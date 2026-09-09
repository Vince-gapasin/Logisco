"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  TrendingUp,
  FileText,
  ChevronDown,
  Filter,
  BarChart3,
  XCircle,
  CheckCircle2,
  Calendar,
  Loader2,
  Clock,
  Truck,
  AlertTriangle,
  X,
  Search,
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
// STATIC FILTER OPTIONS & DUMMY DATA
// ==========================================
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

const STATUS_OPTIONS = [
  "Final Status",
  "Delivered",
  "Foul Trip",
  "Pending",
  "In-Transit",
];

const DUMMY_CLIENTS = [
  "Jollibee – Katipunan",
  "Popeyes – Sta. Mesa",
  "KFC – Cubao",
  "McDonald’s – Ortigas",
  "Chowking – Quezon Avenue",
  "Mang Inasal - Diliman",
  "Burger King - Timog",
  "Greenwich - Trinoma",
  "Pizza Hut - SM North",
  "Shakey's - Tomas Morato",
];

const DUMMY_DRIVERS = [
  "Juan Dela Cruz",
  "Luis Manzano",
  "Pedro Penduko",
  "Cardo Dalisay",
  "Coco Martin",
  "Vic Sotto",
  "Joey de Leon",
  "Daniel Padilla",
  "Dingdong Dantes",
];

const DUMMY_HELPERS = [
  "Mark Reyes",
  "John Doe",
  "Andres Bonifacio",
  "Apolinario Mabini",
  "Emilio Aguinaldo",
  "Jose Rizal",
  "Antonio Luna",
  "Marcelo Del Pilar",
  "Lapu-Lapu",
];

export interface ReportRecord {
  id: string;
  date: string;
  orderId: string;
  client: string;
  status: string;
  crew: string;
  remarks: string;
  rawOrder?: any;
  dispatchStatus?: string;
  driverConfirmed?: boolean;
  helperConfirmed?: boolean;
}

// ==========================================
// VIEW BOOKING MODAL (READ-ONLY) - REUSED FROM DASHBOARD
// ==========================================

function ViewOrderModal({
  isOpen,
  onClose,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}) {
  if (!isOpen || !order) return null;

  const raw = order.rawOrder || {};
  const notes = raw.notes || "";
  const category = order.statusCategory || order.status || "Pending Bookings";
  const isPending = category === "Pending Bookings" || category === "Pending";

  const clientInfo = raw.Client || raw.client || {};
  const cName =
    clientInfo.company ||
    clientInfo.companyName ||
    notes.match(/Name:\s*(.*)/)?.[1] ||
    order.client ||
    "Walk-in Customer";
  const cPerson =
    clientInfo.contactName ||
    clientInfo.contactPerson ||
    notes.match(/Contact:\s*(.*?)\s*\(/)?.[1] ||
    "N/A";
  const cNum =
    clientInfo.contact ||
    clientInfo.contactNumber ||
    notes.match(/\((.*?)\)/)?.[1] ||
    "N/A";
  const cEmail =
    clientInfo.emailAdd || clientInfo.emailAddress || clientInfo.email || "N/A";
  const cAddr =
    clientInfo.businessAdd ||
    clientInfo.businessAddress ||
    clientInfo.address ||
    "N/A";

  const priority = notes.match(/Priority:\s*(.*)/)?.[1] || "Standard";
  const reqDate =
    notes.match(/Request Date:\s*(.*)/)?.[1] ||
    new Date(raw.createdAt || Date.now()).toLocaleDateString();
  const delSchedule =
    notes.match(/Delivery Schedule:\s*(.*)/)?.[1] || order.date || "N/A";

  const pickupLine = notes.match(/Pickup:\s*(.*)/)?.[1] || "N/A @ N/A";
  const pickupParts = pickupLine.split(" @ ");
  const pickupAddr = pickupParts[0]?.trim() || "N/A";
  const pickupTime = pickupParts[1]?.trim() || "N/A";

  const dispatchRecord = Array.isArray(raw.DispatchOrder)
    ? raw.DispatchOrder[0]
    : raw.DispatchOrder || raw.dispatch_order;

  const truck =
    dispatchRecord?.Truck?.plateNumber ||
    notes.match(/Truck:\s*(.*)/)?.[1] ||
    "Unassigned";
  const driver =
    dispatchRecord?.Driver?.employeeName ||
    notes.match(/Driver:\s*(.*)/)?.[1] ||
    "Unassigned";
  const h1 =
    dispatchRecord?.Helper1?.employeeName ||
    notes.match(/Helper 1:\s*(.*)/)?.[1] ||
    "None";
  const h2 =
    dispatchRecord?.Helper2?.employeeName ||
    notes.match(/Helper 2:\s*(.*)/)?.[1] ||
    "None";

  const actualNotesParts = notes.split("[NOTES]");
  const actualNotes =
    actualNotesParts.length > 1 ? actualNotesParts[1].trim() : "None";

  const itemsArr =
    raw.OrderDetails || raw.orderdetails || raw.order_details || [];
  const product = itemsArr[0]?.productName || order.product || "Multiple Items";
  const quantity = itemsArr[0]?.quantity || 1;

  const stopsArr = raw.BranchStops || raw.branchstops || raw.branch_stops || [];
  const deliveries =
    stopsArr.length > 0
      ? stopsArr
      : [
          {
            branchName: "N/A",
            deliveryAddress: "N/A",
            contactPerson: cPerson,
            contactNum: cNum,
            expectedTime: "N/A",
            quantity: quantity,
            stopStatus: "Pending",
          },
        ];

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 cursor-default focus:outline-none";

  const hasHelper = h1 !== "None" && h1 !== "N/A" && h1 !== "Unassigned";
  const isCrewConfirmed =
    order.dispatchStatus === "Accepted" ||
    (order.driverConfirmed && (!hasHelper || order.helperConfirmed));

  const headerColors: Record<string, string> = {
    "Pending Bookings": "bg-[#000c31] border-slate-800",
    Pending: "bg-[#000c31] border-slate-800",
    "In-Transit": "bg-blue-600 border-blue-800",
    Completed: "bg-green-600 border-green-800",
    Delivered: "bg-green-600 border-green-800",
    "Foul Trip": "bg-red-600 border-red-800",
  };
  const headerClass =
    headerColors[category] || headerColors["Pending Bookings"];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
        <div
          className={`flex items-center justify-between px-6 py-4 text-white border-b transition-colors ${headerClass}`}
        >
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Booking Details: {order.orderId}
            </h2>
            <p className="text-xs font-medium opacity-80 mt-0.5">
              Created on{" "}
              {raw.createdAt
                ? new Date(raw.createdAt).toLocaleString()
                : order.date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-black/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900">
          <div
            className={`px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm font-bold shadow-sm border ${
              isPending && !isCrewConfirmed
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : category === "In-Transit"
                  ? "bg-blue-50 border-blue-200 text-blue-800"
                  : category === "Completed" || category === "Delivered"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : category === "Foul Trip"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : "bg-orange-50 border-orange-200 text-orange-800"
            }`}
          >
            {isPending && !isCrewConfirmed ? (
              <>
                <Clock className="w-5 h-5 text-amber-600" /> Waiting for Crew
                Confirmation
              </>
            ) : category === "In-Transit" ? (
              <>
                <Truck className="w-5 h-5 text-blue-600" /> Currently In-Transit
              </>
            ) : category === "Completed" || category === "Delivered" ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" /> Delivery
                Completed
              </>
            ) : category === "Foul Trip" ? (
              <>
                <AlertTriangle className="w-5 h-5 text-red-600" /> Foul Trip /
                Cancelled
              </>
            ) : (
              <>
                <Clock className="w-5 h-5 text-orange-600" /> Crew Confirmed -
                Awaiting Dispatch
              </>
            )}
          </div>

          <div className="space-y-6">
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                1. Client Information
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Company Name
                  </label>
                  <input readOnly value={cName} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Contact Person
                  </label>
                  <input readOnly value={cPerson} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Contact Number
                  </label>
                  <input readOnly value={cNum} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Email Address
                  </label>
                  <input readOnly value={cEmail} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Business Address
                  </label>
                  <input readOnly value={cAddr} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                2. Pickup Address
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs min-w-150">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                      <th className="p-2.5 border-r border-slate-200 w-[20%]">
                        Warehouse Name
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[25%]">
                        Address
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Person
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Number
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[12%]">
                        Pick Up Time
                      </th>
                      <th className="p-2.5 text-center">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200 font-medium text-slate-700">
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        Origin Location
                      </td>
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        {pickupAddr}
                      </td>
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        {cPerson}
                      </td>
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        {cNum}
                      </td>
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        {pickupTime}
                      </td>
                      <td className="p-2 text-center bg-slate-50">
                        {quantity}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                3. Delivery Itinerary & Status
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs min-w-150">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                      <th className="p-2.5 border-r border-slate-200 w-[20%]">
                        Branch Name
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[20%]">
                        Delivery Address
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Person
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Number
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[10%]">
                        Expected Time
                      </th>
                      <th className="p-2.5 border-r border-slate-200 text-center w-[10%]">
                        Quantity
                      </th>
                      <th className="p-2.5 text-center w-[10%]">Stop Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d: any, idx: number) => {
                      const st = d.stopStatus?.toLowerCase() || "pending";
                      let badgeClass = "bg-orange-100 text-orange-700";
                      if (st.includes("transit") || st.includes("progress"))
                        badgeClass = "bg-blue-100 text-blue-700";
                      if (st.includes("complete") || st.includes("delivered"))
                        badgeClass = "bg-green-100 text-green-700";
                      if (
                        st.includes("fail") ||
                        st.includes("foul") ||
                        st.includes("cancel")
                      )
                        badgeClass = "bg-red-100 text-red-700";

                      return (
                        <tr
                          key={idx}
                          className="border-b border-slate-200 font-medium text-slate-700"
                        >
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.branchName || "Branch"}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.deliveryAddress || d.branchName || "N/A"}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.contactPerson || cPerson}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.contactNum || d.contactNumber || cNum}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.expectedTime || "N/A"}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center bg-slate-50">
                            {d.quantity || quantity}
                          </td>
                          <td className="p-2 text-center bg-slate-50">
                            <span
                              className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
                            >
                              {d.stopStatus || order.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                4. Booking Details & Schedule
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Request Date
                  </label>
                  <input readOnly value={reqDate} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Delivery Schedule
                  </label>
                  <input readOnly value={delSchedule} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Product To Deliver
                  </label>
                  <input readOnly value={product} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Priority Level
                  </label>
                  <input readOnly value={priority} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                5. Assigned Delivery Crew & Vehicle
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Truck Plate No.
                  </label>
                  <input readOnly value={truck} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Driver
                  </label>
                  <input readOnly value={driver} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Helper #1
                  </label>
                  <input readOnly value={h1} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Helper #2
                  </label>
                  <input readOnly value={h2} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                6. Notes / Instructions
              </div>
              <textarea
                readOnly
                rows={3}
                value={actualNotes}
                className="w-full resize-y bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none cursor-default"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className={`w-full sm:w-auto px-8 py-2.5 text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer ${
              category === "In-Transit"
                ? "bg-blue-600 hover:bg-blue-700"
                : category === "Completed" || category === "Delivered"
                  ? "bg-green-600 hover:bg-green-700"
                  : category === "Foul Trip"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#000c31] hover:bg-slate-800"
            }`}
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// REUSABLE DROPDOWN COMPONENTS
// ==========================================
const FilterDropdown = ({
  id,
  label,
  options,
  value,
  setValue,
  activeDropdown,
  setActiveDropdown,
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
        className="w-full flex items-center justify-between bg-white border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm cursor-pointer"
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
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 cursor-pointer ${
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

const MultiSelectDropdown = ({
  id,
  label,
  options,
  selectedValues,
  setSelectedValues,
  activeDropdown,
  setActiveDropdown,
  placeholder,
}: {
  id: string;
  label: string;
  options: string[];
  selectedValues: string[];
  setSelectedValues: React.Dispatch<React.SetStateAction<string[]>>;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
  placeholder: string;
}) => {
  const isOpen = activeDropdown === id;
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const toggleSelection = (opt: string) => {
    if (selectedValues.includes(opt)) {
      setSelectedValues(selectedValues.filter((v) => v !== opt));
    } else {
      setSelectedValues([...selectedValues, opt]);
    }
  };

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="relative w-full">
      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <button
        onClick={() => setActiveDropdown(isOpen ? null : id)}
        className="w-full flex items-center justify-between bg-white border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm cursor-pointer"
      >
        <span className="truncate pr-2">
          {selectedValues.length === 0
            ? placeholder
            : selectedValues.length === 1
              ? selectedValues[0]
              : `${selectedValues.length} Selected`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500 italic text-center">
                No results found
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center w-full px-3 py-2 text-sm transition-colors hover:bg-slate-50 cursor-pointer text-slate-700 rounded-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt)}
                    onChange={() => toggleSelection(opt)}
                    className="mr-3 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              ))
            )}
          </div>
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
  const [status, setStatus] = useState(STATUS_OPTIONS[0]);

  // Multi-Select Filter States
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>([]);

  // Custom Date Range States
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Data States
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>(DUMMY_CLIENTS);
  const [driverOptions, setDriverOptions] = useState<string[]>(DUMMY_DRIVERS);
  const [helperOptions, setHelperOptions] = useState<string[]>(DUMMY_HELPERS);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State for Booking details view
  const [selectedOrderForView, setSelectedOrderForView] = useState<any>(null);
  const [isViewOrderModalOpen, setIsViewOrderModalOpen] = useState(false);

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
        const orders = await apiFetch<any[]>("/api/bookings");

        const uniqueClients = new Set<string>();
        const uniqueDrivers = new Set<string>();
        const uniqueHelpers = new Set<string>();
        const formattedRecords: ReportRecord[] = [];

        if (Array.isArray(orders)) {
          orders.forEach((o: any) => {
            const clientObj = o.Client || o.client || {};
            let displayClient = clientObj.company || clientObj.companyName;
            if (!displayClient) {
              const match = o.notes?.match(/Name:\s*(.*)/);
              displayClient = match
                ? `Walk-in: ${match[1]}`
                : "Walk-in Customer";
            }
            uniqueClients.add(displayClient);

            const requestDateMatch = o.notes?.match(/Request Date:\s*([^\n]*)/);
            const reqDate = requestDateMatch
              ? requestDateMatch[1].trim()
              : new Date(o.createdAt).toISOString().split("T")[0];

            const dispatchRecord = Array.isArray(o.DispatchOrder)
              ? o.DispatchOrder[0]
              : o.DispatchOrder || o.dispatch_order;

            const driverName =
              dispatchRecord?.Driver?.employeeName ||
              o.notes?.match(/Driver:\s*([^\n]*)/)?.[1]?.trim() ||
              "Unassigned";

            const helperAssignment = Array.isArray(
              dispatchRecord?.DispatchHelper,
            )
              ? dispatchRecord.DispatchHelper[0]
              : dispatchRecord?.DispatchHelper;

            const helperName =
              helperAssignment?.Helper?.employeeName ||
              o.notes?.match(/Helper 1:\s*([^\n]*)/)?.[1]?.trim() ||
              "None";

            const crewString = `Driver: ${driverName} | Helper: ${helperName}`;

            uniqueDrivers.add(driverName);
            uniqueHelpers.add(helperName);

            const stopsArr =
              o.BranchStops || o.branchstops || o.branch_stops || [];
            const rawStatus = (
              stopsArr[0]?.stopStatus || "Pending"
            ).toLowerCase();
            let category = "Pending";

            if (
              rawStatus.includes("transit") ||
              rawStatus.includes("progress")
            ) {
              category = "In-Transit";
            } else if (
              rawStatus.includes("complete") ||
              rawStatus.includes("delivered")
            ) {
              category = "Delivered";
            } else if (
              rawStatus.includes("foul") ||
              rawStatus.includes("fail") ||
              rawStatus.includes("cancel")
            ) {
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
              rawOrder: o,
              dispatchStatus: dispatchRecord?.status,
              driverConfirmed: Boolean(o.driverConfirmed || o.driver_confirmed),
              helperConfirmed: Boolean(o.helperConfirmed || o.helper_confirmed),
            });
          });
        }

        formattedRecords.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setRecords(formattedRecords);

        // Populate options arrays
        setClientOptions(
          Array.from(
            new Set([...DUMMY_CLIENTS, ...Array.from(uniqueClients)]),
          ).sort(),
        );
        setDriverOptions(
          Array.from(
            new Set([...DUMMY_DRIVERS, ...Array.from(uniqueDrivers)]),
          ).sort(),
        );
        setHelperOptions(
          Array.from(
            new Set([...DUMMY_HELPERS, ...Array.from(uniqueHelpers)]),
          ).sort(),
        );
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

      // Client Filter (Multi-select)
      if (selectedClients.length > 0 && !selectedClients.includes(rec.client))
        return false;

      // Extract specific driver/helper values from the combined crew string for filtering
      const recDriverMatch = rec.crew.match(/Driver:\s*(.*?)\s*\|/);
      const recDriver = recDriverMatch
        ? recDriverMatch[1].trim()
        : "Unassigned";
      if (selectedDrivers.length > 0 && !selectedDrivers.includes(recDriver))
        return false;

      const recHelperMatch = rec.crew.match(/Helper:\s*(.*)/);
      const recHelper = recHelperMatch ? recHelperMatch[1].trim() : "None";
      if (selectedHelpers.length > 0 && !selectedHelpers.includes(recHelper))
        return false;

      if (timeframe !== "All Time") {
        const d = new Date(rec.date);
        const t = new Date();
        d.setHours(0, 0, 0, 0);
        t.setHours(0, 0, 0, 0);

        if (timeframe === "Today" && d.getTime() !== t.getTime()) return false;

        if (timeframe === "Tomorrow") {
          const tomorrow = new Date(t);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (d.getTime() !== tomorrow.getTime()) return false;
        }

        if (timeframe === "Last 7 Days") {
          const last7 = new Date(t);
          last7.setDate(last7.getDate() - 7);
          if (d < last7 || d > t) return false;
        }

        if (timeframe === "Last 30 Days") {
          const last30 = new Date(t);
          last30.setDate(last30.getDate() - 30);
          if (d < last30 || d > t) return false;
        }

        if (timeframe === "This Year" && d.getFullYear() !== t.getFullYear())
          return false;

        if (
          timeframe === "This Month" &&
          (d.getMonth() !== t.getMonth() || d.getFullYear() !== t.getFullYear())
        )
          return false;

        if (timeframe === "This Week") {
          const startOfWeek = new Date(t);
          startOfWeek.setDate(t.getDate() - t.getDay());
          if (d < startOfWeek) return false;
        }

        if (timeframe === "Up to Date" && d > t) return false;

        if (timeframe === "Custom Date Range") {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (d < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (d > end) return false;
          }
        }
      }

      return true;
    });
  }, [
    records,
    timeframe,
    selectedClients,
    selectedDrivers,
    selectedHelpers,
    status,
    customStartDate,
    customEndDate,
  ]);

  // Summary Math
  const totalHistorical = filteredRecords.length;
  const successfulDeliveries = filteredRecords.filter(
    (r) => r.status === "Delivered",
  ).length;
  const foulTrips = filteredRecords.filter(
    (r) => r.status === "Foul Trip",
  ).length;

  // Pagination Math
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    timeframe,
    selectedClients,
    selectedDrivers,
    selectedHelpers,
    status,
    customStartDate,
    customEndDate,
  ]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered":
        return "bg-emerald-100 text-emerald-700";
      case "In-Transit":
        return "bg-blue-100 text-blue-700";
      case "Pending":
        return "bg-amber-100 text-amber-700";
      case "Foul Trip":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const handleRowClick = (record: ReportRecord) => {
    setSelectedOrderForView(record);
    setIsViewOrderModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="space-y-6">
        {/* HEADER SECTION ALIGNED WITH THE BUTTON */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Reports Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-700 mt-1">
              View delivery performance reports and analyze historical records.
            </p>
          </div>

          {/* Action Button: */}
          <div className="w-full sm:w-auto">
            <a
              href="/admindashboard/forecasting"
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white font-semibold rounded-xl shadow-md transition-all duration-200 text-sm whitespace-nowrap cursor-pointer"
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Forecasting</span>
            </a>
          </div>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 mt-6">
        <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
          <Filter className="w-4 h-4 text-blue-600" />
          <h2>Filter Completed Reports</h2>
        </div>

        <div
          ref={dropdownsRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
        >
          <FilterDropdown
            id="timeframe"
            label="Timeframe"
            options={TIMEFRAME_OPTIONS}
            value={timeframe}
            setValue={setTimeframe}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
          />
          <MultiSelectDropdown
            id="client"
            label="Client"
            options={clientOptions}
            selectedValues={selectedClients}
            setSelectedValues={setSelectedClients}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
            placeholder="All Clients"
          />
          <MultiSelectDropdown
            id="drivers"
            label="Drivers"
            options={driverOptions}
            selectedValues={selectedDrivers}
            setSelectedValues={setSelectedDrivers}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
            placeholder="All Drivers"
          />
          <MultiSelectDropdown
            id="helpers"
            label="Helpers"
            options={helperOptions}
            selectedValues={selectedHelpers}
            setSelectedValues={setSelectedHelpers}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
            placeholder="All Helpers"
          />
          <FilterDropdown
            id="status"
            label="Final Status"
            options={STATUS_OPTIONS}
            value={status}
            setValue={setStatus}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
          />
        </div>

        {/* CUSTOM DATE RANGE FIELDS */}
        {timeframe === "Custom Date Range" && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 animate-fade-in mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full bg-white border border-slate-200 text-sm text-slate-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* SUMMARY CARDS SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Total Historical
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              {totalHistorical}
            </h3>
          </div>
        </div>
        <div className="bg-green-50/50 p-4 sm:p-5 rounded-2xl border border-green-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
              Successful Deliveries
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-green-900">
              {successfulDeliveries}
            </h3>
          </div>
        </div>
        <div className="bg-red-50/50 p-4 sm:p-5 rounded-2xl border border-red-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">
              Foul Trip
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-red-900">
              {foulTrips}
            </h3>
          </div>
        </div>
      </div>

      {/* DATA TABLE SECTION */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col w-full mt-6">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Delivery Records
          </h2>
        </div>

        <div className="w-full overflow-x-auto pb-2 min-h-75">
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
                    <p className="text-slate-600 text-sm font-medium">
                      Loading records...
                    </p>
                  </td>
                </tr>
              ) : paginatedRecords.length > 0 ? (
                paginatedRecords.map((record, idx) => (
                  <tr
                    key={record.id || idx}
                    onClick={() => handleRowClick(record)}
                    className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-sm text-slate-800 cursor-pointer"
                  >
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                      {record.date}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 whitespace-nowrap">
                      {record.orderId}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                      {record.client}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-xs text-slate-500">
                      {record.crew}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 truncate max-w-xs text-xs text-slate-500">
                      {record.remarks}
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
                        Adjust your filters or try a different search
                        combination.
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
            Showing {filteredRecords.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredRecords.length)} of{" "}
            {filteredRecords.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
            >
              Previous
            </button>
            <span className="mx-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Reused View Booking Modal */}
      <ViewOrderModal
        isOpen={isViewOrderModalOpen}
        onClose={() => setIsViewOrderModalOpen(false)}
        order={selectedOrderForView}
      />
    </div>
  );
}
