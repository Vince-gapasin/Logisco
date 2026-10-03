"use client";

import { useState } from "react";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";
import { ArrowLeft } from "lucide-react";
import type { HistoryLogRecord, TruckRecord } from "./types";
import { formatDisplayDate } from "./dates";

// ==========================================
// TRUCK SPECIFIC HISTORY VIEW (Displays list of logs for 1 truck)
// ==========================================
interface TruckSpecificHistoryViewProps {
  truck: TruckRecord;
  logs: HistoryLogRecord[];
  onBack: () => void;
  onSelectLog: (log: HistoryLogRecord) => void;
  onEditLog: (log: HistoryLogRecord) => void;
  onDeleteLog: (id: string | number) => void;
}

export function TruckSpecificHistoryView({
  truck,
  logs,
  onBack,
  onSelectLog,
}: TruckSpecificHistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 1. Filter logs for this truck (Ultra-aggressive match ensures IDs and Plates link)
  const truckLogs = logs.filter((l) => {
    if (!l) return false; // <-- ADD THIS GUARD

    const safeLogTruckID = String(l.truckID || "log_null").trim();
    const safeTruckID = String(truck.id || "truck_null").trim();
    const matchID = safeLogTruckID === safeTruckID;

    const cleanLogPlate = String(l.plateNumber || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    const cleanTruckPlate = String(truck.plateNumber || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    const matchPlate =
      cleanLogPlate === cleanTruckPlate &&
      cleanLogPlate !== "" &&
      cleanLogPlate !== "na";

    return matchID || matchPlate;
  });

  const filteredLogs = truckLogs.filter((log) => {
    const searchLower = (searchTerm || "").toLowerCase();
    const p = String(log.plateNumber || "").toLowerCase();
    const t = String(log.truckType || "").toLowerCase();
    return p.includes(searchLower) || t.includes(searchLower);
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative animate-fade-in">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          History Logs — {truck.plateNumber}
        </h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto px-4 sm:px-6">
          <table className="w-full max-w-5xl mx-auto text-left border-collapse table-fixed my-2">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-1/4 text-left">Date</th>
                <th className="py-3.5 px-4 w-1/4 text-left">Plate Number</th>
                <th className="hidden md:table-cell py-3.5 px-4 w-1/4 text-left">
                  Status Before Change
                </th>
                <th className="py-3.5 px-4 w-1/4 text-right">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 sm:py-20 text-center">
                    <div className="text-slate-500">
                      No logs found for this truck.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const stylesBefore = getStatusStyles(log.statusBefore || "");
                  const stylesAfter = getStatusStyles(log.statusAfter || "");
                  return (
                    <tr
                      key={log.id}
                      onClick={() => onSelectLog(log)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-4 w-1/4 text-left align-middle font-medium text-slate-800">
                        {formatDisplayDate(log.date)}
                      </td>
                      <td className="py-4 px-4 w-1/4 text-left align-middle">
                        <div className="font-bold text-slate-900">
                          {log.plateNumber}{" "}
                          <span className="font-normal text-slate-500">
                            — {log.truckType}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {log.mechanicName || "Mechanic"}
                        </div>
                      </td>
                      <td className="hidden md:table-cell py-4 px-4 w-1/4 text-left align-middle">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${stylesBefore.bgLight}`}
                        >
                          {log.statusBefore || "N/A"}
                        </span>
                      </td>
                      <td className="py-4 px-4 w-1/4 text-right align-middle">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${stylesAfter.bgLight}`}
                        >
                          {log.statusAfter || "N/A"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
            >
              Previous
            </button>
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
    </div>
  );
}
