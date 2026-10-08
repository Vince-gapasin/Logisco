"use client";

import { AlertTriangle } from "lucide-react";

// Shown after a booking edit that saved but has something to say about the new
// times: moved to today with nothing to spare, or with times that could not be
// checked against the map. An edit has no confirmation step the way a new
// booking does, so the edit window stays open on this until it has been read -
// closing straight onto a success message would bury it.

interface SavedWithWarningProps {
  message: string;
  onDone: () => void;
}

export default function SavedWithWarning({ message, onDone }: SavedWithWarningProps) {
  return (
    <div
      className="fixed inset-0 overflow-y-auto z-70 flex items-center justify-center p-4 bg-slate-900/60"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="saved-warning-title"
      aria-describedby="saved-warning-message"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl my-auto">
        <h3 id="saved-warning-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Saved - check the times
        </h3>
        <p id="saved-warning-message" className="mt-2 text-sm text-slate-600">
          {message}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onDone}
            className="min-h-tap px-5 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
