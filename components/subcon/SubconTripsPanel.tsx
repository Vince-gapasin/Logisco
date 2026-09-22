"use client";

import React, { useCallback, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, FileText, Loader2, RefreshCw, Search, Truck } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";
import SubconTripModal from "@/components/subcon/SubconTripModal";
import type { SubconTripView } from "@/services/subcon/subconService";

// Partner trips, for the coordinator to keep up to date: those still running,
// and those finished in the last 30 days with their proofs of delivery.

const STATUS_TONE: Record<string, string> = {
  Accepted: "bg-amber-100 text-amber-800",
  "In Transit": "bg-blue-100 text-blue-800",
  Completed: "bg-emerald-100 text-emerald-700",
  "Foul Trip": "bg-red-100 text-red-700",
  Cancelled: "bg-slate-100 text-slate-600",
};
const STATUS_LABEL: Record<string, string> = { Accepted: "Waiting for pickup" };

const ago = (iso: string | null) => {
  if (!iso) return "No update yet";
  const hours = (Date.now() - Date.parse(iso)) / 36e5;
  if (hours < 1) return `Updated ${Math.max(1, Math.round(hours * 60))} min ago`;
  if (hours < 48) return `Updated ${Math.round(hours)} h ago`;
  return `Updated ${new Date(iso).toLocaleDateString("en-PH")}`;
};

function TripRow({ trip, onOpen }: { trip: SubconTripView; onOpen: () => void }) {
  const missingProof = trip.stops.filter((s) => s.delivered && s.proof && !s.proof.url).length;
  return (
    <li>
      <button type="button" onClick={onOpen} className="w-full text-left px-4 sm:px-6 py-3 flex items-center gap-3 hover:bg-slate-50">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{trip.orderCode ?? "Booking"}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[trip.status] ?? "bg-slate-100 text-slate-600"}`}>
              {STATUS_LABEL[trip.status] ?? trip.status}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5 truncate">
            {trip.clientName ?? "Client"} · <Truck className="inline h-3 w-3" /> {trip.partner.name}
            {trip.plateNumber ? ` · ${trip.plateNumber}` : ""}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {trip.deliveredCount} of {trip.stops.length} stops delivered · {ago(trip.lastUpdate)}
            {missingProof > 0 && (
              <span className="ml-1 text-amber-700">
                · <FileText className="inline h-3 w-3" /> {missingProof} without proof
              </span>
            )}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    </li>
  );
}

export default function SubconTripsPanel() {
  const [active, setActive] = useState<SubconTripView[] | null>(null);
  const [recent, setRecent] = useState<SubconTripView[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [openTrip, setOpenTrip] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        apiFetch<{ data: SubconTripView[] }>("/api/subcon-trips?scope=active", { cache: "no-store" }),
        apiFetch<{ data: SubconTripView[] }>("/api/subcon-trips?scope=recent", { cache: "no-store" }),
      ]);
      setActive(a.data ?? []);
      setRecent(r.data ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sub-contractor trips.");
    }
  }, []);

  usePolling(() => void load(), 60000);

  const match = useCallback(
    (trip: SubconTripView) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [trip.orderCode, trip.clientName, trip.partner.name, trip.plateNumber, trip.driverName]
        .some((v) => v?.toLowerCase().includes(q));
    },
    [query],
  );
  const shownActive = useMemo(() => (active ?? []).filter(match), [active, match]);
  const shownRecent = useMemo(() => recent.filter(match), [recent, match]);

  return (
    <div className="space-y-6 mt-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Partners have no access to the system. Record what they report: the pickup, each delivery with the proof they
          send, or a problem.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search booking, client, partner"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh"
            className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">To update ({shownActive.length})</h2>
          <p className="text-xs text-slate-500">Partner trips not delivered yet.</p>
        </div>
        {active === null && !error ? (
          <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : shownActive.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{query ? "No matching trips." : "No partner trips are running."}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shownActive.map((trip) => <TripRow key={trip.dispatchID} trip={trip} onOpen={() => setOpenTrip(trip.dispatchID)} />)}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Finished, last 30 days ({shownRecent.length})</h2>
          <p className="text-xs text-slate-500">Open one to see its proofs of delivery.</p>
        </div>
        {shownRecent.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{query ? "No matching trips." : "None in the last 30 days."}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shownRecent.map((trip) => <TripRow key={trip.dispatchID} trip={trip} onOpen={() => setOpenTrip(trip.dispatchID)} />)}
          </ul>
        )}
      </section>

      <SubconTripModal dispatchID={openTrip} onClose={() => setOpenTrip(null)} onChanged={() => void load()} />
    </div>
  );
}
