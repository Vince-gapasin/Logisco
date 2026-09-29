"use client";

import React, { useCallback, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";

/**
 * Every repair logged against one truck, as its own screen.
 *
 * The office could see that a truck was On Maintenance and not who had it or
 * what was wrong: the fleet status screen showed a plate, a type and a status,
 * and the repair record lived only in the mechanic's module. So a coordinator
 * asked when a truck would be back had to go and ask a mechanic.
 *
 * It was never a permissions problem. Admin and coordinator are both in
 * FLEET_ROLES, so they could always have read this endpoint and simply had
 * nowhere to see it. Nothing new is stored: these are the logs the mechanics
 * already write.
 *
 * Shaped like the mechanic's own history - back, the truck's name, one card, one
 * table, the statuses as coloured chips - because it is the same list and there
 * is no reason for the office to learn a second layout for it. Behind a History
 * button for the same reason.
 *
 * One column differs. The mechanic's shows Plate Number, which is the same value
 * on every row of a single truck's history; the office's question is who has it,
 * so that column names the mechanics instead.
 *
 * Read-only. A repair record is the mechanic's account of their own work, and
 * the office reading it is a different thing from the office editing it.
 */

interface MaintenanceLog {
  id: string;
  truckID: string;
  date: string;
  createdAt: string;
  statusBefore: string | null;
  statusAfter: string | null;
  mechanicName: string;
  additionalMechanic: string;
  issue: string | null;
  remarks: string | null;
  driversReport: string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(at);
}

export default function TruckMaintenanceHistory({
  truckID,
  plateNumber,
  onBack,
}: {
  truckID: string;
  plateNumber: string;
  onBack: () => void;
}) {
  const [logs, setLogs] = useState<MaintenanceLog[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<MaintenanceLog[] | { data?: MaintenanceLog[] }>(
        "/api/historyLogsM",
        { cache: "no-store" },
      );
      const all = Array.isArray(res) ? res : (res.data ?? []);
      // Filtered here because the endpoint answers for the whole fleet, which is
      // what the mechanic's own screen wants. Thirty-six trucks is not a reason
      // to add a second endpoint.
      setLogs(all.filter((log) => String(log.truckID) === String(truckID)));
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load the repair history.");
    }
  }, [truckID]);

  // Polled rather than loaded once, so a coordinator watching a grounded truck
  // sees the repair land instead of reopening the screen. Visibility-aware, so a
  // tab nobody is looking at asks for nothing.
  usePolling(() => void load(), 60_000);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative animate-fade-in">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 wrap-break-word">
          History Logs — {plateNumber}
        </h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="md:overflow-x-auto px-4 pt-4 md:px-6 md:pt-0">
          <table className="w-full max-w-5xl mx-auto text-left border-collapse md:table-fixed my-2 block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-1/4 text-left">Date</th>
                <th className="py-3.5 px-4 w-1/4 text-left">Worked on by</th>
                <th className="hidden md:table-cell py-3.5 px-4 w-1/4 text-left">
                  Status Before Change
                </th>
                <th className="py-3.5 px-4 w-1/4 text-right">Current Status</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group text-sm text-slate-700">
              {logs === null && !error ? (
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
              ) : (logs ?? []).length === 0 ? (
                <tr className="block md:table-row">
                  <td colSpan={4} className="block md:table-cell py-16 sm:py-20 text-center">
                    <div className="text-slate-500">No logs found for this truck.</div>
                  </td>
                </tr>
              ) : (
                (logs ?? []).map((log) => {
                  const stylesBefore = getStatusStyles(log.statusBefore || "");
                  const stylesAfter = getStatusStyles(log.statusAfter || "");
                  return (
                    <tr
                      key={log.id}
                      className="block md:table-row bg-white border border-slate-200 rounded-xl mb-4 p-3 md:border-0 md:border-b md:border-slate-100 md:rounded-none md:mb-0 md:p-0"
                    >
                      <td className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:px-4 md:w-1/4 text-left align-middle font-medium text-slate-800">
                        <span className="md:hidden text-xs font-semibold text-slate-500">Date</span>
                        <span className="wrap-break-word">{formatDate(log.date || log.createdAt)}</span>
                      </td>

                      <td className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-start py-1.5 md:py-4 px-0 md:px-4 md:w-1/4 text-left align-middle">
                        <span className="md:hidden text-xs font-semibold text-slate-500">
                          Worked on by
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-900 wrap-break-word">
                            {log.mechanicName || "Not yet assigned"}
                          </span>
                          {log.additionalMechanic && (
                            <span className="block text-xs text-slate-500 wrap-break-word">
                              with {log.additionalMechanic}
                            </span>
                          )}
                          {/* What started it, which is the office's other question. */}
                          {(log.driversReport || log.issue) && (
                            <span className="block text-xs text-slate-500 mt-0.5 wrap-break-word">
                              {log.issue || log.driversReport}
                            </span>
                          )}
                        </span>
                      </td>

                      <td className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:px-4 md:w-1/4 text-left align-middle">
                        <span className="md:hidden text-xs font-semibold text-slate-500">
                          Status Before
                        </span>
                        {log.statusBefore && log.statusBefore !== "Unknown" ? (
                          <div
                            className={`inline-flex w-max items-center justify-center px-2.5 py-1 rounded-md text-xs font-semibold border ${stylesBefore.bgLight}`}
                          >
                            {log.statusBefore}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>

                      <td className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-1.5 md:py-4 px-0 md:px-4 md:w-1/4 text-left md:text-right align-middle">
                        <span className="md:hidden text-xs font-semibold text-slate-500">
                          Current Status
                        </span>
                        {log.statusAfter && log.statusAfter !== "Unknown" ? (
                          <div
                            className={`inline-flex w-max items-center justify-center px-2.5 py-1 rounded-md text-xs font-semibold border ${stylesAfter.bgLight}`}
                          >
                            {log.statusAfter}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
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
