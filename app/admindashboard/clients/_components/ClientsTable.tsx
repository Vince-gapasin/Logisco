/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import RowOpenButton from "@/components/RowOpenButton";
import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import type { TabType, UnifiedRecord } from "./types";

// ==========================================
// SUB-COMPONENTS
// ==========================================

export function ClientsTable({
  activeTab,
  currentData,
  onRowClick,
}: {
  activeTab: TabType;
  currentData: UnifiedRecord[];
  onRowClick: (record: UnifiedRecord) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Back to the first page when the list itself changes - a search, a tab.
  // Keyed on the array, this reset whenever anything on the page re-rendered,
  // because the filtered list is a new array every time.
  useEffect(() => {
    setCurrentPage(1);
  }, [currentData.length, activeTab]);

  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = currentData.slice(startIndex, endIndex);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      {/* A 580px floor is most of a phone screen left blank, so the short
          version applies there and the taller one returns from sm up, where it
          keeps the pagination footer in a consistent place. */}
      <div className="overflow-x-auto flex-1 min-h-36.25 sm:min-h-145">
        {/* Fixed widths on a phone, fluid percentages from sm up. The first two
            columns come to 270px against a 550px table, so the third is half
            visible at the edge - which is what tells somebody the row scrolls
            rather than ends there. */}
        <table className="w-full text-left border-collapse table-fixed min-w-137.5">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <th className="py-3.5 px-4 sm:px-6 w-45 sm:w-[30%]">Name</th>
              <th className="py-3.5 px-4 sm:px-6 w-22.5 sm:w-[15%]">Status</th>
              <th className="py-3.5 px-4 sm:px-6 w-37.5 sm:w-[30%]">Contact Person</th>
              <th className="py-3.5 px-4 sm:px-6 w-32.5 sm:w-[25%] text-center">Contact Number</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr
                  data-pressable
                  key={item.id}
                  onClick={() => onRowClick(item)}
                  className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-sm text-slate-800 h-13.25"
                >
                  <td
                    className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 truncate"
                    title={item.name}
                  >
                    <RowOpenButton
                      label={`View record for ${item.name}`}
                      onOpen={() => onRowClick(item)}
                      className="truncate max-w-full"
                    >
                      {item.name}
                    </RowOpenButton>
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 truncate">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
                      {item.status}
                    </span>
                  </td>
                  <td
                    className="py-3.5 px-4 sm:px-6 truncate"
                    title={item.contactPerson}
                  >
                    {item.contactPerson}
                  </td>
                  <td
                    className="py-3.5 px-4 sm:px-6 truncate text-center"
                    title={item.contactNumber}
                  >
                    {item.contactNumber}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="py-12 sm:py-16 text-center h-31.25 sm:h-125 align-middle"
                >
                  <div className="flex flex-col items-center justify-center px-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-slate-900 font-medium text-sm">
                      No {activeTab.toLowerCase()} available
                    </p>
                    <p className="text-slate-600 font-normal text-xs mt-1 max-w-sm">
                      Data for {activeTab} will appear here once you add new
                      records.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-normal text-slate-700 bg-white mt-auto">
        <span>
          Showing {currentData.length === 0 ? 0 : startIndex + 1} to{" "}
          {Math.min(endIndex, currentData.length)} of {currentData.length}{" "}
          entries
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
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
            disabled={currentPage === totalPages || totalPages === 0}
            className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
