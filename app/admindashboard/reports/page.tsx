"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  TrendingUp,
  FileText,
  ChevronDown,
  Filter,
  BarChart3,
  XCircle,
  CheckCircle2,
  Calendar,
} from "lucide-react";

// ==========================================
// STATIC FILTER OPTIONS (Supabase Ready)
// ==========================================
const TIMEFRAME_OPTIONS = [
  "Time Frame",
  "Today",
  "This Week",
  "Last Week",
  "This Month",
  "Last Month",
  "This Year",
  "Last Year",
];

const MONTH_OPTIONS = [
  "Month",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STATUS_OPTIONS = ["Final Status", "Delivered", "Foul Trip"];

// These will eventually be populated via Supabase
const CLIENT_OPTIONS = ["Client"];
const CREW_OPTIONS = ["Delivery Crew", "Helper", "Driver"];

export default function ReportsForecastingPage() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Filter States
  const [timeframe, setTimeframe] = useState(TIMEFRAME_OPTIONS[0]);
  const [month, setMonth] = useState(MONTH_OPTIONS[0]);
  const [client, setClient] = useState(CLIENT_OPTIONS[0]);
  const [crew, setCrew] = useState(CREW_OPTIONS[0]);
  const [status, setStatus] = useState(STATUS_OPTIONS[0]);

  // ==========================================
  // ADDED: DATA & PAGINATION STATES
  // ==========================================
  const [records, setRecords] = useState<any[]>([]); // Replace 'any' with your actual Report interface later
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Pagination Math
  const totalPages = Math.ceil(records.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = records.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [timeframe, month, client, crew, status]);

  // Click Outside Handler for Dropdowns
  const dropdownsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownsRef.current &&
        !dropdownsRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==========================================
  // REUSABLE DROPDOWN COMPONENT
  // ==========================================
  const FilterDropdown = ({
    id,
    label,
    options,
    value,
    setValue,
  }: {
    id: string;
    label: string;
    options: string[];
    value: string;
    setValue: (val: string) => void;
  }) => {
    const isOpen = activeDropdown === id;

    return (
      <div className="relative w-full">
        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
          {label}
        </label>
        <button
          onClick={() => setActiveDropdown(isOpen ? null : id)}
          className="w-full flex items-center justify-between bg-white border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
        >
          <span className="truncate pr-2">{value}</span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  setValue(opt);
                  setActiveDropdown(null);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                  value === opt
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
    );
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="space-y-6">
        {/* ========================================== */}
        {/* HEADER SECTION                            */}
        {/* ========================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Reports & Forecasting
            </h1>
            <p className="text-xs sm:text-sm text-slate-700 mt-1">
              View delivery performance reports, analyze historical records, and
              generate demand forecasts.
            </p>
          </div>

          {/* Action Button:*/}
          <div className="flex justify-center sm:justify-start w-full sm:w-auto">
            <button className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white font-semibold rounded-xl shadow-md transition-all duration-200 text-sm whitespace-nowrap">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Forecasting</span>
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* FILTER SECTION                            */}
        {/* ========================================== */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2>Filter Completed Reports</h2>
          </div>

          <div
            ref={dropdownsRef}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
          >
            <FilterDropdown
              id="timeframe"
              label="Timeframe"
              options={TIMEFRAME_OPTIONS}
              value={timeframe}
              setValue={setTimeframe}
            />
            <FilterDropdown
              id="month"
              label="Month"
              options={MONTH_OPTIONS}
              value={month}
              setValue={setMonth}
            />
            <FilterDropdown
              id="client"
              label="Client"
              options={CLIENT_OPTIONS}
              value={client}
              setValue={setClient}
            />
            <FilterDropdown
              id="crew"
              label="Delivery Crew"
              options={CREW_OPTIONS}
              value={crew}
              setValue={setCrew}
            />
            <FilterDropdown
              id="status"
              label="Final Status"
              options={STATUS_OPTIONS}
              value={status}
              setValue={setStatus}
            />
          </div>
        </div>

        {/* ========================================== */}
        {/* SUMMARY CARDS SECTION                     */}
        {/* ========================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Historical Records */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Total Historical
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                0
              </h3>
            </div>
          </div>

          {/* Successful Deliveries */}
          <div className="bg-green-50/50 p-4 sm:p-5 rounded-2xl border border-green-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                Successful Deliveries
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-green-900">
                0
              </h3>
            </div>
          </div>

          {/* Foul Trip */}
          <div className="bg-red-50/50 p-4 sm:p-5 rounded-2xl border border-red-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                Foul Trip
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-red-900">0</h3>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* DATA TABLE SECTION                         */}
        {/* ========================================== */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col w-full">
          {/* Table Header Area */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Delivery Records
            </h2>
          </div>

          {/* Table Wrapper (VISIBLE Horizontal Scroll Protection) */}
          <div className="w-full overflow-x-auto pb-2">
            <table className="w-full text-left border-collapse min-w-225">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Date</th>
                  <th className="py-3.5 px-4 sm:px-6">Order ID</th>
                  <th className="py-3.5 px-4 sm:px-6">Client</th>
                  <th className="py-3.5 px-4 sm:px-6">Final Status</th>
                  <th className="py-3.5 px-4 sm:px-6">Delivery Crews</th>
                  <th className="py-3.5 px-4 sm:px-6">Remarks</th>
                </tr>
              </thead>

              {/* Dynamic Body */}
              <tbody>
                {paginatedRecords.length > 0 ? (
                  paginatedRecords.map((record, idx) => (
                    <tr
                      key={record.id || idx}
                      className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-sm text-slate-800"
                    >
                      <td className="py-3.5 px-4 sm:px-6">
                        {record.date || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                        {record.orderId || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        {record.client || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {record.status || "N/A"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6">
                        {record.crew || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 truncate max-w-xs">
                        {record.remarks || "None"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 sm:py-16 text-center">
                      <div className="flex flex-col items-center justify-center px-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-slate-900 font-medium text-sm">
                          No delivery records found
                        </p>
                        <p className="text-slate-600 text-xs mt-1 max-w-sm">
                          Completed delivery reports will appear here once
                          connected to your backend database.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Dynamic Pagination Footer */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
            <span>
              Showing {records.length === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(endIndex, records.length)} of {records.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                  currentPage === 1
                    ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                }`}
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                  currentPage === totalPages || totalPages === 0
                    ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
