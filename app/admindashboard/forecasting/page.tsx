"use client";

// PDF_PAGE_FIX_V2: overview, forecast history, and accuracy history are captured separately.

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
  FileText,
  FileSpreadsheet,
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

const TIMEFRAME_OPTIONS = [
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
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

function filterByTimeframe(
  records: ForecastRecord[],
  timeframe: string,
) {
  return records.filter((record) => record.periodStart.startsWith(timeframe));
}

function formatMonth(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
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
  const [snapshots, setSnapshots] = useState<ForecastSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState(
    TIMEFRAME_OPTIONS[TIMEFRAME_OPTIONS.length - 1],
  );
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel">("pdf");
  const [isExporting, setIsExporting] = useState(false);

  const loadForecast = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const token = getStoredToken();
      if (!token) {
        throw new Error("Authentication session was not found. Please log in again.");
      }

      const requestOptions = {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store" as const,
      };
      const [response, snapshotResponse] = await Promise.all([
        fetch("/api/forecasting/data", requestOptions),
        fetch("/api/forecasting/snapshots", requestOptions),
      ]);
      const body = (await response.json()) as ForecastResponse & { message?: string };
      const snapshotBody = (await snapshotResponse.json()) as SnapshotResponse;

      if (!response.ok) {
        throw new Error(body.message ?? "Failed to load forecasting data.");
      }
      if (!snapshotResponse.ok) {
        throw new Error(
          snapshotBody.message ?? "Failed to load forecast accuracy history.",
        );
      }

      setForecast(body);
      setSnapshots(snapshotBody.data ?? []);
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

  const filteredRecords = useMemo(
    () => filterByTimeframe(forecast?.records ?? [], selectedYear),
    [forecast, selectedYear],
  );

  const chartRecords = filteredRecords;
  const historyRecords = filteredRecords;
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
  const completedRecords = filteredRecords.filter(
    (record) => record.actualVolume !== null,
  );
  const expectedVolume = completedRecords.reduce(
    (sum, record) => sum + record.expectedVolume,
    0,
  );
  const actualVolume = completedRecords.reduce(
    (sum, record) => sum + (record.actualVolume ?? 0),
    0,
  );
  const totalVariance = actualVolume - expectedVolume;
  const variancePercentage =
    expectedVolume === 0 ? 0 : (totalVariance / expectedVolume) * 100;
  const selectedTrendStatus =
    variancePercentage > 5
      ? "Above Normal"
      : variancePercentage < -5
        ? "Below Normal"
        : "Normal";

  const summary = forecast?.summary;
  const displayedRemarks =
    forecast?.remarksByYear?.[selectedYear] ?? forecast?.remarks ?? [];

  const formattedVariance = `${totalVariance >= 0 ? "+" : ""}${totalVariance.toLocaleString()} (${variancePercentage >= 0 ? "+" : ""}${variancePercentage.toFixed(1)}%)`;

  const handleExcelExport = () => {
    if (!historyRecords.length || !forecast || !summary) return;

    const csvRows = [
      ["Forecast Model", forecast.model],
      ["Validation Method", summary.accuracy.method],
      ["Evaluated Months", summary.accuracy.evaluatedMonths],
      ["Validation MAE", summary.accuracy.mae],
      ["Validation RMSE", summary.accuracy.rmse],
      ["Validation R Squared", summary.accuracy.rSquared ?? "Not available"],
      [],
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
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `forecast-table-${selectedYear}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  const handlePdfExport = async () => {
    const report = document.getElementById("forecast-report-content");
    const historySection = document.getElementById("forecast-history-section");
    const accuracySection = document.getElementById("forecast-accuracy-section");
    if (!report || !historySection || !accuracySection) return;

    setIsExporting(true);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const sharedCaptureOptions = {
        backgroundColor: "#f8fafc",
        scale: 1.5,
        useCORS: true,
        logging: false,
      };

      const overviewCanvas = await html2canvas(report, {
        ...sharedCaptureOptions,
        onclone: (clonedDocument: Document) => {
          const clonedHistory = clonedDocument.getElementById(
            "forecast-history-section",
          );
          const clonedAccuracy = clonedDocument.getElementById(
            "forecast-accuracy-section",
          );
          if (clonedHistory) clonedHistory.style.display = "none";
          if (clonedAccuracy) clonedAccuracy.style.display = "none";
        },
      });

      const historyCanvas = await html2canvas(historySection, {
        ...sharedCaptureOptions,
        onclone: (clonedDocument: Document) => {
          clonedDocument.querySelectorAll<HTMLElement>(".pdf-expand").forEach(
            (element) => {
              element.style.maxHeight = "none";
              element.style.height = "auto";
              element.style.overflow = "visible";
            },
          );
        },
      });

      const accuracyCanvas = await html2canvas(accuracySection, {
        ...sharedCaptureOptions,
        onclone: (clonedDocument: Document) => {
          clonedDocument.querySelectorAll<HTMLElement>(".pdf-expand").forEach(
            (element) => {
              element.style.maxHeight = "none";
              element.style.height = "auto";
              element.style.overflow = "visible";
            },
          );
        },
      });

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const margin = 8;
      const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      const addCanvasToPdf = (
        canvas: HTMLCanvasElement,
        startOnNewPage: boolean,
      ) => {
        if (startOnNewPage) pdf.addPage();

        const imageHeight = (canvas.height * pageWidth) / canvas.width;
        const imageData = canvas.toDataURL("image/jpeg", 0.92);
        let remainingHeight = imageHeight;
        let position = margin;

        pdf.addImage(imageData, "JPEG", margin, position, pageWidth, imageHeight);
        remainingHeight -= pageHeight;

        while (remainingHeight > 0) {
          position = margin - (imageHeight - remainingHeight);
          pdf.addPage();
          pdf.addImage(imageData, "JPEG", margin, position, pageWidth, imageHeight);
          remainingHeight -= pageHeight;
        }
      };

      const overviewImageData = overviewCanvas.toDataURL("image/jpeg", 0.92);
      const overviewRatio = Math.min(
        pageWidth / overviewCanvas.width,
        pageHeight / overviewCanvas.height,
      );
      const overviewWidth = overviewCanvas.width * overviewRatio;
      const overviewHeight = overviewCanvas.height * overviewRatio;
      const overviewX = (pdf.internal.pageSize.getWidth() - overviewWidth) / 2;

      pdf.addImage(
        overviewImageData,
        "JPEG",
        overviewX,
        margin,
        overviewWidth,
        overviewHeight,
      );
      addCanvasToPdf(historyCanvas, true);
      addCanvasToPdf(accuracyCanvas, true);

      pdf.save(`forecast-report-${selectedYear}.pdf`);
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("PDF export failed:", error);
      window.alert("The PDF could not be generated. Please try again.");
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
    <div id="forecast-report" className="flex min-h-screen w-full bg-slate-50 font-sans relative">
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
                <p className="text-xs sm:text-sm text-slate-700 mt-1">
                  Data-driven delivery volume forecasts compared with actual performance.
                </p>
              </div>

              {/* Action Buttons Container */}
              <div
                className="w-full sm:w-auto flex flex-wrap items-center gap-3 print:hidden"
                data-html2canvas-ignore="true"
              >
                <Link
                  href="/admindashboard/reports"
                  className="w-full sm:w-auto h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white font-semibold rounded-xl border border-slate-200 shadow-sm transition-all duration-200 text-sm px-4 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0 text-white" />
                  <span>Back to Reports</span>
                </Link>
                <button
                  onClick={() => setIsExportModalOpen(true)}
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
                    {expectedVolume.toLocaleString()}
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
                    {actualVolume.toLocaleString()}
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
                  </div>

                  <div className="relative w-full sm:w-48" data-html2canvas-ignore="true">
                    <button
                      onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                      className="w-full flex items-center justify-between bg-white border border-slate-200 text-xs font-medium text-slate-900 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {selectedYear}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isYearDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isYearDropdownOpen && (
                      <div className="absolute z-20 top-full right-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1">
                        {TIMEFRAME_OPTIONS.map((year) => (
                          <button
                            key={year}
                            onClick={() => {
                              setSelectedYear(year);
                              setIsYearDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 cursor-pointer ${selectedYear === year ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700"}`}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    )}
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
                        interval={0}
                        minTickGap={0}
                        tickFormatter={(period: string) => period.split(" ")[0]}
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
                    {summary.accuracy.rSquared?.toFixed(3) ?? "N/A"}
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

              <div className="pdf-expand w-full overflow-x-auto pb-2 min-h-75">
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
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Evaluated Snapshots
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {evaluatedSnapshots.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Snapshot MAE
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {snapshotAccuracy.mae ?? "N/A"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Snapshot RMSE
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {snapshotAccuracy.rmse ?? "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pdf-expand w-full overflow-x-auto pb-2">
                  <table className="w-full text-left border-collapse min-w-250">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        <th className="py-3.5 px-4 sm:px-6">Snapshot</th>
                        <th className="py-3.5 px-4 sm:px-6">Target Period</th>
                        <th className="py-3.5 px-4 sm:px-6">Forecast</th>
                        <th className="py-3.5 px-4 sm:px-6">Actual</th>
                        <th className="py-3.5 px-4 sm:px-6">Absolute Error</th>
                        <th className="py-3.5 px-4 sm:px-6">Percentage Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                      {evaluatedSnapshots.map((snapshot) => (
                        <tr
                          key={snapshot.forecastSnapshotID}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-slate-600">
                            {formatMonth(snapshot.snapshotMonth)}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap font-medium text-slate-900">
                            {formatMonth(snapshot.targetPeriod)}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                            {Number(snapshot.expectedVolume).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                            {Number(snapshot.actualVolume).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap font-semibold text-slate-700">
                            {Number(snapshot.absoluteError).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap font-semibold text-amber-600">
                            {snapshot.variancePercentage === null
                              ? "N/A"
                              : `${Math.abs(Number(snapshot.variancePercentage)).toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                      {evaluatedSnapshots.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-10 px-6 text-center text-sm text-slate-500"
                          >
                            No evaluated forecast snapshots are available for {selectedYear} yet.
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
              Choose the export format for {selectedYear}.
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
                    Export the complete forecasting screen.
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
                    Export only the filtered forecast history table.
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
