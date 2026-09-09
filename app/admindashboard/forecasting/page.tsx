"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
];

function getStoredToken(): string | null {
  const storedSession =
    sessionStorage.getItem("logisco_user_session") ??
    localStorage.getItem("logisco_user_session");

  if (!storedSession) return null;

  try {
    const parsedSession = JSON.parse(storedSession) as { token?: string };
    return parsedSession.token ?? null;
  } catch {
    return null;
  }
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function filterByTimeframe(
  records: ForecastRecord[],
  timeframe: string,
  customStart: string,
  customEnd: string,
) {
  if (timeframe === "All Time") return records;

  const today = startOfDay(new Date());
  let start: Date | null = null;
  let end: Date | null = null;

  if (timeframe === "Custom Date Range") {
    start = customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : null;
    end = customEnd ? startOfDay(new Date(`${customEnd}T00:00:00`)) : null;
  } else if (timeframe === "Today") {
    start = today;
    end = today;
  } else if (timeframe === "Tomorrow") {
    start = new Date(today);
    start.setDate(start.getDate() + 1);
    end = start;
  } else if (timeframe === "Last 7 Days" || timeframe === "Last 30 Days") {
    end = today;
    start = new Date(today);
    start.setDate(start.getDate() - (timeframe === "Last 7 Days" ? 6 : 29));
  } else if (timeframe === "This Week") {
    start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  } else if (timeframe === "This Month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (timeframe === "Up to Date") {
    end = today;
  }

  return records.filter((record) => {
    const recordDate = startOfDay(new Date(`${record.periodStart}T00:00:00`));
    return (!start || recordDate >= start) && (!end || recordDate <= end);
  });
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

  const diff = actual - expected;
  const percentage = ((diff / expected) * 100).toFixed(1);
  const sign = diff > 0 ? "+" : "";
  const varianceStr = `${sign}${diff} (${sign}${percentage}%)`;

  const ratio = diff / expected;
  if (ratio > 0.03) {
    return {
      variance: varianceStr,
      varianceVal: diff,
      status: "Above Normal",
      statusClass: "bg-[#dbeafe] text-[#1e40af] border-blue-200",
    };
  } else if (ratio < -0.03) {
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
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Chart Filter States
  const [chartTimeframe, setChartTimeframe] = useState(TIMEFRAME_OPTIONS[0]);
  const [isChartDropdownOpen, setIsChartDropdownOpen] = useState(false);
  const [chartStartDate, setChartStartDate] = useState("");
  const [chartEndDate, setChartEndDate] = useState("");

  // History Filter States
  const [historyTimeframe, setHistoryTimeframe] = useState(
    TIMEFRAME_OPTIONS[0],
  );
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  const loadForecast = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const token = getStoredToken();
      if (!token) {
        throw new Error("Authentication session was not found. Please log in again.");
      }

      const response = await fetch("/api/forecasting/data", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as ForecastResponse & { message?: string };

      if (!response.ok) {
        throw new Error(body.message ?? "Failed to load forecasting data.");
      }

      setForecast(body);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load forecasting data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadForecast();
  }, [loadForecast]);

  const chartRecords = useMemo(
    () =>
      filterByTimeframe(
        forecast?.records ?? [],
        chartTimeframe,
        chartStartDate,
        chartEndDate,
      ),
    [forecast, chartTimeframe, chartStartDate, chartEndDate],
  );

  const historyRecords = useMemo(
    () =>
      filterByTimeframe(
        forecast?.records ?? [],
        historyTimeframe,
        historyStartDate,
        historyEndDate,
      ),
    [forecast, historyTimeframe, historyStartDate, historyEndDate],
  );

  const summary = forecast?.summary;

  const formattedVariance = summary
    ? `${summary.totalVariance >= 0 ? "+" : ""}${summary.totalVariance.toLocaleString()} (${summary.variancePercentage >= 0 ? "+" : ""}${summary.variancePercentage.toFixed(1)}%)`
    : "—";

  const handleExport = () => {
    if (!historyRecords.length) return;

    const csvRows = [
      ["Period", "Expected Volume", "Actual Volume", "Variance", "Variance %", "Trend Status"],
      ...historyRecords.map((row) => [
        row.period,
        row.expectedVolume,
        row.actualVolume ?? "",
        row.variance ?? "",
        row.variancePercentage ?? "",
        row.trendStatus,
      ]),
    ];
    const csv = csvRows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `forecast-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Loading forecasting data…
      </div>
    );
  }

  if (loadError || !forecast || !summary) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
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

  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans relative">
      <div className="flex flex-col flex-1 w-full">
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
          <div className="space-y-6">
            {/* PAGE TITLE & ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Forecasting
                </h1>
                <p className="text-xs sm:text-sm text-slate-700 mt-1">
                  Multiple Linear Regression (MLR) predictive delivery volumes
                  vs actual performance.
                </p>
              </div>

              {/* Action Buttons Container */}
              <div className="w-full sm:w-auto flex items-center gap-3">
                <Link
                  href="/admindashboard/reports"
                  className="w-full sm:w-auto h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white font-semibold rounded-xl border border-slate-200 shadow-sm transition-all duration-200 text-sm px-4 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0 text-white" />
                  <span>Back to Reports</span>
                </Link>
                <button
                  onClick={handleExport}
                  className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white font-semibold rounded-xl shadow-md transition-all duration-200 text-sm whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Export Report</span>
                </button>
              </div>
            </div>

            {/* SUMMARY CARDS SECTION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {/* Expected Volume */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Expected Delivery Volume
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                    {summary.expectedVolume.toLocaleString()}
                  </h3>
                </div>
              </div>

              {/* Actual Volume */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Actual Delivery Volume
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                    {summary.actualVolume.toLocaleString()}
                  </h3>
                </div>
              </div>

              {/* Total Variance */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-900" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Total Variance
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                    {formattedVariance}
                  </h3>
                </div>
              </div>

              {/* Trend Status */}
              <div className="bg-emerald-50/50 p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                    Trend Status
                  </p>
                  <h3 className="text-lg sm:text-xl font-bold text-emerald-900 mt-0.5">
                    {summary.trendStatus}
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
                      MLR Forecast vs Actual Trend
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Comparison between predicted expectations and completed
                      actuals
                    </p>
                  </div>

                  {/* Chart Period Dropdown & Custom Range */}
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <div className="relative w-full sm:w-48">
                      <button
                        onClick={() =>
                          setIsChartDropdownOpen(!isChartDropdownOpen)
                        }
                        className="w-full flex items-center justify-between bg-white border border-slate-200 text-xs font-medium text-slate-900 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {chartTimeframe}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isChartDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isChartDropdownOpen && (
                        <div className="absolute z-10 top-full right-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
                          {TIMEFRAME_OPTIONS.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => {
                                setChartTimeframe(opt);
                                setIsChartDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-xs transition-colors hover:bg-slate-50 cursor-pointer ${
                                chartTimeframe === opt
                                  ? "bg-blue-50 text-blue-600 font-medium"
                                  : "text-slate-700"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Custom Date Range Dropdown Panel */}
                      {chartTimeframe === "Custom Date Range" &&
                        !isChartDropdownOpen && (
                          <div className="absolute z-10 top-full right-0 mt-2 w-full sm:w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-3 animate-fade-in flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-slate-700">
                                Start Date
                              </label>
                              <input
                                type="date"
                                value={chartStartDate}
                                onChange={(e) =>
                                  setChartStartDate(e.target.value)
                                }
                                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-slate-700">
                                End Date
                              </label>
                              <input
                                type="date"
                                value={chartEndDate}
                                onChange={(e) =>
                                  setChartEndDate(e.target.value)
                                }
                                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Recharts Container */}
                <div className="w-full h-72 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartRecords}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="period"
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
                        name="Expected (MLR)"
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
                  <div className="space-y-3 max-h-60 sm:max-h-72 overflow-y-auto pr-1">
                    {forecast.remarks.map((remark, index) => (
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
                    MLR Model updates monthly based on fresh dispatch records.
                  </p>
                </div>
              </div>
            </div>

            {/* FORECAST HISTORY TABLE */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col w-full mt-6">
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

                {/* History Filter Dropdown & Custom Range */}
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <div className="relative w-full sm:w-48">
                    <button
                      onClick={() =>
                        setIsHistoryDropdownOpen(!isHistoryDropdownOpen)
                      }
                      className="w-full flex items-center justify-between bg-white border border-slate-200 text-xs font-medium text-slate-900 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {historyTimeframe}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isHistoryDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isHistoryDropdownOpen && (
                      <div className="absolute z-10 top-full right-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
                        {TIMEFRAME_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setHistoryTimeframe(opt);
                              setIsHistoryDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs transition-colors hover:bg-slate-50 cursor-pointer ${
                              historyTimeframe === opt
                                ? "bg-blue-50 text-blue-600 font-medium"
                                : "text-slate-700"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Custom Date Range Dropdown Panel */}
                    {historyTimeframe === "Custom Date Range" &&
                      !isHistoryDropdownOpen && (
                        <div className="absolute z-10 top-full right-0 mt-2 w-full sm:w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-3 animate-fade-in flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-700">
                              Start Date
                            </label>
                            <input
                              type="date"
                              value={historyStartDate}
                              onChange={(e) =>
                                setHistoryStartDate(e.target.value)
                              }
                              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-700">
                              End Date
                            </label>
                            <input
                              type="date"
                              value={historyEndDate}
                              onChange={(e) =>
                                setHistoryEndDate(e.target.value)
                              }
                              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                            />
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              <div className="w-full overflow-x-auto pb-2 min-h-75">
                <table className="w-full text-left border-collapse min-w-225">
                  <thead>
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
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                    {historyRecords.map((row) => {
                      const metrics = calculateMetrics(
                        row.expectedVolume,
                        row.actualVolume,
                      );

                      return (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-sm text-slate-800"
                        >
                          <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 whitespace-nowrap">
                            {row.period}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-slate-600">
                            {row.expectedVolume.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap font-medium text-slate-900">
                            {row.actualVolume !== null
                              ? row.actualVolume.toLocaleString()
                              : "-"}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-xs font-semibold">
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
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
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
                      <tr>
                        <td colSpan={5} className="py-10 px-6 text-center text-sm text-slate-500">
                          No forecasting records match this timeframe.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
