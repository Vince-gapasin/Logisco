// File: app/admindashboard/calendar/unassigned-bookings/page.tsx
"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import React, { useState, useEffect, useCallback } from "react";
import RowOpenButton from "@/components/RowOpenButton";
import TableSkeleton from "@/components/TableSkeleton";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/apiClient";
import BookingAssignModal from "@/components/booking/BookingAssignModal";
import { useToast } from "@/components/Toast";
import ListLoadError from "@/components/ListLoadError";
import {
  isAwaitingAssignment,
  mapOrderToBookingView,
  type OrderWithRelations,
  type BookingView,
} from "@/app/lib/bookingView";
import {
  Search,
  FileText,
  ArrowLeft,
  Inbox,
  Clock,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;

// ==========================================
// PROGRESS TRACKER COMPONENT

// ==========================================
// SUCCESS MODAL COMPONENT (Awaiting Crew Confirmation)
// ==========================================
interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
}

function SuccessModal({ isOpen, onClose, orderCode }: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 overflow-y-auto z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center my-auto">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">
          Booking Assigned Successfully!
        </h3>
        <p className="text-sm font-semibold text-blue-600 mb-3">
          Order ID: {orderCode}
        </p>
        <p className="text-xs text-slate-600 mb-6">
          The booking has already been assigned to the crew and is currently
          waiting for the crew&apos;s confirmation.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ==========================================
// MAIN UNASSIGNED BOOKINGS PAGE COMPONENT
// ==========================================

export default function UnassignedBookingsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<BookingView | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successOrderCode, setSuccessOrderCode] = useState("");

  const showToast = useToast();
  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ==========================================
  // DATA
  // ==========================================
  const loadBookings = useCallback(async () => {
    try {
      const orders = await apiFetch<OrderWithRelations[]>("/api/bookings?stage=unassigned");
      const rows = (orders ?? []).map(mapOrderToBookingView).filter(isAwaitingAssignment);
      setBookings(rows);
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

  const handleOpenModal = (booking: BookingView) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleModalSubmitSuccess = (orderCode: string) => {
    setSuccessOrderCode(orderCode);
    setIsSuccessModalOpen(true);
    setIsModalOpen(false);
    void loadBookings();
  };

  const handleCancelBooking = async (e: React.MouseEvent, bookingId: string) => {
    e.stopPropagation();

    try {
      await apiFetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
      });
      setIsModalOpen(false);
      setSelectedBooking(null);
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
            onClick={() => router.push("/admindashboard/calendar")}
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to Calendar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Inbox className="w-6 h-6 text-orange-500" />
              Unassigned Bookings
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
            Pending Assignments
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <UrlSearchSync onQuery={(query) => { setSearchTerm(query); setCurrentPage(1); }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }}
                placeholder="Search order ID, client, or product..."
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
                <th role="columnheader" className="py-3.5 pl-6 sm:pl-8 pr-4 w-[15%]">Order ID</th>
                <th role="columnheader" className="py-3.5 px-4 w-[20%]">Client Name</th>
                <th role="columnheader" className="py-3.5 px-4 w-[30%]">Product to Deliver</th>
                <th role="columnheader" className="py-3.5 px-4 w-[20%]">Scheduled Date</th>
                <th role="columnheader" className="py-3.5 pl-4 pr-6 sm:pr-8 w-[15%] text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="block xl:table-row-group">
              {isLoading ? (
                <TableSkeleton rows={5} columns={5} stacked />
              ) : loadError ? (
                <tr role="row" className="block xl:table-row">
                  <td role="cell" colSpan={5} className="block xl:table-cell py-16 sm:py-20 text-center">
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
                    <td role="cell" className="block xl:table-cell pb-2 mb-1 border-b border-slate-100 xl:pb-3.5 xl:mb-0 xl:border-0 py-1.5 xl:py-3.5 px-0 xl:pl-6 xl:pr-4 font-medium text-slate-900 xl:truncate">
                      <RowOpenButton
                        label={`Assign booking ${booking.orderId}`}
                        onOpen={() => handleOpenModal(booking)}
                        className="wrap-break-word text-base font-semibold xl:text-sm xl:font-medium"
                      >
                        {booking.orderId}
                      </RowOpenButton>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 xl:table-cell items-center py-1.5 xl:py-3.5 px-0 xl:px-4 xl:truncate font-medium">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Client Name</span>
                      <span className="wrap-break-word">{booking.clientName}</span>
                    </td>
                    <td role="cell"
                      className="grid grid-cols-[40%_60%] gap-2 xl:table-cell items-start py-1.5 xl:py-3.5 px-0 xl:px-4 xl:truncate"
                      title={booking.product}
                    >
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Product</span>
                      <span className="wrap-break-word">{booking.product}</span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 xl:table-cell items-center py-1.5 xl:py-3.5 px-0 xl:px-4 xl:truncate">
                      <span className="xl:hidden text-xs font-semibold text-slate-500">Scheduled Date</span>
                      <span className="wrap-break-word">{booking.displayDate}</span>
                    </td>
                    <td role="cell" className="block xl:table-cell pt-3 xl:pt-0 py-1.5 xl:py-3.5 px-0 xl:pl-4 xl:pr-6 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(booking);
                        }}
                        className="w-full xl:w-auto px-4 py-3 xl:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors duration-200 whitespace-nowrap cursor-pointer"
                      >
                        Assign Now
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr role="row" className="block xl:table-row">
                  <td role="cell" colSpan={5} className="block xl:table-cell py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        {"No unassigned bookings found"}
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        All current schedules have been assigned or no bookings
                        match your search criteria.
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
              className={`min-h-tap md:pointer-fine:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${
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
              className={`min-h-tap md:pointer-fine:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${
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

      {/* Modals */}
      <BookingAssignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        booking={selectedBooking}
        onSubmitSuccess={handleModalSubmitSuccess}
        onCancelBooking={handleCancelBooking}
      />

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        orderCode={successOrderCode}
      />
    </div>
  );
}
