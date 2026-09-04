"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  FileText,
  ChevronDown,
  Filter,
  BarChart3,
  XCircle,
  CheckCircle2,
  Calendar,
  Loader2
} from "lucide-react";

// ==========================================
// SESSION & API FETCH
// ==========================================

const SESSION_KEY = "logisco_user_session";

interface UserSession {
  email: string;
  role: string;
  token: string;
  id: string;
  employeeName: string;
}

function getAuthSession(): UserSession {
  const savedSession =
    localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);

  if (!savedSession) {
    throw new Error("Authentication session not found. Please log in again.");
  }
  return JSON.parse(savedSession) as UserSession;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const session = getAuthSession();
  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${session.token}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  let result: unknown = null;
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    result = await response.json();
  }

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "message" in result
        ? String((result as any).message)
        : `Request failed with status ${response.status}`;

    if (response.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
    throw new Error(message);
  }

  return result as T;
}

// ==========================================
// STATIC FILTER OPTIONS
// ==========================================
const TIMEFRAME_OPTIONS = [
  "Time Frame",
  "Today",
  "This Week",
  "This Month",
  "This Year",
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

const STATUS_OPTIONS = ["Final Status", "Delivered", "Foul Trip", "Pending", "In-Transit"];
const CREW_OPTIONS = ["Delivery Crew", "Driver", "Helper"];

export interface ReportRecord {
  id: string;
  date: string;
  orderId: string;
  client: string;
  status: string;
  crew: string;
  remarks: string;
}

// ==========================================
// REUSABLE DROPDOWN COMPONENT
// ==========================================
const FilterDropdown = ({
  id,
  label,
  options,
  value,
  setValue,
  activeDropdown,
  setActiveDropdown
}: {
  id: string;
  label: string;
  options: string[];
  value: string;
  setValue: (val: string) => void;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
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

export default function ReportsForecastingPage() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Filter States
  const [timeframe, setTimeframe] = useState(TIMEFRAME_OPTIONS[0]);
  const [month, setMonth] = useState(MONTH_OPTIONS[0]);
  const [client, setClient] = useState("Client");
  const [crew, setCrew] = useState(CREW_OPTIONS[0]);
  const [status, setStatus] = useState(STATUS_OPTIONS[0]);

  // Data States
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>(["Client"]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ==========================================
  // DATA FETCHING
  // ==========================================
  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        // Changed to use our secure custom wrapper and the new /api/bookings route!
        const orders = await apiFetch<any[]>("/api/bookings");

        const uniqueClients = new Set<string>();
        const formattedRecords: ReportRecord[] = [];

        if (Array.isArray(orders)) {
          orders.forEach((o: any) => {
            // 1. Client Formatting
            const clientObj = o.Client || o.client || {};
            let displayClient = clientObj.company || clientObj.companyName;
            if (!displayClient) {
              const match = o.notes?.match(/Name:\s*(.*)/);
              displayClient = match ? `Walk-in: ${match[1]}` : "Walk-in Customer";
            }
            uniqueClients.add(displayClient);

            // 2. Date Formatting
            const requestDateMatch = o.notes?.match(/Request Date:\s*([^\n]*)/);
            const reqDate = requestDateMatch 
              ? requestDateMatch[1].trim() 
              : new Date(o.createdAt).toISOString().split("T")[0];

            // 3. Crew Formatting (Check live dispatch order first, fallback to notes)
            const dispatchRecord = Array.isArray(o.DispatchOrder) ? o.DispatchOrder[0] : (o.DispatchOrder || o.dispatch_order);
            const driverName = dispatchRecord?.Driver?.employeeName || o.notes?.match(/Driver:\s*([^\n]*)/)?.[1]?.trim() || "Unassigned";
            const helperName = dispatchRecord?.Helper1?.employeeName || o.notes?.match(/Helper 1:\s*([^\n]*)/)?.[1]?.trim() || "None";
            const crewString = `Driver: ${driverName} | Helper: ${helperName}`;

            // 4. Status Routing
            const stopsArr = o.BranchStops || o.branchstops || o.branch_stops || [];
            const rawStatus = (stopsArr[0]?.stopStatus || "Pending").toLowerCase();
            let category = "Pending";
            
            if (rawStatus.includes("transit") || rawStatus.includes("progress")) {
              category = "In-Transit";
            } else if (rawStatus.includes("complete") || rawStatus.includes("delivered")) {
              category = "Delivered";
            } else if (rawStatus.includes("foul") || rawStatus.includes("fail") || rawStatus.includes("cancel")) {
              category = "Foul Trip";
            }

            formattedRecords.push({
              id: o.orderCode || o.orderID,
              date: reqDate,
              orderId: o.orderCode || o.orderID,
              client: displayClient,
              status: category,
              crew: crewString,
              remarks: "Retrieved from DB",
            });
          });
        }

        formattedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecords(formattedRecords);
        setClientOptions(["Client", ...Array.from(uniqueClients)]);
      } catch (error) {
        console.error("Failed to fetch reports:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  // ==========================================
  // FILTERING LOGIC
  // ==========================================
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (status !== "Final Status" && rec.status !== status) return false;
      if (client !== "Client" && rec.client !== client) return false;
      if (crew === "Driver" && !rec.crew.includes("Driver:")) return false;
      if (crew === "Helper" && (!rec.crew.includes("Helper:") || rec.crew.includes("None"))) return false;

      if (month !== "Month") {
        const recMonth = new Date(rec.date).toLocaleString('default', { month: 'long' });
        if (recMonth !== month) return false;
      }

      if (timeframe !== "Time Frame") {
        const d = new Date(rec.date);
        const t = new Date();
        d.setHours(0,0,0,0);
        t.setHours(0,0,0,0);

        if (timeframe === "Today" && d.getTime() !== t.getTime()) return false;
        if (timeframe === "This Year" && d.getFullYear() !== t.getFullYear()) return false;
        if (timeframe === "This Month" && (d.getMonth() !== t.getMonth() || d.getFullYear() !== t.getFullYear())) return false;
        if (timeframe === "This Week") {
          const startOfWeek = new Date(t);
          startOfWeek.setDate(t.getDate() - t.getDay());
          if (d < startOfWeek) return false;
        }
      }

      return true;
    });
  }, [records, timeframe, month, client, crew, status]);

  // Summary Math
  const totalHistorical = filteredRecords.length;
  const successfulDeliveries = filteredRecords.filter((r) => r.status === "Delivered").length;
  const foulTrips = filteredRecords.filter((r) => r.status === "Foul Trip").length;

  // Pagination Math
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [timeframe, month, client, crew, status]);

  const dropdownsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownsRef.current && !dropdownsRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered": return "bg-emerald-100 text-emerald-700";
      case "In-Transit": return "bg-blue-100 text-blue-700";
      case "Pending": return "bg-amber-100 text-amber-700";
      case "Foul Trip": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="space-y-6">
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Reports Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-700 mt-1">
              View delivery performance reports and analyze historical records.
            </p>
          </div>
        </div>

        {/* FILTER SECTION */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2>Filter Completed Reports</h2>
          </div>

          <div ref={dropdownsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <FilterDropdown id="timeframe" label="Timeframe" options={TIMEFRAME_OPTIONS} value={timeframe} setValue={setTimeframe} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
            <FilterDropdown id="month" label="Month" options={MONTH_OPTIONS} value={month} setValue={setMonth} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
            <FilterDropdown id="client" label="Client" options={clientOptions} value={client} setValue={setClient} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
            <FilterDropdown id="crew" label="Delivery Crew" options={CREW_OPTIONS} value={crew} setValue={setCrew} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
            <FilterDropdown id="status" label="Final Status" options={STATUS_OPTIONS} value={status} setValue={setStatus} activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
          </div>
        </div>

        {/* SUMMARY CARDS SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Total Historical</p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{totalHistorical}</h3>
            </div>
          </div>
          <div className="bg-green-50/50 p-4 sm:p-5 rounded-2xl border border-green-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Successful Deliveries</p>
              <h3 className="text-xl sm:text-2xl font-bold text-green-900">{successfulDeliveries}</h3>
            </div>
          </div>
          <div className="bg-red-50/50 p-4 sm:p-5 rounded-2xl border border-red-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">Foul Trip</p>
              <h3 className="text-xl sm:text-2xl font-bold text-red-900">{foulTrips}</h3>
            </div>
          </div>
        </div>

        {/* DATA TABLE SECTION */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col w-full">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">Delivery Records</h2>
          </div>

          <div className="w-full overflow-x-auto pb-2 min-h-[300px]">
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

              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                      <p className="text-slate-600 text-sm font-medium">Loading records...</p>
                    </td>
                  </tr>
                ) : paginatedRecords.length > 0 ? (
                  paginatedRecords.map((record, idx) => (
                    <tr key={record.id || idx} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-sm text-slate-800">
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">{record.date}</td>
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 whitespace-nowrap">{record.orderId}</td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">{record.client}</td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>{record.status}</span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-xs text-slate-500">{record.crew}</td>
                      <td className="py-3.5 px-4 sm:px-6 truncate max-w-xs text-xs text-slate-500">{record.remarks}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 sm:py-16 text-center">
                      <div className="flex flex-col items-center justify-center px-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-slate-900 font-medium text-sm">No delivery records found</p>
                        <p className="text-slate-600 text-xs mt-1 max-w-sm">Adjust your filters or try a different search combination.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Dynamic Pagination Footer */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
            <span>Showing {filteredRecords.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length} entries</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Previous</button>
              <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}