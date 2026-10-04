"use client";

import { useState } from "react";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";
import { shownTruckStatus } from "@/app/lib/truckBooking";
import TruckTripCard from "@/components/truck/TruckTripCard";
import {
  Truck,
  ArrowLeft,
  Edit3,
  RotateCcw,
  History as HistoryIcon,
  Wrench,
  Archive,
  MoreHorizontal,
} from "lucide-react";
import type { HistoryLogRecord, TruckRecord } from "./types";
import { formatDisplayDate } from "./dates";
import { ImageModal } from "./ImageModal";

// ==========================================
// TRUCK INFORMATION DETAIL VIEW
// ==========================================
interface TruckDetailViewProps {
  truck: TruckRecord;
  logs: HistoryLogRecord[];
  onBack: () => void;
  onEdit: (truckRecord: TruckRecord) => void;
  /** Opened from Archived Trucks: the only thing to do with it is restore it. */
  isArchived: boolean;
  onArchiveClick: () => void;
  onRestoreClick: () => void;
  onUpdateStatusClick: () => void;
  onHistoryClick: () => void;
  onLogMaintenanceClick: () => void;
  currentUserId: string;
}

export function TruckDetailView({
  truck,
  logs,
  onBack,
  onEdit,
  isArchived,
  onArchiveClick,
  onRestoreClick,
  onUpdateStatusClick,
  onHistoryClick,
  onLogMaintenanceClick,
  currentUserId,
}: TruckDetailViewProps) {
  const shownStatus = shownTruckStatus(truck.status, truck.booking);
  const styles = getStatusStyles(shownStatus);

  // --- NEW: Dropdown State ---
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Only true if the truck is actively broken down or being worked on
  const isUnderMaintenance = truck.status === "On Maintenance" || truck.status === "Out of Service";

  // True if the truck is out on a delivery.
  const isRestrictedStatus = truck.status === "On Delivery";

  // 1. Isolate logs for this truck (Ultra-aggressive match ensures IDs and Plates link)
  const sortedTruckLogs = logs.filter((l) => {
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

  // 2. Isolate the newest log that contains preliminary inspection data
  const prelimIndex = sortedTruckLogs.findIndex(
    (l) => l.driversReport || l.preliminaryRemarks || l.preliminaryPhotoUrl,
  );
  const latestPreliminaryLog =
    prelimIndex !== -1 ? sortedTruckLogs[prelimIndex] : null;

  // 3. Extract all logs belonging to the current maintenance cycle FIRST
  // sortedTruckLogs is Newest-First, meaning index 0 is the most recent update.
  const currentCycleLogs =
    prelimIndex !== -1
      ? sortedTruckLogs.slice(0, prelimIndex + 1)
      : sortedTruckLogs;

  // --- Strict Latest-Mechanic Access Control ---
  // A mechanic is ONLY unblocked if they are assigned on the MOST RECENT log of the active cycle.
  // If they are replaced or removed in a newer update, they lose access.
  //
  // Except when nobody is on it. A truck grounded by the office, or by a
  // breakdown on the road, opens its log with no mechanic - nobody has been
  // sent yet. That used to lock every mechanic out of the truck, including the
  // one who went to fix it. An open job is anyone's; whoever writes the next
  // log becomes the mechanic on it.
  const currentUserStr = String(currentUserId).trim();
  const activeCycleLog = currentCycleLogs[0];
  const isUnassignedJob = Boolean(activeCycleLog) && !activeCycleLog.primaryMechanicID;
  const hasMechanicAccess = activeCycleLog
    ? isUnassignedJob ||
      String(activeCycleLog.primaryMechanicID).trim() === currentUserStr ||
      String(activeCycleLog.additionalMechanicID).trim() === currentUserStr
    : true;

  // --- ADD THIS NEW VARIABLE ---
  // Evaluates to true ONLY if the mechanic is explicitly assigned to an active log (bypasses delivery restrictions for foul trips)
  const isExplicitlyAssigned = activeCycleLog ? (
    String(activeCycleLog.primaryMechanicID).trim() === currentUserStr || 
    String(activeCycleLog.additionalMechanicID).trim() === currentUserStr
  ) : false;

  const progressUpdates = currentCycleLogs
    .filter((l) => l.additionalIssue || l.progressRemarks || l.progressPhotoUrl)
    .sort((a, b) => {
      const timeA = new Date(a.created_at || a.date).getTime();
      const timeB = new Date(b.created_at || b.date).getTime();
      return timeB - timeA;
    });

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

  const combinedPhotos = progressUpdates
    .map((u) => u.progressPhotoUrl)
    .filter(Boolean);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        {/* LEFT SIDE: Back Button + Truck Identity */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* NEW: Subtle Vertical Divider */}
          <div className="hidden sm:block w-px h-8 bg-slate-200"></div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* NEW: Inline Truck Icon for context */}
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Truck className="w-5 h-5 text-slate-500" />
              {truck.plateNumber}
            </h2>

            <span className="px-2.5 py-0.5 rounded-full text-xs sm:text-[10px] font-medium bg-blue-100 text-blue-700">
              {truck.truckType}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs sm:text-[10px] font-medium ${styles.bgLight.split(" border")[0]}`}
            >
              {shownStatus}
            </span>
          </div>
        </div>

        {/* RIGHT SIDE: Action Buttons */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-end w-full md:w-auto gap-2 sm:gap-3">
          {/* The work buttons. Second on a phone, first on a desktop. */}
          <div className="order-2 md:order-1 flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            {isArchived && (
              <button
                onClick={onRestoreClick}
                className="flex-none md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-emerald-600 hover:bg-black text-white px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Restore Truck</span>
              </button>
            )}

            {/* Maintenance Update Form (Only visible to assigned mechanic when broken down) */}
            {!isArchived && isUnderMaintenance && hasMechanicAccess && (
              <button
                onClick={onLogMaintenanceClick}
                className="flex-none md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-amber-200 shadow-sm cursor-pointer"
              >
                <Wrench className="w-4 h-4 shrink-0" />
                <span>Maintenance Update Form</span>
              </button>
            )}

            {/* Hide top action buttons if the truck is being fixed by another mechanic OR is restricted (unless assigned to a foul trip) */}
            {!isArchived && (!isRestrictedStatus || isExplicitlyAssigned) && (!isUnderMaintenance || hasMechanicAccess) && (
              <button onClick={onUpdateStatusClick} className="flex-none md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-emerald-600 hover:bg-black text-white px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"><span>Update Status</span></button>
            )}
          </div>

          {/* Looking back at the truck. First on a phone, last on a desktop. */}
          <div className="order-1 md:order-2 flex items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* History Button (Always visible) */}
          <button
            onClick={onHistoryClick}
            className="flex-none md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-slate-200 shadow-sm cursor-pointer"
          >
            <HistoryIcon className="w-4 h-4 shrink-0" />
            <span>History</span>
          </button>

          {!isArchived && (!isUnderMaintenance || hasMechanicAccess) && (
            <div className="relative shrink-0">
              {/* More Actions Dropdown Menu */}
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-2.5 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 transition-colors shadow-xs cursor-pointer"
                title="More Actions"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {isMoreMenuOpen && (
                <>
                  {/* Invisible overlay to close dropdown when clicking outside */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsMoreMenuOpen(false)}
                  ></div>

                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden py-1 animate-fade-in">
                    {/* Edit Button inside Dropdown */}
                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onEdit(truck);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-4 h-4 text-slate-500" /> Edit Truck
                    </button>

                    {/* Archive: takes the truck out of the fleet, keeping its history.
                        Not while it is out on a delivery - the server refuses that too. */}
                    {!isRestrictedStatus ? (
                      <button
                        onClick={() => { setIsMoreMenuOpen(false); onArchiveClick(); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Archive className="w-4 h-4" /> Archive Truck
                      </button>
                    ) : (
                      <div
                        title="A truck on a delivery can be archived once it is back."
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-400 bg-slate-50 flex items-center gap-2 cursor-not-allowed"
                      >
                        <Archive className="w-4 h-4" /> Archive Truck
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">
        <div className="space-y-6 text-sm text-slate-900">
          {!isArchived && truck.booking && <TruckTripCard trip={truck.booking} showLink={false} />}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Truck Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Plate Number
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {truck.plateNumber || "—"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Truck
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {truck.truckType || "—"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Truck Model
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {truck.truckModel || "—"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Capacity
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {truck.capacity || "—"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Last Checked
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {formatDisplayDate(truck.lastChecked) || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Preliminary Inspection - Hides when not under maintenance */}
          {isUnderMaintenance &&
            latestPreliminaryLog &&
            (latestPreliminaryLog.driversReport ||
              latestPreliminaryLog.preliminaryRemarks) && (
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
                    <label className="block text-xs font-medium text-black mb-1">
                      Preliminary Remarks
                    </label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                      {latestPreliminaryLog.preliminaryRemarks || "None"}
                    </div>
                  </div>
                  {latestPreliminaryLog.preliminaryPhotoUrl && (
                    <div className="sm:col-span-2 mt-2">
                      <label className="block text-xs font-medium text-black mb-1">
                        Attachment/s
                      </label>
                      <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                        <img
                          src={latestPreliminaryLog.preliminaryPhotoUrl}
                          alt="Preliminary Evidence"
                          onClick={() =>
                            setZoomedImage(
                              latestPreliminaryLog.preliminaryPhotoUrl!,
                            )
                          }
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Section 3: Consolidated Maintenance Progress Updates - Hides when not under maintenance */}
          {isUnderMaintenance && progressUpdates.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex items-center justify-between">
                <span>3. Maintenance Progress Updates (Consolidated)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Additional Issue/s
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                    {combinedIssuesList.length > 0 ? combinedIssuesList : "—"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Progress Remark/s (Optional)
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                    {combinedRemarksList.length > 0
                      ? combinedRemarksList
                      : "N/A"}
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
        </div>
      </div>
      {zoomedImage && (
        <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />
      )}
    </div>
  );
}
