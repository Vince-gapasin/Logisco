"use client";

import React, { useCallback, useState } from "react";
import { Loader2, Wrench } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";

/**
 * Who worked on this truck, and what they found.
 *
 * The office could see that a truck was On Maintenance and not who had it or
 * what was wrong: the fleet status screen showed a plate, a type and a status,
 * and the repair record lived only in the mechanic's own module. So a
 * coordinator asked to say when a truck would be back had to go and ask a
 * mechanic, which is the question this answers.
 *
 * Nothing new is stored. The logs are the ones the mechanics already write, read
 * through the endpoint they already use - admin and coordinator are both in
 * FLEET_ROLES, so they could always have read this and simply had nowhere to see
 * it.
 *
 * Read-only on purpose. A repair record is the mechanic's account of their own
 * work, and the office reading it is a different thing from the office editing
 * it.
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
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(at);
}

export default function TruckMaintenanceHistory({
  truckID,
  title = "2. Maintenance History",
}: {
  truckID: string;
  title?: string;
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

  // Through usePolling rather than a bare effect, which is what BookingHistory
  // does and what the set-state-in-effect rule is asking for: the state lands in
  // a callback from outside React rather than in the body of an effect. It also
  // keeps the panel current, so a coordinator watching a grounded truck sees the
  // repair land instead of having to reopen it. Visibility-aware, so a tab
  // nobody is looking at asks for nothing.
  usePolling(() => void load(), 60_000);

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
      <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex items-center gap-2">
        <Wrench className="w-4 h-4 text-slate-500 shrink-0" />
        {title}
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse text-xs md:min-w-150">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
              <th className="p-2.5 border-r border-slate-200 w-[18%]">Date</th>
              <th className="p-2.5 border-r border-slate-200 w-[24%]">Worked on by</th>
              <th className="p-2.5 border-r border-slate-200 w-[36%]">What was wrong</th>
              <th className="p-2.5 w-[22%]">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {logs === null && !error ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-500 bg-slate-50">
                  <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-red-700 bg-red-50">
                  {error}
                </td>
              </tr>
            ) : (logs ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-500 italic bg-slate-50">
                  No repair has been logged against this truck.
                </td>
              </tr>
            ) : (
              (logs ?? []).map((log) => (
                <tr key={log.id} className="border-b border-slate-200 font-medium text-slate-700">
                  <td className="p-2 border-r border-slate-200 bg-slate-50 whitespace-nowrap">
                    {formatDate(log.date || log.createdAt)}
                  </td>
                  <td className="p-2 border-r border-slate-200 bg-slate-50">
                    <span className="font-semibold text-slate-900 wrap-break-word">
                      {log.mechanicName || "Unknown"}
                    </span>
                    {log.additionalMechanic && (
                      <span className="block text-slate-600 wrap-break-word">
                        with {log.additionalMechanic}
                      </span>
                    )}
                  </td>
                  <td className="p-2 border-r border-slate-200 bg-slate-50">
                    {/* The crew's report of the fault first, because that is what
                        started it; then what the mechanic concluded. */}
                    {log.driversReport && (
                      <span className="block text-slate-600 wrap-break-word">
                        Reported: {log.driversReport}
                      </span>
                    )}
                    <span className="block wrap-break-word">{log.issue || "Not stated"}</span>
                    {log.remarks && (
                      <span className="block text-slate-600 wrap-break-word">{log.remarks}</span>
                    )}
                  </td>
                  <td className="p-2 bg-slate-50 whitespace-nowrap">
                    {log.statusBefore && log.statusAfter ? (
                      <span className="wrap-break-word">
                        {log.statusBefore} → {log.statusAfter}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
