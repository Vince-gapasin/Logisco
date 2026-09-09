"use client";

import React, { useEffect, useState } from "react";
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
  trendStatus:
    | "Above Normal"
    | "Below Normal"
    | "Normal"
    | "In Progress";
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

const PERIOD_OPTIONS = ["This Year"];

function getStoredToken(): string | null {
  const storedSession =
    sessionStorage.getItem("logisco_user_session") ??
    localStorage.getItem("logisco_user_session");

  if (!storedSession) {
    return null;
  }

  try {
    const parsedSession = JSON.parse(storedSession);
    return parsedSession.token ?? null;
  } catch {
    return null;
  }
}

function formatVariance(record: ForecastRecord): string {
  if (
    record.actualVolume === null ||
    record.variance === null ||
    record.variancePercentage === null
  ) {
    return "Pending";
  }

  const varianceSign = record.variance > 0 ? "+" : "";
  const percentageSign =
    record.variancePercentage > 0 ? "+" : "";

  return `${varianceSign}${record.variance} (${percentageSign}${record.variancePercentage}%)`;
}

function getVarianceClass(record: ForecastRecord): string {
  if (record.actualVolume === null) {
    return "text-slate-500";
  }

  if ((record.variance ?? 0) > 0) {
    return "text-blue-600";
  }

  if ((record.variance ?? 0) < 0) {
    return "text-amber-600";
  }

  return "text-slate-500";
}

function getStatusClass(status: ForecastRecord["trendStatus"]) {
  switch (status) {
    case "Above Normal":
      return "bg-blue-100 text-blue-800 border-blue-200";

    case "Below Normal":
      return "bg-amber-100 text-amber-800 border-amber-200";

    case "Normal":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";

    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getSummaryStatusClass(status: string) {
  if (status === "Below Normal") {
    return {
      card: "bg-amber-50/50 border-amber-100",
      circle: "bg-amber-100",
      icon: "text-amber-600",
      label: "text-amber-700",
      value: "text-amber-900",
    };
  }

  if (status === "Above Normal") {
    return {
      card: "bg-blue-50/50 border-blue-100",
      circle: "bg-blue-100",
      icon: "text-blue-600",
      label: "text-blue-700",
      value: "text-blue-900",
    };
  }

  return {
    card: "bg-emerald-50/50 border-emerald-100",
    circle: "bg-emerald-100",
    icon: "text-emerald-600",
    label: "text-emerald-700",
    value: "text-emerald-900",
  };
}

function escapeCsvValue(value: unknown): string {
  const stringValue =
    value === null || value === undefined ? "" : String(value);

  return `"${stringValue.replace(/"/g, '""')}"`;
}

export default function ForecastingPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(
    PERIOD_OPTIONS[0]
  );
  const [isDropdownOpen, setIsDropdownOpen] =
    useState(false);
  const [forecastData, setForecastData] =
    useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadForecast() {
      try {
        setLoading(true);
        setError("");

        const token = getStoredToken();

        if (!token) {
          throw new Error(
            "Authentication session was not found. Please log in again."
          );
        }

        const response = await fetch(
          "/api/forecasting/data",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message ||
              "Failed to retrieve forecasting data."
          );
        }

        setForecastData(result);
      } catch (fetchError) {
        console.error(
          "Forecasting page error:",
          fetchError
        );

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load forecasting data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadForecast();
  }, []);

  const handleExport = () => {
    if (!forecastData) return;

    const headers = [
      "Period",
      "Expected Delivery Volume",
      "Actual Delivery Volume",
      "Variance",
      "Variance Percentage",
      "Trend Status",
      "Average Temperature",
      "Total Rainfall",
      "Rainy Days",
      "Average Wind Speed",
      "Average Diesel Price",
      "Average Fuel Adjustment",
    ];

    const rows = forecastData.records.map((record) => [
      record.period,
      record.expectedVolume,
      record.actualVolume,
      record.variance,
      record.variancePercentage,
      record.trendStatus,
      record.factors.averageTemperature,
      record.factors.totalRainfall,
      record.factors.rainyDays,
      record.factors.averageWindSpeed,
      record.factors.averageDieselPrice,
      record.factors.averageFuelAdjustment,
    ]);

    const csvContent = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) =>
        row.map(escapeCsvValue).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `forecasting-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(downloadUrl);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />

          <p className="text-sm font-medium text-slate-700">
            Generating forecast from historical records...
          </p>
        </div>
      </div>
    );
  }

  if (error || !forecastData) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="text-sm font-semibold text-red-700">
            Unable to load forecasting data
          </p>

          <p className="mt-2 text-xs text-red-600">
            {error}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const {
    summary,
    records: forecastRecords,
    remarks: forecastingRemarks,
  } = forecastData;

  const summaryStatusClass = getSummaryStatusClass(
    summary.trendStatus
  );

  const varianceText =
    `${summary.totalVariance > 0 ? "+" : ""}` +
    `${summary.totalVariance.toLocaleString()} (` +
    `${summary.variancePercentage > 0 ? "+" : ""}` +
    `${summary.variancePercentage}%)`;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      <div className="flex w-full flex-1 flex-col overflow-hidden">
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="space-y-6">
            {/* PAGE HEADER */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Forecasting
                </h1>

                <p className="mt-1 text-xs text-slate-700 sm:text-sm">
                  Multiple Linear Regression predictive delivery
                  volumes versus actual performance.
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Trained using {forecastData.trainingMonths} months
                  of historical delivery and weather records.
                </p>
              </div>

              <div className="flex w-full items-center gap-3 sm:w-auto">
                <Link
                  href="/admindashboard/reports"
                  className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-black sm:w-auto"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <span>Back to Reports</span>
                </Link>

                <button
                  onClick={handleExport}
                  className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-black sm:w-40"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Export Report</span>
                </button>
              </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 sm:h-12 sm:w-12">
                  <Layers className="h-5 w-5 text-slate-500 sm:h-6 sm:w-6" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Expected Delivery Volume
                  </p>

                  <h3 className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl">
                    {summary.expectedVolume.toLocaleString()}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 sm:h-12 sm:w-12">
                  <Truck className="h-5 w-5 text-blue-600 sm:h-6 sm:w-6" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Actual Delivery Volume
                  </p>

                  <h3 className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl">
                    {summary.actualVolume.toLocaleString()}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 sm:h-12 sm:w-12">
                  <TrendingUp className="h-5 w-5 text-indigo-900 sm:h-6 sm:w-6" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Total Variance
                  </p>

                  <h3 className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl">
                    {varianceText}
                  </h3>
                </div>
              </div>

              <div
                className={`flex items-center gap-4 rounded-2xl border p-4 shadow-sm sm:p-5 ${summaryStatusClass.card}`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 ${summaryStatusClass.circle}`}
                >
                  <CheckCircle2
                    className={`h-5 w-5 sm:h-6 sm:w-6 ${summaryStatusClass.icon}`}
                  />
                </div>

                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${summaryStatusClass.label}`}
                  >
                    Trend Status
                  </p>

                  <h3
                    className={`mt-0.5 text-lg font-bold sm:text-xl ${summaryStatusClass.value}`}
                  >
                    {summary.trendStatus}
                  </h3>
                </div>
              </div>
            </div>

            {/* GRAPH AND REMARKS */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6 lg:col-span-2">
                <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                      MLR Forecast vs Actual Trend
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Comparison between predicted expectations and
                      completed actual deliveries
                    </p>
                  </div>

                  <div className="relative w-full sm:w-40">
                    <button
                      onClick={() =>
                        setIsDropdownOpen(!isDropdownOpen)
                      }
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {selectedPeriod}
                      </span>

                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                        {PERIOD_OPTIONS.map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setSelectedPeriod(option);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-xs transition-colors hover:bg-slate-50 ${
                              selectedPeriod === option
                                ? "bg-blue-50 font-medium text-blue-600"
                                : "text-slate-700"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-72 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={forecastRecords}
                      margin={{
                        top: 10,
                        right: 10,
                        left: -20,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f1f5f9"
                      />

                      <XAxis
                        dataKey="period"
                        tick={{
                          fontSize: 11,
                          fill: "#64748b",
                        }}
                        axisLine={{ stroke: "#cbd5e1" }}
                      />

                      <YAxis
                        domain={["auto", "auto"]}
                        allowDecimals={false}
                        tick={{
                          fontSize: 11,
                          fill: "#64748b",
                        }}
                        axisLine={{ stroke: "#cbd5e1" }}
                      />

                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "0.75rem",
                          borderColor: "#e2e8f0",
                          boxShadow:
                            "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          fontSize: "12px",
                        }}
                      />

                      <Legend
                        wrapperStyle={{
                          fontSize: "12px",
                          paddingTop: "10px",
                        }}
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

              {/* AUTOMATED FINDINGS */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
                <div>
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Info className="h-4 w-4 text-blue-600" />
                    <h2>Automated Forecasting Findings</h2>
                  </div>

                  <div className="max-h-60 space-y-3 overflow-y-auto pr-1 sm:max-h-72">
                    {forecastingRemarks.length > 0 ? (
                      forecastingRemarks.map(
                        (remark, index) => (
                          <div
                            key={`${index}-${remark}`}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600"
                          >
                            {remark}
                          </div>
                        )
                      )
                    ) : (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-500">
                        No forecasting findings are currently
                        available.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-blue-800">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                    The model recalculates from the latest completed
                    dispatch and external-factor records.
                  </p>
                </div>
              </div>
            </div>

            {/* FORECAST HISTORY */}
            <div className="mt-6 flex w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Forecast History (MLR Results)
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Monthly forecast and actual delivery volume
                    comparison
                  </p>
                </div>
              </div>

              <div className="min-h-75 w-full overflow-x-auto pb-2">
                <table className="min-w-225 w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-700">
                      <th className="px-4 py-3.5 sm:px-6">
                        Period
                      </th>

                      <th className="px-4 py-3.5 sm:px-6">
                        Expected Delivery Volume
                      </th>

                      <th className="px-4 py-3.5 sm:px-6">
                        Actual Delivery Volume
                      </th>

                      <th className="px-4 py-3.5 sm:px-6">
                        Calculated Variance
                      </th>

                      <th className="px-4 py-3.5 sm:px-6">
                        Trend Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                    {forecastRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="border-b border-slate-100 text-sm text-slate-800 transition-colors hover:bg-slate-50/80"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-900 sm:px-6">
                          {record.period}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-600 sm:px-6">
                          {record.expectedVolume.toLocaleString()}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-900 sm:px-6">
                          {record.actualVolume !== null
                            ? record.actualVolume.toLocaleString()
                            : "-"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold sm:px-6">
                          <span
                            className={getVarianceClass(record)}
                          >
                            {formatVariance(record)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-6">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                              record.trendStatus
                            )}`}
                          >
                            {record.trendStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                <p className="text-xs text-slate-500">
                  Model generated:{" "}
                  {new Date(
                    forecastData.generatedAt
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}