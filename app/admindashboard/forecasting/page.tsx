"use client";

import React, { useState, useMemo } from "react";
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

// ==========================================
// MOCK DATA LAYER (BACKEND-READY)
// ==========================================

export interface ForecastRecord {
  id: string;
  period: string;
  expectedVolume: number;
  actualVolume: number | null;
}

const MOCK_PERIOD_OPTIONS = ["This Year"];

// Dummy records constrained strictly within 100-200 range
const MOCK_FORECAST_DATA: ForecastRecord[] = [
  { id: "1", period: "Jan 2026", expectedVolume: 110, actualVolume: 108 },
  { id: "2", period: "Feb 2026", expectedVolume: 125, actualVolume: 130 },
  { id: "3", period: "Mar 2026", expectedVolume: 135, actualVolume: 132 },
  { id: "4", period: "Apr 2026", expectedVolume: 145, actualVolume: 150 },
  { id: "5", period: "May 2026", expectedVolume: 155, actualVolume: 151 },
  { id: "6", period: "Jun 2026", expectedVolume: 165, actualVolume: 170 },
  { id: "7", period: "Jul 2026", expectedVolume: 175, actualVolume: 172 },
  { id: "8", period: "Aug 2026", expectedVolume: 185, actualVolume: 190 },
  { id: "9", period: "Sep 2026", expectedVolume: 190, actualVolume: null },
  { id: "10", period: "Oct 2026", expectedVolume: 192, actualVolume: null },
  { id: "11", period: "Nov 2026", expectedVolume: 195, actualVolume: null },
  { id: "12", period: "Dec 2026", expectedVolume: 200, actualVolume: null },
];

const MOCK_REMARKS = [
  {
    id: "r1",
    text: "In September, actual delivery performance stabilized as normal weather patterns resumed and fleet maintenance backlogs were fully cleared, aligning output closely with the initial pre-season forecasts.",
  },
  {
    id: "r2",
    text: "In August, delivery volumes experienced a temporary surge due to a back-to-school promotional campaign launched by major retail clients, prompting the deployment of auxiliary fleet units to meet the sudden uptick in orders.",
  },
  {
    id: "r3",
    text: "In July, operational efficiency improved as delivery teams streamlined travel paths and reduced transit times despite ongoing regional weather disruptions.",
  },
  {
    id: "r4",
    text: "In June, manpower shortages and vehicle availability issues further reduced delivery operations, causing actual deliveries to remain below the expected forecasted volume.",
  },
  {
    id: "r5",
    text: "By May, continuous heavy rainfall and traffic congestion caused delivery delays and reduced completed delivery volume compared to the forecasted trend.",
  },
  {
    id: "r6",
    text: "In April, both forecasted and actual deliveries peaked due to seasonal demand growth and promotional activities from partner clients, resulting in a higher number of delivery requests.",
  },
  {
    id: "r7",
    text: "During March, fuel prices increased significantly, causing delivery schedules to be reduced and routes to be consolidated to minimize operational expenses.",
  },
  {
    id: "r8",
    text: "In February, delivery activity declined because several delivery vehicles underwent scheduled maintenance, reducing the number of available delivery units.",
  },
  {
    id: "r9",
    text: "In January, actual deliveries exceeded the forecasted volume due to increased customer demand after the holiday season and the addition of temporary delivery crews to handle the higher workload.",
  },
];

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
  const [selectedPeriod, setSelectedPeriod] = useState(MOCK_PERIOD_OPTIONS[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Calculates single period averages (100–200 scale) for summary cards
  const summary = useMemo(() => {
    const completedRecords = MOCK_FORECAST_DATA.filter(
      (r) => r.actualVolume !== null,
    );

    const count = completedRecords.length || 1;
    const avgExpected = Math.round(
      completedRecords.reduce((acc, curr) => acc + curr.expectedVolume, 0) /
        count,
    );
    const avgActual = Math.round(
      completedRecords.reduce(
        (acc, curr) => acc + (curr.actualVolume || 0),
        0,
      ) / count,
    );

    const netVariance = avgActual - avgExpected;
    const netVariancePct = avgExpected
      ? ((netVariance / avgExpected) * 100).toFixed(1)
      : "0.0";

    return {
      avgExpected,
      avgActual,
      netVariance: `${netVariance >= 0 ? "+" : ""}${netVariance} (${netVariance >= 0 ? "+" : ""}${netVariancePct}%)`,
      trendStatus: "Normal",
    };
  }, []);

  const handleExport = () => {
    alert("Exporting forecasting report data...");
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans relative">
      {/* 2. MAIN RIGHT CONTAINER CANVAS */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
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
                    {summary.avgExpected}
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
                    {summary.avgActual}
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
                    {summary.netVariance}
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

                  {/* Period Dropdown */}
                  <div className="relative w-full sm:w-40">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full flex items-center justify-between bg-white border border-slate-200 text-xs font-medium text-slate-900 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {selectedPeriod}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute z-50 top-full right-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1">
                        {MOCK_PERIOD_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setSelectedPeriod(opt);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs transition-colors hover:bg-slate-50 ${
                              selectedPeriod === opt
                                ? "bg-blue-50 text-blue-600 font-medium"
                                : "text-slate-700"
                            }`}
                          >
                            {opt}
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
                      data={MOCK_FORECAST_DATA}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={{ stroke: "#cbd5e1" }}
                      />
                      <YAxis
                        domain={[100, 210]}
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
                    {MOCK_REMARKS.map((remark) => (
                      <div
                        key={remark.id}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed"
                      >
                        {remark.text}
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
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
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
                    {MOCK_FORECAST_DATA.map((row) => {
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
