"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Pencil } from "lucide-react";
import { apiFetch, authFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";
import type { BookingHistoryEntry } from "@/services/booking/bookingHistoryService";

// What happened to a booking: created, assigned, accepted or declined and by
// whom, each status, the foul trips and how they were recovered. Newest
// first, from the audit trail rather than from lines of the trip note, which
// carried no time and no author.

/** What the downloaded file is called, so a downloads folder stays readable. */
function downloadNameFor(label: string, isPdf: boolean): string {
  const stop = label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "stop";
  return `proof-of-delivery-${stop}.${isPdf ? "pdf" : "jpg"}`;
}

export default function BookingHistory({ orderID, title = "7. Remarks History" }: { orderID: string; title?: string }) {
  const [entries, setEntries] = useState<BookingHistoryEntry[] | null>(null);
  const [error, setError] = useState("");
  const [enlarged, setEnlarged] = useState<BookingHistoryEntry["proof"]>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [draft, setDraft] = useState({ receiverName: "", remarks: "", reason: "" });
  const [replacement, setReplacement] = useState<File | null>(null);

  // Escape closes the photograph, and only while one is open, so it cannot
  // swallow the Escape that closes the booking behind it.
  useEffect(() => {
    if (!enlarged) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEnlarged(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged]);

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

  /**
   * Sends a correction.
   *
   * The office can replace an unreadable photograph and fix a name typed
   * one-handed at a gate. The server keeps the file it replaces and writes the
   * change to the audit trail, so the next reload of this table shows who
   * corrected it - the correction becomes another line of the history rather
   * than a quiet edit of the evidence.
   */
  const saveCorrection = async () => {
    if (!enlarged) return;

    setSaving(true);
    setSaveError("");

    try {
      const body = new FormData();
      if (replacement) body.append("proof", replacement);
      body.append("receiverName", draft.receiverName);
      body.append("remarks", draft.remarks);
      body.append("reason", draft.reason);

      const res = await authFetch(`/api/pod/${enlarged.podID}`, { method: "PATCH", body });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSaveError(result.message ?? "Could not save that.");
        return;
      }

      setEditing(false);
      setEnlarged(null);
      setReplacement(null);
      await load();
    } catch {
      setSaveError("No connection. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
      <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">{title}</div>
      {/* Each entry is a small card below laptop width; the six-column table from lg up. */}
      <div className="lg:overflow-x-auto lg:border lg:border-slate-200 lg:rounded-lg">
        <table role="table" className="w-full text-left border-collapse text-xs lg:min-w-150 block lg:table">
          <thead role="rowgroup" className="hidden lg:table-header-group">
            <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
              <th className="p-2.5 w-10 border-r border-slate-200 text-center">#</th>
              <th className="p-2.5 border-r border-slate-200 w-[20%]">Date &amp; Time</th>
              <th className="p-2.5 border-r border-slate-200 w-[35%]">Details</th>
              <th className="p-2.5 border-r border-slate-200 w-[10%]">POD</th>
              <th className="p-2.5 border-r border-slate-200 w-[18%]">Staff</th>
              <th className="p-2.5 w-[17%]">Role</th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="block lg:table-row-group space-y-2 lg:space-y-0">
            {entries === null && !error ? (
              <tr role="row" className="block lg:table-row">
                <td role="cell" colSpan={6} className="block lg:table-cell p-4 text-center text-slate-500 bg-slate-50 rounded-lg lg:rounded-none">
                  <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
                </td>
              </tr>
            ) : error ? (
              <tr role="row" className="block lg:table-row">
                <td role="cell" colSpan={6} className="block lg:table-cell p-4 text-center text-red-700 bg-red-50 rounded-lg lg:rounded-none">
                  {error}
                </td>
              </tr>
            ) : (entries ?? []).length === 0 ? (
              <tr role="row" className="block lg:table-row">
                <td role="cell" colSpan={6} className="block lg:table-cell p-4 text-center text-slate-500 italic bg-slate-50 rounded-lg lg:rounded-none">
                  Nothing recorded for this booking yet.
                </td>
              </tr>
            ) : (
              (entries ?? []).map((entry, index) => (
                <tr role="row" key={entry.id} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 p-3 border border-slate-200 rounded-lg bg-slate-50 lg:table-row lg:p-0 lg:border-0 lg:border-b lg:rounded-none lg:bg-transparent font-medium text-slate-700">
                  {/* Counted from the bottom, where the booking was created.
                      The rows are newest first, so numbering them downwards
                      made the newest thing #1 and the creation of the booking
                      the highest number - the opposite of the order it
                      happened in. Now #1 is where it started and the number
                      at the top is how many things have happened since. */}
                  <td role="cell" className="lg:p-2 lg:border-r lg:border-slate-200 lg:text-center lg:bg-slate-50 text-slate-500">
                    #{(entries ?? []).length - index}
                  </td>
                  <td role="cell" className="text-slate-500 lg:text-slate-700 lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50 lg:whitespace-nowrap">{entry.dateTime}</td>
                  <td role="cell" className="col-span-2 lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50">
                    <span className="font-semibold text-slate-900">{entry.title}</span>
                    {entry.detail ? <span className="block text-slate-600">{entry.detail}</span> : null}
                  </td>
                  {/* The proof taken at the stop this line is about. Empty on the
                      lines that are not about a stop, which is most of them. */}
                  <td role="cell" className={`col-span-2 lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50 lg:text-center ${entry.proof ? "" : "hidden lg:table-cell"}`}>
                    {entry.proof ? (
                      entry.proof.isPdf ? (
                        <a
                          href={entry.proof.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-tap lg:pointer-fine:min-h-0 inline-flex items-center font-semibold text-blue-600 hover:underline"
                        >
                          View PDF
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEnlarged(entry.proof);
                            setEditing(false);
                            setSaveError("");
                            setReplacement(null);
                            setDraft({
                              receiverName: entry.proof?.receiverName ?? "",
                              remarks: entry.proof?.remarks ?? "",
                              reason: "",
                            });
                          }}
                          className="min-h-tap lg:pointer-fine:min-h-0 inline-flex items-center font-semibold text-blue-600 hover:underline"
                        >
                          View POD
                        </button>
                      )
                    ) : (
                      <span className="text-slate-400">&mdash;</span>
                    )}
                  </td>
                  <td role="cell" className="col-span-2 text-slate-500 lg:text-slate-700 lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50">
                    <span className="lg:hidden">By </span>
                    {entry.actorName}
                    <span className="lg:hidden">{entry.actorRole ? ` (${entry.actorRole})` : ""}</span>
                  </td>
                  <td role="cell" className="hidden lg:table-cell p-2 bg-slate-50">{entry.actorRole}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {enlarged && (
        <div
          className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/85 animate-fade-in"
          onClick={() => setEnlarged(null)}
        >
          <div
            className="flex w-full max-w-3xl flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlarged.url}
              alt={`Proof of delivery from ${enlarged.label}`}
              className="max-h-[70dvh] w-auto max-w-full rounded-xl border border-slate-700 bg-slate-900 object-contain"
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-xs font-medium text-slate-200 wrap-break-word">
                {enlarged.label}
                {enlarged.receiverName && enlarged.receiverName !== "N/A"
                  ? ` - received by ${enlarged.receiverName}`
                  : ""}
              </span>
              {/* Supabase signs the object; adding download turns the same link
                  into an attachment rather than something the browser displays.
                  No second request and no copy of the file to serve. */}
              <a
                href={`${enlarged.url}&download=${encodeURIComponent(downloadNameFor(enlarged.label, enlarged.isPdf))}`}
                className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:underline"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                Download
              </a>
              <a
                href={enlarged.url}
                target="_blank"
                rel="noreferrer"
                className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center text-xs font-semibold text-blue-300 hover:underline"
              >
                Open full size
              </a>
              <button
                type="button"
                onClick={() => setEditing((open) => !open)}
                className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:underline"
              >
                <Pencil className="w-3.5 h-3.5 shrink-0" />
                {editing ? "Stop editing" : "Correct this"}
              </button>
              <button
                type="button"
                onClick={() => setEnlarged(null)}
                className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center text-xs font-semibold text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>

            {editing && (
              <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-left space-y-3">
                <p className="text-xs text-slate-400">
                  The file you replace is kept, and this correction is added to the history
                  with your name on it.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Replace the photograph
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => setReplacement(event.target.files?.[0] ?? null)}
                    className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Received by
                  </label>
                  <input
                    type="text"
                    value={draft.receiverName}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, receiverName: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={draft.remarks}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, remarks: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Why (shown in the history)
                  </label>
                  <input
                    type="text"
                    value={draft.reason}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, reason: event.target.value }))
                    }
                    placeholder="Ex. the original was unreadable"
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                  />
                </div>

                {saveError && <p className="text-xs font-medium text-red-400">{saveError}</p>}

                <button
                  type="button"
                  onClick={() => void saveCorrection()}
                  disabled={saving}
                  className="w-full min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save correction"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
