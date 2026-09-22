// File: app/admindashboard/feeds/fouls/page.tsx
"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import React, { useState, useEffect, useCallback } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import SubconTripModal from "@/components/subcon/SubconTripModal";
import FoulTripDetailsModal, { attachIncident, type FoulTripRow } from "@/components/foulTrip/FoulTripDetailsModal";
import type { FoulTripSummary, IncidentView } from "@/services/foulTrip/foulTripService";
import { apiFetch } from "@/app/lib/apiClient";
import {
  mapOrderToBookingView,
  toFeedBooking,
} from "@/app/lib/bookingView";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;

// ==========================================
// STATUS BADGE HELPERS
// ==========================================
const getStatusBadgeClass = (status: string) => {
  if (
    status === "Vehicle Breakdown" ||
    status === "Client Rejection" ||
    status === "Accident"
  ) {
    return "bg-red-100 text-red-800 border border-red-200";
  }
  return "bg-amber-100 text-amber-800 border border-amber-200";
};

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
// The foul-trip screen is driven by incidents: a booking is listed while its
// incident is open. Each row carries its incident, and the details section
// reads what the crew actually reported instead of parsing the trip note.
const RESOLUTION_LABEL: Record<string, string> = {
  reassigned: "Re-assigned",
  rescheduled: "Rescheduled",
  subcontracted: "Sub-contracted",
  repaired_on_site: "Repaired on site",
  cancelled: "Booking cancelled",
  closed: "Closed",
};

function hoursLabel(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export default function FoulTripFeedPage() {
  const [bookings, setBookings] = useState<FoulTripRow[]>([]);
  const [summary, setSummary] = useState<FoulTripSummary | null>(null);
  const [recent, setRecent] = useState<IncidentView[]>([]);
  const [partnerTripID, setPartnerTripID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadBookings = useCallback(async () => {
    try {
      // Fresh every time: after a recovery the list must not come back from
      // the 60-second GET cache still showing what was just resolved.
      const [orders, foul] = await Promise.all([
        apiFetch<any[]>("/api/bookings?stage=foul-trip", { cache: "no-store" }),
        apiFetch<{ open: IncidentView[]; recent: IncidentView[]; summary: FoulTripSummary }>(
          "/api/foul-trips",
          { cache: "no-store" },
        ),
      ]);
      const byOrder = new Map(foul.open.map((incident) => [incident.orderCode, incident]));
      setBookings(
        (orders ?? [])
          .map(mapOrderToBookingView)
          .map(toFeedBooking)
          .map((booking) => attachIncident(booking, byOrder.get(booking.orderId))),
      );
      setSummary(foul.summary);
      setRecent(foul.recent);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load bookings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Success Toast State for Recovery Actions
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredBookings = bookings.filter(
    (booking) =>
      booking.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.product.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ==========================================
  // PAGINATION SETUP
  // ==========================================
  const totalBookings = filteredBookings.length;
  const totalPages = Math.max(Math.ceil(totalBookings / ITEMS_PER_PAGE), 1);
  const startIndex =
    totalBookings === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalBookings);

  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleOpenModal = (booking: any) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleProceedSuccess = (message: string) => {
    setIsModalOpen(false); // Close the Foul Trip Details Modal immediately
    setToastMessage(message);
    setShowSuccessToast(true);
    void loadBookings();

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative">
      
      {/* CENTERED SUCCESS NOTIFICATION TOAST */}
      {showSuccessToast && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 pointer-events-none animate-fade-in">
          <div className="bg-white border border-slate-200 text-slate-900 px-8 sm:px-12 py-10 rounded-2xl shadow-2xl flex flex-col items-center justify-center text-center gap-5 max-w-lg w-full mx-auto animate-scale-up pointer-events-auto">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="w-9 h-9 text-emerald-600 stroke-[2.5]" />
            </div>
            <span className="text-lg sm:text-[20px] font-bold text-slate-900 leading-relaxed tracking-wide">
              {toastMessage}
            </span>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* HEADER */}
      {/* ========================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admindashboard/dashboard")}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              Foul Trip Feed
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Trips that could not finish, and what is being done about each.
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs">
          {loadError}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {summary && (
          <div className="p-4 sm:p-5 border-b border-slate-100 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ["Waiting for recovery", summary.open, summary.open ? "text-red-600" : "text-slate-900"],
                ["Mechanic on the way", summary.mechanicAssigned, "text-blue-600"],
                ["Resolved, last 30 days", summary.resolvedLast30Days, "text-emerald-600"],
                ["Typical time to resolve", hoursLabel(summary.medianHoursToResolve), "text-slate-900"],
              ].map(([label, value, tone]) => (
                <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-medium text-slate-500">{label}</div>
                  <div className={`mt-1 text-xl font-bold ${tone}`}>{value}</div>
                </div>
              ))}
            </div>
            {(summary.reasons.length > 0 || summary.trucksAboveFleetRate.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
                {summary.reasons.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">Reported reasons</div>
                    <div className="flex flex-wrap gap-2">
                      {summary.reasons.map((r) => (
                        <span key={r.issueType} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                          {r.issueType} · {r.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {summary.trucksAboveFleetRate.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-semibold text-amber-900 mb-2">
                      Trucks failing well above the fleet rate of {(summary.fleetRate * 100).toFixed(1)}%
                    </div>
                    <ul className="space-y-1 text-xs text-amber-900">
                      {summary.trucksAboveFleetRate.map((t) => (
                        <li key={t.plateNumber}>
                          <strong>{t.plateNumber}</strong>: {t.foulTrips} foul trips in {t.trips} trips ({(t.rate * 100).toFixed(0)}%)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* FILTERS */}
        {/* ========================================== */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Trip Exceptions
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <UrlSearchSync onQuery={setSearchTerm} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search order ID, client, product..."
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* TABLE */}
        {/* ========================================== */}
        <div className="overflow-x-auto min-h-135">
          <table className="w-full text-left border-collapse min-w-250 table-fixed">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 pl-6 sm:pl-8 pr-4 w-[12%] align-top">
                  Order ID
                </th>
                <th className="py-3.5 px-4 w-[15%] align-top">Client Name</th>
                <th className="py-3.5 px-4 w-[20%] align-top">
                  Product to Deliver
                </th>
                <th className="py-3.5 px-4 w-[15%] align-top">
                  Scheduled Date
                </th>
                <th className="py-3.5 px-4 w-[20%] align-top">Assigned Crew</th>
                <th className="py-3.5 pl-4 pr-6 sm:pr-8 w-[18%] align-top">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={5} columns={5} />
              ) : paginatedBookings.length > 0 ? (
                paginatedBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    onClick={() => handleOpenModal(booking)}
                    className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-sm text-slate-800 cursor-pointer"
                  >
                    <td className="py-4 pl-6 sm:pl-8 pr-4 font-medium text-slate-900 align-top">
                      {booking.orderId}
                    </td>
                    <td className="py-4 px-4 font-medium align-top">
                      {booking.clientName}
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 truncate">
                      {booking.product}
                    </td>
                    <td className="py-4 px-4 align-top">
                      {booking.displayDate}
                    </td>

                    <td className="py-4 px-4 align-top">
                      {booking.crews && booking.crews.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {booking.crews.map((crew: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center text-xs truncate"
                            >
                              <span className="font-semibold text-slate-700 mr-1.5 shrink-0 w-16">
                                {crew.role}:
                              </span>
                              <span className="truncate text-slate-900">
                                {crew.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 italic text-xs font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Not Assigned
                        </span>
                      )}
                    </td>

                    {/* STATUS COLUMN */}
                    <td className="py-4 pl-4 pr-6 sm:pr-8 align-top">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getStatusBadgeClass(
                          booking.confirmationStatus,
                        )}`}
                      >
                        {booking.confirmationStatus}
                      </span>
                      {booking.incident?.status === "mechanic_assigned" && (
                        <div className="mt-1.5 text-xs font-medium text-blue-600">Mechanic on the way</div>
                      )}
                      {booking.incident?.status === "open" && booking.incident.mechanicOutcome === "not_fixable" && (
                        <div className="mt-1.5 text-xs font-medium text-amber-700">Not fixable on site</div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        {"No foul trip bookings found"}
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        There are currently no active trip exceptions matching
                        your search.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ========================================== */}
        {/* PAGINATION */}
        {/* ========================================== */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {startIndex} to {endIndex} of {totalBookings} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage <= 1
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
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
              disabled={currentPage >= totalPages}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage >= totalPages
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Recently resolved</h2>
            <p className="text-xs text-slate-500 mt-0.5">The last 30 days.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {recent.map((incident) => {
              // A partner has no app: the coordinator records their trip.
              const partnerTrip =
                incident.resolution === "subcontracted" && incident.newDispatch ? incident.newDispatch : null;
              const awaitingPartner = Boolean(partnerTrip && partnerTrip.status !== "Completed");
              return (
                <li key={incident.incidentID} className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {incident.orderCode ?? "Booking"}
                      <span className="font-normal text-slate-500"> · {incident.clientName ?? "Client"} · {incident.issueType}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {RESOLUTION_LABEL[incident.resolution ?? ""] ?? incident.resolution}
                      {incident.resolverName ? ` by ${incident.resolverName}` : ""}
                      {incident.resolvedAt ? ` · ${new Date(incident.resolvedAt).toLocaleString("en-PH")}` : ""}
                      {incident.resolutionNotes ? ` · ${incident.resolutionNotes}` : ""}
                    </div>
                  </div>
                  {awaitingPartner && (
                    <button
                      type="button"
                      onClick={() => setPartnerTripID(partnerTrip!.dispatchID)}
                      className="min-h-11 sm:min-h-0 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold whitespace-nowrap"
                    >
                      Update partner trip
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <SubconTripModal dispatchID={partnerTripID} onClose={() => setPartnerTripID(null)} onChanged={() => void loadBookings()} />

      {/* Booking Details Modal */}
      <FoulTripDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProceedSuccess={handleProceedSuccess}
        booking={selectedBooking}
      />
    </div>
  );
}