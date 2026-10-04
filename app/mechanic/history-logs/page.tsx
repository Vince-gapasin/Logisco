// ==========================================
// LOGISCO - MECHANIC HISTORY LOGS PAGE
// ==========================================
// Three levels, from the general to the particular:
//
//   1. General history - every truck, with its details and the latest thing
//      logged against it. The question it answers is "what is the state of the
//      fleet's repairs", one line a truck.
//   2. A truck - its information and its latest update in full, with a
//      History button.
//   3. That truck's history - every maintenance log, each opening the record
//      it belongs to.
//
// This page used to be a flat list of every log in the fleet, newest first,
// which mixed every truck's repairs together and answered neither question.
// Levels 2 and 3 are the same views the fleet screen uses, so a truck's repair
// record reads the same whichever way it was reached.
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { EmployeeRow, TruckRow } from "@/types/database";
import RowOpenButton from "@/components/RowOpenButton";
import UrlSearchSync from "@/components/UrlSearchSync";
import { authFetch } from "@/app/lib/apiClient";
import { useToast } from "@/components/Toast";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";
import {
  ArrowLeft,
  ClipboardCheck,
  FileText,
  History as HistoryIcon,
  Loader2,
  Search,
  Truck,
  User,
  Wrench,
} from "lucide-react";
import type { EmployeeOption, HistoryLogRecord, TruckRecord } from "../fleet-status/_components/types";
import { formatDisplayDate } from "../fleet-status/_components/dates";
import { TruckSpecificHistoryView } from "../fleet-status/_components/TruckSpecificHistoryView";
import { LogDetailView } from "../fleet-status/_components/LogDetailView";
import { LogMaintenanceModal } from "../fleet-status/_components/LogMaintenanceModal";
import { ImageModal } from "../fleet-status/_components/ImageModal";
import { useLogPhotos } from "../fleet-status/_components/useLogPhotos";

const ITEMS_PER_PAGE = 10;

/** A truck as this page shows it: its record, and whether it was archived. */
interface HistoryTruck extends TruckRecord {
  archived: boolean;
}

function toTruck(row: Partial<TruckRow>, archived: boolean): HistoryTruck {
  return {
    id: row.truckID ?? "",
    truckCode: row.truckCode ?? undefined,
    plateNumber: row.plateNumber ?? "",
    truckType: row.truckType ?? "",
    truckModel: row.model ?? "",
    capacity: row.capacity === null || row.capacity === undefined ? "" : String(row.capacity),
    lastChecked: row.lastChecked ?? "",
    status: row.truckStatus || "Available",
    archived,
  };
}

const logTime = (log: HistoryLogRecord) => {
  const t = new Date(log.created_at || log.date).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** What kind of entry a log is, by the phase it records. */
function phaseOf(log: HistoryLogRecord): { label: string; text: string; remarks: string; photo?: string } {
  if (log.issue || log.remarks || log.photoUrl || log.hasFinalPhoto) {
    return { label: "Final maintenance log", text: log.issue, remarks: log.remarks, photo: log.photoUrl };
  }
  if (log.additionalIssue || log.progressRemarks || log.progressPhotoUrl || log.hasProgressPhoto) {
    return {
      label: "Maintenance update",
      text: log.additionalIssue ?? "",
      remarks: log.progressRemarks ?? "",
      photo: log.progressPhotoUrl,
    };
  }
  return {
    label: "Preliminary inspection",
    text: log.driversReport ?? "",
    remarks: log.preliminaryRemarks ?? "",
    photo: log.preliminaryPhotoUrl,
  };
}

const mechanicsOf = (log: HistoryLogRecord) =>
  log.primaryMechanicID
    ? [log.mechanicName, log.additionalMechanic].filter(Boolean).join(" & ")
    : "Unassigned - awaiting a mechanic";

function readSessionUser(): { employeeID: string; employeeName: string } {
  try {
    const raw = localStorage.getItem("logisco_user_session") || sessionStorage.getItem("logisco_user_session");
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      employeeID: String(parsed?.id || parsed?.employeeID || ""),
      employeeName: parsed?.employeeName || parsed?.name || "Mechanic",
    };
  } catch {
    return { employeeID: "", employeeName: "Mechanic" };
  }
}

export default function MechanicHistoryLogsPage() {
  const showToast = useToast();

  const [trucks, setTrucks] = useState<HistoryTruck[]>([]);
  const [logs, setLogs] = useState<HistoryLogRecord[]>([]);
  const [mechanics, setMechanics] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currentUser, setCurrentUser] = useState({ employeeID: "", employeeName: "Mechanic" });

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Where the mechanic is: a truck, its full history, one record.
  const [selectedTruckID, setSelectedTruckID] = useState<string | null>(null);
  const [showTruckHistory, setShowTruckHistory] = useState(false);
  const [selectedLogID, setSelectedLogID] = useState<string | null>(null);

  const [editingLog, setEditingLog] = useState<HistoryLogRecord | null>(null);
  const [formType, setFormType] = useState<"inspection" | "update" | "log">("log");
  const [isSaving, setIsSaving] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    // Read from browser storage, which only exists once mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentUser(readSessionUser());
  }, []);

  const loadLogs = useCallback(async () => {
    const response = await authFetch(`/api/historyLogsM?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const raw = (Array.isArray(result?.data) ? result.data : []) as (HistoryLogRecord & { createdAt?: string })[];
    // The service sends createdAt; the shared views read created_at.
    const mapped = raw.map((log) => ({ ...log, created_at: log.created_at ?? log.createdAt }));
    setLogs(mapped.sort((a, b) => logTime(b) - logTime(a)));
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [active, archived, mechanicRes] = await Promise.all([
        authFetch(`/api/fleet-status`),
        authFetch(`/api/fleet-status?archived=true`),
        authFetch(`/api/employees?role=Mechanic&isActive=true&limit=100`),
      ]);
      const activeRows = active.ok ? ((await active.json()).data ?? []) : [];
      const archivedRows = archived.ok ? ((await archived.json()).data ?? []) : [];
      setTrucks([
        ...(activeRows as Partial<TruckRow>[]).map((row) => toTruck(row, false)),
        ...(archivedRows as Partial<TruckRow>[]).map((row) => toTruck(row, true)),
      ]);
      if (mechanicRes.ok) {
        const employees = ((await mechanicRes.json()).data ?? []) as Partial<EmployeeRow>[];
        setMechanics(
          employees.map((emp) => ({
            employeeID: emp.employeeID ?? "",
            employeeName: emp.employeeName ?? "",
            role: emp.role ?? "",
          })),
        );
      }
      await loadLogs();
      setLoadError("");
    } catch (error) {
      console.error("Error loading history:", error);
      setLoadError("Could not load the maintenance history. Check your connection and reload.");
    } finally {
      setIsLoading(false);
    }
  }, [loadLogs]);

  useEffect(() => {
    // Everything here is set from a response, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, [loadAll]);

  const { logs: logsWithPhotos, seed: seedLogPhotos } = useLogPhotos(logs, selectedTruckID);

  // Each truck's logs, newest first, and the one most recently written.
  const logsByTruck = useMemo(() => {
    const map = new Map<string, HistoryLogRecord[]>();
    for (const log of logsWithPhotos) {
      const key = String(log.truckID ?? "");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return map;
  }, [logsWithPhotos]);

  // The general history: every truck that is in the fleet, plus any archived
  // one that still has repairs on record, the most recently worked on first.
  const rows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return trucks
      .filter((truck) => !truck.archived || (logsByTruck.get(String(truck.id))?.length ?? 0) > 0)
      .map((truck) => {
        const truckLogs = logsByTruck.get(String(truck.id)) ?? [];
        return { truck, latest: truckLogs[0] ?? null, count: truckLogs.length };
      })
      .filter(({ truck, latest }) =>
        !term ||
        truck.plateNumber.toLowerCase().includes(term) ||
        truck.truckType.toLowerCase().includes(term) ||
        (latest ? mechanicsOf(latest).toLowerCase().includes(term) : false),
      )
      .sort((a, b) => (b.latest ? logTime(b.latest) : 0) - (a.latest ? logTime(a.latest) : 0));
  }, [trucks, logsByTruck, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const pageRows = rows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const selectedTruck = trucks.find((truck) => String(truck.id) === selectedTruckID) ?? null;
  const truckLogs = selectedTruckID ? (logsByTruck.get(selectedTruckID) ?? []) : [];
  const selectedLog = logsWithPhotos.find((log) => String(log.id) === selectedLogID) ?? null;

  const openEdit = (log: HistoryLogRecord) => {
    setEditingLog(log);
    // The form for the phase this record is, as the fleet screen decides it.
    setFormType(
      log.driversReport || log.preliminaryRemarks
        ? "inspection"
        : log.additionalIssue || log.progressRemarks
          ? "update"
          : "log",
    );
  };

  const failure = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    return body?.message || fallback;
  };

  const handleSave = async (formData: Record<string, string>) => {
    if (!editingLog || isSaving) return;
    setIsSaving(true);
    try {
      const response = await authFetch(`/api/historyLogsM/${editingLog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          statusBefore: editingLog.statusBefore,
          statusAfter: editingLog.statusAfter,
        }),
      });
      if (!response.ok) {
        showToast(await failure(response, "Failed to save the log."), "error");
        return;
      }
      seedLogPhotos(editingLog.id, {
        preliminary: formData.preliminaryPhotoUrl,
        progress: formData.progressPhotoUrl,
        final: formData.photoUrl,
      });
      await loadLogs();
      setEditingLog(null);
      showToast("Changes saved successfully.", "success");
    } catch (error) {
      console.error("Error saving log:", error);
      showToast("Error saving the log.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      const response = await authFetch(`/api/historyLogsM/${id}`, { method: "DELETE" });
      if (!response.ok) {
        showToast(await failure(response, "Failed to delete the log."), "error");
        return;
      }
      setSelectedLogID(null);
      await loadLogs();
      showToast("Deleted successfully.", "success");
    } catch (error) {
      console.error("Error deleting log:", error);
      showToast("Error deleting the log.", "error");
    }
  };

  const editModal = (
    <LogMaintenanceModal
      isOpen={Boolean(editingLog)}
      onClose={() => setEditingLog(null)}
      onSubmitSuccess={handleSave}
      editData={editingLog ? (logsWithPhotos.find((log) => log.id === editingLog.id) ?? editingLog) : null}
      trucksOptions={trucks.map((truck) => ({ truckID: truck.id, plateNumber: truck.plateNumber, truckType: truck.truckType }))}
      mechanicsOptions={mechanics}
      preselectedTruckId={editingLog?.truckID ?? null}
      formType={formType}
      loggedInMechanic={currentUser}
      isSaving={isSaving}
    />
  );

  // ------------------------------------------------ level 3b: one record
  if (selectedLog) {
    return (
      <>
        <LogDetailView
          log={selectedLog}
          truckLogs={logsWithPhotos.filter((log) => String(log.truckID) === String(selectedLog.truckID))}
          onBack={() => setSelectedLogID(null)}
          onEdit={openEdit}
          onDelete={handleDelete}
          currentUserId={currentUser.employeeID}
        />
        {editModal}
      </>
    );
  }

  // ------------------------------------------ level 3: a truck's history
  if (selectedTruck && showTruckHistory) {
    return (
      <>
        <TruckSpecificHistoryView
          truck={selectedTruck}
          logs={logsWithPhotos}
          onBack={() => setShowTruckHistory(false)}
          onSelectLog={(log) => setSelectedLogID(String(log.id))}
          onEditLog={openEdit}
          onDeleteLog={handleDelete}
        />
        {editModal}
      </>
    );
  }

  // ------------------------------------- level 2: a truck and its latest
  if (selectedTruck) {
    const latest = truckLogs[0] ?? null;
    const phase = latest ? phaseOf(latest) : null;
    const styles = getStatusStyles(selectedTruck.status);

    return (
      <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => setSelectedTruckID(null)}
              className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-xs cursor-pointer shrink-0"
              aria-label="Back to all trucks"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-slate-500" />
                {selectedTruck.plateNumber}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {selectedTruck.truckType}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles.bgLight.split(" border")[0]}`}>
                {selectedTruck.archived ? "Archived" : selectedTruck.status}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* The record the latest update belongs to, in full. */}
            {latest && (
              <button
                onClick={() => setSelectedLogID(String(latest.id))}
                className="flex-none sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-slate-200 shadow-sm cursor-pointer"
              >
                <FileText className="w-4 h-4 shrink-0" />
                {/* Short on a phone, so it sits beside History on one line. */}
                <span className="sm:hidden">Full record</span>
                <span className="hidden sm:inline">Open the full maintenance record</span>
              </button>
            )}

            {/* The way into every maintenance record this truck has. */}
            <button
              onClick={() => setShowTruckHistory(true)}
              className="flex-none sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-slate-200 shadow-sm cursor-pointer"
            >
              <HistoryIcon className="w-4 h-4 shrink-0" />
              History ({truckLogs.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Truck information */}
          <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-xs p-5">
            <h2 className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              Truck Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                ["Plate Number", selectedTruck.plateNumber],
                ["Type of Truck", selectedTruck.truckType],
                ["Truck Model", selectedTruck.truckModel],
                ["Capacity", selectedTruck.capacity ? `${selectedTruck.capacity} kg` : ""],
                ["Last Checked", selectedTruck.lastChecked ? formatDisplayDate(selectedTruck.lastChecked) : ""],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <label className="block text-xs font-medium text-black mb-1">{label}</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 break-words">
                    {value || "—"}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* The latest update, in full */}
          <section className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-xs p-5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-4">
              <h2 className="font-semibold text-black text-sm tracking-wide">Latest Update</h2>
              {latest && (
                <span className="text-xs text-slate-500">{formatDisplayDate(latest.date)}</span>
              )}
            </div>

            {latest && phase ? (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">
                    <Wrench className="w-3.5 h-3.5" /> {phase.label}
                  </span>
                  {latest.statusBefore && latest.statusAfter && latest.statusBefore !== latest.statusAfter && (
                    <span className="text-xs text-slate-600">
                      {latest.statusBefore} → <strong>{latest.statusAfter}</strong>
                    </span>
                  )}
                </div>

                <p className="flex items-center gap-2 text-slate-700">
                  <User className="w-4 h-4 text-slate-500 shrink-0" />
                  {mechanicsOf(latest)}
                </p>

                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    {phase.label === "Final maintenance log"
                      ? "Work Performed"
                      : phase.label === "Maintenance update"
                        ? "Additional Issue"
                        : "Issue to Fix / Driver's Report"}
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                    {phase.text || "—"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Remarks</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-10 whitespace-pre-wrap">
                    {phase.remarks || "None"}
                  </div>
                </div>
                {phase.photo && (
                  <button
                    type="button"
                    onClick={() => setZoomedImage(phase.photo ?? null)}
                    className="block w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs cursor-pointer"
                    aria-label="View the photo"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={phase.photo} alt="Latest update" className="w-full h-full object-cover" />
                  </button>
                )}

              </div>
            ) : (
              <p className="text-sm text-slate-500">No maintenance has been logged for this truck yet.</p>
            )}
          </section>
        </div>

        {zoomedImage && <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />}
        {editModal}
      </div>
    );
  }

  // --------------------------------------------- level 1: general history
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">History Logs</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Maintenance Records</h2>
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <UrlSearchSync onQuery={(query) => { setSearchTerm(query); setCurrentPage(1); }} />
            <input
              type="text"
              placeholder="Search plate, type, mechanic..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        {loadError && <p className="mx-5 mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{loadError}</p>}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Loading maintenance history...
          </div>
        ) : pageRows.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-800">No trucks found</p>
          </div>
        ) : (
          <div className="overflow-x-auto px-4 sm:px-6">
            <table className="w-full max-w-5xl mx-auto text-left border-collapse md:table-fixed my-2">
              <thead className="hidden md:table-header-group">
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-[30%] text-left">Plate Number</th>
                  <th className="py-3.5 px-4 text-left">Latest Update</th>
                  <th className="py-3.5 px-4 w-40 text-right">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {pageRows.map(({ truck, latest, count }) => {
                  const styles = getStatusStyles(truck.status);
                  const phase = latest ? phaseOf(latest) : null;
                  return (
                    <tr
                      key={truck.id}
                      data-pressable
                      onClick={() => setSelectedTruckID(String(truck.id))}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors flex flex-col gap-2 py-4 md:table-row md:py-0"
                    >
                      <td className="md:py-4 md:px-4 align-middle min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          <RowOpenButton
                            label={`Open ${truck.plateNumber}`}
                            onOpen={() => setSelectedTruckID(String(truck.id))}
                            className="max-w-full truncate"
                          >
                            {truck.plateNumber}
                          </RowOpenButton>
                          <span className="text-xs text-slate-500 font-normal ml-1 sm:ml-2">— {truck.truckType}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {count} {count === 1 ? "record" : "records"}
                          {truck.lastChecked ? ` · Last checked ${formatDisplayDate(truck.lastChecked)}` : ""}
                        </div>
                      </td>
                      <td className="md:py-4 md:px-4 align-middle min-w-0 text-xs text-slate-600">
                        {latest && phase ? (
                          <>
                            <div className="font-medium text-slate-800">
                              {phase.label} · {formatDisplayDate(latest.date)}
                            </div>
                            <div className="mt-0.5 truncate">{phase.text || "No details written"}</div>
                            <div className="text-slate-500 truncate">{mechanicsOf(latest)}</div>
                          </>
                        ) : (
                          <span className="text-slate-500">No maintenance logged yet</span>
                        )}
                      </td>
                      <td className="md:py-4 md:px-4 align-middle md:text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${styles.bgLight}`}>
                          {truck.archived ? "Archived" : truck.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700">
          <span>
            Showing {rows.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, rows.length)} of {rows.length} trucks
          </span>
          {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              disabled={currentPage === 1}
              className="min-h-tap md:min-h-0 px-4 py-1.5 border border-slate-200 rounded-lg font-medium disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed bg-white hover:bg-slate-50 cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="min-h-tap md:min-h-0 px-4 py-1.5 border border-slate-200 rounded-lg font-medium disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed bg-white hover:bg-slate-50 cursor-pointer"
            >
              Next
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
