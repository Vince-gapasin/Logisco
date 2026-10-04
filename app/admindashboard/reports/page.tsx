"use client";

import Link from "next/link";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { mapOrderToBookingView, toFeedBooking, type OrderWithRelations, liveDispatchOf } from "@/app/lib/bookingView";
import BookingHistoryPanel from "@/components/booking/BookingHistoryPanel";
import BookingStopsReadOnly from "@/components/booking/BookingStopsReadOnly";
import DeliveryProgress from "@/components/booking/DeliveryProgress";
import {
  AssignedCrew,
  BookingNotes,
  BookingSchedule,
  ClientInformation,
} from "@/components/booking/BookingReadOnly";
import { hasDriverAccepted, haveHelpersAccepted } from "@/app/lib/enums";
import { formatDateTime, todayInManila } from "@/app/lib/datetime";
import { useToast } from "@/components/Toast";
import SubconTripsPanel from "@/components/subcon/SubconTripsPanel";
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
  X,
  Search,
  History,
  Download,
} from "lucide-react";

// ==========================================
// SESSION & API FETCH
// ==========================================

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
  "Cancelled",
  "Pending",
  "In-Transit",
];

export interface ReportRecord {
  id: string;
  date: string;
  orderId: string;
  client: string;
  status: string;
  crew: string;
  remarks: string;
  rawOrder?: OrderWithRelations;
  dispatchStatus?: string;
  driverConfirmed?: boolean;
  helperConfirmed?: boolean;
}

// ==========================================
// VIEW BOOKING MODAL (READ-ONLY) - REUSED FROM DASHBOARD
// ==========================================

// The proof shapes live with the component that renders them, in
// components/booking/StopProofList.tsx - copies of them here were how this screen
// and the dashboard drifted apart in the first place.

// The same booking record the delivery feeds show.
//
// This screen had its own modal: six hand-written sections that had drifted from
// the ones the feeds use - a different header, no progress tracker, no history,
// and an unnumbered proof card wedged into the middle of the sequence. So the
// same booking read differently depending on which screen you opened it from.
//
// It is composed from the shared sections now, in the same order, from the same
// mapper. Whatever those sections gain, this gains, and neither can drift from
// the other again.
function ViewOrderModal({
  isOpen,
  onClose,
  order,
  onOpenHistory,
}: {
  isOpen: boolean;
  onClose: () => void;
  order: ReportRecord | null;
  /**
   * Takes the booking's real ID, which this modal has and its caller does not:
   * ReportRecord.id is the order code, and the history endpoint wants the UUID.
   */
  onOpenHistory: (orderID: string) => void;
}) {
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !order) return null;

  // Through the same two mappers the feeds use, so the sections receive exactly
  // what they receive there.
  const view = mapOrderToBookingView((order.rawOrder ?? {}) as OrderWithRelations);
  const booking = toFeedBooking(view);

  const fields: Record<string, string> = {
    clientName: booking.clientName || "",
    contactPerson: booking.contactPerson || "",
    contactNumber: booking.contactNumber || "",
    emailAddress: booking.emailAddress || "",
    businessAddress: booking.businessAddress || "",
    requestDate: booking.dateCreated || "",
    deliverySchedule: booking.scheduledDate || "",
    product: booking.product || "",
    priorityLevel: booking.priorityLevel || "Standard",
    subconPartner: booking.subconPartner || "",
    truckPlate: booking.truckPlate === "Not Assigned" ? "" : booking.truckPlate,
    driver: booking.driver === "Not Assigned" ? "" : booking.driver,
    helper1: booking.crews?.find((member) => member.role === "Helper #1")?.name ?? "",
    helper2: booking.crews?.find((member) => member.role === "Helper #2")?.name ?? "",
    notes: booking.notes || "",
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-full flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 wrap-break-word">
              <FileText className="w-5 h-5 shrink-0" /> Booking Details: {booking.orderId}
            </h2>
            <p className="text-xs font-medium opacity-80 mt-0.5">
              Status: {booking.status} | {booking.confirmationStatus}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 md:p-6 bg-white shadow-xs flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto flex-1">
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Date Created
                </p>
                <p className="text-xs font-bold text-slate-800">{booking.dateCreated}</p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Created By
                </p>
                <p className="text-xs font-bold text-slate-800">{booking.createdBy}</p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Order Priority
                </p>
                <span
                  className={`inline-flex px-2 py-0.5 rounded font-bold text-xs sm:text-[10px] uppercase tracking-wider ${
                    booking.priorityLevel === "High Priority" || booking.priorityLevel === "Urgent"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {booking.priorityLevel}
                </span>
              </div>
            </div>

            <div className="w-full md:w-87.5 shrink-0">
              <h3 className="text-xs sm:text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2 md:text-right">
                Delivery Progress
              </h3>
              <DeliveryProgress currentStatus={booking.status} />
            </div>
          </div>

          <ClientInformation fields={fields} />

          <BookingStopsReadOnly
            pickups={booking.pickupList ?? []}
            deliveries={booking.deliveryList ?? []}
            showStatus
            showEditNote={false}
          />

          <BookingSchedule fields={fields} scheduledFor={booking.displayDate} />

          <AssignedCrew fields={fields} sectionRef={crewSectionRef} />

          <BookingNotes notes={fields.notes} />

        </div>

        {/* FIXED FOOTER */}
        <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 flex flex-row justify-end gap-2 sm:gap-4 bg-slate-50">
          {/* What happened to this booking, and where its proofs are. It was
              the seventh section of this modal, which meant scrolling past
              everything else to reach the part most often wanted. Behind a
              button, like the mechanic's repair history and the office's
              maintenance history. */}
          <button
            type="button"
            onClick={() => onOpenHistory(booking.id)}
            className="w-auto sm:w-auto px-3.5 sm:px-6 py-2 sm:py-2.5 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
          >
            <History className="w-4 h-4 shrink-0" />
            History
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-auto sm:w-auto px-3.5 sm:px-6 py-2 sm:py-2.5 bg-slate-200 hover:bg-black hover:text-white text-slate-800 font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Close<span className="hidden sm:inline"> Details</span>
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
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
              className={`min-h-tap md:min-h-0 inline-flex items-center justify-start w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 cursor-pointer ${
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
      // Clearing the search when the picker closes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
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
  // Delivery records, or the partner trips the coordinator keeps up to date.
  const showToast = useToast();
  const [view, setView] = useState<"records" | "subcon">("records");
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
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [driverOptions, setDriverOptions] = useState<string[]>([]);
  const [helperOptions, setHelperOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State for Booking details view
  const [selectedOrderForView, setSelectedOrderForView] = useState<ReportRecord | null>(null);
  const [historyFor, setHistoryFor] = useState<
    { orderID: string; orderCode: string; client: string } | null
  >(null);
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
        // Summary rows only: the table shows a line per booking, and the
        // full booking is fetched when one is opened.
        const orders = await apiFetch<OrderWithRelations[]>("/api/bookings?view=summary");

        const uniqueClients = new Set<string>();
        const uniqueDrivers = new Set<string>();
        const uniqueHelpers = new Set<string>();
        const formattedRecords: ReportRecord[] = [];

        if (Array.isArray(orders)) {
          orders.forEach((o) => {
            const clientObj = (Array.isArray(o.Client) ? o.Client[0] : o.Client) ?? {};
            let displayClient = clientObj.company;
            if (!displayClient) {
              const match = o.notes?.match(/Name:\s*(.*)/);
              displayClient = match
                ? `Walk-in: ${match[1]}`
                : "Walk-in Customer";
            }
            uniqueClients.add(displayClient);

            // The delivery day, as the dashboard has it: what a report of
            // deliveries is dated by. It was the day the booking was taken, so
            // a delivery booked on the 1st for the 5th counted in the wrong
            // day's, and sometimes the wrong month's, figures. Older bookings
            // with no delivery day fall back to that.
            const scheduleMatch = o.notes?.match(/Delivery Schedule:\s*([^\n]*)/);
            const requestDateMatch = o.notes?.match(/Request Date:\s*([^\n]*)/);
            const reqDate =
              scheduleMatch?.[1]?.trim() ||
              requestDateMatch?.[1]?.trim() ||
              (o.createdAt ? todayInManila(new Date(o.createdAt)) : "");

            // The trip it is on now, not the first one it ever had.
            const dispatchRecord = liveDispatchOf(o.DispatchOrder);

            const driverPerson = Array.isArray(dispatchRecord?.Driver)
              ? dispatchRecord?.Driver[0]
              : dispatchRecord?.Driver;
            const driverName =
              driverPerson?.employeeName ||
              o.notes?.match(/Driver:\s*([^\n]*)/)?.[1]?.trim() ||
              "Unassigned";

            const helperAssignment = Array.isArray(
              dispatchRecord?.DispatchHelper,
            )
              ? dispatchRecord.DispatchHelper[0]
              : dispatchRecord?.DispatchHelper;

            const helperPerson = Array.isArray(helperAssignment?.Helper)
              ? helperAssignment?.Helper[0]
              : helperAssignment?.Helper;
            const helperName =
              helperPerson?.employeeName ||
              o.notes?.match(/Helper 1:\s*([^\n]*)/)?.[1]?.trim() ||
              "None";

            const crewString = `Driver: ${driverName} | Helper: ${helperName}`;

            uniqueDrivers.add(driverName);
            uniqueHelpers.add(helperName);

            const stopsArr = Array.isArray(o.BranchStops)
              ? o.BranchStops
              : o.BranchStops
                ? [o.BranchStops]
                : [];
            // The dispatch status is what actually advances; stopStatus is
            // only written when a proof of delivery is uploaded, so relying on
            // it reported finished trips as "Pending".
            const dispatchStatusValue = dispatchRecord?.status ?? "";
            const rawStatus = (
              stopsArr[0]?.stopStatus || "Pending"
            ).toLowerCase();

            let category = "Pending";

            if (["Completed", "Delivered", "Returned"].includes(dispatchStatusValue)) {
              category = "Delivered";
            } else if (dispatchStatusValue === "Cancelled") {
              category = "Cancelled";
            } else if (dispatchStatusValue === "Foul Trip") {
              category = "Foul Trip";
            } else if (dispatchStatusValue === "Rejected") {
              // A crew turned it down and it is waiting for another, as the
              // dashboard has it. Counted as a foul trip here, it inflated the
              // foul-trip total with deliveries nothing had gone wrong with.
              category = "Pending";
            } else if (dispatchStatusValue === "In Transit") {
              category = "In-Transit";
            } else if (
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
              id: o.orderCode || o.orderID || "",
              date: reqDate,
              orderId: o.orderCode || o.orderID || "",
              client: displayClient,
              status: category,
              crew: crewString,
              // Why it did not finish, where that was recorded: a driver's
              // reason for declining, or the coordinator's for cancelling. It
              // used to read "Retrieved from DB" on every row, which is not a
              // remark about the delivery - it is a note about the fetch.
              //
              // Empty for a trip that simply ran, because there is nothing
              // short and true to say about one. What happened on it is behind
              // the History button, in full.
              remarks: dispatchRecord?.rejectionreason?.trim() || "",
              rawOrder: o,
              dispatchStatus: dispatchRecord?.status,
              // From the trip itself. These used to read Order columns named
              // driverConfirmed and helper_confirmed, which do not exist, so
              // both were always false and a confirmed crew never showed as
              // one on this screen.
              driverConfirmed: hasDriverAccepted(dispatchRecord?.status),
              helperConfirmed: haveHelpersAccepted(
                Array.isArray(dispatchRecord?.DispatchHelper)
                  ? dispatchRecord.DispatchHelper
                  : dispatchRecord?.DispatchHelper
                    ? [dispatchRecord.DispatchHelper]
                    : [],
              ),
            });
          });
        }

        formattedRecords.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setRecords(formattedRecords);

        // Populate options arrays
        setClientOptions(
          Array.from(uniqueClients).sort(),
        );
        setDriverOptions(
          Array.from(uniqueDrivers).sort(),
        );
        setHelperOptions(
          Array.from(uniqueHelpers).sort(),
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

  /**
   * What the report is of, in the words the filters are set in.
   *
   * On the page because a table of records without them is a table of some
   * records, and the reader of a printed one has no way of knowing which.
   */
  const filterSummary = useMemo(() => {
    const said = [`Period: ${timeframe}`];

    if (timeframe === "Custom Range" && (customStartDate || customEndDate)) {
      said[0] = `Period: ${customStartDate || "the beginning"} to ${customEndDate || "today"}`;
    }

    said.push(`Final status: ${status}`);
    said.push(
      selectedClients.length > 0 ? `Clients: ${selectedClients.join(", ")}` : "Clients: all",
    );
    if (selectedDrivers.length > 0) said.push(`Drivers: ${selectedDrivers.join(", ")}`);
    if (selectedHelpers.length > 0) said.push(`Helpers: ${selectedHelpers.join(", ")}`);

    return said;
  }, [timeframe, status, selectedClients, selectedDrivers, selectedHelpers, customStartDate, customEndDate]);

  const [isExporting, setIsExporting] = useState(false);

  /**
   * The records as a printable report.
   *
   * Every row the filters match, not the page of them on screen: pagination is
   * how a long table is read, not a limit on what was asked for.
   */
  const exportRecords = async () => {
    if (filteredRecords.length === 0) {
      showToast("There is nothing to export with these filters.", "error");
      return;
    }

    setIsExporting(true);
    try {
      const { startReport, toFileSlug } = await import("@/app/lib/pdfReport");
      const generatedAt = formatDateTime(new Date().toISOString());

      const report = await startReport({
        title: "Delivery Records",
        // Landscape because six columns of a delivery record do not fit across
        // a portrait page without cutting the ones that carry the detail.
        orientation: "landscape",
        meta: [...filterSummary, `Generated ${generatedAt}`],
      });

      const delivered = successfulDeliveries;
      const rate = totalHistorical > 0 ? Math.round((delivered / totalHistorical) * 100) : 0;

      report.figures([
        { label: "Records", value: String(totalHistorical) },
        { label: "Delivered", value: String(delivered) },
        { label: "Foul trips", value: String(foulTrips) },
        { label: "Delivered rate", value: `${rate}%` },
      ]);

      report.section("Records", `${totalHistorical} matching this filter`, 24);
      report.table(
        [
          { header: "Delivery Date", width: 25 },
          { header: "Order ID", width: 38 },
          { header: "Client", width: 55 },
          { header: "Final status", width: 26 },
          { header: "Crew", width: 58 },
          { header: "Remarks", width: 65 },
        ],
        filteredRecords.map((record) => [
          record.date,
          record.orderId,
          record.client,
          record.status,
          record.crew,
          record.remarks || "-",
        ]),
      );

      report.save(`delivery-records-${toFileSlug(timeframe)}-${toFileSlug(generatedAt)}.pdf`);
    } catch (error) {
      console.error("Export failed:", error);
      showToast("The report could not be built. Try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Pagination Math
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  useEffect(() => {
    // Back to page one whenever the filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleRowClick = async (record: ReportRecord) => {
    setSelectedOrderForView(record);
    setIsViewOrderModalOpen(true);

    // The list row carries only summary columns. Fetch the stops, pickups,
    // items and proof of delivery the modal renders.
    const orderID = record.rawOrder?.orderID;
    if (!orderID || record.rawOrder?.BranchStops) return;

    try {
      const full = await apiFetch<{ data: OrderWithRelations }>(`/api/bookings/${orderID}`);
      if (!full?.data) return;

      setRecords((prev) =>
        prev.map((row) => (row.id === record.id ? { ...row, rawOrder: full.data } : row)),
      );
      setSelectedOrderForView((current: ReportRecord | null) =>
        current && current.id === record.id ? { ...current, rawOrder: full.data } : current,
      );
    } catch (error) {
      console.error("Failed to load booking detail:", error);
    }
  };

  // Its own screen rather than a panel inside the record, which is how the
  // mechanic's module does it and what the office asked the truck history to
  // match. Three lists behind a History button now, all the same shape.
  if (historyFor) {
    return (
      <BookingHistoryPanel
        orderID={historyFor.orderID}
        orderCode={historyFor.orderCode}
        clientName={historyFor.client}
        onBack={() => setHistoryFor(null)}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh]">
      <div className="space-y-6">
        {/* HEADER SECTION ALIGNED WITH THE BUTTON */}
        <div className="flex flex-row flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Reports Dashboard
            </h1>
            </div>

          {/* Action Buttons */}
          <div className="flex flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => void exportRecords()}
              disabled={isExporting || view !== "records"}
              className="w-auto sm:w-40 h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold rounded-lg sm:rounded-xl shadow-sm transition-all duration-200 text-xs sm:text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed px-3"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{isExporting ? "Building..." : "Export PDF"}</span>
            </button>

            <Link
              href="/admindashboard/forecasting"
              className="w-auto sm:w-40 h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-700 hover:bg-black text-white font-semibold rounded-lg sm:rounded-xl shadow-md transition-all duration-200 text-xs sm:text-sm whitespace-nowrap cursor-pointer px-3"
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Forecasting</span>
            </Link>
          </div>
        </div>
      </div>

      <div role="tablist" aria-label="Reports" className="mt-6 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        {([
          ["records", "Delivery Records"],
          ["subcon", "Sub-con Trips"],
        ] as const).map(([id, title]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`min-h-tap md:min-h-10 px-4 rounded-lg text-sm font-semibold transition-colors ${view === id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {title}
          </button>
        ))}
      </div>

      {view === "subcon" ? (
        <SubconTripsPanel />
      ) : (
      <>
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

        {/* Each record is a card below desktop width, in the booking feeds'
            stacked layout; the six-column table needs a full desktop. */}
        <div className="w-full xl:overflow-x-auto pb-2 min-h-75 px-4 pt-4 xl:px-0 xl:pt-0">
          <table role="table" className="w-full text-left border-collapse block xl:table">
            <thead role="rowgroup" className="hidden xl:table-header-group">
              <tr role="row" className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Delivery Date</th>
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Order ID</th>
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Client</th>
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Final Status</th>
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Delivery Crews</th>
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Remarks</th>
              </tr>
            </thead>

            <tbody role="rowgroup" className="block xl:table-row-group xl:divide-y xl:divide-slate-100">
              {isLoading ? (
                <tr role="row" className="block xl:table-row">
                  <td role="cell" colSpan={6} className="block xl:table-cell py-16 text-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                    <p className="text-slate-600 text-sm font-medium">
                      Loading records...
                    </p>
                  </td>
                </tr>
              ) : paginatedRecords.length > 0 ? (
                paginatedRecords.map((record, idx) => (
                  <tr
                    role="row"
                    key={record.id || idx}
                    onClick={() => handleRowClick(record)}
                    className="block xl:table-row bg-white border border-slate-200 rounded-xl mb-3 p-3 xl:border-0 xl:border-b xl:border-slate-100 xl:rounded-none xl:mb-0 xl:p-0 hover:bg-slate-50/80 transition-colors text-sm text-slate-800 cursor-pointer"
                  >
                    <td role="cell" className="hidden xl:table-cell py-3.5 px-4 sm:px-6 whitespace-nowrap">
                      {record.date}
                    </td>
                    <td role="cell" className="flex items-start justify-between gap-3 xl:table-cell pb-2 mb-1 border-b border-slate-100 xl:border-0 xl:mb-0 py-1 xl:py-3.5 px-0 xl:px-6 font-medium text-slate-900 xl:whitespace-nowrap">
                      <span className="text-base xl:text-sm font-semibold xl:font-medium wrap-break-word">{record.orderId}</span>
                      <span
                        className={`xl:hidden shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] md:grid-cols-[12rem_1fr] gap-2 xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:whitespace-nowrap">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Client</span>
                      <span className="wrap-break-word">{record.client}</span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] md:grid-cols-[12rem_1fr] gap-2 xl:hidden py-1.5 px-0">
                      <span className="text-xs font-semibold text-slate-500">Delivery Date</span>
                      <span>{record.date}</span>
                    </td>
                    <td role="cell" className="hidden xl:table-cell py-3.5 px-4 sm:px-6 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] md:grid-cols-[12rem_1fr] gap-2 xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:whitespace-nowrap text-xs text-slate-500">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Delivery Crews</span>
                      <span className="wrap-break-word">{record.crew}</span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] md:grid-cols-[12rem_1fr] gap-2 xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:truncate xl:max-w-xs text-xs text-slate-500">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Remarks</span>
                      <span className="wrap-break-word xl:truncate">{record.remarks || "—"}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr role="row" className="block xl:table-row">
                  <td role="cell" colSpan={6} className="block xl:table-cell py-12 sm:py-16 text-center">
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
              className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
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
              className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      </>
      )}

      {/* Reused View Booking Modal */}
      <ViewOrderModal
        isOpen={isViewOrderModalOpen}
        onClose={() => setIsViewOrderModalOpen(false)}
        order={selectedOrderForView}
        onOpenHistory={(orderID) =>
          setHistoryFor({
            orderID,
            orderCode: selectedOrderForView?.orderId ?? "",
            client: selectedOrderForView?.client ?? "",
          })
        }
      />

    </div>
  );
}
