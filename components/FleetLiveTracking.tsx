"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search, FileText, Radio, Copy, Check } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
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

export default function FleetLiveTracking() {
  const [searchTerm, setSearchTerm] = useState("");
  const [trackingList, setTrackingList] = useState<LiveFleetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedAt, setLoadedAt] = useState(0);
  const [copiedToken, setCopiedToken] = useState("");

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

  useEffect(() => {
    const initialLoad = setTimeout(loadFleet, 0);
    const interval = setInterval(loadFleet, REFRESH_INTERVAL_MS);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [loadFleet]);

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
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Fleet Live Tracking
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Monitor active deliveries and track the real-time location and
            status of your fleet.
          </p>
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
            className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs">
          {loadError}
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
            {mapPoints.length} of {filteredList.length} trucks reporting GPS
          </span>
        </div>
        <LiveRouteMap
          points={mapPoints}
          emptyMessage="No truck has reported a GPS position yet. Positions appear here once a driver starts a delivery in the crew app."
        />
      </div>

      {/* Main Content Container Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-150">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Order ID</th>
                <th className="py-3.5 px-4 sm:px-6">Truck</th>
                <th className="py-3.5 px-4 sm:px-6">Client</th>
                <th className="py-3.5 px-4 sm:px-6">Tracking Link</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentRecords.length > 0 ? (
                currentRecords.map((record) => {
                  const hasFix = record.latitude !== null && record.longitude !== null;
                  return (
                    <tr
                      key={record.dispatchID}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="py-4 px-4 sm:px-6 text-sm text-slate-900 font-medium">
                        {record.orderId}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-sm text-slate-600">
                        {record.truck}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-sm text-slate-600">
                        {record.client}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-sm">
                        {record.trackingToken ? (
                          <button
                            type="button"
                            onClick={() => copyTrackingLink(record.trackingToken as string)}
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                          >
                            {copiedToken === record.trackingToken ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {copiedToken === record.trackingToken ? "Copied" : "Copy client link"}
                          </button>
                        ) : (
                          <span className="text-slate-400">No link</span>
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
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-sm text-slate-600">
                        {record.status}
                        <span className="block text-xs text-slate-400 mt-0.5">
                          {formatLastSeen(record.lastUpdated, loadedAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 sm:py-20 text-center">
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
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {filteredList.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredList.length)} of {filteredList.length}{" "}
            entries
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || totalPages === 0}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors w-full sm:w-auto text-center ${
                currentPage === 1 || totalPages === 0
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors w-full sm:w-auto text-center ${
                currentPage === totalPages || totalPages === 0
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
