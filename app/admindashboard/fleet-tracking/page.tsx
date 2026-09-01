"use client";

import React, { useState, useEffect } from "react";
import { Search, FileText } from "lucide-react";

export default function FleetLiveTrackingPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // ==========================================
  // ADDED: DATA & PAGINATION STATES
  // ==========================================
  const [deliveries, setDeliveries] = useState<any[]>([]); // Replace 'any' with your tracking interface later
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search filtering logic
  const filteredDeliveries = deliveries.filter((delivery) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      delivery.orderId?.toLowerCase().includes(searchLower) ||
      delivery.truck?.toLowerCase().includes(searchLower) ||
      delivery.client?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination Math
  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDeliveries = filteredDeliveries.slice(startIndex, endIndex);

  // Reset to page 1 whenever the search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Fleet Live Tracking
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Monitor active deliveries and track the real-time location and
            status of your fleet.
          </p>
        </div>

        {/* Search Input Control */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order ID, truck, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Main Content Container Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* 5-Column Data Table Structure with Horizontal Scrolling Protection */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[187.5px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Order ID</th>
                <th className="py-3.5 px-4 sm:px-6">Truck</th>
                <th className="py-3.5 px-4 sm:px-6">Client</th>
                <th className="py-3.5 px-4 sm:px-6">Tracking Link</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
              </tr>
            </thead>

            {/* Dynamic Body */}
            <tbody>
              {paginatedDeliveries.length > 0 ? (
                paginatedDeliveries.map((delivery, index) => (
                  <tr
                    key={delivery.id || index}
                    className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-sm text-slate-800"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                      {delivery.orderId}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">{delivery.truck}</td>
                    <td className="py-3.5 px-4 sm:px-6">{delivery.client}</td>
                    <td className="py-3.5 px-4 sm:px-6">
                      {delivery.trackingLink ? (
                        <a
                          href={delivery.trackingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View Live Map
                        </a>
                      ) : (
                        <span className="text-slate-400">Unavailable</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {delivery.status || "Pending"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                /* Empty State Placeholder */
                <tr>
                  <td colSpan={5} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        No active deliveries found
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        Live delivery and fleet tracking records will appear
                        here once connected to your backend database.
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
            Showing {filteredDeliveries.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredDeliveries.length)} of{" "}
            {filteredDeliveries.length} entries
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors w-full sm:w-auto text-center ${
                currentPage === 1
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
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
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors w-full sm:w-auto text-center ${
                currentPage === totalPages || totalPages === 0
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
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
