"use client";

import React, { useState } from "react";
import { UserPlus, Search, FileText } from "lucide-react";

type TabType = "Clients" | "Partners" | "On-Call";

interface ClientRecord {
  id: string | number;
  name: string;
  status: string;
  contactPerson: string;
  contactNumber: string;
}

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("Clients");
  const [searchTerm, setSearchTerm] = useState("");

  // Empty data lists representing no backend data connected yet
  const dataMap: Record<TabType, ClientRecord[]> = {
    Clients: [],
    Partners: [],
    "On-Call": [],
  };

  const currentData = dataMap[activeTab];

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Clients & Partners
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Manage your client directories, partner relationships, and on-call
            personnel.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() =>
            alert(
              `Backend not connected yet. Add new ${activeTab.slice(0, -1)} modal will open here!`,
            )
          }
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-sm transition-all duration-200 text-sm whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span>
            Add New{" "}
            {activeTab === "Clients"
              ? "Client"
              : activeTab === "Partners"
                ? "Partner"
                : "Personnel"}
          </span>
        </button>
      </div>

      {/* Main Content Container Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Tab Navigation Header */}
        <div className="border-b border-slate-100 px-4 sm:px-6 pt-4 flex gap-6 sm:gap-8 overflow-x-auto scrollbar-none">
          {(["Clients", "Partners", "On-Call"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-sm sm:text-base font-semibold transition-all relative whitespace-nowrap ${
                  isActive
                    ? "text-blue-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Search Bar Container */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* 4-Column Data Table Structure with Horizontal Scrolling Protection */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-162.5">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Name</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
                <th className="py-3.5 px-4 sm:px-6">Contact Person</th>
                <th className="py-3.5 px-4 sm:px-6">Contact Number</th>
              </tr>
            </thead>
            <tbody>
              {currentData.length > 0 ? (
                currentData.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 hover:bg-slate-50/50"
                  >
                    {/* Rows will render here once connected */}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 sm:py-16 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        No {activeTab.toLowerCase()} available
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        Data for {activeTab} will appear here once you connect
                        your backend database.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
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
