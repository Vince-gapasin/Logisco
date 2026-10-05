"use client";

import { Navigation } from "lucide-react";

// Turn-by-turn to the stop the crew are heading for, in the app the driver
// already drives with. This page draws the route but cannot talk a driver
// through it, so the address used to be copied out by hand.
//
// Exact coordinates when the stop has them; otherwise the address, which both
// apps can search.

export interface NavigateTarget {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

function hasPosition(target: NavigateTarget): target is NavigateTarget & { latitude: number; longitude: number } {
  return typeof target.latitude === "number" && typeof target.longitude === "number" && !(target.latitude === 0 && target.longitude === 0);
}

export function canNavigateTo(target: NavigateTarget | null | undefined): target is NavigateTarget {
  return Boolean(target && (hasPosition(target) || target.address?.trim()));
}

function wazeUrl(target: NavigateTarget): string {
  return hasPosition(target)
    ? `https://waze.com/ul?ll=${target.latitude},${target.longitude}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(target.address ?? "")}&navigate=yes`;
}

function googleUrl(target: NavigateTarget): string {
  const destination = hasPosition(target)
    ? `${target.latitude},${target.longitude}`
    : encodeURIComponent(target.address ?? "");
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

export default function NavigateButtons({ target }: { target: NavigateTarget }) {
  const link =
    "flex-1 min-h-tap inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition-colors";
  return (
    <div className="mt-4 border-t border-blue-200 pt-3">
      <p className="mb-2 text-xs font-medium text-slate-600">
        Navigate to <span className="font-semibold text-slate-900">{target.name}</span>
      </p>
      <div className="flex gap-2">
        <a href={wazeUrl(target)} target="_blank" rel="noreferrer" className={`${link} bg-sky-500 text-white hover:bg-sky-600`}>
          <Navigation className="h-4 w-4" /> Waze
        </a>
        <a href={googleUrl(target)} target="_blank" rel="noreferrer" className={`${link} bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50`}>
          <Navigation className="h-4 w-4" /> Google Maps
        </a>
      </div>
    </div>
  );
}
