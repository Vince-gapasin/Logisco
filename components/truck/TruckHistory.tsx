"use client";

import React, { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ClipboardCheck, FilePen, Loader2, Wrench } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";
import { formatDateTime } from "@/app/lib/datetime";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";
import type { TruckChange } from "@/services/truck/truckService";
import type { HistoryLogRecord } from "@/app/mechanic/fleet-status/_components/types";
import { LogDetailView } from "@/app/mechanic/fleet-status/_components/LogDetailView";
import { useLogPhotos } from "@/app/mechanic/fleet-status/_components/useLogPhotos";

/**
 * Everything that has happened to one truck, in order, behind the History button.
 *
 * Two kinds of update land on a truck, and both are listed here as one sequence,
 * newest first:
 *
 * - Maintenance updates: the logs mechanics write (and the one opened for them
 *   when the office grounds a truck). Opening one shows the whole maintenance
 *   record it belongs to - inspection, every progress update, the final log -
 *   the same record the mechanic sees, read-only.
 * - Record changes: someone added, edited, archived or restored the truck, or
 *   changed its status. Opening one shows who did it, when, and each field
 *   before and after.
 *
 * The record changes used to sit at the foot of the truck's page. They are
 * history like the repairs are, so they live here with them: the truck's page
 * says what the truck is now, this screen says how it got there.
 */

type Entry =
  | { kind: "maintenance"; id: string; at: string; log: HistoryLogRecord }
  | { kind: "change"; id: string; at: string; change: TruckChange };

/** Which step of a repair one log is, from what was written on it. */
function maintenanceStep(log: HistoryLogRecord): string {
  if (log.issue || log.remarks || log.hasFinalPhoto) return "Final maintenance log";
  if (log.additionalIssue || log.progressRemarks || log.hasProgressPhoto) return "Maintenance update";
  if (log.driversReport || log.preliminaryRemarks || log.hasPreliminaryPhoto) {
    return log.primaryMechanicID ? "Preliminary inspection" : "Sent for maintenance";
  }
  return "Status update";
}

function maintenanceNote(log: HistoryLogRecord): string {
  return log.issue || log.additionalIssue || log.driversReport || "";
}

/** "Edited", "Disabled" and so on, said as what happened to the record. */
function changeTitle(change: TruckChange): string {
  const fields = change.changes.map((item) => item.field);
  if (change.action === "Added") return "Added to the fleet";
  if (change.action === "Disabled") return "Disabled";
  if (change.action === "Restored") return "Restored to the fleet";
  if (fields.length === 1 && fields[0] === "Status") return "Status changed";
  if (fields.length === 0) return "Record edited";
  return `Record edited: ${fields.filter((field) => field !== "Status").join(", ") || "Status"}`;
}

function StatusChip({ status }: { status: string | null | undefined }) {
  if (!status || status === "Unknown") return <span className="text-xs text-slate-500">—</span>;
  return (
    <div
      className={`inline-flex w-max items-center justify-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getStatusStyles(status).bgLight}`}
    >
      {status}
    </div>
  );
}

/** One record change, opened from the list. */
function RecordChangeView({
  change,
  plateNumber,
  onBack,
}: {
  change: TruckChange;
  plateNumber: string;
  onBack: () => void;
}) {
  const showBefore = change.action === "Edited";

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Record Change</h1>
          <p className="text-sm text-slate-600 mt-0.5">A change made to this truck&apos;s record.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6 text-sm text-slate-900">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shrink-0">
            <FilePen className="w-8 h-8" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 wrap-break-word">{plateNumber}</h2>
            <p className="text-slate-600 text-sm mt-1 wrap-break-word">{changeTitle(change)}</p>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
          <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
            1. Change Details
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              ["Change", change.action],
              ["Date and time", formatDateTime(change.at)],
              ["Done by", `${change.byName}${change.byRole ? ` (${change.byRole})` : ""}`],
            ].map(([label, value]) => (
              <div key={label}>
                <label className="block text-xs font-medium text-black mb-1">{label}</label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 wrap-break-word">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
          <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
            2. What Changed
          </div>
          {change.changes.length === 0 ? (
            <p className="text-xs text-slate-500">No field values were recorded with this change.</p>
          ) : (
            <div className="space-y-3">
              {showBefore && (
                <p className="hidden sm:grid grid-cols-3 gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <span>Field</span>
                  <span>Before</span>
                  <span>After</span>
                </p>
              )}
              {change.changes.map((item) => (
                <div key={item.field} className={`grid grid-cols-1 gap-2 ${showBefore ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                  <div className="text-xs font-medium text-black sm:py-2">{item.field}</div>
                  {showBefore && (
                    <div>
                      <span className="sm:hidden block text-[11px] text-slate-500 mb-0.5">Before</span>
                      <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-500 wrap-break-word">
                        {item.from ?? "—"}
                      </div>
                    </div>
                  )}
                  <div>
                    {showBefore && <span className="sm:hidden block text-[11px] text-slate-500 mb-0.5">After</span>}
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 font-medium wrap-break-word">
                      {item.to ?? "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {change.reason && (
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              3. Reason Given
            </div>
            <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 whitespace-pre-wrap">
              {change.reason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TruckHistory({
  truckID,
  plateNumber,
  onBack,
}: {
  truckID: string;
  plateNumber: string;
  onBack: () => void;
}) {
  const [logs, setLogs] = useState<HistoryLogRecord[] | null>(null);
  const [changes, setChanges] = useState<TruckChange[] | null>(null);
  const [error, setError] = useState("");
  // Kept as an id, so a record that is open picks up updates as the list reloads.
  const [openID, setOpenID] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [logRes, changeRes] = await Promise.all([
        apiFetch<HistoryLogRecord[] | { data?: (HistoryLogRecord & { createdAt?: string })[] }>("/api/historyLogsM", {
          cache: "no-store",
        }),
        apiFetch<{ data: TruckChange[] }>(`/api/fleet-status/${truckID}/changes`, { cache: "no-store" }),
      ]);
      const all = (Array.isArray(logRes) ? logRes : (logRes.data ?? [])) as (HistoryLogRecord & { createdAt?: string })[];
      // The endpoint answers for the whole fleet, which is what the mechanic's
      // screen wants; this truck's are picked out here. It names the timestamp
      // createdAt, and the record view reads created_at.
      setLogs(
        all
          .filter((log) => String(log.truckID) === String(truckID))
          .map((log) => ({ ...log, created_at: log.created_at ?? log.createdAt })),
      );
      setChanges(changeRes.data ?? []);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load the truck's history.");
    }
  }, [truckID]);

  // Polled, so someone watching a grounded truck sees the repair land without
  // reopening the screen. Visibility-aware: a hidden tab asks for nothing.
  usePolling(() => void load(), 60_000);

  // Photos are not in the log list; they are fetched for this truck's logs.
  const { logs: logsWithPhotos } = useLogPhotos(logs ?? [], truckID);

  const entries = useMemo<Entry[]>(() => {
    const time = (value: string | undefined) => {
      const t = new Date(value ?? "").getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    const list: Entry[] = [
      ...logsWithPhotos.map((log) => ({
        kind: "maintenance" as const,
        id: `log-${log.id}`,
        at: log.created_at || log.date,
        log,
      })),
      ...(changes ?? []).map((change) => ({ kind: "change" as const, id: `change-${change.id}`, at: change.at, change })),
    ];
    return list.sort((a, b) => time(b.at) - time(a.at));
  }, [logsWithPhotos, changes]);

  const opened = openID ? entries.find((entry) => entry.id === openID) : undefined;

  if (opened?.kind === "maintenance") {
    // This truck's logs, newest first - the order the record view expects when
    // it walks back and forward from the one opened to find its whole repair.
    const truckLogs = entries
      .filter((entry): entry is Extract<Entry, { kind: "maintenance" }> => entry.kind === "maintenance")
      .map((entry) => entry.log);
    return (
      <LogDetailView
        log={opened.log}
        truckLogs={truckLogs}
        onBack={() => setOpenID(null)}
        onEdit={() => undefined}
        onDelete={() => undefined}
        currentUserId=""
        readOnly
      />
    );
  }

  if (opened?.kind === "change") {
    return <RecordChangeView change={opened.change} plateNumber={plateNumber} onBack={() => setOpenID(null)} />;
  }

  const loading = (logs === null || changes === null) && !error;

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative animate-fade-in">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 wrap-break-word">History Logs — {plateNumber}</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Every update to this truck, newest first. Open one to see its full record.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="md:overflow-x-auto px-4 pt-4 md:px-6 md:pt-0">
          <table className="w-full max-w-5xl mx-auto text-left border-collapse md:table-fixed my-2 block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-1/5 text-left">Date</th>
                <th className="py-3.5 px-4 w-2/5 text-left">Update</th>
                <th className="py-3.5 px-4 w-1/5 text-left">Status Before</th>
                <th className="py-3.5 px-4 w-1/5 text-right">Status After</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group text-sm text-slate-700">
              {loading ? (
                <tr className="block md:table-row">
                  <td colSpan={4} className="block md:table-cell py-16 sm:py-20 text-center text-slate-500">
                    <Loader2 className="inline h-5 w-5 animate-spin" /> Loading…
                  </td>
                </tr>
              ) : error ? (
                <tr className="block md:table-row">
                  <td colSpan={4} className="block md:table-cell py-16 text-center text-red-700">
                    {error}
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr className="block md:table-row">
                  <td colSpan={4} className="block md:table-cell py-16 sm:py-20 text-center">
                    <div className="text-slate-500">Nothing has been recorded for this truck yet.</div>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isLog = entry.kind === "maintenance";
                  const status = isLog
                    ? { before: entry.log.statusBefore, after: entry.log.statusAfter }
                    : (() => {
                        const item = entry.change.changes.find((c) => c.field === "Status");
                        return { before: entry.change.action === "Edited" ? item?.from : null, after: item?.to };
                      })();
                  const title = isLog ? maintenanceStep(entry.log) : changeTitle(entry.change);
                  const by = isLog
                    ? entry.log.mechanicName
                      ? `by ${entry.log.mechanicName}`
                      : "Awaiting a mechanic"
                    : `by ${entry.change.byName}${entry.change.byRole ? ` (${entry.change.byRole})` : ""}`;
                  const note = isLog ? maintenanceNote(entry.log) : (entry.change.reason ?? "");

                  return (
                    <tr
                      key={entry.id}
                      data-pressable
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ${title} from ${formatDateTime(entry.at)}`}
                      onClick={() => setOpenID(entry.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOpenID(entry.id);
                        }
                      }}
                      className="block md:table-row bg-white border border-slate-200 rounded-xl mb-4 p-3 md:border-0 md:border-b md:border-slate-100 md:rounded-none md:mb-0 md:p-0 cursor-pointer hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:px-4 text-left align-middle font-medium text-slate-800">
                        <span className="md:hidden text-xs font-semibold text-slate-500">Date</span>
                        <span className="wrap-break-word text-xs sm:text-sm">{formatDateTime(entry.at)}</span>
                      </td>

                      <td className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-start py-1.5 md:py-4 px-0 md:px-4 text-left align-middle">
                        <span className="md:hidden text-xs font-semibold text-slate-500">Update</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-bold text-slate-900 wrap-break-word">
                            {isLog ? (
                              <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            ) : (
                              <ClipboardCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                            {title}
                          </span>
                          <span className="block text-xs text-slate-500 wrap-break-word">{by}</span>
                          {note && (
                            <span className="block text-xs text-slate-500 mt-0.5 wrap-break-word line-clamp-2">{note}</span>
                          )}
                        </span>
                      </td>

                      <td className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:px-4 text-left align-middle">
                        <span className="md:hidden text-xs font-semibold text-slate-500">Status Before</span>
                        <StatusChip status={status.before} />
                      </td>

                      <td className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:px-4 text-left md:text-right align-middle">
                        <span className="md:hidden text-xs font-semibold text-slate-500">Status After</span>
                        <StatusChip status={status.after} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
