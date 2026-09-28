"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * What a list says when it could not load.
 *
 * The six feed and calendar lists already set a loadError and rendered it in a
 * red strip above the table. The bug was what the table did underneath: the rows
 * array stays empty on a failure, so the empty state rendered too, and a dropped
 * connection told the user "no bookings found - or none matching your search".
 * That points at the search box when the problem is the network, which on a
 * phone is the common case rather than the edge one.
 *
 * So there are two situations and they want different things:
 *
 *   nothing loaded    -> this, in place of the empty state, with a way to retry.
 *   a refresh failed  -> compact, above rows that are still worth reading.
 *                        Stale data beats an empty screen.
 */
export default function ListLoadError({
  message,
  onRetry,
  compact = false,
}: {
  message: string;
  onRetry: () => void;
  /** Set when rows are already on screen: says so without replacing them. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        role="alert"
        className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
      >
        <span className="flex items-start gap-2 flex-1 wrap-break-word">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
          <span>
            Showing what loaded last. {message}
          </span>
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 min-h-tap sm:min-h-0 sm:py-1.5 px-4 inline-flex items-center justify-center gap-1.5 bg-white border border-red-200 text-red-700 font-semibold rounded-lg hover:bg-red-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center max-w-sm mx-auto px-4"
    >
      <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-3">
        <AlertTriangle className="w-6 h-6" aria-hidden="true" />
      </div>
      <p className="text-slate-900 font-semibold text-sm">
        Could not load this list
      </p>
      {/* The server's own words. Kept because "check your connection" is a guess
          and the real reason is often more specific than that. */}
      <p className="text-slate-600 text-xs mt-1 wrap-break-word">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-tap px-5 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
