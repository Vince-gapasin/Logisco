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
import { formatDate, formatDateTime, todayInManila } from "@/app/lib/datetime";
import { useToast } from "@/components/Toast";
import { downloadCsv } from "@/app/lib/csvExport";
import { exportDelivery, type ExportFormat } from "@/app/lib/deliveryExport";
import type { BookingHistoryEntry } from "@/services/booking/bookingHistoryService";
import SubconTripsPanel from "@/components/subcon/SubconTripsPanel";
import { bookingStatusLabel } from "@/app/lib/statusLabels";
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
  driver: string;
  helper: string;
  remarks: string;
  rawOrder?: OrderWithRelations;
  dispatchStatus?: string;
  driverConfirmed?: boolean;
  helperConfirmed?: boolean;
}

/**
 * What narrows the records. The table and the export each hold one: the export
 * starts from the table's and can be changed without disturbing it.
 */
interface ReportFilters {
  timeframe: string;
  status: string;
  clients: string[];
  drivers: string[];
  helpers: string[];
  customStartDate: string;
  customEndDate: string;
}

function matchesReportFilters(rec: ReportRecord, filters: ReportFilters): boolean {
  const { timeframe, status, clients, drivers, helpers, customStartDate, customEndDate } = filters;

  if (status !== "Final Status" && rec.status !== status) return false;
  if (clients.length > 0 && !clients.includes(rec.client)) return false;
  if (drivers.length > 0 && !drivers.includes(rec.driver)) return false;
  if (helpers.length > 0 && !helpers.includes(rec.helper)) return false;

  if (timeframe === "All Time") return true;

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

  if (timeframe === "This Year" && d.getFullYear() !== t.getFullYear()) return false;

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

  return true;
}

/**
 * What a report is of, in the words the filters are set in.
 *
 * On the page because a table of records without them is a table of some
 * records, and the reader of a printed one has no way of knowing which.
 */
function describeReportFilters(filters: ReportFilters): string[] {
  const { timeframe, status, clients, drivers, helpers, customStartDate, customEndDate } = filters;
  const said = [`Period: ${timeframe}`];

  if (timeframe === "Custom Date Range") {
    said[0] = `Period: ${customStartDate ? formatDate(customStartDate) : "the beginning"} to ${customEndDate ? formatDate(customEndDate) : "today"}`;
  }

  said.push(`Final status: ${status === "Final Status" ? "all" : bookingStatusLabel(status)}`);
  said.push(clients.length > 0 ? `Clients: ${clients.join(", ")}` : "Clients: all");
  if (drivers.length > 0) said.push(`Drivers: ${drivers.join(", ")}`);
  if (helpers.length > 0) said.push(`Helpers: ${helpers.join(", ")}`);

  return said;
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
  const showToast = useToast();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportingAs, setExportingAs] = useState<ExportFormat | null>(null);

  if (!isOpen || !order) return null;

  // The list row carries only summary columns; the stops arrive once the
  // full booking has been fetched, and a file without them would be missing
  // most of what it is for.
  const isFullRecord = Boolean(order.rawOrder?.BranchStops);

  const exportThis = async (format: ExportFormat) => {
    const rawOrder = order.rawOrder;
    if (!rawOrder?.orderID) return;
    setIsExportMenuOpen(false);
    setExportingAs(format);
    try {
      // The whole history, from the audit trail the History button reads -
      // not the few lines kept in the booking's notes.
      const history = await apiFetch<{ data: BookingHistoryEntry[] }>(
        `/api/bookings/${rawOrder.orderID}/history`,
        { cache: "no-store" },
      );
      await exportDelivery(rawOrder, history.data ?? [], format);
    } catch (error) {
      console.error("Delivery export failed:", error);
      showToast("This delivery could not be exported. Try again.", "error");
    } finally {
      setExportingAs(null);
    }
  };

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
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-[#000c31] text-white border-b border-slate-800">
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-white tracking-wide flex items-center gap-2 wrap-break-word">
              <FileText className="w-5 h-5 shrink-0" /> <span className="hidden sm:inline">Booking Details:</span> {booking.orderId}
            </h2>
            <p className="text-xs font-medium opacity-80 mt-0.5">
              Status: {bookingStatusLabel(booking.confirmationStatus)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
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

          {/* This delivery on its own, as opposed to the page's Export, which
              is a list of them. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((open) => !open)}
              disabled={!isFullRecord || exportingAs !== null}
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
              title={isFullRecord ? "Export this delivery" : "Loading the full record..."}
              className="w-auto px-3.5 sm:px-6 py-2 sm:py-2.5 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingAs || !isFullRecord ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              ) : (
                <Download className="w-4 h-4 shrink-0" />
              )}
              Export
            </button>
            {isExportMenuOpen && (
              <div
                role="menu"
                className="absolute bottom-full right-0 mb-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10"
              >
                {([
                  ["pdf", "PDF document"],
                  ["csv", "CSV spreadsheet"],
                ] as const).map(([format, title]) => (
                  <button
                    key={format}
                    type="button"
                    role="menuitem"
                    onClick={() => void exportThis(format)}
                    className="min-h-tap md:pointer-fine:min-h-0 w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>

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
  formatOption = (option: string) => option,
}: {
  id: string;
  label: string;
  options: string[];
  value: string;
  setValue: (val: string) => void;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
  /** The wording shown for an option; the value set stays the option itself. */
  formatOption?: (option: string) => string;
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
        <span className="truncate pr-2">{formatOption(value)}</span>
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
              className={`min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-start w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 cursor-pointer ${
                value === opt
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-slate-700"
              }`}
            >
              {formatOption(opt)}
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

// Asked before anything is built: what range, what records, and as what.
//
// It starts from the filters the table is set to, since that is usually what
// was meant, but its own choices stay its own - changing the export's period
// does not change what is on the screen behind it.
function ExportRecordsDialog({
  initialFilters,
  records,
  clientOptions,
  driverOptions,
  helperOptions,
  isExporting,
  onClose,
  onExport,
}: {
  initialFilters: ReportFilters;
  records: ReportRecord[];
  clientOptions: string[];
  driverOptions: string[];
  helperOptions: string[];
  isExporting: boolean;
  onClose: () => void;
  onExport: (filters: ReportFilters, format: ExportFormat) => void;
}) {
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const set = <K extends keyof ReportFilters>(key: K) =>
    (value: ReportFilters[K] | ((prev: ReportFilters[K]) => ReportFilters[K])) =>
      setFilters((prev) => ({
        ...prev,
        [key]: typeof value === "function" ? (value as (p: ReportFilters[K]) => ReportFilters[K])(prev[key]) : value,
      }));

  const matching = useMemo(
    () => records.filter((rec) => matchesReportFilters(rec, filters)).length,
    [records, filters],
  );

  const dateInput =
    "w-full bg-white border border-slate-200 text-sm text-slate-900 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm";

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-records-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-full flex flex-col overflow-hidden"
      >
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
          <h2 id="export-records-title" className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Download className="w-5 h-5 shrink-0 text-blue-600" /> Export delivery records
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            aria-label="Close"
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          <FilterDropdown
            id="export-timeframe"
            label="Date range"
            options={TIMEFRAME_OPTIONS}
            value={filters.timeframe}
            setValue={set("timeframe")}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
          />
          {filters.timeframe === "Custom Date Range" && (
            <div className="grid grid-cols-2 gap-2 animate-fade-in">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Start</label>
                <input
                  type="date"
                  value={filters.customStartDate}
                  max={filters.customEndDate || undefined}
                  onChange={(e) => set("customStartDate")(e.target.value)}
                  className={dateInput}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">End</label>
                <input
                  type="date"
                  value={filters.customEndDate}
                  min={filters.customStartDate || undefined}
                  onChange={(e) => set("customEndDate")(e.target.value)}
                  className={dateInput}
                />
              </div>
            </div>
          )}
          <FilterDropdown
            id="export-status"
            label="Final Status"
            options={STATUS_OPTIONS}
            value={filters.status}
            setValue={set("status")}
            formatOption={(option) => (option === STATUS_OPTIONS[0] ? "All statuses" : bookingStatusLabel(option))}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
          />
          <MultiSelectDropdown
            id="export-client"
            label="Client"
            options={clientOptions}
            selectedValues={filters.clients}
            setSelectedValues={set("clients")}
            activeDropdown={activeDropdown}
            setActiveDropdown={setActiveDropdown}
            placeholder="All Clients"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MultiSelectDropdown
              id="export-drivers"
              label="Drivers"
              options={driverOptions}
              selectedValues={filters.drivers}
              setSelectedValues={set("drivers")}
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
              placeholder="All Drivers"
            />
            <MultiSelectDropdown
              id="export-helpers"
              label="Helpers"
              options={helperOptions}
              selectedValues={filters.helpers}
              setSelectedValues={set("helpers")}
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
              placeholder="All Helpers"
            />
          </div>

          <fieldset>
            <legend className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Format</legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["pdf", "PDF", "A printable report"],
                ["csv", "CSV", "For Excel or Sheets"],
              ] as const).map(([value, title, note]) => (
                <label
                  key={value}
                  className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                    format === value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={value}
                    checked={format === value}
                    onChange={() => setFormat(value)}
                    className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{title}</span>
                    <span className="block text-xs text-slate-500">{note}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <p className="text-xs text-slate-600">
            <span className="font-bold text-slate-900">{matching}</span> record{matching === 1 ? "" : "s"} will be exported
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold rounded-lg text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onExport(filters, format)}
              disabled={isExporting || matching === 0}
              className="px-4 py-2 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-lg text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? "Building..." : `Export ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsForecastingPage() {
  // Delivery records, or the partner trips the coordinator keeps up to date.
  const showToast = useToast();
  const [view, setView] = useState<"records" | "subcon">("records");
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  // The filters live behind one button, as on the dashboard: open as a full
  // panel they took a screen of their own before any record was in sight.
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

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
              driver: driverName,
              helper: helperName,
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
  const currentFilters: ReportFilters = useMemo(
    () => ({
      timeframe,
      status,
      clients: selectedClients,
      drivers: selectedDrivers,
      helpers: selectedHelpers,
      customStartDate,
      customEndDate,
    }),
    [timeframe, status, selectedClients, selectedDrivers, selectedHelpers, customStartDate, customEndDate],
  );

  const filteredRecords = useMemo(
    () => records.filter((rec) => matchesReportFilters(rec, currentFilters)),
    [records, currentFilters],
  );

  // Summary Math
  const totalHistorical = filteredRecords.length;
  const successfulDeliveries = filteredRecords.filter(
    (r) => r.status === "Delivered",
  ).length;
  const foulTrips = filteredRecords.filter(
    (r) => r.status === "Foul Trip",
  ).length;

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  /**
   * The records the export dialog was set to, as a printable report or a CSV.
   *
   * Every row those filters match, not the page of them on screen: pagination
   * is how a long table is read, not a limit on what was asked for.
   */
  const exportRecords = async (filters: ReportFilters, format: ExportFormat) => {
    const rows = records.filter((rec) => matchesReportFilters(rec, filters));
    if (rows.length === 0) {
      showToast("There is nothing to export with these filters.", "error");
      return;
    }

    setIsExporting(true);
    try {
      const { startReport, toFileSlug } = await import("@/app/lib/pdfReport");
      const generatedAt = formatDateTime(new Date().toISOString());
      const filename = `delivery-records-${toFileSlug(filters.timeframe)}-${toFileSlug(generatedAt)}`;

      if (format === "csv") {
        // A plain table, a row per booking, so it sorts and filters in a
        // spreadsheet. What it is of is in the filename.
        downloadCsv(`${filename}.csv`, [
          ["Delivery Date", "Order ID", "Client", "Final Status", "Driver", "Helper", "Remarks"],
          ...rows.map((record) => [
            formatDate(record.date),
            record.orderId,
            record.client,
            bookingStatusLabel(record.status),
            record.driver,
            record.helper,
            record.remarks,
          ]),
        ]);
        setIsExportOpen(false);
        return;
      }

      const report = await startReport({
        title: "Delivery Records",
        // Landscape because six columns of a delivery record do not fit across
        // a portrait page without cutting the ones that carry the detail.
        orientation: "landscape",
        meta: [...describeReportFilters(filters), `Generated ${generatedAt}`],
      });

      const delivered = rows.filter((r) => r.status === "Delivered").length;
      const foul = rows.filter((r) => r.status === "Foul Trip").length;
      const rate = Math.round((delivered / rows.length) * 100);

      report.figures([
        { label: "Records", value: String(rows.length) },
        { label: "Delivered", value: String(delivered) },
        { label: "Foul trips", value: String(foul) },
        { label: "Delivered rate", value: `${rate}%` },
      ]);

      report.section("Records", `${rows.length} matching this filter`, 24);
      report.table(
        [
          { header: "Delivery Date", width: 25 },
          { header: "Order ID", width: 38 },
          { header: "Client", width: 55 },
          { header: "Final status", width: 26 },
          { header: "Crew", width: 58 },
          { header: "Remarks", width: 65 },
        ],
        rows.map((record) => [
          formatDate(record.date),
          record.orderId,
          record.client,
          bookingStatusLabel(record.status),
          record.crew,
          record.remarks || "-",
        ]),
      );

      report.save(`${filename}.pdf`);
      setIsExportOpen(false);
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

  useEffect(() => {
    if (!isFilterOpen) return;
    function handlePanelOutside(event: MouseEvent) {
      if (filterPanelRef.current && !filterPanelRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePanelOutside);
    return () => document.removeEventListener("mousedown", handlePanelOutside);
  }, [isFilterOpen]);

  // What is narrowing the records, said plainly, so the counts below are
  // never read without knowing what they are counts of.
  const activeFilters: { key: string; label: string; clear: () => void }[] = [
    ...(timeframe !== TIMEFRAME_OPTIONS[0]
      ? [{
          key: "timeframe",
          label:
            timeframe === "Custom Date Range"
              ? `${customStartDate || "…"} to ${customEndDate || "…"}`
              : timeframe,
          clear: () => setTimeframe(TIMEFRAME_OPTIONS[0]),
        }]
      : []),
    ...(selectedClients.length
      ? [{ key: "client", label: selectedClients.length === 1 ? selectedClients[0] : `${selectedClients.length} clients`, clear: () => setSelectedClients([]) }]
      : []),
    ...(selectedDrivers.length
      ? [{ key: "drivers", label: selectedDrivers.length === 1 ? `Driver: ${selectedDrivers[0]}` : `${selectedDrivers.length} drivers`, clear: () => setSelectedDrivers([]) }]
      : []),
    ...(selectedHelpers.length
      ? [{ key: "helpers", label: selectedHelpers.length === 1 ? `Helper: ${selectedHelpers[0]}` : `${selectedHelpers.length} helpers`, clear: () => setSelectedHelpers([]) }]
      : []),
    ...(status !== STATUS_OPTIONS[0]
      ? [{ key: "status", label: bookingStatusLabel(status), clear: () => setStatus(STATUS_OPTIONS[0]) }]
      : []),
  ];
  const clearAllFilters = () => activeFilters.forEach((filter) => filter.clear());
  const percentOf = (part: number) => (totalHistorical ? Math.round((part / totalHistorical) * 100) : 0);

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
              onClick={() => setIsExportOpen(true)}
              disabled={isLoading || view !== "records"}
              className="w-auto sm:w-40 h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold rounded-lg sm:rounded-xl shadow-sm transition-all duration-200 text-xs sm:text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed px-3"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Export</span>
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

      <div className="mt-6 flex items-center justify-between gap-2 sm:gap-3">
      <div role="tablist" aria-label="Reports" className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
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
            className={`min-h-tap md:min-h-10 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${view === id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {title}
          </button>
        ))}
      </div>

      {view === "records" && (
        <div ref={filterPanelRef} className="relative">
          <button
            type="button"
            onClick={() => setIsFilterOpen((open) => !open)}
            aria-expanded={isFilterOpen}
            aria-label="Filters"
            title="Filters"
            className={`relative min-h-tap md:pointer-fine:min-h-0 h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 border text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl transition-colors shadow-sm whitespace-nowrap w-9 sm:w-auto px-0 sm:px-4 cursor-pointer ${
              isFilterOpen ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <Filter className="w-4 h-4 shrink-0" />
            {/* Just the icon on a phone, beside the tabs on one row. */}
            <span className="hidden sm:inline">Filters</span>
            {activeFilters.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 sm:static sm:ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                {activeFilters.length}
              </span>
            )}
          </button>

          {isFilterOpen && (
            <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-40 p-4 animate-fade-in origin-top-right">
              <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                <h3 className="font-bold text-sm text-slate-800">Filter completed reports</h3>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  aria-label="Close filters"
                  className="p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div ref={dropdownsRef} className="grid grid-cols-1 gap-3">
                <FilterDropdown
                  id="timeframe"
                  label="Timeframe"
                  options={TIMEFRAME_OPTIONS}
                  value={timeframe}
                  setValue={setTimeframe}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                />
                {timeframe === "Custom Date Range" && (
                  <div className="grid grid-cols-2 gap-2 animate-fade-in">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">Start</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-sm text-slate-900 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">End</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-sm text-slate-900 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                      />
                    </div>
                  </div>
                )}
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
                  formatOption={(option) => (option === STATUS_OPTIONS[0] ? "All statuses" : bookingStatusLabel(option))}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                />
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  disabled={activeFilters.length === 0}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-not-allowed cursor-pointer"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {view === "subcon" ? (
        <SubconTripsPanel />
      ) : (
      <>
      {/* What the numbers below are of: every filter that is on, each one
          removable on its own. */}
      {activeFilters.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Showing:</span>
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 pl-2.5 pr-1 py-0.5 text-xs font-medium text-blue-800"
            >
              <span className="max-w-48 truncate">{filter.label}</span>
              <button
                type="button"
                onClick={filter.clear}
                aria-label={`Remove ${filter.label}`}
                className="p-0.5 rounded-full hover:bg-blue-100 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* The three counts, three across at every size like the dashboard's,
          with the share of the total so a number reads as good or bad at once. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4">
        {[
          { label: "Total Records", short: "TOTAL", value: totalHistorical, note: activeFilters.length ? "matching the filters" : "all time", icon: BarChart3, card: "bg-white border-slate-100", iconBg: "bg-slate-100", iconText: "text-slate-500", text: "text-slate-900", labelText: "text-slate-600" },
          { label: "Successful Deliveries", short: "DELIVERED", value: successfulDeliveries, note: `${percentOf(successfulDeliveries)}% of records`, icon: CheckCircle2, card: "bg-green-50/50 border-green-100", iconBg: "bg-green-100", iconText: "text-green-600", text: "text-green-900", labelText: "text-green-700" },
          { label: "Foul Trips", short: "FOUL TRIP", value: foulTrips, note: `${percentOf(foulTrips)}% of records`, icon: XCircle, card: "bg-red-50/50 border-red-100", iconBg: "bg-red-100", iconText: "text-red-600", text: "text-red-900", labelText: "text-red-700" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center gap-1.5 sm:gap-4 text-center sm:text-left ${stat.card}`}
          >
            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 ${stat.iconBg}`}>
              <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.iconText}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-lg sm:text-2xl font-bold leading-none ${stat.text}`}>{stat.value}</p>
              <p className={`mt-1 text-[10px] sm:text-xs font-bold tracking-wider ${stat.labelText}`}>
                <span className="sm:hidden">{stat.short}</span>
                <span className="hidden sm:inline">{stat.label.toUpperCase()}</span>
              </p>
              <p className="hidden sm:block text-[11px] text-slate-500 mt-0.5 truncate">{stat.note}</p>
            </div>
          </div>
        ))}
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
                      {formatDate(record.date)}
                    </td>
                    <td role="cell" className="flex items-start justify-between gap-3 xl:table-cell pb-2 mb-1 border-b border-slate-100 xl:border-0 xl:mb-0 py-1 xl:py-3.5 px-0 xl:px-6 font-medium text-slate-900 xl:whitespace-nowrap">
                      <span className="text-base xl:text-sm font-semibold xl:font-medium wrap-break-word">{record.orderId}</span>
                      <span
                        className={`xl:hidden shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}
                      >
                        {bookingStatusLabel(record.status)}
                      </span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] md:grid-cols-[12rem_1fr] gap-2 xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Client</span>
                      <span className="wrap-break-word">{record.client}</span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] md:grid-cols-[12rem_1fr] gap-2 xl:hidden py-1.5 px-0">
                      <span className="text-xs font-semibold text-slate-500">Delivery Date</span>
                      <span>{formatDate(record.date)}</span>
                    </td>
                    <td role="cell" className="hidden xl:table-cell py-3.5 px-4 sm:px-6 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}
                      >
                        {bookingStatusLabel(record.status)}
                      </span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] md:grid-cols-[12rem_1fr] gap-2 xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 text-xs text-slate-500">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Delivery Crews</span>
                      <span className="wrap-break-word">{record.crew}</span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] md:grid-cols-[12rem_1fr] gap-2 xl:table-cell py-1.5 xl:py-3.5 px-0 xl:px-6 xl:truncate xl:max-w-56 text-xs text-slate-500">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Remarks</span>
                      <span className="wrap-break-word xl:truncate" title={record.remarks || undefined}>{record.remarks || "—"}</span>
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
          {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`min-h-tap md:pointer-fine:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
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
              className={`min-h-tap md:pointer-fine:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
            >
              Next
            </button>
          </div>
          )}
        </div>
      </div>

      </>
      )}

      {isExportOpen && (
        <ExportRecordsDialog
          initialFilters={currentFilters}
          records={records}
          clientOptions={clientOptions}
          driverOptions={driverOptions}
          helperOptions={helperOptions}
          isExporting={isExporting}
          onClose={() => setIsExportOpen(false)}
          onExport={(filters, format) => void exportRecords(filters, format)}
        />
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
