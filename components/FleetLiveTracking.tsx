"use client";

import React, { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Search, FileText, Radio, Copy, Check } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";
import { describeSilence, CHECK_IN_LABELS, type CheckInState } from "@/app/lib/stallRules";
import { checkerWarning, type CheckerHealth } from "@/app/lib/schedulerHealth";
import type { MapPoint } from "@/components/LiveRouteMap";

// Mapbox is heavy and browser-only: keep it out of every other page's bundle.
const LiveRouteMap = dynamic(() => import("@/components/LiveRouteMap"), {
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse bg-slate-100" />,
});

interface LiveFleetRecord {
  dispatchID: string;
  orderId: string;
  truck: string;
  client: string;
  status: string;
  trackingToken: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  lastUpdated: string | null;
}

// The crew app posts a fix every ~15 m of movement; 30s keeps the board
// current without hammering the API.
const REFRESH_INTERVAL_MS = 30_000;
const ITEMS_PER_PAGE = 10;

function formatLastSeen(timestamp: string | null, now: number): string {
  if (!timestamp) return "No GPS signal yet";
  const minutes = Math.round((now - new Date(timestamp).getTime()) / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours}h ago`;
}


/**
 * Answering a stall alert from the board it links to.
 *
 * Deliberately asks for a note rather than being a single button. The next
 * person to see this alert reads what you did, and "handled" on its own tells
 * them nothing - it is the difference between a problem being worked and a
 * problem being ticked off.
 */
function AnswerStallDialog({
  record,
  note,
  onNote,
  error,
  saving,
  onCancel,
  onSave,
}: {
  record: LiveFleetRecord;
  note: string;
  onNote: (value: string) => void;
  error: string;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 overflow-y-auto z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 my-auto">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Mark this handled</h3>
          <p className="text-xs text-slate-600 mt-0.5 wrap-break-word">
            {record.orderId} - {record.truck}
          </p>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600">
            This quietens the alert for an hour. If the trip is still silent after that, it
            comes back - so this is for saying what you did, not for closing it.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              What did you do? <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => onNote(event.target.value)}
              placeholder="Ex. Spoke to the driver, stuck at the gate, carrying on."
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="w-auto sm:w-auto min-h-tap sm:pointer-fine:min-h-0 px-3.5 sm:px-5 py-2 sm:py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm"
          >
            Never mind
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-auto sm:w-auto min-h-tap sm:pointer-fine:min-h-0 px-3.5 sm:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm disabled:opacity-60"
          >
            {saving ? "Saving..." : "Mark handled"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FleetLiveTracking() {
  const [searchTerm, setSearchTerm] = useState("");
  const [trackingList, setTrackingList] = useState<LiveFleetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedAt, setLoadedAt] = useState(0);
  const [copiedToken, setCopiedToken] = useState("");

  // Whose route to draw. Every truck at once would be a tangle of lines and a
  // Mapbox request per truck on every refresh, so it is one at a time: pick a
  // truck to see the road it is meant to be taking.
  // Trucks that have gone quiet. Fifteen minutes notifies nobody - most
  // quarter-hour stops are a queue at a gate - but whoever is watching the
  // board should be able to see it.
  const [quiet, setQuiet] = useState<
    Record<string, { silentFor: number; threshold: number | null; reason: string; cause: string; outOfContactFor: number; checkIn: { state: CheckInState; at: string } | null }>
  >({});

  /** The trip whose alert is being answered, if any. */
  const [answering, setAnswering] = useState<LiveFleetRecord | null>(null);
  const [answerNote, setAnswerNote] = useState("");
  const [answerError, setAnswerError] = useState("");
  const [savingAnswer, setSavingAnswer] = useState(false);

  const [checker, setChecker] = useState<CheckerHealth | null>(null);

  const checkForQuietTrucks = useCallback(async () => {
    try {
      const res = await apiFetch<{
        data: {
          trips: {
            dispatchID: string;
            silentFor: number;
            threshold: number | null;
            reason: string;
            cause: string;
            outOfContactFor: number;
            checkIn: { state: CheckInState; at: string } | null;
          }[];
          checker?: CheckerHealth;
        };
      }>("/api/fleet/stall-check", { cache: "no-store" });

      // Whether the thing that notifies people is still running. This board
      // recomputes the same verdicts on every poll and notifies nobody, so when
      // the schedule stops, quiet trips go on turning amber here while not one
      // alert is sent - which has happened twice, and both times the only
      // symptom was silence.
      setChecker(res.data.checker ?? null);

      const byDispatch: Record<string, { silentFor: number; threshold: number | null; reason: string; cause: string; outOfContactFor: number; checkIn: { state: CheckInState; at: string } | null }> = {};
      for (const trip of res.data.trips) {
        // At a stop is the crew working, and under a quarter of an hour is
        // traffic. Neither belongs on the board.
        //
        // "Never reported" is the exception to the second: its silence measures
        // zero because there is no position to measure from, so the length test
        // dropped it - and a trip marked on the road whose app has never spoken
        // is the one a coordinator has least to go on and most needs to see.
        if (trip.reason === "at a stop") continue;
        if (trip.reason !== "never reported" && trip.silentFor < 15) continue;

        byDispatch[trip.dispatchID] = {
          silentFor: trip.silentFor,
          threshold: trip.threshold,
          reason: trip.reason,
          cause: trip.cause,
          outOfContactFor: trip.outOfContactFor,
          checkIn: trip.checkIn ?? null,
        };
      }
      setQuiet(byDispatch);
    } catch (error) {
      console.error("Could not check for stalled trucks:", error);
    }
  }, []);

  usePolling(() => void checkForQuietTrucks(), REFRESH_INTERVAL_MS);

  /**
   * Records that somebody has acted on this silence.
   *
   * Then re-reads the board, so the trip stops being flagged straight away
   * rather than on the next poll - the person who just dealt with it should not
   * be looking at their own unanswered alert.
   */
  const answerStall = async () => {
    if (!answering) return;
    if (!answerNote.trim()) {
      setAnswerError("Say what you did. The next person to see this reads it.");
      return;
    }

    setSavingAnswer(true);
    setAnswerError("");

    try {
      await apiFetch("/api/fleet/stall-check/respond", {
        method: "POST",
        body: JSON.stringify({ dispatchID: answering.dispatchID, reason: answerNote.trim() }),
      });
      setAnswering(null);
      setAnswerNote("");
      await checkForQuietTrucks();
    } catch (error) {
      setAnswerError(error instanceof Error ? error.message : "Could not save that.");
    } finally {
      setSavingAnswer(false);
    }
  };

  const [routeFor, setRouteFor] = useState<string>("");
  const [plannedRoute, setPlannedRoute] = useState<[number, number][]>([]);

  const loadPlannedRoute = useCallback(async () => {
    if (!routeFor) {
      setPlannedRoute([]);
      return;
    }
    try {
      const res = await apiFetch<{ data: { path: [number, number][] } | null }>(
        `/api/dispatch/${routeFor}/route`,
        { cache: "no-store" },
      );
      setPlannedRoute(res.data?.path ?? []);
    } catch (error) {
      console.error("Could not load the route ahead:", error);
      setPlannedRoute([]);
    }
  }, [routeFor]);

  usePolling(() => void loadPlannedRoute(), 120000, { enabled: Boolean(routeFor) });

  // Customer-facing tracking link for an order.
  const copyTrackingLink = async (token: string) => {
    const link = `${window.location.origin}/client-view?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(""), 2000);
    } catch {
      window.prompt("Copy this tracking link:", link);
    }
  };

  const loadFleet = useCallback(async () => {
    try {
      // Polled every 30s: always go to the network.
      const result = await apiFetch<{ data: LiveFleetRecord[] }>("/api/fleet-locations", {
        cache: "no-store",
      });
      setTrackingList(result.data ?? []);
      setLoadedAt(Date.now());
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load live fleet.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Polls only while the tab is visible.
  usePolling(loadFleet, REFRESH_INTERVAL_MS);

  const term = searchTerm.toLowerCase();
  const filteredList = trackingList.filter(
    (record) =>
      record.orderId.toLowerCase().includes(term) ||
      record.truck.toLowerCase().includes(term) ||
      record.client.toLowerCase().includes(term),
  );

  // Only trucks that have reported a position can be plotted.
  const mapPoints: MapPoint[] = useMemo(
    () =>
      filteredList
        .filter((record) => record.latitude !== null && record.longitude !== null)
        .map((record) => ({
          id: record.dispatchID,
          label: record.truck,
          detail: `${record.orderId} - ${record.client}`,
          latitude: record.latitude as number,
          longitude: record.longitude as number,
          kind: "truck" as const,
        })),
    [filteredList],
  );

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentRecords = filteredList.slice(startIndex, endIndex);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Fleet Live Tracking
          </h1>
          </div>

        {/* Search Input Control */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order ID, truck, client..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-500"
          />
        </div>
      </div>

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs">
          {loadError}
        </div>
      )}

      {/* The watchdog's own pulse.
          Above the map on purpose: everything below it is worth less when this
          is showing, because a quiet truck on this board is only ever acted on
          if somebody is notified about it. It names the consequence, not the
          fault - a coordinator does not need to know what pg_cron is. */}
      {checker && checkerWarning(checker) && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-xl text-xs"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span className="font-medium">{checkerWarning(checker)}</span>
        </div>
      )}

      {/* Live Map */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-5">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-900">Live Map</span>
          </div>
          <span className="text-xs text-slate-500">
            {routeFor
              ? plannedRoute.length > 1
                ? "Showing one truck's planned route"
                : "That truck has no route left to draw"
              : `${mapPoints.length} of ${filteredList.length} trucks reporting GPS`}
          </span>
        </div>
        <LiveRouteMap
          points={mapPoints}
          plannedRoute={plannedRoute}
          emptyMessage="No truck has reported a GPS position yet. Positions appear here once a driver starts a delivery in the crew app."
        />
      </div>

      {/* Main Content Container Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* On a phone each row becomes its own card of label/value pairs; from
            md up it is an ordinary table. One set of markup, one set of data -
            the layout switches rather than a second copy of the list existing. */}
        <div className="overflow-x-auto px-4 sm:px-6 md:px-0">
          <table role="table" className="w-full text-left border-collapse md:table-fixed my-2 block md:table">
            <thead role="rowgroup" className="hidden md:table-header-group">
              <tr role="row" className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Order ID</th>
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Truck</th>
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Client</th>
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Tracking Link</th>
                <th role="columnheader" className="py-3.5 px-4 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="block md:table-row-group">
              {currentRecords.length > 0 ? (
                currentRecords.map((record) => {
                  const hasFix = record.latitude !== null && record.longitude !== null;
                  const silence = quiet[record.dispatchID];
                  return (
                    <tr role="row"
                      key={record.dispatchID}
                      className="block md:table-row bg-white border border-slate-200 rounded-xl mb-4 md:border-0 md:border-b md:border-slate-100 md:rounded-none md:mb-0 hover:bg-slate-50/50 transition-colors shadow-sm md:shadow-none overflow-hidden"
                    >
                      <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-3 md:py-4 px-4 sm:px-6 w-full md:w-auto align-middle border-b md:border-none border-slate-100">
                        <span className="md:hidden text-xs font-semibold text-slate-500">Order ID</span>
                        <div className="text-right md:text-left text-sm wrap-break-word">
                          <span className="font-bold text-blue-700 bg-blue-100 md:bg-transparent md:font-medium md:text-slate-900 px-2.5 md:px-0 py-1 md:py-0 rounded-md inline-block">
                            {record.orderId}
                          </span>
                        </div>
                      </td>

                      <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-3 md:py-4 px-4 sm:px-6 w-full md:w-auto align-middle border-b md:border-none border-slate-100">
                        <span className="md:hidden text-xs font-semibold text-slate-500">Truck</span>
                        <div className="text-right md:text-left text-sm text-slate-600 wrap-break-word">
                          <span className="block">{record.truck}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setRouteFor((current) => (current === record.dispatchID ? "" : record.dispatchID))
                            }
                            className="mt-0.5 min-h-tap md:pointer-fine:min-h-0 inline-flex items-center text-xs font-medium text-blue-600 hover:underline"
                          >
                            {routeFor === record.dispatchID ? "Hide route" : "Show route"}
                          </button>
                        </div>
                      </td>

                      <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-3 md:py-4 px-4 sm:px-6 w-full md:w-auto align-middle border-b md:border-none border-slate-100">
                        <span className="md:hidden text-xs font-semibold text-slate-500">Client</span>
                        <div className="text-right md:text-left text-sm text-slate-600 wrap-break-word">
                          {record.client}
                        </div>
                      </td>

                      <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-center py-3 md:py-4 px-4 sm:px-6 w-full md:w-auto align-middle border-b md:border-none border-slate-100">
                        <span className="md:hidden text-xs font-semibold text-slate-500">Tracking Link</span>
                        <div className="flex flex-col items-end md:items-start text-right md:text-left text-sm wrap-break-word">
                          {record.trackingToken ? (
                            <button
                              type="button"
                              onClick={() => copyTrackingLink(record.trackingToken as string)}
                              className="inline-flex items-center gap-1.5 min-h-tap md:pointer-fine:min-h-0 text-blue-600 hover:underline"
                            >
                              {copiedToken === record.trackingToken ? (
                                <Check className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                              )}
                              {copiedToken === record.trackingToken ? "Copied" : "Copy client link"}
                            </button>
                          ) : (
                            <span className="text-slate-500">No link</span>
                          )}
                          {hasFix && (
                            <a
                              href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-slate-500 hover:underline mt-0.5"
                            >
                              Open in Google Maps
                            </a>
                          )}
                        </div>
                      </td>

                      <td role="cell" className="grid grid-cols-[40%_60%] gap-2 md:table-cell items-start py-3 md:py-4 px-4 sm:px-6 w-full md:w-auto align-middle">
                        <span className="md:hidden text-xs font-semibold text-slate-500 text-left">Status</span>
                        <div className="flex flex-col items-end md:items-start text-right md:text-left text-sm text-slate-600 wrap-break-word">
                          <span>{record.status}</span>
                          <span className="block text-xs text-slate-500 mt-0.5">
                            {formatLastSeen(record.lastUpdated, loadedAt)}
                          </span>
                          {silence && (
                            <span
                              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                // A trip nobody closed is a tidying job, not an
                                // alarm, so it gets its own quiet styling rather
                                // than the grey that used to make the stalest
                                // trip on the board look like the calmest.
                                silence.reason === "left open"
                                  ? "bg-slate-200 text-slate-700"
                                  // Somebody has picked this up. Still worth
                                  // seeing, no longer worth shouting about.
                                  : silence.reason === "office answered"
                                    ? "bg-emerald-100 text-emerald-800"
                                    // No position at all, so there is no length
                                    // of silence to escalate by - and it would
                                    // otherwise fall through to the calmest
                                    // colour on the board, which is the one case
                                    // where there is nothing to go and look at.
                                    : silence.reason === "never reported"
                                      ? "bg-amber-100 text-amber-800"
                                      : (silence.threshold ?? 0) >= 45
                                        ? "bg-red-100 text-red-700"
                                        : (silence.threshold ?? 0) >= 30
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {silence.reason === "left open"
                                ? `Left open - ${describeSilence(silence.silentFor)}`
                                : silence.reason === "never reported"
                                  ? "No tracking on this trip"
                                  : silence.reason === "office answered"
                                    ? `Handled - quiet ${describeSilence(silence.silentFor)}`
                                    : `Quiet ${describeSilence(silence.silentFor)}`}
                            </span>
                          )}

                          {/* Whether the truck stopped or the phone did.
                              assessStall has always worked this out and nothing
                              showed it, so the board said how long a truck had
                              been quiet and left the first question a
                              coordinator asks - is the app still talking to us -
                              to be answered by ringing the driver. */}
                          {silence && silence.reason !== "never reported" && (
                            <span className="mt-1 block text-xs text-slate-500">
                              {silence.cause === "stopped"
                                ? "App still reporting - the truck has stopped"
                                : silence.cause === "out of contact"
                                  ? `App silent ${describeSilence(silence.outOfContactFor)} - phone may be off or out of signal`
                                  : "Cannot tell whether the truck or the phone stopped"}
                            </span>
                          )}
                          {/* What the crew said, so nobody rings a driver who has
                              already told us they are on their break. */}
                          {silence?.checkIn && (
                            <span
                              className={`mt-1 block text-xs ${
                                silence.reason === "crew asked for help"
                                  ? "font-semibold text-red-700"
                                  : "text-slate-500"
                              }`}
                            >
                              Crew: {CHECK_IN_LABELS[silence.checkIn.state]}
                            </span>
                          )}

                          {/* Answering the alert, from the board it links to.
                              The forty-five minute rung tells the office to call
                              the driver and had no way of knowing whether anybody
                              did, so it kept escalating at the person who already
                              had. Saying so buys an hour - not silence, an hour. */}
                          {silence &&
                            silence.reason !== "left open" &&
                            silence.reason !== "office answered" &&
                            (silence.threshold ?? 0) >= 45 && (
                            <button
                              type="button"
                              onClick={() => setAnswering(record)}
                              className="mt-1.5 min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Check className="h-3.5 w-3.5 shrink-0" />
                              Mark handled
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr role="row" className="block md:table-row">
                  <td role="cell" colSpan={5} className="block md:table-cell py-16 sm:py-20 text-center w-full">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        {isLoading ? "Loading live fleet..." : "No active deliveries found"}
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        Trucks on an accepted or in-transit delivery appear here
                        with their latest GPS position.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:grid sm:grid-cols-3 gap-3 items-center text-xs text-slate-700 bg-white">
          <div className="w-full text-center sm:text-left">
            Showing {filteredList.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredList.length)} of {filteredList.length} entries
          </div>
          {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 w-full">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || totalPages === 0}
              className={`px-3 py-1.5 min-h-tap sm:pointer-fine:min-h-0 border border-slate-200 rounded-lg font-medium transition-colors flex-1 sm:flex-none text-center ${
                currentPage === 1 || totalPages === 0
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Previous
            </button>
            <span className="mx-2 whitespace-nowrap">
              Page {currentPage} of {totalPages === 0 ? 1 : totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`px-3 py-1.5 min-h-tap sm:pointer-fine:min-h-0 border border-slate-200 rounded-lg font-medium transition-colors flex-1 sm:flex-none text-center ${
                currentPage === totalPages || totalPages === 0
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Next
            </button>
          </div>
          )}
          {/* Balances the grid so the buttons sit centred from sm up. */}
          <div className="hidden sm:block" />
        </div>
      </div>

      {answering && (
        <AnswerStallDialog
          record={answering}
          note={answerNote}
          onNote={setAnswerNote}
          error={answerError}
          saving={savingAnswer}
          onCancel={() => {
            setAnswering(null);
            setAnswerNote("");
            setAnswerError("");
          }}
          onSave={() => void answerStall()}
        />
      )}
    </div>
  );
}
