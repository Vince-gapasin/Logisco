"use client";

import React, { useState } from "react";
import { Search, Truck, FileText } from "lucide-react";

export default function FleetStatusPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Fleet Status
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Monitor and manage fleet availability, maintenance logs, and truck
            asset statuses.
          </p>
        </div>

        <button
          onClick={() =>
            alert("Add new truck modal/form will open here once configured!")
          }
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-5 py-2.5 shadow-sm transition-all duration-200 text-sm whitespace-nowrap"
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span>Add Truck</span>
        </button>
      </div>

      {/* Main Content Container Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Search Bar Container */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by plate number or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* 3-Column Data Table Structure with Horizontal Scrolling Protection */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-162.5">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Plate Number</th>
                <th className="py-3.5 px-4 sm:px-6">Last Checked</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Empty State Placeholder */}
              <tr>
                <td colSpan={3} className="py-12 sm:py-16 text-center">
                  <div className="flex flex-col items-center justify-center px-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-slate-900 font-medium text-sm">
                      No trucks found
                    </p>
                    <p className="text-slate-600 text-xs mt-1 max-w-sm">
                      Truck records will appear here once connected to your
                      backend database.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination Footer Placeholder */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>Showing 0 of 0 entries</span>
          <div className="flex items-center gap-2">
            <button
              disabled
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
