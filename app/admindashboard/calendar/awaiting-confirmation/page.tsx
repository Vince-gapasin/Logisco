// File: app/admindashboard/calendar/awaiting-confirmation/page.tsx
"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import React, { useState, useEffect, useCallback } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/apiClient";
import BookingAssignModal from "@/components/booking/BookingAssignModal";
import {
  isAwaitingCrewConfirmation,
  mapOrderToBookingView,
  type OrderWithRelations,
  type BookingView,
} from "@/app/lib/bookingView";
import {
  Search,
  FileText,
  ArrowLeft,
  Clock,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;

// Helper function to assign color classes to statuses
const getStatusBadge = (status: string) => {
  switch (status) {
    case "Accepted":
      return "bg-emerald-100 text-emerald-700";
    case "Pending":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

// ==========================================
// PROGRESS TRACKER COMPONENT

// ==========================================
// SUCCESS MODAL COMPONENT
// ==========================================
interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
}

function SuccessModal({ isOpen, onClose, orderCode }: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">
          Booking Re-assigned Successfully!
        </h3>
        <p className="text-sm font-semibold text-blue-600 mb-3">
          Order ID: {orderCode}
        </p>
        <p className="text-xs text-slate-600 mb-6">
          The booking has been updated and is waiting for crew confirmation.
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
// MAIN PAGE COMPONENT
// ==========================================
export default function AwaitingConfirmationPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<BookingView | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successOrderCode, setSuccessOrderCode] = useState("");

  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Assigned bookings where at least one crew member has not confirmed yet.
  const loadBookings = useCallback(async () => {
    try {
      const orders = await apiFetch<OrderWithRelations[]>("/api/bookings?stage=awaiting-crew");
      setBookings((orders ?? []).map(mapOrderToBookingView).filter(isAwaitingCrewConfirmation));
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

  const pendingConfirmations = bookings;

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredConfirmations = pendingConfirmations.filter(
    (booking) =>
      booking.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.product.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ==========================================
  // PAGINATION SETUP
  // ==========================================
  const totalBookings = filteredConfirmations.length;
  const totalPages = Math.max(Math.ceil(totalBookings / ITEMS_PER_PAGE), 1);
  const startIndex =
    totalBookings === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalBookings);

  const paginatedBookings = filteredConfirmations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleOpenModal = (booking: BookingView) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleModalSubmitSuccess = (orderId: string) => {
    setSuccessOrderCode(orderId);
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
      alert(error instanceof Error ? error.message : "Failed to cancel booking.");
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
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to Calendar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-500" />
              Awaiting Crew Confirmation
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Monitor individual crew responses for upcoming delivery schedules.
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
        {/* ========================================== */}
        {/* FILTERS */}
        {/* ========================================== */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Crew Status List
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <UrlSearchSync onQuery={setSearchTerm} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search order ID or client..."
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
                <th className="py-3.5 pl-6 sm:pl-8 pr-4 w-[15%] align-top">
                  Order ID
                </th>
                <th className="py-3.5 px-4 w-[15%] align-top">Client Name</th>
                <th className="py-3.5 px-4 w-[15%] align-top">
                  Scheduled Date
                </th>
                <th className="py-3.5 px-4 w-[25%] align-top">
                  Assigned Crews
                </th>
                <th className="py-3.5 px-4 w-[15%] align-top">Status</th>
                <th className="py-3.5 pl-4 pr-6 sm:pr-8 w-[15%] text-center align-top">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={5} columns={6} />
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
                    <td className="py-4 px-4 align-top">
                      {booking.displayDate}
                    </td>

                    {/* ASSIGNED CREWS COLUMN */}
                    <td className="py-4 px-4 align-top">
                      <div className="flex flex-col gap-2">
                        {booking.crews.map((crew, idx) => (
                          <div
                            key={idx}
                            className="h-8 flex items-center truncate"
                          >
                            <span className="font-semibold text-slate-700 mr-2 shrink-0">
                              {crew.role}:
                            </span>
                            <span className="truncate">{crew.name}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* STATUS COLUMN */}
                    <td className="py-4 px-4 align-top">
                      <div className="flex flex-col gap-2">
                        {booking.crews.map((crew, idx) => (
                          <div key={idx} className="h-8 flex items-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs sm:text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${getStatusBadge(
                                crew.status,
                              )}`}
                            >
                              {crew.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* ACTION COLUMN */}
                    <td className="py-4 pl-4 pr-6 sm:pr-8 text-center align-top">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(booking);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors duration-200 whitespace-nowrap cursor-pointer"
                      >
                        Re-assign
                      </button>
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
                        {"No pending confirmations found"}
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        All crew members have confirmed their schedules or no
                        records match your search.
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
