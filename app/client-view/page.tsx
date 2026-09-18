// ==========================================
// LOGISCO - CLIENT TRACKER VIEW PAGE
// ==========================================
// Public page opened from the tracking link handed to a customer:
//   /client-view?token=<Order.orderLinkToken>
"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Truck, User, MapPin, Clock, Package } from "lucide-react";
import type { MapPoint } from "@/components/LiveRouteMap";
import { usePolling } from "@/app/lib/usePolling";

const LiveRouteMap = dynamic(() => import("@/components/LiveRouteMap"), {
  ssr: false,
  loading: () => <div className="h-65 sm:h-87.5 md:h-100 w-full animate-pulse bg-slate-100" />,
});

const REFRESH_INTERVAL_MS = 30_000;

interface TrackingStep {
  title: string;
  detail: string;
  stage: "completed" | "current" | "upcoming";
}

interface TrackingStop {
  branchID: number;
  branchName: string;
  expectedTime: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
}

interface TrackingData {
  isExpired: boolean;
  orderNumber: string;
  clientName: string | null;
  deliveryStatus: string;
  isCompleted: boolean;
  estimatedArrival: string | null;
  liveEta: { minutes: number; distanceKm: number; arrivalTime: string } | null;
  nextStopName: string | null;
  plateNumber: string | null;
  truckModel: string | null;
  driverName: string | null;
  driverContact: string | null;
  currentLocation: { latitude: number; longitude: number; updatedAt: string | null } | null;
  trail: { latitude: number; longitude: number }[];
  stops: TrackingStop[];
  steps: TrackingStep[];
}

type LoadState = "loading" | "ready" | "expired" | "missing" | "error";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto min-h-[100dvh] bg-[#f8fafc] font-sans text-slate-900 flex flex-col">
      <div className="w-full max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}

function Notice({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 sm:p-12 min-h-100 text-center">
      <div className="bg-black text-white px-6 py-4 rounded-xl shadow-md max-w-md w-full flex flex-col gap-1 items-center">
        <p className="text-sm sm:text-base font-semibold tracking-tight">{title}</p>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function ClientTrackerView() {
  const token = useSearchParams().get("token");
  const [data, setData] = useState<TrackingData | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const loadTracking = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/track/${token}`, { cache: "no-store" });

      if (response.status === 404 || response.status === 400) {
        setState("missing");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }

      const result = await response.json();
      if (result.isExpired) {
        setState("expired");
        return;
      }

      setData(result as TrackingData);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [token]);

  useEffect(() => {
    void loadTracking();
  }, [loadTracking]);

  // Keep polling while the delivery is still running, and only while the
  // customer actually has the page open.
  usePolling(loadTracking, REFRESH_INTERVAL_MS, {
    enabled: state === "ready" && !data?.isCompleted,
    immediate: false,
  });

  // No token in the URL at all: nothing to look up.
  if (!token) {
    return (
      <Shell>
        <Notice
          title="This tracking link is not valid."
          subtitle="Please check the link, or contact your coordinator for a new one."
        />
      </Shell>
    );
  }

  if (state === "loading") {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 min-h-100 text-slate-600">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium">Loading your delivery...</p>
        </div>
      </Shell>
    );
  }

  if (state === "missing") {
    return (
      <Shell>
        <Notice
          title="This tracking link is not valid."
          subtitle="Please check the link, or contact your coordinator for a new one."
        />
      </Shell>
    );
  }

  if (state === "expired") {
    return (
      <Shell>
        <Notice
          title="Oops, this link has expired."
          subtitle="You might want to contact the coordinator"
        />
      </Shell>
    );
  }

  if (state === "error" || !data) {
    return (
      <Shell>
        <Notice
          title="We could not load this delivery right now."
          subtitle="Please refresh the page in a moment."
        />
      </Shell>
    );
  }

  const mapPoints: MapPoint[] = [
    ...(data.currentLocation
      ? [
          {
            id: "truck",
            label: data.plateNumber ? `Truck ${data.plateNumber}` : "Delivery truck",
            detail: "Current position",
            latitude: data.currentLocation.latitude,
            longitude: data.currentLocation.longitude,
            kind: "truck" as const,
          },
        ]
      : []),
    ...data.stops
      .filter((stop) => stop.latitude !== null && stop.longitude !== null)
      .map((stop) => ({
        id: `stop-${stop.branchID}`,
        label: stop.branchName,
        detail: stop.status,
        latitude: stop.latitude as number,
        longitude: stop.longitude as number,
        kind: "stop" as const,
        done: /complete|delivered/i.test(stop.status),
      })),
  ];

  // Prefer the live driving estimate; fall back to the scheduled window.
  const headline = data.isCompleted
    ? "Delivery Completed"
    : data.liveEta
      ? `Arriving in about ${data.liveEta.minutes} min (${data.liveEta.arrivalTime})`
      : data.estimatedArrival
        ? `Estimated Arrival by ${data.estimatedArrival}`
        : data.deliveryStatus;

  return (
    <Shell>
      <div className="flex flex-col flex-1 bg-white">
        {/* Live Route / Map Section */}
        <div className="bg-slate-100 border-b border-slate-200 overflow-hidden flex flex-col">
          <div className="bg-white px-4 sm:px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 text-blue-600 ${data.isCompleted ? "" : "animate-pulse"}`} />
              <span className="text-sm font-bold text-slate-900">
                Live Route Tracking — {data.orderNumber}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold text-slate-600">
                Status: <strong className="text-blue-600">{data.deliveryStatus}</strong>
              </span>
              {data.plateNumber && (
                <span className="flex items-center gap-1.5 font-bold text-blue-600">
                  <Truck className="w-3.5 h-3.5" /> Unit: {data.plateNumber}
                </span>
              )}
            </div>
          </div>

          <div className="relative w-full h-65 sm:h-87.5 md:h-100">
            <LiveRouteMap
              points={mapPoints}
              trail={data.trail ?? []}
              heightClass="h-65 sm:h-87.5 md:h-100"
              emptyMessage={
                data.isCompleted
                  ? "This delivery is complete. Live tracking has ended."
                  : "Live tracking will appear here once the driver starts the trip."
              }
            />
          </div>
        </div>

        {/* Content Container */}
        <div className="flex flex-col p-4 sm:p-6 md:p-8 gap-5 bg-slate-50/50 flex-1">
          <div className="w-full">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{headline}</h1>
            {!data.isCompleted && data.nextStopName && (
              <p className="text-sm text-slate-600 mt-1">
                Next stop: {data.nextStopName}
                {data.liveEta ? ` - ${data.liveEta.distanceKm} km away` : ""}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Booking Details Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-sm font-semibold text-slate-900">Booking Details</span>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                  {data.orderNumber}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 pt-0.5">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500">Truck / Plate No.</div>
                    <div className="text-sm font-medium text-slate-900">
                      {data.plateNumber
                        ? [data.truckModel, data.plateNumber].filter(Boolean).join(" - ")
                        : "Not yet assigned"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500">Driver</div>
                    <div className="text-sm font-medium text-slate-900">
                      {data.driverName
                        ? [data.driverName, data.driverContact].filter(Boolean).join(" - ")
                        : "Not yet assigned"}
                    </div>
                  </div>
                </div>

                {data.stops.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-500">
                        Delivery stops ({data.stops.length})
                      </div>
                      <ul className="text-sm font-medium text-slate-900 mt-0.5 space-y-0.5">
                        {data.stops.map((stop) => (
                          <li key={stop.branchID} className="flex items-center gap-2">
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                /complete|delivered/i.test(stop.status) ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                            />
                            <span className="truncate">{stop.branchName}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Latest Updates Timeline Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Clock className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-semibold text-slate-900">Latest Updates</span>
              </div>

              <div className="flex flex-col pl-2.5 pt-1 space-y-4 relative">
                <div className="absolute left-4.25 top-3 bottom-3 w-0.5 bg-slate-200 z-0"></div>

                {data.steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3.5 relative z-10">
                    <div className="mt-0.5 shrink-0">
                      {step.stage === "completed" ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-xs flex items-center justify-center"></div>
                      ) : step.stage === "current" ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border-4 border-blue-100 shadow-xs"></div>
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-300 border-2 border-white"></div>
                      )}
                    </div>

                    <div className="flex flex-col text-sm">
                      <span
                        className={`text-sm font-medium ${
                          step.stage === "current" ? "text-blue-700 font-semibold" : "text-slate-900"
                        }`}
                      >
                        {step.title}
                      </span>
                      <span
                        className={`text-xs text-slate-600 mt-0.5 ${
                          step.stage === "current" ? "font-semibold text-slate-900" : ""
                        }`}
                      >
                        {step.detail}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export default function ClientTrackerPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="flex-1 flex items-center justify-center p-12 min-h-100 text-sm text-slate-600">
            Loading your delivery...
          </div>
        </Shell>
      }
    >
      <ClientTrackerView />
    </Suspense>
  );
}
