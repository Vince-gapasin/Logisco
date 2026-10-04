"use client";

// FORECAST_CACHE_V4: reuse verified forecast data and deduplicate in-flight loads.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Layers,
  CheckCircle2,
  Info,
  ArrowLeft,
  Truck,
  FileText,
  FileSpreadsheet,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Forecasting API response types

export interface ForecastRecord {
  id: string;
  periodStart: string;
  period: string;
  expectedVolume: number;
  actualVolume: number | null;
  variance: number | null;
  variancePercentage: number | null;
  trendStatus: "Above Normal" | "Below Normal" | "Normal" | "In Progress";
  factors: {
    averageTemperature: number | null;
    totalRainfall: number | null;
    rainyDays: number | null;
    averageWindSpeed: number | null;
    averageDieselPrice: number | null;
    averageFuelAdjustment: number | null;
  };
}

interface ForecastSummary {
  expectedVolume: number;
  actualVolume: number;
  totalVariance: number;
  variancePercentage: number;
  trendStatus: string;
  accuracy: {
    method: string;
    evaluatedMonths: number;
    mae: number;
    rmse: number;
    rSquared: number | null;
  };
}

interface ForecastResponse {
  model: string;
  generatedAt: string;
  trainingMonths: number;

  summary: ForecastSummary;

  records: ForecastRecord[];

  yearly: YearlyForecastRecord[];
  monthly: MonthlyForecastRecord[];
  weekly: WeeklyForecastRecord[];
  daily?: DailyForecastRecord[];

  remarks: string[];
  remarksByYear: Record<string, string[]>;
}

interface ForecastSnapshot {
  forecastSnapshotID: string;
  snapshotMonth: string;
  targetPeriod: string;
  expectedVolume: number;
  actualVolume: number | null;
  variance: number | null;
  variancePercentage: number | null;
  absoluteError: number | null;
  model: string;
  evaluatedAt: string | null;
}

interface SnapshotResponse {
  data: ForecastSnapshot[];
  accuracy: {
    evaluatedSnapshots: number;
    mae: number | null;
    rmse: number | null;
    rSquared: number | null;
  };
  message?: string;
}

interface YearlyForecastRecord {
  year: number;
  expectedVolume: number;
  actualVolume: number;
  variance: number;
  variancePercentage: number;
}

interface MonthlyForecastRecord {
  periodStart: string;
  year: number;
  month: number;
  monthName: string;
  expectedVolume: number;
  actualVolume: number;
  variance: number;
  variancePercentage: number;
}

interface WeeklyForecastRecord {
  periodStart: string;
  periodEnd?: string;
  weekOfMonth?: number;
  expectedVolume: number | null;
  actualVolume: number | null;
  variance: number | null;
  variancePercentage: number | null;
}

interface DailyForecastRecord {
  periodStart: string;
  weekStart: string;
  expectedVolume: number;
  actualVolume: number | null;
  variance: number | null;
  variancePercentage: number | null;
}

type StoredAuth = {
  token: string;
  ownerId: string;
};

type ForecastCacheEntry = {
  ownerId: string;
  data: ForecastResponse;
};

type SnapshotCacheEntry = {
  ownerId: string;
  data: ForecastSnapshot[];
};

let forecastCache: ForecastCacheEntry | null = null;
let snapshotCache: SnapshotCacheEntry | null = null;
let forecastRequest: {
  ownerId: string;
  promise: Promise<ForecastResponse>;
} | null = null;
let snapshotRequest: {
  ownerId: string;
  promise: Promise<ForecastSnapshot[]>;
} | null = null;

const TIMEFRAME_OPTIONS = [
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
];

const MONTH_OPTIONS = [
  {
    value: 1,
    label: "January",
  },
  {
    value: 2,
    label: "February",
  },
  {
    value: 3,
    label: "March",
  },
  {
    value: 4,
    label: "April",
  },
  {
    value: 5,
    label: "May",
  },
  {
    value: 6,
    label: "June",
  },
  {
    value: 7,
    label: "July",
  },
  {
    value: 8,
    label: "August",
  },
  {
    value: 9,
    label: "September",
  },
  {
    value: 10,
    label: "October",
  },
  {
    value: 11,
    label: "November",
  },
  {
    value: 12,
    label: "December",
  },
];

type ForecastView = "yearly" | "monthly" | "weekly";
type TrendFilter = "Any" | "Above Normal" | "Normal" | "Below Normal";

type FilterState = {
  view: ForecastView;
  year: string;
  month: number | null;
  week: string | null;
  trend: TrendFilter;
};

const DEFAULT_FILTERS: FilterState = {
  view: "yearly",
  year: TIMEFRAME_OPTIONS[TIMEFRAME_OPTIONS.length - 1],
  month: null,
  week: null,
  trend: "Any",
};

function formatWeekRange(periodStart: string, periodEnd?: string) {
  const start = new Date(`${periodStart.slice(0, 10)}T00:00:00Z`);
  const end = periodEnd
    ? new Date(`${periodEnd.slice(0, 10)}T00:00:00Z`)
    : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const format = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  return `${format(start)} – ${format(end)}`;
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function toDisplayRow(
  id: string,
  periodStart: string,
  period: string,
  expectedVolume: number,
  actualVolume: number | null,
  dayCount?: number,
) {
  const variance =
    actualVolume === null ? null : roundOne(actualVolume - expectedVolume);
  return {
    id,
    periodStart,
    period,
    expectedVolume,
    actualVolume,
    dayCount,
    variance,
    variancePercentage:
      variance === null || expectedVolume === 0
        ? null
        : roundOne((variance / expectedVolume) * 100),
  };
}

const VIEW_OPTIONS: { value: ForecastView; label: string }[] = [
  { value: "yearly", label: "Yearly" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
];

const TREND_OPTIONS: { value: TrendFilter; label: string }[] = [
  { value: "Any", label: "Any" },
  { value: "Above Normal", label: "Above" },
  { value: "Normal", label: "Normal" },
  { value: "Below Normal", label: "Below" },
];

function SegmentedControl<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex w-full overflow-hidden rounded-xl border border-slate-200">
      {options.map((option, index) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`flex-1 min-w-0 px-2 py-3 text-sm transition-colors cursor-pointer ${
              index > 0 ? "border-l border-slate-200" : ""
            } ${
              isActive
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterPill({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={`rounded-full border px-3 py-2.5 text-sm transition-colors cursor-pointer ${
        isActive
          ? "border-blue-200 bg-blue-50 text-blue-700 font-semibold"
          : "border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;

  const storedSession =
    sessionStorage.getItem("logisco_user_session") ??
    localStorage.getItem("logisco_user_session");

  if (!storedSession) return null;

  try {
    const parsedSession = JSON.parse(storedSession) as {
      token?: string;
      id?: string;
    };

    if (!parsedSession.token || !parsedSession.id) return null;

    return {
      token: parsedSession.token,
      ownerId: parsedSession.id,
    };
  } catch {
    return null;
  }
}

function getCachedForecast(): ForecastResponse | null {
  const auth = getStoredAuth();
  if (!auth || forecastCache?.ownerId !== auth.ownerId) return null;
  return forecastCache.data;
}

function getCachedSnapshots(): ForecastSnapshot[] | null {
  const auth = getStoredAuth();
  if (!auth || snapshotCache?.ownerId !== auth.ownerId) return null;
  return snapshotCache.data;
}

async function requestForecast(auth: StoredAuth): Promise<ForecastResponse> {
  if (forecastRequest?.ownerId === auth.ownerId) {
    return forecastRequest.promise;
  }

  const promise = (async () => {
    const response = await fetch("/api/forecasting/data", {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    });
    const body = (await response.json()) as ForecastResponse & {
      message?: string;
    };

    if (!response.ok) {
      throw new Error(body.message ?? "Failed to load forecasting data.");
    }

    forecastCache = { ownerId: auth.ownerId, data: body };
    return body;
  })();

  forecastRequest = { ownerId: auth.ownerId, promise };

  try {
    return await promise;
  } finally {
    if (forecastRequest?.promise === promise) forecastRequest = null;
  }
}

async function requestSnapshots(auth: StoredAuth): Promise<ForecastSnapshot[]> {
  if (snapshotRequest?.ownerId === auth.ownerId) {
    return snapshotRequest.promise;
  }

  const promise = (async () => {
    const response = await fetch("/api/forecasting/snapshots", {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    });
    const body = (await response.json()) as SnapshotResponse;

    if (!response.ok) {
      throw new Error(
        body.message ?? "Failed to load forecast accuracy history.",
      );
    }

    const data = body.data ?? [];
    snapshotCache = { ownerId: auth.ownerId, data };
    return data;
  })();

  snapshotRequest = { ownerId: auth.ownerId, promise };

  try {
    return await promise;
  } finally {
    if (snapshotRequest?.promise === promise) snapshotRequest = null;
  }
}

function formatMonth(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

type RemarkRow = {
  period: string;
  expectedVolume: number;
  actualVolume: number | null;
  dayCount?: number;
};

function countDays(periodStart: string, periodEnd?: string) {
  if (!periodEnd) return undefined;
  const start = Date.parse(`${periodStart.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${periodEnd.slice(0, 10)}T00:00:00Z`);
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

function pluralize(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatSignedPercent(actual: number, expected: number) {
  if (expected === 0) return "no forecast to compare";
  const percentage = ((actual - expected) / expected) * 100;
  return `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`;
}

// Builds the remarks from exactly what the filters are showing, so they
// change with the view, year, month, week and trend status.
function buildFilterRemarks({
  rows,
  totalRowCount,
  scopeLabel,
  unit,
  trendFilter,
  scopeMonths,
}: {
  rows: RemarkRow[];
  totalRowCount: number;
  scopeLabel: string;
  unit: string;
  trendFilter: TrendFilter;
  scopeMonths: ForecastRecord[];
}): string[] {
  const remarks: string[] = [];
  const scopeTitle = scopeLabel.charAt(0).toUpperCase() + scopeLabel.slice(1);
  const completed = rows.filter(
    (row): row is RemarkRow & { actualVolume: number } =>
      row.actualVolume !== null,
  );
  const pendingCount = rows.length - completed.length;

  if (trendFilter !== "Any") {
    remarks.push(
      `Showing only ${trendFilter} ${unit}s: ${rows.length} of ${totalRowCount} ${unit}s in ${scopeLabel} match.`,
    );
  }

  if (rows.length === 0) {
    remarks.push(`No ${unit}s in ${scopeLabel} match the selected filters.`);
    return remarks;
  }

  if (completed.length === 0) {
    remarks.push(
      `${scopeTitle} has no completed deliveries yet. ${pluralize(pendingCount, unit)} still in progress, with ${formatNumber(
        rows.reduce((sum, row) => sum + row.expectedVolume, 0),
      )} deliveries forecast.`,
    );
  } else {
    const actual = completed.reduce((sum, row) => sum + row.actualVolume, 0);
    const expected = completed.reduce((sum, row) => sum + row.expectedVolume, 0);
    const status = overallTrendStatus(expected, actual);
    remarks.push(
      `${scopeTitle}: ${formatNumber(actual)} completed deliveries against a forecast of ${formatNumber(
        expected,
      )} (${formatSignedPercent(actual, expected)}), which is ${status.toLowerCase()}.` +
        (pendingCount > 0
          ? ` ${pluralize(pendingCount, unit)} still in progress.`
          : ""),
    );
  }

  if (completed.length >= 2) {
    const largestGap = [...completed].sort(
      (a, b) =>
        Math.abs(b.actualVolume - b.expectedVolume) -
        Math.abs(a.actualVolume - a.expectedVolume),
    )[0];
    const gap = largestGap.actualVolume - largestGap.expectedVolume;
    if (gap !== 0) {
      remarks.push(
        `${largestGap.period} had the largest gap: ${formatNumber(
          largestGap.actualVolume,
        )} delivered vs ${formatNumber(largestGap.expectedVolume)} forecast (${formatSignedPercent(
          largestGap.actualVolume,
          largestGap.expectedVolume,
        )}).`,
      );
    }
  }

  // Short end-of-month weeks (e.g. the 29th–31st) would always look like the
  // slowest week, so only full weeks are compared against each other.
  const comparable = completed.filter(
    (row) => unit !== "week" || (row.dayCount ?? 7) >= 7,
  );

  if (comparable.length >= 2) {
    const peak = [...comparable].sort((a, b) => b.actualVolume - a.actualVolume)[0];
    const low = [...comparable].sort((a, b) => a.actualVolume - b.actualVolume)[0];
    if (peak.actualVolume !== low.actualVolume) {
      remarks.push(
        `Busiest ${unit} was ${peak.period} with ${formatNumber(
          peak.actualVolume,
        )} deliveries; the slowest was ${low.period} with ${formatNumber(low.actualVolume)}.`,
      );
    }

    const latest = comparable[comparable.length - 1];
    const previous = comparable[comparable.length - 2];
    const change = latest.actualVolume - previous.actualVolume;
    remarks.push(
      change === 0
        ? `Deliveries held steady at ${formatNumber(latest.actualVolume)} from ${previous.period} to ${latest.period}.`
        : `Deliveries ${change > 0 ? "rose" : "fell"} from ${formatNumber(
            previous.actualVolume,
          )} in ${previous.period} to ${formatNumber(latest.actualVolume)} in ${latest.period}.`,
    );
  }

  const weatherMonths = scopeMonths.filter(
    (record) => record.factors.totalRainfall !== null,
  );
  if (weatherMonths.length === 1) {
    const month = weatherMonths[0];
    remarks.push(
      `Weather in ${month.period}: ${month.factors.totalRainfall?.toFixed(1)} mm of rain over ${Math.round(
        month.factors.rainyDays ?? 0,
      )} rainy days` +
        (month.factors.averageTemperature !== null
          ? `, averaging ${month.factors.averageTemperature.toFixed(1)}°C.`
          : "."),
    );
  } else if (weatherMonths.length > 1) {
    const wettest = [...weatherMonths].sort(
      (a, b) => (b.factors.totalRainfall ?? 0) - (a.factors.totalRainfall ?? 0),
    )[0];
    if ((wettest.factors.totalRainfall ?? 0) > 0) {
      remarks.push(
        `Wettest month in ${scopeLabel} was ${wettest.period} with ${wettest.factors.totalRainfall?.toFixed(
          1,
        )} mm of rain over ${Math.round(wettest.factors.rainyDays ?? 0)} rainy days` +
          (wettest.actualVolume !== null
            ? `; ${formatNumber(wettest.actualVolume)} deliveries were completed vs ${formatNumber(
                wettest.expectedVolume,
              )} forecast.`
            : "."),
      );
    }
  }

  const dieselPrices = scopeMonths
    .map((record) => record.factors.averageDieselPrice)
    .filter((price): price is number => price !== null);
  if (dieselPrices.length > 0) {
    const averageDiesel =
      dieselPrices.reduce((sum, price) => sum + price, 0) / dieselPrices.length;
    remarks.push(
      `Average NCR diesel price for ${scopeLabel}: ₱${averageDiesel.toFixed(2)} per liter.`,
    );
  }

  return remarks;
}

// Overall status for a whole period (summary card, remarks, PDF): more than
// 5% above or below the forecast.
function overallTrendStatus(expected: number, actual: number) {
  const percentage = expected === 0 ? 0 : ((actual - expected) / expected) * 100;
  return percentage > 5
    ? "Above Normal"
    : percentage < -5
      ? "Below Normal"
      : "Normal";
}

// jsPDF's built-in fonts only cover basic Latin characters, so symbols like
// the peso sign or en dash are swapped for plain equivalents in the PDF.
function toPdfText(value: string) {
  return value
    .replace(/₱/g, "PHP ")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function toFileSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function calculateMetrics(expected: number, actual: number | null) {
  if (actual === null) {
    return {
      variance: "Pending",
      varianceVal: 0,
      status: "In Progress",
      statusClass: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }

  const diff = roundOne(actual - expected);
  const percentage = ((diff / expected) * 100).toFixed(1);
  const sign = diff > 0 ? "+" : "";
  const varianceStr = `${sign}${diff} (${sign}${percentage}%)`;

  // Same +/-5% rule as the Trend Status card, the remarks and the server.
  const ratio = diff / expected;
  if (ratio > 0.05) {
    return {
      variance: varianceStr,
      varianceVal: diff,
      status: "Above Normal",
      statusClass: "bg-[#dbeafe] text-[#1e40af] border-blue-200",
    };
  } else if (ratio < -0.05) {
    return {
      variance: varianceStr,
      varianceVal: diff,
      status: "Below Normal",
      statusClass: "bg-[#fef3c7] text-[#92400e] border-amber-200",
    };
  } else {
    return {
      variance: varianceStr,
      varianceVal: diff,
      status: "Normal",
      statusClass: "bg-[#d1fae5] text-[#065f46] border-emerald-200",
    };
  }
}

export default function ForecastingPage() {
  const showToast = useToast();
  const [forecast, setForecast] = useState<ForecastResponse | null>(() =>
    getCachedForecast(),
  );
  const [snapshots, setSnapshots] = useState<ForecastSnapshot[]>(() =>
    getCachedSnapshots() ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => !getCachedForecast());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(
    () => !getCachedSnapshots(),
  );
  const [snapshotLoadError, setSnapshotLoadError] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState(
    TIMEFRAME_OPTIONS[TIMEFRAME_OPTIONS.length - 1],
  );

const [forecastView, setForecastView] = useState<
  "yearly" | "monthly" | "weekly"
>("yearly");

const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const [trendFilter, setTrendFilter] = useState<TrendFilter>("Any");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const activeFilterCount =
    (forecastView !== DEFAULT_FILTERS.view ? 1 : 0) +
    (selectedYear !== DEFAULT_FILTERS.year ? 1 : 0) +
    (selectedMonth !== null ? 1 : 0) +
    (selectedWeek !== null ? 1 : 0) +
    (trendFilter !== "Any" ? 1 : 0);

  const openFilters = () => {
    setDraftFilters({
      view: forecastView,
      year: selectedYear,
      month: selectedMonth,
      week: selectedWeek,
      trend: trendFilter,
    });
    setIsFilterOpen(true);
  };

  const applyFilters = () => {
    setForecastView(draftFilters.view);
    setSelectedYear(draftFilters.year);
    setSelectedMonth(draftFilters.view === "yearly" ? null : draftFilters.month);
    setSelectedWeek(draftFilters.view === "weekly" ? draftFilters.week : null);
    setTrendFilter(draftFilters.trend);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
  };
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel">("pdf");
  const [isExporting, setIsExporting] = useState(false);

  const loadForecast = useCallback(async () => {
    const cachedForecast = getCachedForecast();
    if (cachedForecast) {
      setForecast(cachedForecast);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);

    try {
      const auth = getStoredAuth();
      if (!auth) {
        throw new Error("Authentication session was not found. Please log in again.");
      }

      setForecast(await requestForecast(auth));
    } catch (error) {
      if (!cachedForecast) {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load forecasting data.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);


  // Initial load. State is only set inside the promise callbacks (never
  // directly in the effect body), so the first render uses the cached data
  // from the useState initializers and this just refreshes it.
  // loadForecast remains for the "Try Again" button.
  useEffect(() => {
    let active = true;

    const auth = getStoredAuth();

    (auth
      ? requestForecast(auth)
      : Promise.reject(
          new Error("Authentication session was not found. Please log in again."),
        )
    )
      .then((data) => {
        if (!active) return;
        setForecast(data);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!active || getCachedForecast()) return;
        setLoadError(
          error instanceof Error ? error.message : "Failed to load forecasting data.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    if (auth) {
      requestSnapshots(auth)
        .then((data) => {
          if (!active) return;
          setSnapshots(data);
          setSnapshotLoadError(null);
        })
        .catch((error: unknown) => {
          if (!active || getCachedSnapshots()) return;
          setSnapshotLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load forecast accuracy history.",
          );
        })
        .finally(() => {
          if (active) setIsSnapshotLoading(false);
        });
    } else {
      Promise.resolve().then(() => {
        if (active) setIsSnapshotLoading(false);
      });
    }

    return () => {
      active = false;
    };
  }, []);

  const baseRecords = useMemo(() => {
    if (!forecast) return [];

    if (forecastView === "yearly") {
      return forecast.yearly.map((item) => ({
        id: `year-${item.year}`,
        periodStart: `${item.year}-01-01`,
        // The current year only has its completed months so far.
        period:
          item.year === new Date().getFullYear()
            ? `${item.year} (year to date)`
            : String(item.year),
        expectedVolume: item.expectedVolume,
        actualVolume: item.actualVolume,
        variance: item.variance,
        variancePercentage: item.variancePercentage,
        trendStatus:
          item.variance > 0
            ? "Above Normal"
            : item.variance < 0
            ? "Below Normal"
            : "Normal",
        factors: {
          averageTemperature: null,
          totalRainfall: null,
          rainyDays: null,
          averageWindSpeed: null,
          averageDieselPrice: null,
          averageFuelAdjustment: null,
        },
      }));
    }

    if (forecastView === "monthly") {
      return forecast.monthly
        .filter((item) => item.year === Number(selectedYear))
        .map((item) => ({
          id: `month-${item.periodStart}`,
          periodStart: item.periodStart,
          period: item.monthName,
          expectedVolume: item.expectedVolume,
          actualVolume: item.actualVolume,
          variance: item.variance,
          variancePercentage: item.variancePercentage,
          trendStatus:
            item.variance > 0
              ? "Above Normal"
              : item.variance < 0
              ? "Below Normal"
              : "Normal",
          factors: {
            averageTemperature: null,
            totalRainfall: null,
            rainyDays: null,
            averageWindSpeed: null,
            averageDieselPrice: null,
            averageFuelAdjustment: null,
          },
        }));
    }
  

    return forecast.weekly
      .filter((item) =>
        item.periodStart.startsWith(String(selectedYear))
      )
      .map((item) => ({
        id: `week-${item.periodStart}`,
        periodStart: item.periodStart,
        period: formatWeekRange(item.periodStart, item.periodEnd),
        dayCount: countDays(item.periodStart, item.periodEnd),
        expectedVolume: item.expectedVolume ?? 0,
        actualVolume: item.actualVolume,
        variance: item.variance ?? 0,
        variancePercentage: item.variancePercentage ?? 0,
        trendStatus:
          (item.variance ?? 0) > 0
            ? "Above Normal"
            : (item.variance ?? 0) < 0
            ? "Below Normal"
            : "Normal",
        factors: {
          averageTemperature: null,
          totalRainfall: null,
          rainyDays: null,
          averageWindSpeed: null,
          averageDieselPrice: null,
          averageFuelAdjustment: null,
        },
      }));

  }, [
    forecast,
    forecastView,
    selectedYear,
  ]);

  const getRecordMonth = (record: { periodStart: string }) =>
    Number(record.periodStart.slice(5, 7));

  // Table + summary cards: narrowed to the selected month / week.
  const filteredRecords = useMemo(
    () =>
      baseRecords.filter((record) => {
        if (
          forecastView !== "yearly" &&
          selectedMonth !== null &&
          getRecordMonth(record) !== selectedMonth
        ) {
          return false;
        }
        if (
          forecastView === "weekly" &&
          selectedWeek !== null &&
          record.periodStart.slice(0, 10) !== selectedWeek
        ) {
          return false;
        }
        return true;
      }),
    [baseRecords, forecastView, selectedMonth, selectedWeek],
  );

  // When a single month or week is picked, drill down one level so the
  // chart and table still show a trend: a month shows its weeks, a week
  // shows its days.
  const displayRecords = useMemo(() => {
    if (!forecast) return filteredRecords;

    if (forecastView === "monthly" && selectedMonth !== null) {
      const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
      return forecast.weekly
        .filter((item) => item.periodStart.startsWith(monthPrefix))
        .map((item) =>
          toDisplayRow(
            `month-week-${item.periodStart}`,
            item.periodStart,
            formatWeekRange(item.periodStart, item.periodEnd),
            item.expectedVolume ?? 0,
            item.actualVolume,
            countDays(item.periodStart, item.periodEnd),
          ),
        );
    }

    if (forecastView === "weekly" && selectedWeek !== null) {
      return (forecast.daily ?? [])
        .filter((item) => item.weekStart === selectedWeek)
        .map((item) =>
          toDisplayRow(
            `day-${item.periodStart}`,
            item.periodStart,
            formatDay(item.periodStart),
            item.expectedVolume,
            item.actualVolume,
          ),
        );
    }

    return filteredRecords;
  }, [forecast, filteredRecords, forecastView, selectedYear, selectedMonth, selectedWeek]);

  const breakdownLabel =
    forecastView === "monthly" && selectedMonth !== null
      ? `Weekly breakdown · ${MONTH_OPTIONS[selectedMonth - 1].label} ${selectedYear}`
      : forecastView === "weekly" && selectedWeek !== null
        ? `Daily breakdown · ${
            filteredRecords[0]?.period ?? formatWeekRange(selectedWeek)
          }, ${selectedYear}`
        : null;

  const visibleRecords = useMemo(
    () =>
      trendFilter === "Any"
        ? displayRecords
        : displayRecords.filter(
            (record) =>
              calculateMetrics(record.expectedVolume, record.actualVolume)
                .status === trendFilter,
          ),
    [displayRecords, trendFilter],
  );

  const chartRecords = visibleRecords;

  // Forecast History table (also used by the PDF and Excel exports):
  // newest period first, and only periods that have already started, so the
  // current year never shows future months/weeks/days. Because this uses
  // today's date, a new month or week appears automatically once it begins.
  const historyRecords = useMemo(() => {
    if (forecastView === "yearly") {
      return [...visibleRecords].sort((a, b) =>
        b.periodStart.localeCompare(a.periodStart),
      );
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;

    return visibleRecords
      .filter((record) => record.periodStart.slice(0, 10) <= todayKey)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  }, [visibleRecords, forecastView]);
  const evaluatedSnapshots = useMemo(
    () =>
      snapshots.filter(
        (snapshot) =>
          snapshot.targetPeriod.startsWith(selectedYear) &&
          snapshot.evaluatedAt !== null &&
          snapshot.actualVolume !== null,
      ),
    [snapshots, selectedYear],
  );
  const snapshotAccuracy = useMemo(() => {
    if (evaluatedSnapshots.length === 0) {
      return { mae: null, rmse: null, rSquared: null };
    }

    const errors = evaluatedSnapshots.map(
      (snapshot) =>
        Number(snapshot.actualVolume) - Number(snapshot.expectedVolume),
    );
    const actualValues = evaluatedSnapshots.map((snapshot) =>
      Number(snapshot.actualVolume),
    );
    const mae =
      errors.reduce((sum, error) => sum + Math.abs(error), 0) /
      errors.length;
    const rmse = Math.sqrt(
      errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length,
    );
    const actualMean =
      actualValues.reduce((sum, value) => sum + value, 0) /
      actualValues.length;
    const residualSum = errors.reduce(
      (sum, error) => sum + error ** 2,
      0,
    );
    const totalSum = actualValues.reduce(
      (sum, value) => sum + (value - actualMean) ** 2,
      0,
    );

    return {
      mae: Number(mae.toFixed(2)),
      rmse: Number(rmse.toFixed(2)),
      rSquared:
        actualValues.length < 2 || totalSum === 0
          ? null
          : Number((1 - residualSum / totalSum).toFixed(4)),
    };
  }, [evaluatedSnapshots]);
  const completedRecords = visibleRecords.filter(
    (record) => record.actualVolume !== null,
  );
  const expectedVolume = roundOne(
    completedRecords.reduce((sum, record) => sum + record.expectedVolume, 0),
  );
  const actualVolume = completedRecords.reduce(
    (sum, record) => sum + (record.actualVolume ?? 0),
    0,
  );
  const totalVariance = roundOne(actualVolume - expectedVolume);
  const variancePercentage =
    expectedVolume === 0 ? 0 : (totalVariance / expectedVolume) * 100;
  const selectedTrendStatus =
    completedRecords.length === 0
      ? "No data yet"
      : overallTrendStatus(expectedVolume, actualVolume);

  // Card colors follow the status (same colors as the table's status badges).
  const trendCardStyle =
    selectedTrendStatus === "Above Normal"
      ? {
          card: "bg-blue-50/60 border-blue-100",
          iconWrap: "bg-blue-100",
          icon: "text-blue-600",
          label: "text-blue-700",
          value: "text-blue-900",
          Icon: TrendingUp,
        }
      : selectedTrendStatus === "Below Normal"
        ? {
            card: "bg-amber-50/60 border-amber-100",
            iconWrap: "bg-amber-100",
            icon: "text-amber-600",
            label: "text-amber-700",
            value: "text-amber-900",
            Icon: TrendingDown,
          }
        : selectedTrendStatus === "Normal"
          ? {
              card: "bg-emerald-50/50 border-emerald-100",
              iconWrap: "bg-emerald-100",
              icon: "text-emerald-600",
              label: "text-emerald-700",
              value: "text-emerald-900",
              Icon: CheckCircle2,
            }
          : {
              card: "bg-slate-50 border-slate-100",
              iconWrap: "bg-slate-100",
              icon: "text-slate-500",
              label: "text-slate-600",
              value: "text-slate-700",
              Icon: Info,
            };
  const TrendIcon = trendCardStyle.Icon;

  const summary = forecast?.summary;
  const selectedMonthName =
    selectedMonth !== null ? MONTH_OPTIONS[selectedMonth - 1].label : null;
  const selectedWeekLabel =
    selectedWeek !== null
      ? filteredRecords[0]?.period ?? formatWeekRange(selectedWeek)
      : null;

  const remarkScopeLabel =
    forecastView === "yearly"
      ? `${TIMEFRAME_OPTIONS[0]}–${TIMEFRAME_OPTIONS[TIMEFRAME_OPTIONS.length - 1]}`
      : forecastView === "weekly" && selectedWeekLabel
        ? `the week of ${selectedWeekLabel}, ${selectedYear}`
        : selectedMonthName
          ? `${selectedMonthName} ${selectedYear}`
          : selectedYear;

  const remarkUnit =
    forecastView === "yearly"
      ? "year"
      : forecastView === "monthly"
        ? selectedMonth !== null
          ? "week"
          : "month"
        : selectedWeek !== null
          ? "day"
          : "week";

  const remarkMonthPrefix =
    forecastView === "yearly"
      ? ""
      : forecastView === "weekly" && selectedWeek !== null
        ? selectedWeek.slice(0, 7)
        : selectedMonth !== null
          ? `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`
          : selectedYear;

  const displayedRemarks = forecast
    ? buildFilterRemarks({
        rows: visibleRecords,
        totalRowCount: displayRecords.length,
        scopeLabel: remarkScopeLabel,
        unit: remarkUnit,
        trendFilter,
        scopeMonths: forecast.records.filter((record) =>
          record.periodStart.startsWith(remarkMonthPrefix),
        ),
      })
    : [];

  const formattedVariance = `${totalVariance >= 0 ? "+" : ""}${totalVariance.toLocaleString()} (${variancePercentage >= 0 ? "+" : ""}${variancePercentage.toFixed(1)}%)`;

  const handleExcelExport = () => {
    if (!historyRecords.length || !forecast || !summary) return;

    const csvRows = [
      ["Delivery Forecast Report"],
      ["Report Period", reportScopeTitle],
      ["View", breakdownLabel ? `${viewLabel} (${breakdownLabel})` : viewLabel],
      ["Trend Status Filter", trendFilter === "Any" ? "All periods" : `${trendFilter} only`],
      [],
      ["Remarks"],
      ...displayedRemarks.map((remark, index) => [`${index + 1}.`, remark]),
      [],
      ["Period", "Expected Volume", "Actual Volume", "Variance", "Variance %", "Trend Status"],
      ...historyRecords.map((row) => [
        row.period,
        row.expectedVolume,
        row.actualVolume ?? "",
        row.variance ?? "",
        row.variancePercentage ?? "",
        calculateMetrics(row.expectedVolume, row.actualVolume).status,
      ]),
    ];
    const csv = csvRows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `forecast-table-${toFileSlug(remarkScopeLabel)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  const reportScopeTitle =
    remarkScopeLabel.charAt(0).toUpperCase() + remarkScopeLabel.slice(1);
  const viewLabel =
    forecastView === "yearly"
      ? "Yearly"
      : forecastView === "monthly"
        ? "Monthly"
        : "Weekly";

  /*
    Builds a real A4 report (text and tables), not a screenshot. Only the
    chart is captured as an image. Everything follows the current filters.
  */
  const handlePdfExport = async () => {
    if (!forecast || !summary) return;

    setIsExporting(true);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      const bottomLimit = pageHeight - 18;
      let y = margin;

      const colors = {
        ink: [15, 23, 42] as const,
        muted: [100, 116, 139] as const,
        line: [226, 232, 240] as const,
        panel: [248, 250, 252] as const,
        blue: [29, 78, 216] as const,
        green: [4, 120, 87] as const,
        amber: [180, 83, 9] as const,
      };
      type Color = readonly [number, number, number];

      const setText = (color: Color, size: number, style: "normal" | "bold" = "normal") => {
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.setFontSize(size);
        pdf.setFont("helvetica", style);
      };

      const ensureSpace = (height: number) => {
        if (y + height > bottomLimit) {
          pdf.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // keepWithNext: room the content after the heading needs, so a heading
      // is never left alone at the bottom of a page.
      const sectionTitle = (title: string, subtitle?: string, keepWithNext = 20) => {
        ensureSpace((subtitle ? 16 : 11) + keepWithNext);
        y += 3;
        setText(colors.ink, 12, "bold");
        pdf.text(toPdfText(title), margin, y);
        y += 5;
        if (subtitle) {
          setText(colors.muted, 8.5);
          pdf.text(toPdfText(subtitle), margin, y);
          y += 5;
        }
        y += 1;
      };

      const statusColor = (status: string): Color =>
        status === "Above Normal"
          ? colors.blue
          : status === "Below Normal"
            ? colors.amber
            : status === "Normal"
              ? colors.green
              : colors.muted;

      const drawTable = (
        columns: Array<{ header: string; width: number; align?: "left" | "right" }>,
        rows: string[][],
        statusColumn?: number,
      ) => {
        const headerHeight = 7;
        const rowHeight = 6.5;

        const drawHeader = () => {
          pdf.setFillColor(241, 245, 249);
          pdf.rect(margin, y, contentWidth, headerHeight, "F");
          setText(colors.muted, 7.5, "bold");
          let x = margin;
          for (const column of columns) {
            const textX = column.align === "right" ? x + column.width - 2 : x + 2;
            pdf.text(column.header.toUpperCase(), textX, y + 4.7, {
              align: column.align === "right" ? "right" : "left",
            });
            x += column.width;
          }
          y += headerHeight;
        };

        ensureSpace(headerHeight + rowHeight);
        drawHeader();

        rows.forEach((row, rowIndex) => {
          if (ensureSpace(rowHeight)) drawHeader();

          if (rowIndex % 2 === 1) {
            pdf.setFillColor(colors.panel[0], colors.panel[1], colors.panel[2]);
            pdf.rect(margin, y, contentWidth, rowHeight, "F");
          }

          let x = margin;
          row.forEach((cell, cellIndex) => {
            const column = columns[cellIndex];
            const isStatus = cellIndex === statusColumn;
            setText(isStatus ? statusColor(cell) : colors.ink, 8.5, isStatus ? "bold" : "normal");
            const textX = column.align === "right" ? x + column.width - 2 : x + 2;
            pdf.text(toPdfText(cell), textX, y + 4.4, {
              align: column.align === "right" ? "right" : "left",
            });
            x += column.width;
          });

          pdf.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
          pdf.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
          y += rowHeight;
        });

        y += 4;
      };

      const formatCount = (value: number) =>
        value.toLocaleString("en-US", { maximumFractionDigits: 1 });

      // ---- Header ----
      setText(colors.ink, 18, "bold");
      pdf.text("Delivery Forecast Report", margin, y + 4);
      setText(colors.muted, 9);
      pdf.text("Logisco - Forecasting", margin, y + 10);
      pdf.text(
        `Generated ${new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date())}`,
        pageWidth - margin,
        y + 4,
        { align: "right" },
      );
      y += 15;
      pdf.setDrawColor(colors.blue[0], colors.blue[1], colors.blue[2]);
      pdf.setLineWidth(0.6);
      pdf.line(margin, y, pageWidth - margin, y);
      pdf.setLineWidth(0.2);
      y += 6;

      // ---- Report scope ----
      const scopeRows: Array<[string, string]> = [
        ["Report period", reportScopeTitle],
        ["View", breakdownLabel ? `${viewLabel} (${breakdownLabel})` : viewLabel],
        ["Trend status filter", trendFilter === "Any" ? "All periods" : `${trendFilter} only`],
      ];
      const scopeHeight = scopeRows.length * 5.5 + 5;
      pdf.setFillColor(colors.panel[0], colors.panel[1], colors.panel[2]);
      pdf.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
      pdf.roundedRect(margin, y, contentWidth, scopeHeight, 2, 2, "FD");
      let scopeY = y + 6;
      for (const [label, value] of scopeRows) {
        setText(colors.muted, 8.5);
        pdf.text(label, margin + 4, scopeY);
        setText(colors.ink, 8.5, "bold");
        pdf.text(toPdfText(value), margin + 42, scopeY, { maxWidth: contentWidth - 46 });
        scopeY += 5.5;
      }
      y += scopeHeight + 6;

      // ---- Summary cards ----
      const cards: Array<[string, string, Color]> = [
        ["Expected deliveries", formatCount(expectedVolume), colors.ink],
        ["Actual deliveries", formatCount(actualVolume), colors.ink],
        ["Total variance", formattedVariance, colors.ink],
        ["Trend status", selectedTrendStatus, statusColor(selectedTrendStatus)],
      ];
      const gap = 4;
      const cardWidth = (contentWidth - gap * 3) / 4;
      cards.forEach(([label, value, color], index) => {
        const x = margin + index * (cardWidth + gap);
        pdf.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(x, y, cardWidth, 18, 2, 2, "FD");
        setText(colors.muted, 7, "bold");
        pdf.text(label.toUpperCase(), x + 3, y + 6);
        setText(color, 12, "bold");
        pdf.text(toPdfText(value), x + 3, y + 13.5, { maxWidth: cardWidth - 6 });
      });
      y += 22;
      setText(colors.muted, 7.5);
      pdf.text(
        "Totals include completed periods only; periods still in progress are left out.",
        margin,
        y,
      );
      y += 4;

      // ---- Chart ----
      sectionTitle(
        "Forecast vs Actual Trend",
        breakdownLabel ?? `${viewLabel} view - ${reportScopeTitle}`,
        60,
      );
      const chartElement = document.getElementById("forecast-chart");
      if (chartElement && chartRecords.length > 0) {
        const chartCanvas = await html2canvas(chartElement, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const chartHeight = Math.min(
          85,
          (chartCanvas.height * contentWidth) / chartCanvas.width,
        );
        const chartWidth = (chartCanvas.width * chartHeight) / chartCanvas.height;
        ensureSpace(chartHeight + 4);
        pdf.addImage(
          chartCanvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          margin + (contentWidth - chartWidth) / 2,
          y,
          chartWidth,
          chartHeight,
        );
        y += chartHeight + 4;
      } else {
        setText(colors.muted, 9);
        pdf.text("No chart data for this selection.", margin, y + 2);
        y += 8;
      }

      // ---- Remarks (all of them, as text) ----
      sectionTitle("Forecasting Remarks", `Based only on ${remarkScopeLabel}`);
      if (displayedRemarks.length === 0) {
        setText(colors.muted, 9);
        pdf.text("No remarks for this selection.", margin, y + 2);
        y += 8;
      } else {
        displayedRemarks.forEach((remark, index) => {
          setText(colors.ink, 9.5);
          const lines: string[] = pdf.splitTextToSize(toPdfText(remark), contentWidth - 8);
          const blockHeight = lines.length * 4.6 + 2.5;
          ensureSpace(blockHeight);
          setText(colors.blue, 9.5, "bold");
          pdf.text(`${index + 1}.`, margin, y + 3.5);
          setText(colors.ink, 9.5);
          pdf.text(lines, margin + 7, y + 3.5, { lineHeightFactor: 1.35 });
          y += blockHeight;
        });
        y += 2;
      }

      // ---- Forecast history table ----
      sectionTitle(
        "Forecast History",
        `${historyRecords.length} ${remarkUnit}${historyRecords.length === 1 ? "" : "s"} - ${reportScopeTitle}`,
        7 + 6.5 * Math.min(historyRecords.length, 3),
      );
      if (historyRecords.length === 0) {
        setText(colors.muted, 9);
        pdf.text("No forecasting records match these filters.", margin, y + 2);
        y += 8;
      } else {
        drawTable(
          [
            { header: "Period", width: 52 },
            { header: "Expected", width: 26, align: "right" },
            { header: "Actual", width: 26, align: "right" },
            { header: "Variance", width: 44, align: "right" },
            { header: "Trend status", width: 32 },
          ],
          historyRecords.map((row) => {
            const metrics = calculateMetrics(row.expectedVolume, row.actualVolume);
            return [
              row.period,
              formatCount(row.expectedVolume),
              row.actualVolume === null ? "-" : formatCount(row.actualVolume),
              metrics.variance,
              metrics.status,
            ];
          }),
          4,
        );
      }

      // ---- Notes (kept together on one page) ----
      const notes = [
        "Expected deliveries are forecasts based on past delivery volumes and seasonal patterns.",
        forecastView !== "yearly"
          ? "Weekly and daily expected deliveries are estimates and may differ more from actual volumes than monthly figures."
          : null,
        "Periods marked In Progress have not finished yet and are not included in the totals.",
      ].filter((note): note is string => note !== null);
      setText(colors.muted, 8.5);
      const noteLines: string[][] = notes.map((note) =>
        pdf.splitTextToSize(toPdfText(note), contentWidth - 5),
      );
      sectionTitle(
        "Notes",
        undefined,
        noteLines.reduce((sum, lines) => sum + lines.length * 4 + 1.5, 0),
      );
      noteLines.forEach((lines) => {
        setText(colors.muted, 8.5);
        pdf.text("-", margin, y + 3);
        pdf.text(lines, margin + 4, y + 3, { lineHeightFactor: 1.3 });
        y += lines.length * 4 + 1.5;
      });

      // ---- Footer on every page ----
      const totalPages = pdf.getNumberOfPages();
      for (let page = 1; page <= totalPages; page++) {
        pdf.setPage(page);
        pdf.setDrawColor(colors.line[0], colors.line[1], colors.line[2]);
        pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
        setText(colors.muted, 7.5);
        pdf.text(
          toPdfText(`Logisco - Delivery Forecast Report - ${reportScopeTitle}`),
          margin,
          pageHeight - 7.5,
        );
        pdf.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 7.5, {
          align: "right",
        });
      }

      pdf.save(`forecast-report-${toFileSlug(remarkScopeLabel)}.pdf`);
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("PDF export failed:", error);
      showToast("The PDF could not be generated. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmedExport = async () => {
    if (exportFormat === "pdf") {
      await handlePdfExport();
    } else {
      handleExcelExport();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Loading forecasting data…
      </div>
    );
  }

  if (loadError || !forecast || !summary) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="font-semibold text-red-700">Unable to load forecasting data</h2>
          <p className="mt-2 text-sm text-red-600">{loadError}</p>
          <button onClick={() => void loadForecast()} className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const draftWeekOptions =
    draftFilters.view === "weekly" && draftFilters.month !== null
      ? forecast.weekly
          .filter(
            (item) =>
              item.periodStart.startsWith(draftFilters.year) &&
              Number(item.periodStart.slice(5, 7)) === draftFilters.month,
          )
          .map((item) => ({
            periodStart: item.periodStart.slice(0, 10),
            periodEnd: item.periodEnd,
          }))
          .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
      : [];

  return (
    <div id="forecast-report" className="flex min-h-[100dvh] w-full bg-slate-50 font-sans relative">
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }

          body {
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          #forecast-report {
            background: white !important;
          }

          #forecast-report main {
            max-width: none !important;
            padding: 0 !important;
          }

          #forecast-report .overflow-y-auto,
          #forecast-report .overflow-x-auto {
            max-height: none !important;
            overflow: visible !important;
          }

          #forecast-report table {
            min-width: 0 !important;
          }
        }
      `}</style>
      
      <div className="flex flex-col flex-1 w-full">
        <main id="forecast-report-content" className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
          <div className="space-y-6">
            {/* PAGE TITLE & ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Forecasting
                </h1>
                </div>
            

              {/* Action Buttons Container */}
              <div
                className="flex flex-wrap items-center gap-2 sm:gap-3 print:hidden"
                data-html2canvas-ignore="true"
              >
                <Link
                  href="/admindashboard/reports"
                  className="w-auto sm:w-auto h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-700 hover:bg-black text-white font-semibold rounded-lg sm:rounded-xl border border-slate-200 shadow-sm transition-all duration-200 text-xs sm:text-sm px-4 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0 text-white" />
                  <span>Back to Reports</span>
                </Link>

                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-700 hover:bg-black text-white font-semibold rounded-lg sm:rounded-xl shadow-md transition-all text-xs sm:text-sm px-4 cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Export Report</span>
                  </button>

                  <button
                    onClick={openFilters}
                    aria-label="Open filters"
                    className="relative w-9 sm:w-11 h-9 sm:h-11 inline-flex items-center justify-center bg-white border border-slate-200 rounded-lg sm:rounded-xl shadow-sm hover:border-blue-400 transition-all cursor-pointer px-3"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* SUMMARY CARDS SECTION - two by two on a phone, short labels, so
                the four numbers are read together instead of one per screen. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mt-6">
              {/* Expected Volume */}
              <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2.5 sm:gap-4">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 sm:w-6 sm:h-6 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <span className="sm:hidden">Expected</span>
                    <span className="hidden sm:inline">Expected Delivery Volume</span>
                  </p>
                  <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 leading-tight">
                    {expectedVolume.toLocaleString()}
                  </h3>
                </div>
              </div>

              {/* Actual Volume */}
              <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2.5 sm:gap-4">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <span className="sm:hidden">Actual</span>
                    <span className="hidden sm:inline">Actual Delivery Volume</span>
                  </p>
                  <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 leading-tight">
                    {actualVolume.toLocaleString()}
                  </h3>
                </div>
              </div>

              {/* Total Variance */}
              <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2.5 sm:gap-4">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-indigo-900" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <span className="sm:hidden">Variance</span>
                    <span className="hidden sm:inline">Total Variance</span>
                  </p>
                  <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 leading-tight">
                    {formattedVariance}
                  </h3>
                </div>
              </div>

              {/* Trend Status */}
              <div className={`${trendCardStyle.card} p-3 sm:p-5 rounded-xl sm:rounded-2xl border shadow-sm flex items-center gap-2.5 sm:gap-4`}>
                <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full ${trendCardStyle.iconWrap} flex items-center justify-center shrink-0`}>
                  <TrendIcon className={`w-4 h-4 sm:w-6 sm:h-6 ${trendCardStyle.icon}`} />
                </div>
                <div>
                  <p className={`text-[10px] sm:text-xs font-semibold ${trendCardStyle.label} uppercase tracking-wider`}>
                    <span className="sm:hidden">Trend</span>
                    <span className="hidden sm:inline">Trend Status</span>
                  </p>
                  <h3 className={`text-base sm:text-xl font-bold ${trendCardStyle.value} mt-0.5 leading-tight`}>
                    {selectedTrendStatus}
                  </h3>
                </div>
              </div>
            </div>

            {/* CHART & REMARKS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              {/* MLR Trend Line Chart */}
              <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                      Forecast vs Actual Trend
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Comparison between predicted expectations and completed
                      actuals
                    </p>
                    {breakdownLabel && (
                      <p className="mt-1.5 inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {breakdownLabel}
                      </p>
                    )}
                  </div>
              </div>

                {/* Recharts Container */}
                <div id="forecast-chart" className="w-full h-72 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartRecords}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="period"
                        interval={0}
                        minTickGap={0}
                        tickFormatter={(period: string) => period.split(" – ")[0].split(" (")[0]}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={{ stroke: "#cbd5e1" }}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={{ stroke: "#cbd5e1" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "0.75rem",
                          borderColor: "#e2e8f0",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expectedVolume"
                        name="Expected Forecast"
                        stroke="#1d4ed8"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="actualVolume"
                        name="Actual Volume"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={{ r: 4 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Forecasting Remarks Panel (Scrollable) */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4 text-slate-900 font-semibold text-sm">
                    <Info className="w-4 h-4 text-blue-600" />
                    <h2>Forecasting Remarks</h2>
                  </div>

                  {/* Scrollable Container with custom scrollbar styling */}
                  <div className="pdf-expand space-y-3 max-h-60 sm:max-h-72 overflow-y-auto pr-1">
                    {displayedRemarks.map((remark, index) => (
                      <div
                        key={`${index}-${remark}`}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed"
                      >
                        {remark}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-800 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 inline-block shrink-0"></span>
                    {forecast.model} · MAE {summary.accuracy.mae.toFixed(2)} · R²{" "}
                    {summary.accuracy.rSquared?.toFixed(3) ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* FORECAST HISTORY TABLE */}
            <div
              id="forecast-history-section"
              className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col w-full mt-6"
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Forecast History (MLR Results)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Itemized period breakdown calculating volume variances
                    dynamically
                  </p>
                </div>

              </div>

              <div className="pdf-expand w-full lg:overflow-x-auto px-4 pt-4 lg:px-0 lg:pt-0 pb-2 min-h-75">
                <table role="table" className="w-full text-left border-collapse lg:min-w-225 block lg:table">
                  <thead role="rowgroup" className="hidden lg:table-header-group">
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      <th className="py-3.5 px-4 sm:px-6">Period</th>
                      <th className="py-3.5 px-4 sm:px-6">
                        Expected Delivery Volume
                      </th>
                      <th className="py-3.5 px-4 sm:px-6">
                        Actual Delivery Volume
                      </th>
                      <th className="py-3.5 px-4 sm:px-6">
                        Calculated Variance
                      </th>
                      <th className="py-3.5 px-4 sm:px-6">Trend Status</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup" className="block lg:table-row-group lg:divide-y lg:divide-slate-100 text-sm text-slate-800">
                    {historyRecords.map((row) => {
                      const metrics = calculateMetrics(
                        row.expectedVolume,
                        row.actualVolume,
                      );

                      return (
                        <tr
                          key={row.id}
                          role="row" className="block lg:table-row bg-white border border-slate-200 rounded-xl mb-3 p-3 lg:border-0 lg:border-b lg:border-slate-100 lg:rounded-none lg:mb-0 lg:p-0 hover:bg-slate-50/80 transition-colors text-sm text-slate-800"
                        >
                          <td role="cell" className="block lg:table-cell pb-2 mb-1 border-b border-slate-100 lg:border-0 lg:pb-3.5 lg:mb-0 text-base lg:text-sm font-semibold lg:font-medium py-1.5 lg:py-3.5 px-0 lg:px-6 font-medium text-slate-900 lg:whitespace-nowrap">
                            {row.period}
                          </td>
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start lg:table-cell py-1.5 lg:py-3.5 px-0 lg:px-6 lg:whitespace-nowrap text-slate-600"><span className="lg:hidden text-xs font-semibold text-slate-500">Expected Delivery Volume</span>
                            {row.expectedVolume.toLocaleString()}
                          </td>
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start lg:table-cell py-1.5 lg:py-3.5 px-0 lg:px-6 lg:whitespace-nowrap font-medium text-slate-900"><span className="lg:hidden text-xs font-semibold text-slate-500">Actual Delivery Volume</span>
                            {row.actualVolume !== null
                              ? row.actualVolume.toLocaleString()
                              : "-"}
                          </td>
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start lg:table-cell py-1.5 lg:py-3.5 px-0 lg:px-6 lg:whitespace-nowrap text-xs font-semibold"><span className="lg:hidden text-xs font-semibold text-slate-500">Calculated Variance</span>
                            <span
                              className={
                                metrics.varianceVal > 0
                                  ? "text-blue-600"
                                  : metrics.varianceVal < 0
                                    ? "text-amber-600"
                                    : "text-slate-500"
                              }
                            >
                              {metrics.variance}
                            </span>
                          </td>
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start lg:table-cell py-1.5 lg:py-3.5 px-0 lg:px-6 lg:whitespace-nowrap"><span className="lg:hidden text-xs font-semibold text-slate-500">Trend Status</span>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-medium ${metrics.statusClass}`}
                            >
                              {metrics.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {historyRecords.length === 0 && (
                      <tr role="row" className="block lg:table-row">
                        <td role="cell" colSpan={5} className="block lg:table-cell py-10 px-6 text-center text-sm text-slate-500">
                          No forecasting records match this timeframe.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Shown only once the monthly job has saved and checked real forecasts for this year. */}
            {evaluatedSnapshots.length > 0 && (
            <div
              id="forecast-accuracy-section"
              className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col w-full"
            >
                <div className="p-4 sm:p-5 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Forecast Accuracy History
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Preserved MLR forecasts compared with actual completed
                    delivery volumes
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Evaluated Snapshots
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {isSnapshotLoading ? "…" : evaluatedSnapshots.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Snapshot MAE
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {isSnapshotLoading ? "…" : snapshotAccuracy.mae ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Snapshot RMSE
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {isSnapshotLoading ? "…" : snapshotAccuracy.rmse ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pdf-expand w-full xl:overflow-x-auto px-4 pt-4 xl:px-0 xl:pt-0 pb-2">
                  <table role="table" className="w-full text-left border-collapse xl:min-w-225 block xl:table">
                    <thead role="rowgroup" className="hidden xl:table-header-group">
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        <th className="py-3.5 px-4 sm:px-6">Snapshot</th>
                        <th className="py-3.5 px-4 sm:px-6">Target Period</th>
                        <th className="py-3.5 px-4 sm:px-6">Forecast</th>
                        <th className="py-3.5 px-4 sm:px-6">Actual</th>
                        <th className="py-3.5 px-4 sm:px-6">Absolute Error</th>
                        <th className="py-3.5 px-4 sm:px-6">Percentage Error</th>
                      </tr>
                    </thead>
                    <tbody role="rowgroup" className="block xl:table-row-group xl:divide-y xl:divide-slate-100 text-sm text-slate-800">
                      {!isSnapshotLoading && !snapshotLoadError && evaluatedSnapshots.map((snapshot) => (
                        <tr
                          key={snapshot.forecastSnapshotID}
                          role="row" className="block xl:table-row bg-white border border-slate-200 rounded-xl mb-3 p-3 xl:border-0 xl:border-b xl:border-slate-100 xl:rounded-none xl:mb-0 xl:p-0 hover:bg-slate-50/80 transition-colors"
                        >
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:whitespace-nowrap text-slate-600"><span className="xl:hidden text-xs font-semibold text-slate-500">Snapshot</span>
                            {formatMonth(snapshot.snapshotMonth)}
                          </td>
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:whitespace-nowrap font-medium text-slate-900"><span className="xl:hidden text-xs font-semibold text-slate-500">Target Period</span>
                            {formatMonth(snapshot.targetPeriod)}
                          </td>
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:whitespace-nowrap"><span className="xl:hidden text-xs font-semibold text-slate-500">Forecast</span>
                            {Number(snapshot.expectedVolume).toLocaleString()}
                          </td>
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:whitespace-nowrap"><span className="xl:hidden text-xs font-semibold text-slate-500">Actual</span>
                            {Number(snapshot.actualVolume).toLocaleString()}
                          </td>
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:whitespace-nowrap font-semibold text-slate-700"><span className="xl:hidden text-xs font-semibold text-slate-500">Absolute Error</span>
                            {Number(snapshot.absoluteError).toLocaleString()}
                          </td>
                          <td role="cell" className="grid grid-cols-[45%_55%] sm:grid-cols-[12rem_1fr] gap-2 items-center justify-items-start xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:whitespace-nowrap font-semibold text-amber-600"><span className="xl:hidden text-xs font-semibold text-slate-500">Percentage Error</span>
                            {snapshot.variancePercentage === null
                              ? "N/A"
                              : `${Math.abs(Number(snapshot.variancePercentage)).toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                      {isSnapshotLoading && (
                        <tr role="row" className="block xl:table-row">
                          <td role="cell"
                            colSpan={6}
                            className="block xl:table-cell py-10 px-6 text-center text-sm text-slate-500"
                          >
                            Loading forecast accuracy history…
                          </td>
                        </tr>
                      )}
                      {!isSnapshotLoading && snapshotLoadError && (
                        <tr role="row" className="block xl:table-row">
                          <td role="cell"
                            colSpan={6}
                            className="block xl:table-cell py-10 px-6 text-center text-sm text-red-600"
                          >
                            {snapshotLoadError}
                          </td>
                        </tr>
                      )}
                      {!isSnapshotLoading && !snapshotLoadError && evaluatedSnapshots.length === 0 && (
                        <tr role="row" className="block xl:table-row">
                          <td role="cell"
                            colSpan={6}
                            className="block xl:table-cell py-10 px-6 text-center text-sm text-slate-500"
                          >
                            No evaluated forecast snapshots are available for {selectedYear} yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {isFilterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-title"
          onClick={() => setIsFilterOpen(false)}
        >
          <div
            className="flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="relative flex items-center justify-center px-5 py-4">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                aria-label="Close filters"
                className="absolute left-3 rounded-full p-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 id="filter-title" className="text-lg font-semibold text-slate-900">
                Filters
              </h2>
            </div>

            {/* Options */}
            <div className="flex-1 space-y-7 overflow-y-auto px-5 pb-6 pt-2">
              <section>
                <h3 className="mb-3 text-sm font-medium text-slate-900">View by</h3>
                <SegmentedControl
                  options={VIEW_OPTIONS}
                  value={draftFilters.view}
                  onChange={(view) =>
                    setDraftFilters((current) => ({
                      ...current,
                      view,
                      month: view === "yearly" ? null : current.month,
                      week: null,
                    }))
                  }
                />
              </section>

              <section>
                <h3 className="mb-3 text-sm font-medium text-slate-900">Year</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {TIMEFRAME_OPTIONS.map((year) => (
                    <FilterPill
                      key={year}
                      isActive={draftFilters.year === year}
                      onClick={() =>
                        setDraftFilters((current) => ({ ...current, year, week: null }))
                      }
                    >
                      {year}
                    </FilterPill>
                  ))}
                </div>
                {draftFilters.view === "yearly" && (
                  <p className="mt-2 text-xs text-slate-500">
                    The yearly chart shows every year. The selected year sets the remarks and accuracy history.
                  </p>
                )}
              </section>

              {draftFilters.view !== "yearly" && (
                <section>
                  <h3 className="mb-3 text-sm font-medium text-slate-900">Month</h3>
                  <div className="grid grid-cols-4 gap-2">
                    <FilterPill
                      isActive={draftFilters.month === null}
                      onClick={() =>
                        setDraftFilters((current) => ({ ...current, month: null, week: null }))
                      }
                    >
                      Any
                    </FilterPill>
                    {MONTH_OPTIONS.map((month) => (
                      <FilterPill
                        key={month.value}
                        isActive={draftFilters.month === month.value}
                        onClick={() =>
                          setDraftFilters((current) => ({
                            ...current,
                            month: month.value,
                            week: null,
                          }))
                        }
                      >
                        {month.label.slice(0, 3)}
                      </FilterPill>
                    ))}
                  </div>
                </section>
              )}

              {draftFilters.view === "weekly" && (
                <section>
                  <h3 className="mb-3 text-sm font-medium text-slate-900">Week</h3>
                  {draftFilters.month === null ? (
                    <p className="text-xs text-slate-500">
                      Pick a month first to choose a specific week.
                    </p>
                  ) : draftWeekOptions.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No weekly data for this month.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <FilterPill
                        isActive={draftFilters.week === null}
                        onClick={() =>
                          setDraftFilters((current) => ({ ...current, week: null }))
                        }
                      >
                        Any
                      </FilterPill>
                      {draftWeekOptions.map((week, index) => (
                        <FilterPill
                          key={week.periodStart}
                          isActive={draftFilters.week === week.periodStart}
                          onClick={() =>
                            setDraftFilters((current) => ({
                              ...current,
                              week: week.periodStart,
                            }))
                          }
                        >
                          <span className="block font-medium">Week {index + 1}</span>
                          <span className="block text-xs opacity-70">
                            {formatWeekRange(week.periodStart, week.periodEnd)}
                          </span>
                        </FilterPill>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section>
                <h3 className="mb-3 text-sm font-medium text-slate-900">Trend status</h3>
                <SegmentedControl
                  options={TREND_OPTIONS}
                  value={draftFilters.trend}
                  onChange={(trend) =>
                    setDraftFilters((current) => ({ ...current, trend }))
                  }
                />
              </section>
            </div>

            {/* Footer */}
            <div className="grid grid-cols-2 border-t border-slate-200">
              <button
                type="button"
                onClick={clearFilters}
                className="border-r border-slate-200 py-4 text-sm font-semibold tracking-wide text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="py-4 text-sm font-semibold tracking-wide text-blue-700 hover:bg-blue-50 cursor-pointer"
              >
                APPLY
              </button>
            </div>
          </div>
        </div>
      )}

      {isExportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-report-title"
          onClick={() => setIsExportModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="export-report-title" className="text-lg font-bold text-slate-900">
              Export Forecast Report
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose the export format for {reportScopeTitle}.
            </p>

            <div className="mt-5 grid gap-3">
              <button
                onClick={() => setExportFormat("pdf")}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors cursor-pointer ${exportFormat === "pdf" ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">PDF</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    A full report: summary, chart, all remarks and the forecast history table.
                  </span>
                </span>
              </button>

              <button
                onClick={() => setExportFormat("excel")}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors cursor-pointer ${exportFormat === "excel" ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Excel</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    The filtered forecast table and remarks, for spreadsheets.
                  </span>
                </span>
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:cursor-wait disabled:opacity-60 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exporting…" : "Export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
