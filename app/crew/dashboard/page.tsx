// ==========================================
// LOGISCO - CREW DASHBOARD PAGE
// ==========================================
"use client";

import React, { useState, useEffect } from "react";
import { FileText, CheckCircle2, Clock, Eye } from "lucide-react";

export interface DeliveryRecord {
  id: string | number;
  clientName: string;
  bookingId: string;
  address: string;
  dateTime: string;
  status: "Accepted" | "Awaiting Confirmation";
}

interface CrewDashboardProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

export default function CrewDashboardPage({
  isOpen,
  setIsOpen,
}: CrewDashboardProps) {
  const [selectedFilter, setSelectedFilter] = useState<
    "My Deliveries" | "Unconfirmed"
  >("My Deliveries");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Realistic food-service dummy delivery data (Supabase-ready)
  const [deliveryList, setDeliveryList] = useState<DeliveryRecord[]>([
    {
      id: 1,
      clientName: "Jollibee – Katipunan",
      bookingId: "ORD-0001",
      address: "Katipunan Avenue, Quezon City",
      dateTime: "August 21, 2026 • 8:00 AM - 10:00 AM",
      status: "Accepted",
    },
    {
      id: 2,
      clientName: "Popeyes – Sta. Mesa",
      bookingId: "ORD-0002",
      address: "V. Mapa Street, Sta. Mesa, Manila",
      dateTime: "August 22, 2026 • 1:00 - 4:00 PM",
      status: "Awaiting Confirmation",
    },
    {
      id: 3,
      clientName: "KFC – Cubao",
      bookingId: "ORD-0003",
      address: "Aurora Boulevard, Cubao, Quezon City",
      dateTime: "August 23, 2026 • 9:30 AM - 1:30 AM",
      status: "Accepted",
    },
    {
      id: 4,
      clientName: "McDonald’s – Ortigas",
      bookingId: "ORD-0004",
      address: "Emerald Avenue, Ortigas Center, Pasig City",
      dateTime: "August 24, 2026 • 2:00 PM - 6:00 PM",
      status: "Awaiting Confirmation",
    },
    {
      id: 5,
      clientName: "Chowking – Quezon Avenue",
      bookingId: "ORD-0005",
      address: "Quezon Avenue, Quezon City",
      dateTime: "August 25, 2026 • 10:00 AM - 12:00 PM",
      status: "Accepted",
    },
  ]);

  // Reset page to 1 when switching tabs
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter]);

  // Category counts
  const myDeliveriesCount = deliveryList.filter(
    (d) => d.status === "Accepted",
  ).length;
  const unconfirmedCount = deliveryList.filter(
    (d) => d.status === "Awaiting Confirmation",
  ).length;

  // Filter logic based on tabs only
  const filteredDeliveries = deliveryList.filter((delivery) => {
    return selectedFilter === "My Deliveries"
      ? delivery.status === "Accepted"
      : delivery.status === "Awaiting Confirmation";
  });

  // Pagination Math
  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDeliveries = filteredDeliveries.slice(startIndex, endIndex);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* ================= PAGE HEADER ================= */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Crew Delivery Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your assigned delivery schedules and confirm pending
            bookings.
          </p>
        </div>
      </div>

      {/* ================= MAIN CONTENT CARD ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter Bar Container */}
        <div className="p-4 sm:p-5 px-6 sm:px-12 md:px-20 lg:px-32 xl:px-40 border-b border-slate-100 flex items-center justify-between">
          {/* Filter Tabs/Buttons */}
          <div className="flex items-center gap-2 w-full overflow-x-auto pb-2 lg:pb-0">
            <button
              onClick={() => setSelectedFilter("My Deliveries")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                selectedFilter === "My Deliveries"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>My Deliveries ({myDeliveriesCount})</span>
            </button>

            <button
              onClick={() => setSelectedFilter("Unconfirmed")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                selectedFilter === "Unconfirmed"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100/70 border border-amber-200/50"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Unconfirmed ({unconfirmedCount})</span>
            </button>
          </div>
        </div>

        {/* Data Table with Balanced Fixed Layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {currentDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        No delivery records found
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Try switching tabs to view other records.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentDeliveries.map((delivery) => (
                  <tr
                    key={delivery.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Clients Column: Stacked Info Block */}
                    <td className="py-4 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 text-left w-2/3">
                      <div className="font-bold text-slate-900">
                        {delivery.clientName}
                      </div>
                      <div className="text-xs font-semibold text-black-600 mt-1">
                        {delivery.bookingId}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {delivery.address}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">
                        {delivery.dateTime}
                      </div>
                    </td>

                    {/* Status Column: View Details at Top + Badge */}
                    <td className="py-4 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 text-right w-1/3">
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => {
                            console.log(
                              "Viewing details for:",
                              delivery.bookingId,
                            );
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Click to View</span>
                        </button>
                        <span
                          className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold ${
                            delivery.status === "Accepted"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {delivery.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 px-6 sm:px-12 md:px-20 lg:px-32 xl:px-40 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {filteredDeliveries.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredDeliveries.length)} of{" "}
            {filteredDeliveries.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage === 1
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Previous
            </button>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage === totalPages || totalPages === 0
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
