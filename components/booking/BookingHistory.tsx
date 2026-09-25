"use client";

import React, { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";
import type { BookingHistoryEntry } from "@/services/booking/bookingHistoryService";

// What happened to a booking: created, assigned, accepted or declined and by
// whom, each status, the foul trips and how they were recovered. Newest
// first, from the audit trail rather than from lines of the trip note, which
// carried no time and no author.

export default function BookingHistory({ orderID, title = "7. Remarks History" }: { orderID: string; title?: string }) {
  const [entries, setEntries] = useState<BookingHistoryEntry[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: BookingHistoryEntry[] }>(`/api/bookings/${orderID}/history`, {
        cache: "no-store",
      });
      setEntries(res.data ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the history.");
    }
  }, [orderID]);

  usePolling(() => void load(), 60000);

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
      <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">{title}</div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse text-xs min-w-150">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
              <th className="p-2.5 w-10 border-r border-slate-200 text-center">#</th>
              <th className="p-2.5 border-r border-slate-200 w-[20%]">Date &amp; Time</th>
              <th className="p-2.5 border-r border-slate-200 w-[45%]">Details</th>
              <th className="p-2.5 border-r border-slate-200 w-[18%]">Staff</th>
              <th className="p-2.5 w-[17%]">Role</th>
            </tr>
          </thead>
          <tbody>
            {entries === null && !error ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-500 bg-slate-50">
                  <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-red-700 bg-red-50">
                  {error}
                </td>
              </tr>
            ) : (entries ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-500 italic bg-slate-50">
                  Nothing recorded for this booking yet.
                </td>
              </tr>
            ) : (
              (entries ?? []).map((entry, index) => (
                <tr key={entry.id} className="border-b border-slate-200 font-medium text-slate-700">
                  <td className="p-2 border-r border-slate-200 text-center bg-slate-50">{index + 1}</td>
                  <td className="p-2 border-r border-slate-200 bg-slate-50 whitespace-nowrap">{entry.dateTime}</td>
                  <td className="p-2 border-r border-slate-200 bg-slate-50">
                    <span className="font-semibold text-slate-900">{entry.title}</span>
                    {entry.detail ? <span className="block text-slate-600">{entry.detail}</span> : null}
                  </td>
                  <td className="p-2 border-r border-slate-200 bg-slate-50">{entry.actorName}</td>
                  <td className="p-2 bg-slate-50">{entry.actorRole}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
