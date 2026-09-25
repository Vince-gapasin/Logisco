// File: app/admindashboard/feeds/completed/page.tsx
"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import UrlOpenSync from "@/components/UrlOpenSync";
import BookingHistory from "@/components/booking/BookingHistory";
import React, { useState, useRef, useEffect, useCallback } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { apiFetch } from "@/app/lib/apiClient";
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
} from "@/app/lib/bookingView";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const renderStopStatus = (status?: string) => {
  const currentStatus = status || "Completed";
  const s = currentStatus.toLowerCase();

  if (s === "in progress") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
        <Clock className="w-3 h-3" /> {currentStatus}
      </span>
    );
  } else if (s.includes("deliver") || s === "completed" || s === "complete") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="w-3 h-3" /> {currentStatus}
      </span>
    );
  } else {
    // Treat as Not Completed / Pending / No
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
        <X className="w-3 h-3" /> {currentStatus}
      </span>
    );
  }
};

// ==========================================
// PROGRESS TRACKER COMPONENT

// ==========================================
// BOOKING DETAILS MODAL
// ==========================================
interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
}

function BookingDetailsModal({
  isOpen,
  onClose,
  booking,
}: BookingDetailsModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState<any>({});
  const [pickupList, setPickupList] = useState<any[]>([]);
  const [deliveryList, setDeliveryList] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && booking) {
      setFormData({
        clientName: booking.clientName || "",
        contactPerson: booking.contactPerson || "Juan Dela Cruz",
        contactNumber: booking.contactNumber || "09123456789",
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
        helper1: booking.helper1 === "Not Assigned" ? "" : booking.helper1,
        helper2: booking.helper2 === "Not Assigned" ? "" : booking.helper2,
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

  if (!isOpen || !booking) return null;

  // Completed bookings are strictly read-only.
  const tableInputClass =
    "w-full bg-transparent border-none px-1.5 py-1 font-medium text-slate-700 cursor-default focus:outline-none";

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

          {/* 2. Pickup Address */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                2. Pickup Addresses
              </span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg pb-2">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
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
                    <th className="p-2.5 border-r border-slate-200 w-24 text-center">
                      Quantity
                    </th>
                    <th className="p-2.5 text-center w-[10%]">
                      <div className="flex items-center justify-center gap-1.5">
                        Stop Status
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pickupList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium align-middle">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          readOnly
                          value={row.warehouseName}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.warehouseAddress}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.contactPerson}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.contactNumber}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="time"
                          value={row.pickupTime}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="number"
                          value={row.quantity}
                          readOnly
                          className={`${tableInputClass} min-w-15 text-center`}
                        />
                      </td>
                      <td className="p-2 text-center bg-slate-50 align-top">
                        {renderStopStatus(row.stopStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Delivery Address */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                3. Delivery Address
              </span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg pb-2">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
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
                      Delivery Time
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-16 text-center">
                      Quantity
                    </th>
                    <th className="p-2.5 text-center w-[10%]">
                      <div className="flex items-center justify-center gap-1.5">
                        Stop Status
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium align-middle">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          readOnly
                          value={row.branchName}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.deliveryAddress}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.contactPerson}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.contactNumber}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="time"
                          value={row.deliveryTime}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="number"
                          value={row.quantity}
                          readOnly
                          className={`${tableInputClass} min-w-15 text-center`}
                        />
                      </td>
                      <td className="p-2 text-center bg-slate-50 align-top">
                        {renderStopStatus(row.stopStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
      const orders = await apiFetch<any[]>("/api/bookings?stage=completed");
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
    void loadBookings();
  }, [loadBookings]);

  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
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

  const handleOpenModal = (booking: any) => {
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
        <div className="overflow-x-auto min-h-135">
          <table className="w-full text-left border-collapse min-w-62.5 table-fixed">
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
                        className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getStatusBadgeClass(booking.confirmationStatus)}`}
                      >
                        {booking.confirmationStatus}
                      </span>
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
