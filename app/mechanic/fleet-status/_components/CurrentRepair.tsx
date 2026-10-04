"use client";

import { useState } from "react";
import type { HistoryLogRecord, TruckRecord } from "./types";
import { formatDisplayDate } from "./dates";
import { ImageModal } from "./ImageModal";

// The repair a truck is in the middle of: which of its logs belong to it, who
// is on it, and the inspection and progress sections a truck page shows for
// it. Shared by the mechanic's truck page and the office's, so both read a
// repair the same way.

export interface CurrentRepair {
  /** This truck's logs, newest first. */
  truckLogs: HistoryLogRecord[];
  /** The newest log has the truck grounded: a repair is under way. */
  inProgress: boolean;
  /** The newest log of the repair under way, when there is one. */
  activeLog: HistoryLogRecord | undefined;
  latestPreliminaryLog: HistoryLogRecord | null;
  /** Progress updates of the repair under way, newest first. */
  progressUpdates: HistoryLogRecord[];
}

export function currentRepairOf(truck: Pick<TruckRecord, "id" | "plateNumber">, logs: HistoryLogRecord[]): CurrentRepair {
  // Logs for this truck, matched by id, or by plate for older rows (newest first).
  const truckLogs = logs.filter((l) => {
    if (!l) return false;
    const matchID = String(l.truckID || "log_null").trim() === String(truck.id || "truck_null").trim();
    const cleanLogPlate = String(l.plateNumber || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const cleanTruckPlate = String(truck.plateNumber || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const matchPlate = cleanLogPlate === cleanTruckPlate && cleanLogPlate !== "" && cleanLogPlate !== "na";
    return matchID || matchPlate;
  });

  // The newest log with an inspection starts the current cycle.
  const prelimIndex = truckLogs.findIndex((l) => l.driversReport || l.preliminaryRemarks || l.preliminaryPhotoUrl);
  const latestPreliminaryLog = prelimIndex !== -1 ? truckLogs[prelimIndex] : null;
  const cycleLogs = prelimIndex !== -1 ? truckLogs.slice(0, prelimIndex + 1) : truckLogs;

  // Only a repair still in progress belongs to somebody. When the newest log
  // put the truck back in service, the last repair is over: a truck grounded
  // again without a new log - a restored truck comes back Out of Service - is
  // an open job, the same as one the office has just sent to maintenance.
  const newestLog = truckLogs[0];
  const inProgress = newestLog?.statusAfter === "On Maintenance" || newestLog?.statusAfter === "Out of Service";

  const progressUpdates = cycleLogs
    .filter((l) => l.additionalIssue || l.progressRemarks || l.progressPhotoUrl)
    .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

  return {
    truckLogs,
    inProgress,
    activeLog: inProgress ? cycleLogs[0] : undefined,
    latestPreliminaryLog,
    progressUpdates,
  };
}

/** Sections 2 and 3 of a truck page: the inspection and progress of the repair under way. */
export function CurrentRepairSections({ repair, show }: { repair: CurrentRepair; show: boolean }) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const { latestPreliminaryLog, progressUpdates } = repair;
  if (!show || !repair.inProgress) return null;

  const combinedIssuesList = progressUpdates
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

  const combinedRemarksList = progressUpdates
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

  const combinedPhotos = progressUpdates.map((u) => u.progressPhotoUrl).filter(Boolean);

  return (
    <>
      {latestPreliminaryLog && (latestPreliminaryLog.driversReport || latestPreliminaryLog.preliminaryRemarks) && (
        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
          <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
            2. Latest Preliminary Inspection
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Issue to Fix / Driver&apos;s Report
              </label>
              <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                {latestPreliminaryLog.driversReport || "—"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-black mb-1">Preliminary Remarks</label>
              <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                {latestPreliminaryLog.preliminaryRemarks || "None"}
              </div>
            </div>
            {latestPreliminaryLog.preliminaryPhotoUrl && (
              <div className="sm:col-span-2 mt-2">
                <label className="block text-xs font-medium text-black mb-1">Attachment/s</label>
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                  <img
                    src={latestPreliminaryLog.preliminaryPhotoUrl}
                    alt="Preliminary Evidence"
                    onClick={() => setZoomedImage(latestPreliminaryLog.preliminaryPhotoUrl!)}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {progressUpdates.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
          <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex items-center justify-between">
            <span>3. Maintenance Progress Updates (Consolidated)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-black mb-1">Additional Issue/s</label>
              <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                {combinedIssuesList.length > 0 ? combinedIssuesList : "—"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-black mb-1">Progress Remark/s (Optional)</label>
              <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                {combinedRemarksList.length > 0 ? combinedRemarksList : "—"}
              </div>
            </div>
            {combinedPhotos.length > 0 && (
              <div className="sm:col-span-2 mt-2">
                <label className="block text-xs font-medium text-black mb-1">Attachment/s ({combinedPhotos.length})</label>
                <div className="flex flex-wrap gap-3">
                  {combinedPhotos.map((url, idx) => (
                    <div key={idx} className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
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

      {zoomedImage && <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />}
    </>
  );
}
