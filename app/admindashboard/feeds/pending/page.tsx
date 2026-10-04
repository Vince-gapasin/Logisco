// File: app/admindashboard/calendar/pending-bookings/page.tsx
"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import UrlOpenSync from "@/components/UrlOpenSync";
import React, { useState, useEffect, useCallback } from "react";
import RowOpenButton from "@/components/RowOpenButton";
import TableSkeleton from "@/components/TableSkeleton";
import { apiFetch } from "@/app/lib/apiClient";
import {
  isPendingBooking,
  mapOrderToBookingView,
  toFeedBooking,
  type BookingView,
  type FeedBooking,
} from "@/app/lib/bookingView";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import ListLoadError from "@/components/ListLoadError";
import {
  Search,
  FileText,
  ArrowLeft,
  CalendarDays,
  Clock,
} from "lucide-react";
import { getStatusBadgeClass } from "./_components/badges";
import { BookingDetailsModal } from "./_components/BookingDetailsModal";
import { SuccessModal } from "./_components/SuccessModal";
import { bookingStatusLabel } from "@/app/lib/statusLabels";
import DayFilterSelect from "@/components/DayFilterSelect";
import { matchesDayFilter, type DayFilter } from "@/app/lib/dayFilter";


// ==========================================
// DUMMY DATA (Enriched to match the detailed form fields)
// ==========================================

const ITEMS_PER_PAGE = 10;

// An order as the API returns it, whatever shape that is: the one function
// that reads it decides.
type OrderRow = Parameters<typeof mapOrderToBookingView>[0];

// What a coordinator has to act on first: a trip a crew has just turned down,
// then one that has never had a crew, then everything already assigned. Within
// each group the order the database gave them stands - newest first.
function urgency(booking: BookingView): number {
  if (booking.dispatchStatus === "Rejected") return 2;
  if (!booking.hasDispatch) return 1;
  return 0;
}

function byMostUrgent(a: BookingView, b: BookingView): number {
  return urgency(b) - urgency(a);
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function PendingBookingPage() {
  const showToast = useToast();
  const [bookings, setBookings] = useState<FeedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadBookings = useCallback(async () => {
    try {
      // Two stages, because a booking waiting for a crew is as pending as one
      // waiting to depart. A crew declining used to drop a booking out of this
      // list entirely: it was no longer assigned, so the departing stage did
      // not carry it, and the only place left to find it was the calendar.
      const [assigned, awaitingCrew] = await Promise.all([
        apiFetch<OrderRow[]>("/api/bookings?stage=departing"),
        apiFetch<OrderRow[]>("/api/bookings?stage=unassigned"),
      ]);

      const seen = new Set<string>();
      const rows = [...(assigned ?? []), ...(awaitingCrew ?? [])]
        .map(mapOrderToBookingView)
        .filter((booking) => {
          if (seen.has(booking.id) || !isPendingBooking(booking)) return false;
          seen.add(booking.id);
          return true;
        })
        .sort(byMostUrgent);

      setBookings(rows.map(toFeedBooking));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load bookings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // The rows land in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBookings();
  }, [loadBookings]);

  // Try again, with the skeleton back while it runs.
  const retryLoad = useCallback(() => {
    setIsLoading(true);
    void loadBookings();
  }, [loadBookings]);

  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [dayFilter, setDayFilter] = useState<DayFilter>("Any day");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<FeedBooking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successOrderCode, setSuccessOrderCode] = useState("");
  const [successTitle, setSuccessTitle] = useState("");
  const [successDesc, setSuccessDesc] = useState("");

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredBookings = bookings.filter(
    (booking) =>
      matchesDayFilter(booking.scheduledDate, dayFilter) &&
      (booking.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.product.toLowerCase().includes(searchTerm.toLowerCase())),
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

  const handleOpenModal = (booking: FeedBooking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleModalSubmitSuccess = (orderId: string, status: string) => {
    void loadBookings();
    setSuccessOrderCode(orderId);
    if (status === "Assign Crew" || status === "Unassigned") {
      setSuccessTitle("Booking Assigned Successfully!");
      setSuccessDesc(
        "The booking has already been assigned to the crew and is currently waiting for the crew's confirmation.",
      );
    } else {
      setSuccessTitle("Booking Re-assigned Successfully!");
      setSuccessDesc(
        "The booking has been updated and is waiting for crew confirmation.",
      );
    }
    setIsSuccessModalOpen(true);
  };

  const handleCancelBooking = async (e: React.MouseEvent, bookingId: string) => {
    e.stopPropagation();

    try {
      await apiFetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
      });
      // Closed and confirmed. The details used to stay open on the booking it
      // had just cancelled, with nothing to say the cancel had worked.
      setIsModalOpen(false);
      setSelectedBooking(null);
      showToast("Booking cancelled.", "success");
      await loadBookings();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to cancel booking.", "error");
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative">
      {/* ========================================== */}
      {/* HEADER */}
      {/* ========================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admindashboard/dashboard")}
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to Calendar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-blue-500" />
              Pending Bookings
            </h1>
            </div>
        </div>
      </div>

      {loadError && paginatedBookings.length > 0 && (
        <ListLoadError message={loadError} onRetry={retryLoad} compact />
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* ========================================== */}
        {/* FILTERS */}
        {/* ========================================== */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Pending Booking List
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <DayFilterSelect value={dayFilter} onChange={(value) => { setDayFilter(value); setCurrentPage(1); }} />
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <UrlSearchSync onQuery={(query) => { setSearchTerm(query); setCurrentPage(1); }} />
              <UrlOpenSync rows={bookings} ready={!isLoading} onOpen={handleOpenModal} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }}
                placeholder="Search order ID, client, product..."
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* TABLE */}
        {/* ========================================== */}
        <div className="xl:overflow-x-auto px-4 pt-4 xl:px-0 xl:pt-0 min-h-100 xl:min-h-135">
          <table role="table" className="w-full text-left border-collapse xl:min-w-250 xl:table-fixed block xl:table">
            <thead role="rowgroup" className="hidden xl:table-header-group">
              <tr role="row" className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th role="columnheader" className="py-3.5 pl-6 sm:pl-8 pr-4 w-[12%] align-top">
                  Order ID
                </th>
                <th role="columnheader" className="py-3.5 px-4 w-[15%] align-top">Client Name</th>
                <th role="columnheader" className="py-3.5 px-4 w-[20%] align-top">
                  Product to Deliver
                </th>
                <th role="columnheader" className="py-3.5 px-4 w-[15%] align-top">
                  Scheduled Date
                </th>
                <th role="columnheader" className="py-3.5 px-4 w-[20%] align-top">Assigned Crew</th>
                <th role="columnheader" className="py-3.5 pl-4 pr-6 sm:pr-8 w-[18%] align-top">
                  Status
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="block xl:table-row-group">
              {isLoading ? (
                <TableSkeleton rows={5} columns={6} stacked />
              ) : loadError ? (
                <tr role="row" className="block xl:table-row">
                  <td role="cell" colSpan={6} className="block xl:table-cell py-16 sm:py-20 text-center">
                    <ListLoadError message={loadError} onRetry={retryLoad} />
                  </td>
                </tr>
              ) : paginatedBookings.length > 0 ? (
                paginatedBookings.map((booking) => (
                  <tr role="row"
                    data-pressable
                    key={booking.id}
                    onClick={() => handleOpenModal(booking)}
                    className="block xl:table-row bg-white border border-slate-200 rounded-xl mb-4 p-3 xl:border-0 xl:border-b xl:border-slate-100 xl:rounded-none xl:mb-0 xl:p-0 hover:bg-slate-50/80 transition-colors text-sm text-slate-800 cursor-pointer"
                  >
                    <td role="cell" className="block xl:table-cell pb-2 mb-1 border-b border-slate-100 xl:pb-4 xl:mb-0 xl:border-0 py-1.5 xl:py-4 px-0 xl:pl-6 xl:pr-4 font-medium text-slate-900 align-top">
                      <RowOpenButton
                        label={`View booking ${booking.orderId}`}
                        onOpen={() => handleOpenModal(booking)}
                        className="wrap-break-word text-base font-semibold xl:text-sm xl:font-medium"
                      >
                        {booking.orderId}
                      </RowOpenButton>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 xl:table-cell items-center py-1.5 xl:py-4 px-0 xl:px-4 font-medium align-top">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Client Name</span>
                      <span className="wrap-break-word">{booking.clientName}</span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 xl:table-cell items-start py-1.5 xl:py-4 px-0 xl:px-4 align-top text-slate-600 xl:truncate">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Product</span>
                      <span className="wrap-break-word">{booking.product}</span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 xl:table-cell items-center py-1.5 xl:py-4 px-0 xl:px-4 align-top">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Scheduled Date</span>
                      <span className="wrap-break-word">{booking.displayDate}</span>
                    </td>

                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 xl:table-cell items-start py-1.5 xl:py-4 px-0 xl:px-4 align-top">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Assigned Crew</span>
                      {booking.crews && booking.crews.length > 0 ? (
                        <div className="flex flex-col gap-1.5 min-w-0">
                          {booking.crews.map((crew, idx) => (
                            <div
                              key={idx}
                              className="flex items-baseline text-xs xl:truncate"
                            >
                              <span className="font-semibold text-slate-700 mr-1.5 shrink-0 w-16">
                                {crew.role}:
                              </span>
                              <span className="xl:truncate wrap-break-word text-slate-900">
                                {crew.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 italic text-xs font-medium">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          Not Assigned
                        </span>
                      )}
                    </td>

                    {/* STATUS COLUMN */}
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 xl:table-cell items-center py-1.5 xl:py-4 px-0 xl:pl-4 xl:pr-6 align-top">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Status</span>
                      <span
                        className={`inline-flex w-max items-center justify-center px-2.5 py-1.5 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getStatusBadgeClass(booking.confirmationStatus)}`}
                      >
                        {bookingStatusLabel(booking.confirmationStatus)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr role="row" className="block xl:table-row">
                  <td role="cell" colSpan={6} className="block xl:table-cell py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        {"No pending bookings found"}
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        There are currently no scheduled deliveries in pending
                        status or matching your search.
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
          {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
              className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${
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
              className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage >= totalPages
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Booking Details Modal */}
      <BookingDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        booking={selectedBooking}
        onSubmitSuccess={handleModalSubmitSuccess}
        onCancelBooking={handleCancelBooking}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        orderCode={successOrderCode}
        title={successTitle}
        description={successDesc}
      />
    </div>
  );
}
