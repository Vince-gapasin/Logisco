"use client";

import React, { useCallback, useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { formatDateTime } from "@/app/lib/datetime";
import type { TruckChange } from "@/services/truck/truckService";

// Who changed this truck's record, what they changed and when.
//
// Admins, coordinators and mechanics can all add, edit, archive and restore
// trucks. Each change was recorded with the person who made it, and none of
// it was on screen - so "who changed this plate?" had no answer anyone could
// look up. This is that answer, newest first.

export default function TruckChangeHistory({ truckID, refreshKey }: { truckID: string; refreshKey?: unknown }) {
  const [changes, setChanges] = useState<TruckChange[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: TruckChange[] }>(`/api/fleet-status/${truckID}/changes`, { cache: "no-store" });
      setChanges(res.data ?? []);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load the changes.");
    }
  }, [truckID]);

  useEffect(() => {
    // The rows land in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
      <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex items-center gap-2">
        <History className="w-4 h-4 text-slate-500" />
        Record changes
      </div>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : changes === null ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
        </p>
      ) : changes.length === 0 ? (
        <p className="text-xs text-slate-500">No changes recorded for this truck yet.</p>
      ) : (
        <ol className="space-y-3">
          {changes.map((change) => (
            <li key={change.id} className="text-xs text-slate-700 border-l-2 border-slate-200 pl-3">
              <p className="font-semibold text-slate-900">
                {change.action}
                <span className="font-normal text-slate-600">
                  {" "}
                  by {change.byName}
                  {change.byRole ? ` (${change.byRole})` : ""}
                </span>
              </p>
              <p className="text-slate-500">{formatDateTime(change.at)}</p>
              {change.changes.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {change.changes.map((item) => (
                    <li key={item.field}>
                      <span className="font-medium">{item.field}:</span>{" "}
                      {item.from !== null && change.action === "Edited" ? (
                        <>
                          {item.from} <span className="text-slate-400">→</span> {item.to ?? "—"}
                        </>
                      ) : (
                        item.to ?? "—"
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {change.reason && <p className="mt-1 italic text-slate-600">&ldquo;{change.reason}&rdquo;</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
