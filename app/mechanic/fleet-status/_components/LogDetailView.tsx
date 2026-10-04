"use client";

import { useState } from "react";
import {
  Truck,
  ArrowLeft,
  Edit3,
  Trash2,
  ClipboardCheck,
} from "lucide-react";
import type { HistoryLogRecord } from "./types";
import { formatDisplayDate } from "./dates";
import { ImageModal } from "./ImageModal";

// ==========================================
// HISTORY LOG DETAIL VIEW (Displays consolidated maintenance cycle)
// ==========================================
interface LogDetailViewProps {
  log: HistoryLogRecord;
  truckLogs: HistoryLogRecord[];
  onBack: () => void;
  onEdit: (logRecord: HistoryLogRecord) => void;
  onDelete: (id: string | number) => void;
  currentUserId: string; // <-- ADD THIS
  /** The office reads a repair record; it never edits or deletes one. */
  readOnly?: boolean;
}

export function LogDetailView({
  log,
  truckLogs,
  onBack,
  onEdit,
  onDelete,
  currentUserId,
  readOnly = false,
}: LogDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const isMaintenance = (status?: string) =>
    status === "On Maintenance" || status === "Out of Service";

  const sorted = [...(truckLogs || [])].reverse();
  const clickedIdx = sorted.findIndex((l) => String(l.id) === String(log.id));

  let startIdx = clickedIdx !== -1 ? clickedIdx : 0;
  while (startIdx > 0 && isMaintenance(sorted[startIdx].statusBefore)) {
    startIdx--;
  }

  let endIdx = clickedIdx !== -1 ? clickedIdx : 0;
  while (
    endIdx < sorted.length - 1 &&
    isMaintenance(sorted[endIdx].statusAfter)
  ) {
    endIdx++;
  }

  const cycleLogs =
    clickedIdx !== -1 ? sorted.slice(startIdx, endIdx + 1) : [log];

  const preliminaryLogs = cycleLogs.filter(
    (l) => l.driversReport || l.preliminaryRemarks || l.preliminaryPhotoUrl || l.hasPreliminaryPhoto,
  );
  const progressLogs = cycleLogs.filter(
    (l) => l.additionalIssue || l.progressRemarks || l.progressPhotoUrl || l.hasProgressPhoto,
  );
  const finalLogs = cycleLogs.filter(
    (l) => l.issue || l.remarks || l.photoUrl || l.hasFinalPhoto,
  );

  const mechanicSourceLog =
    preliminaryLogs.length > 0 ? preliminaryLogs[0] : cycleLogs[0] || log;

  // --- NEW: Strict Latest-Mechanic Access Control (Explicitly Newest-First) ---
  // Sort the logs by exact timestamp to guarantee index 0 is the most recent update
  const newestFirstCycleLogs = [...cycleLogs].sort((a, b) => {
    const timeA = new Date(a.created_at || a.date).getTime();
    const timeB = new Date(b.created_at || b.date).getTime();
    return timeB - timeA;
  });

  const activeCycleLog = newestFirstCycleLogs[0];
  const currentUserStr = String(currentUserId).trim();
  // A log opened by the office or by a breakdown has no mechanic on it yet;
  // it is open to whichever mechanic picks it up, as on the truck screen.
  const hasMechanicAccess = activeCycleLog
    ? !activeCycleLog.primaryMechanicID ||
      String(activeCycleLog.primaryMechanicID).trim() === currentUserStr ||
      String(activeCycleLog.additionalMechanicID).trim() === currentUserStr
    : false;

  // --- MERGE PROGRESS UPDATES (SECTION 3) INTO SINGLE CONSOLIDATED BLOCKS ---
  const sortedProgressLogs = [...progressLogs].sort((a, b) => {
    const timeA = new Date(a.created_at || a.date).getTime();
    const timeB = new Date(b.created_at || b.date).getTime();
    return timeB - timeA;
  });

  const combinedIssuesList = sortedProgressLogs
    .filter((u) => u.additionalIssue)
    .map((u, idx, arr) => (
      <div key={`issue-${idx}`} className={idx !== 0 ? "mt-4" : ""}>
        <span className="font-bold">
          Update #{arr.length - idx} [{formatDisplayDate(u.date)} -{" "}
          {u.mechanicName || "Mechanic"}]:
        </span>
        <br />
        {u.additionalIssue}
      </div>
    ));

  const combinedRemarksList = sortedProgressLogs
    .filter((u) => u.progressRemarks)
    .map((u, idx, arr) => (
      <div key={`remark-${idx}`} className={idx !== 0 ? "mt-4" : ""}>
        <span className="font-bold">
          Update #{arr.length - idx} [{formatDisplayDate(u.date)} -{" "}
          {u.mechanicName || "Mechanic"}]:
        </span>
        <br />
        {u.progressRemarks}
      </div>
    ));

  const combinedPhotos = sortedProgressLogs
    .map((u) => u.progressPhotoUrl)
    .filter(Boolean);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {" "}
              Maintenance Record
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Showing all logs related to this maintenance cycle.
            </p>
          </div>
        </div>

        {/* UPDATED: Only show Edit/Delete if authorized mechanic */}
        {!readOnly && hasMechanicAccess && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onEdit(log)}
              className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit This Row</span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete This Row</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold border border-blue-100">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {log.plateNumber}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-slate-600 text-sm">
                <Truck className="w-4 h-4" />
                <span>{log.truckType}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-900">
          {/* 1. Basic Information (Clicked Row) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Selected Record Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Plate Number
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {log.plateNumber}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Truck
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {log.truckType}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Date
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {log.date ? formatDisplayDate(log.date) : "—"}
                </div>
              </div>
              {/* UPDATED: Pulls mechanics from the preliminary log, falling back to current log */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Primary Mechanic
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {mechanicSourceLog?.primaryMechanicID
                    ? mechanicSourceLog.mechanicName
                    : log.primaryMechanicID
                      ? log.mechanicName
                      : "Unassigned - awaiting a mechanic"}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Additional Mechanic
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {mechanicSourceLog?.additionalMechanic ||
                    log.additionalMechanic ||
                    "None"}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Preliminary Inspection Section */}
          {preliminaryLogs.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                2. Preliminary Inspection
              </div>
              <div className="space-y-6">
                {preliminaryLogs.map((pLog, idx) => (
                  <div
                    key={pLog.id}
                    className={
                      idx !== 0 ? "pt-6 border-t border-slate-100" : ""
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">
                          Issue to Fix / Driver&apos;s Report
                        </label>
                        <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                          {pLog.driversReport || "—"}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">
                          Preliminary Remarks
                        </label>
                        <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                          {pLog.preliminaryRemarks || "None"}
                        </div>
                      </div>
                      {pLog.preliminaryPhotoUrl && (
                        <div className="sm:col-span-2 mt-2">
                          <label className="block text-xs font-medium text-black mb-1">
                            Attachment/s
                          </label>
                          <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                            <img
                              src={pLog.preliminaryPhotoUrl}
                              alt="Preliminary Evidence"
                              onClick={() =>
                                setZoomedImage(pLog.preliminaryPhotoUrl!)
                              }
                              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Maintenance Progress Section (CONSOLIDATED) */}
          {progressLogs.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex items-center justify-between">
                <span>3. Maintenance Progress </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Additional Issues
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                    {combinedIssuesList.length > 0 ? combinedIssuesList : "—"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    {" "}
                    Progress Remarks
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                    {combinedRemarksList.length > 0
                      ? combinedRemarksList
                      : "None"}
                  </div>
                </div>
                {combinedPhotos.length > 0 && (
                  <div className="sm:col-span-2 mt-2">
                    <label className="block text-xs font-medium text-black mb-1">
                      Attachment/s ({combinedPhotos.length})
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {combinedPhotos.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs"
                        >
                          <img
                            src={url as string}
                            alt={`Progress Evidence ${idx + 1}`}
                            onClick={() => setZoomedImage(url as string)}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Final Maintenance Log Section */}
          {finalLogs.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                4. Final Maintenance Log
              </div>
              <div className="space-y-6">
                {finalLogs.map((fLog, idx) => (
                  <div
                    key={fLog.id}
                    className={
                      idx !== 0 ? "pt-6 border-t border-slate-100" : ""
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">
                          Work Performed
                        </label>
                        <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                          {fLog.issue || "—"}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">
                          Final Remarks
                        </label>
                        <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                          {fLog.remarks || "None"}
                        </div>
                      </div>
                      {fLog.photoUrl && (
                        <div className="sm:col-span-2 mt-2">
                          <label className="block text-xs font-medium text-black mb-1">
                            Attachment/s
                          </label>
                          <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                            <img
                              src={fLog.photoUrl}
                              alt="Final Evidence"
                              onClick={() => setZoomedImage(fLog.photoUrl!)}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {showDeleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Maintenance Log
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(log.id);
                  setShowDeleteModal(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {zoomedImage && (
        <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />
      )}
    </div>
  );
}
