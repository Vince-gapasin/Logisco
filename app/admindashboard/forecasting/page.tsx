"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  Info,
  ChevronDown,
  ArrowLeft,
  Truck,
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

interface ForecastFactors {
  averageTemperature: number | null;
  totalRainfall: number | null;
  rainyDays: number | null;
  averageWindSpeed: number | null;
  averageDieselPrice: number | null;
  averageFuelAdjustment: number | null;
}

interface ForecastRecord {
  id: string;
  periodStart: string;
  period: string;
  expectedVolume: number;
  actualVolume: number | null;
  variance: number | null;
  variancePercentage: number | null;
  trendStatus: "Above Normal" | "Below Normal" | "Normal" | "In Progress";
  factors: ForecastFactors;
}

interface ForecastSummary {
  expectedVolume: number;
  actualVolume: number;
  totalVariance: number;
  variancePercentage: number;
  trendStatus: string;
}

interface ForecastResponse {
  model: string;
  generatedAt: string;
  trainingMonths: number;
  summary: ForecastSummary;
  records: ForecastRecord[];
  remarks: string[];
}

const TIMEFRAME_OPTIONS = [
  "All Time",
  "Today",
  "Tomorrow",
  "Last 7 Days",
  "Last 30 Days",
  "This Week",
  "This Month",
  "Up to Date",
  "Custom Date Range",
] as const;

type Timeframe = (typeof TIMEFRAME_OPTIONS)[number];

function getStoredToken(): string | null {
  const storedSession =
    sessionStorage.getItem("logisco_user_session") ??
    localStorage.getItem("logisco_user_session");

  if (!storedSession) return null;

  try {
    const parsedSession = JSON.parse(storedSession);
    return parsedSession.token ?? null;
  } catch {
    return null;
  }
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function getDateRange(timeframe: Timeframe, customStart: string, customEnd: string) {
  const now = new Date();

  switch (timeframe) {
    case "Today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "Tomorrow": {
      const tomorrow = addDays(now, 1);
      return { start: startOfDay(tomorrow), end: endOfDay(tomorrow) };
    }
    case "Last 7 Days":
      return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
    case "Last 30 Days":
      return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
    case "This Week": {
      const weekday = now.getDay();
      const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
      const monday = addDays(now, -daysFromMonday);
      return { start: startOfDay(monday), end: endOfDay(addDays(monday, 6)) };
    }
    case "This Month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case "Up to Date":
      return { start: null, end: endOfDay(now) };
    case "Custom Date Range":
      return {
        start: customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : null,
        end: customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : null,
      };
    default:
      return { start: null, end: null };
  }
}

function filterRecords(
  records: ForecastRecord[],
  timeframe: Timeframe,
  customStart: string,
  customEnd: string,
) {
  const { start, end } = getDateRange(timeframe, customStart, customEnd);
  if (!start && !end) return records;

  return records.filter((record) => {
    const monthStart = new Date(`${record.periodStart}T00:00:00`);
    const monthEnd = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    return (!start || monthEnd >= start) && (!end || monthStart <= end);
  });
}

function summarize(records: ForecastRecord[]): ForecastSummary {
  const completed = records.filter((record) => record.actualVolume !== null);
  const expectedVolume = completed.reduce((sum, record) => sum + record.expectedVolume, 0);
  const actualVolume = completed.reduce((sum, record) => sum + (record.actualVolume ?? 0), 0);
  const totalVariance = actualVolume - expectedVolume;
  const variancePercentage = expectedVolume
    ? Number(((totalVariance / expectedVolume) * 100).toFixed(1))
    : 0;
  const trendStatus =
    variancePercentage > 5
      ? "Above Normal"
      : variancePercentage < -5
        ? "Below Normal"
        : "Normal";

  return { expectedVolume, actualVolume, totalVariance, variancePercentage, trendStatus };
}

function formatVariance(record: ForecastRecord) {
  if (record.actualVolume === null || record.variance === null || record.variancePercentage === null) {
    return "Pending";
  }
  const valueSign = record.variance > 0 ? "+" : "";
  const percentSign = record.variancePercentage > 0 ? "+" : "";
  return `${valueSign}${record.variance} (${percentSign}${record.variancePercentage}%)`;
}

function getStatusClass(status: ForecastRecord["trendStatus"] | string) {
  if (status === "Above Normal") return "bg-blue-100 text-blue-800 border-blue-200";
  if (status === "Below Normal") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "Normal") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function TimeframeFilter({
  value,
  open,
  startDate,
  endDate,
  onToggle,
  onChange,
  onStartDateChange,
  onEndDateChange,
}: {
  value: Timeframe;
  open: boolean;
  startDate: string;
  endDate: string;
  onToggle: () => void;
  onChange: (value: Timeframe) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:w-48">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <span className="flex items-center gap-1.5 truncate">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          {value}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => onChange(option)}
              className={`w-full cursor-pointer px-4 py-2 text-left text-xs hover:bg-slate-50 ${
                value === option ? "bg-blue-50 font-medium text-blue-600" : "text-slate-700"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {value === "Custom Date Range" && !open && (
        <div className="absolute right-0 top-full z-40 mt-2 flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:w-56">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-normal text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            End Date
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => onEndDateChange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-normal text-slate-900"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default function ForecastingPage() {
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [chartTimeframe, setChartTimeframe] = useState<Timeframe>("All Time");
  const [isChartDropdownOpen, setIsChartDropdownOpen] = useState(false);
  const [chartStartDate, setChartStartDate] = useState("");
  const [chartEndDate, setChartEndDate] = useState("");

  const [historyTimeframe, setHistoryTimeframe] = useState<Timeframe>("All Time");
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  useEffect(() => {
    async function loadForecast() {
      try {
        setLoading(true);
        const token = getStoredToken();
        if (!token) throw new Error("Authentication session was not found. Please log in again.");

        const response = await fetch("/api/forecasting/data", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Failed to retrieve forecasting data.");
        setForecastData(result);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load forecasting data.");
      } finally {
        setLoading(false);
      }
    }
    loadForecast();
  }, []);

  const chartRecords = useMemo(
    () => filterRecords(forecastData?.records ?? [], chartTimeframe, chartStartDate, chartEndDate),
    [forecastData, chartTimeframe, chartStartDate, chartEndDate],
  );

  const historyRecords = useMemo(
    () => filterRecords(forecastData?.records ?? [], historyTimeframe, historyStartDate, historyEndDate),
    [forecastData, historyTimeframe, historyStartDate, historyEndDate],
  );

  const summary = useMemo(() => summarize(chartRecords), [chartRecords]);

  const handleExport = () => {
    const headers = ["Period", "Expected Volume", "Actual Volume", "Variance", "Variance Percentage", "Trend Status"];
    const rows = historyRecords.map((record) => [
      record.period,
      record.expectedVolume,
      record.actualVolume ?? "",
      record.variance ?? "",
      record.variancePercentage ?? "",
      record.trendStatus,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `forecasting-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Generating forecast from historical records...</p>
      </div>
    );
  }

  if (error || !forecastData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="font-semibold text-red-700">Unable to load forecasting data</p>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const varianceText = `${summary.totalVariance > 0 ? "+" : ""}${summary.totalVariance} (${summary.variancePercentage > 0 ? "+" : ""}${summary.variancePercentage}%)`;

  return (
    <div className="relative flex min-h-screen w-full bg-slate-50 font-sans">
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 md:p-8">
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Forecasting</h1>
              <p className="mt-1 text-xs text-slate-700 sm:text-sm">Multiple Linear Regression predictive delivery volumes versus actual performance.</p>
              <p className="mt-1 text-xs text-slate-500">Trained using {forecastData.trainingMonths} months of historical delivery and weather records.</p>
            </div>
            <div className="flex w-full gap-3 sm:w-auto">
              <Link href="/admindashboard/reports" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-black sm:flex-none">
                <ArrowLeft className="h-4 w-4" /> Back to Reports
              </Link>
              <button type="button" onClick={handleExport} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-black sm:flex-none">
                <Download className="h-4 w-4" /> Export Report
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Expected Delivery Volume", value: summary.expectedVolume, icon: Layers, color: "text-slate-500", bg: "bg-slate-100" },
              { label: "Actual Delivery Volume", value: summary.actualVolume, icon: Truck, color: "text-blue-600", bg: "bg-blue-100" },
              { label: "Total Variance", value: varianceText, icon: TrendingUp, color: "text-indigo-900", bg: "bg-indigo-50" },
              { label: "Trend Status", value: summary.trendStatus, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${bg}`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">{label}</p>
                  <h3 className="mt-0.5 text-xl font-bold text-slate-900">{typeof value === "number" ? value.toLocaleString() : value}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 lg:col-span-2">
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold text-slate-900">MLR Forecast vs Actual Trend</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Comparison between predicted expectations and completed actuals</p>
                </div>
                <TimeframeFilter
                  value={chartTimeframe}
                  open={isChartDropdownOpen}
                  startDate={chartStartDate}
                  endDate={chartEndDate}
                  onToggle={() => setIsChartDropdownOpen((value) => !value)}
                  onChange={(value) => { setChartTimeframe(value); setIsChartDropdownOpen(false); }}
                  onStartDateChange={setChartStartDate}
                  onEndDateChange={setChartEndDate}
                />
              </div>

              <div className="h-80 w-full">
                {chartRecords.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartRecords} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} />
                      <YAxis domain={["auto", "auto"]} allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} />
                      <Tooltip contentStyle={{ backgroundColor: "#fff", borderRadius: "0.75rem", borderColor: "#e2e8f0", fontSize: "12px" }} />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                      <Line type="monotone" dataKey="expectedVolume" name="Expected (MLR)" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="actualVolume" name="Actual Volume" stroke="#10b981" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 4 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">No monthly forecast overlaps the selected date range.</div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Info className="h-4 w-4 text-blue-600" /> Automated Forecasting Findings
                </div>
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {forecastData.remarks.map((remark, index) => (
                    <div key={`${index}-${remark}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600">{remark}</div>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs font-medium text-blue-800">
                MLR model updates from fresh dispatch and external-factor records.
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Forecast History (MLR Results)</h2>
                <p className="mt-0.5 text-xs text-slate-500">Monthly forecast and actual delivery volume comparison</p>
              </div>
              <TimeframeFilter
                value={historyTimeframe}
                open={isHistoryDropdownOpen}
                startDate={historyStartDate}
                endDate={historyEndDate}
                onToggle={() => setIsHistoryDropdownOpen((value) => !value)}
                onChange={(value) => { setHistoryTimeframe(value); setIsHistoryDropdownOpen(false); }}
                onStartDateChange={setHistoryStartDate}
                onEndDateChange={setHistoryEndDate}
              />
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-700">
                    <th className="px-6 py-3.5">Period</th>
                    <th className="px-6 py-3.5">Expected Delivery Volume</th>
                    <th className="px-6 py-3.5">Actual Delivery Volume</th>
                    <th className="px-6 py-3.5">Calculated Variance</th>
                    <th className="px-6 py-3.5">Trend Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                  {historyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-6 py-3.5 font-medium text-slate-900">{record.period}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-slate-600">{record.expectedVolume.toLocaleString()}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 font-medium">{record.actualVolume?.toLocaleString() ?? "-"}</td>
                      <td className={`whitespace-nowrap px-6 py-3.5 text-xs font-semibold ${
                        (record.variance ?? 0) > 0 ? "text-blue-600" : (record.variance ?? 0) < 0 ? "text-amber-600" : "text-slate-500"
                      }`}>{formatVariance(record)}</td>
                      <td className="whitespace-nowrap px-6 py-3.5">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(record.trendStatus)}`}>{record.trendStatus}</span>
                      </td>
                    </tr>
                  ))}
                  {!historyRecords.length && (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No monthly forecast overlaps the selected date range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
