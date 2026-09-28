// File: app/admindashboard/feeds/completed/page.tsx
"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import UrlOpenSync from "@/components/UrlOpenSync";
import BookingHistory from "@/components/booking/BookingHistory";
import React, { useState, useRef, useEffect, useCallback } from "react";
import RowOpenButton from "@/components/RowOpenButton";
import TableSkeleton from "@/components/TableSkeleton";
import { apiFetch } from "@/app/lib/apiClient";
import BookingStopsReadOnly from "@/components/booking/BookingStopsReadOnly";
import {
  AssignedCrew,
  BookingNotes,
  BookingSchedule,
  ClientInformation,
} from "@/components/booking/BookingReadOnly";
import DeliveryProgress from "@/components/booking/DeliveryProgress";
import {
  isCompleted,
  mapOrderToBookingView,
  toFeedBooking,
  type FeedBooking,
  type FeedStopRow,
  type OrderWithRelations,
} from "@/app/lib/bookingView";
import { useRouter } from "next/navigation";
import ListLoadError from "@/components/ListLoadError";
import {
  Search,
  FileText,
  ArrowLeft,
  X,
  CheckCircle2,
  Clock,
} from "lucide-react";

// ==========================================
// DUMMY DATA (Realistic Completed records with full accumulated history)
// ==========================================

const ITEMS_PER_PAGE = 10;

// ==========================================
// STATUS BADGE HELPERS
// ==========================================
const getStatusBadgeClass = (status: string) => {
  if (status === "Delivered" || status === "Complete") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  return "bg-slate-100 text-slate-800 border border-slate-200";
};


// ==========================================
// PROGRESS TRACKER COMPONENT

// ==========================================
// BOOKING DETAILS MODAL
// ==========================================
interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: FeedBooking | null;
}

function BookingDetailsModal({
  isOpen,
  onClose,
  booking,
}: BookingDetailsModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [pickupList, setPickupList] = useState<FeedStopRow[]>([]);
  const [deliveryList, setDeliveryList] = useState<FeedStopRow[]>([]);

  // The form is seeded from the booking this was opened with. That is a
  // synchronous setState in an effect, which the rule is right to notice and
  // is also the only way to fill a form from a prop that arrives later.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen && booking) {
      setFormData({
        clientName: booking.clientName || "",
        contactPerson: booking.contactPerson || "",
        contactNumber: booking.contactNumber || "",
        emailAddress: booking.emailAddress || "",
        businessAddress: booking.businessAddress || "",
        requestDate: booking.dateCreated || currentDate,
        deliverySchedule: booking.scheduledDate || "",
        product: booking.product || "",
        priorityLevel: booking.priorityLevel || "Standard",
        subconPartner: booking.subconPartner || "",
        truckPlate:
          booking.truckPlate === "Not Assigned" ? "" : booking.truckPlate,
        driver: booking.driver === "Not Assigned" ? "" : booking.driver,
        helper1: booking.crews?.find((member) => member.role === "Helper #1")?.name ?? "",
        helper2: booking.crews?.find((member) => member.role === "Helper #2")?.name ?? "",
        notes: booking.notes || "",
      });

      setPickupList(
        booking.pickupList?.length
          ? JSON.parse(JSON.stringify(booking.pickupList))
          : [
              {
                warehouseName: "Main Warehouse",
                warehouseAddress: "Manila Hub",
                contactPerson: "Warehouse Admin",
                contactNumber: "09181112233",
                pickupTime: "08:00",
                quantity: "50",
              },
            ],
      );

      setDeliveryList(
        booking.deliveryList?.length
          ? JSON.parse(JSON.stringify(booking.deliveryList))
          : [
              {
                branchName: "",
                deliveryAddress: "",
                contactPerson: "",
                contactNumber: "",
                deliveryTime: "12:00",
                quantity: "50",
                stopStatus: "Completed",
              },
            ],
      );

      setTimeout(() => {
        crewSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [isOpen, booking, currentDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen || !booking) return null;

  // Completed bookings are strictly read-only.

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-full flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <FileText className="w-5 h-5" /> Booking Details:{" "}
              {booking.orderId}
            </h2>
            <p className="text-xs font-medium opacity-80 mt-0.5">
              Status: {booking.status} | {booking.confirmationStatus}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-900">
          {/* Top Info & Progress Tracker */}
          <div className="border border-slate-200 rounded-xl p-4 md:p-6 bg-white shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto flex-1">
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Date Created
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.dateCreated}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Created By
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.createdBy}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Order Priority
                </p>
                <span
                  className={`inline-flex px-2 py-0.5 rounded font-bold text-xs sm:text-[10px] uppercase tracking-wider ${
                    booking.priorityLevel === "High Priority" ||
                    booking.priorityLevel === "Urgent"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {booking.priorityLevel}
                </span>
              </div>
            </div>

            <div className="w-full md:w-87.5 shrink-0">
              <h3 className="text-xs sm:text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 md:text-right">
                Delivery Progress
              </h3>
              <DeliveryProgress finished currentStatus={booking.status} />
            </div>
          </div>

          <ClientInformation fields={formData} />

          <BookingStopsReadOnly
            pickups={pickupList}
            deliveries={deliveryList}
            showStatus
            showEditNote={false}
          />

          <BookingSchedule fields={formData} scheduledFor={booking.displayDate} />

          <AssignedCrew fields={formData} sectionRef={crewSectionRef} />

          <BookingNotes notes={formData.notes} />

          {/* 7. What happened to this booking, newest first. */}
          <BookingHistory orderID={booking.id} />
        </div>

        {/* FIXED FOOTER */}
        <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-200 hover:bg-black hover:text-white text-slate-800 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function CompletedFeedPage() {
  const [bookings, setBookings] = useState<FeedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadBookings = useCallback(async () => {
    try {
      const orders = await apiFetch<OrderWithRelations[]>("/api/bookings?stage=completed");
      setBookings(
        (orders ?? []).map(mapOrderToBookingView).filter(isCompleted).map(toFeedBooking),
      );
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
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<FeedBooking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleOpenModal = (booking: FeedBooking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
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
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              Completed Feed
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Review successfully delivered orders and trip history.
            </p>
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
            Delivered Orders
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <UrlSearchSync onQuery={setSearchTerm} />
              <UrlOpenSync rows={bookings} ready={!isLoading} onOpen={handleOpenModal} />
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
        <div className="md:overflow-x-auto px-4 pt-4 md:px-0 md:pt-0 min-h-100 md:min-h-135">
          <table role="table" className="w-full text-left border-collapse md:min-w-62.5 md:table-fixed block md:table">
            <thead role="rowgroup" className="hidden md:table-header-group">
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
            <tbody role="rowgroup" className="block md:table-row-group">
              {isLoading ? (
                <TableSkeleton rows={5} columns={6} stacked />
              ) : loadError ? (
                <tr role="row" className="block md:table-row">
                  <td role="cell" colSpan={6} className="block md:table-cell py-16 sm:py-20 text-center">
                    <ListLoadError message={loadError} onRetry={retryLoad} />
                  </td>
                </tr>
              ) : paginatedBookings.length > 0 ? (
                paginatedBookings.map((booking) => (
                  <tr role="row"
                    data-pressable
                    key={booking.id}
                    onClick={() => handleOpenModal(booking)}
                    className="block md:table-row bg-white border border-slate-200 rounded-xl mb-4 p-3 md:border-0 md:border-b md:border-slate-100 md:rounded-none md:mb-0 md:p-0 hover:bg-slate-50/80 transition-colors text-sm text-slate-800 cursor-pointer"
                  >
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:pl-6 md:pr-4 font-medium text-slate-900 align-top">
                      <span className="md:hidden text-xs font-semibold text-slate-500">Order ID</span>
                      <RowOpenButton
                        label={`View booking ${booking.orderId}`}
                        onOpen={() => handleOpenModal(booking)}
                        className="wrap-break-word font-medium"
                      >
                        {booking.orderId}
                      </RowOpenButton>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:px-4 font-medium align-top">
                      <span className="md:hidden text-xs font-semibold text-slate-500">Client Name</span>
                      <span className="wrap-break-word">{booking.clientName}</span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-start py-1.5 md:py-4 px-0 md:px-4 align-top text-slate-600 md:truncate">
                      <span className="md:hidden text-xs font-semibold text-slate-500">Product</span>
                      <span className="wrap-break-word">{booking.product}</span>
                    </td>
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:px-4 align-top">
                      <span className="md:hidden text-xs font-semibold text-slate-500">Scheduled Date</span>
                      <span className="wrap-break-word">{booking.displayDate}</span>
                    </td>

                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-start py-1.5 md:py-4 px-0 md:px-4 align-top">
                      <span className="md:hidden text-xs font-semibold text-slate-500">Assigned Crew</span>
                      {booking.crews && booking.crews.length > 0 ? (
                        <div className="flex flex-col gap-1.5 min-w-0">
                          {booking.crews.map((crew, idx) => (
                            <div
                              key={idx}
                              className="flex items-baseline text-xs md:truncate"
                            >
                              <span className="font-semibold text-slate-700 mr-1.5 shrink-0 w-16">
                                {crew.role}:
                              </span>
                              <span className="md:truncate wrap-break-word text-slate-900">
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
                    <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:pl-4 md:pr-6 align-top">
                      <span className="md:hidden text-xs font-semibold text-slate-500">Status</span>
                      <span
                        className={`inline-flex w-max items-center justify-center px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getStatusBadgeClass(booking.confirmationStatus)}`}
                      >
                        {booking.confirmationStatus}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr role="row" className="block md:table-row">
                  <td role="cell" colSpan={6} className="block md:table-cell py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        {"No completed bookings found"}
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        There are currently no finished deliveries matching your
                        search.
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

      {/* Booking Details Modal */}
      <BookingDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        booking={selectedBooking}
      />
    </div>
  );
}
