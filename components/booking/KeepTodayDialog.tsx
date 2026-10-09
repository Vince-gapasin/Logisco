"use client";

import { AlertTriangle } from "lucide-react";

// Asked when a booking is moved to today and the crew may not make its times,
// or whether they can could not be checked. Nothing has been saved yet: the
// coordinator keeps today, or goes back and picks another day.
//
// It used to be shown after the save, as a notice to acknowledge - by which
// point the day had already moved and there was nothing left to decide.

interface KeepTodayDialogProps {
  message: string;
  onKeep: () => void;
  onPickAnother: () => void;
}

export default function KeepTodayDialog({ message, onKeep, onPickAnother }: KeepTodayDialogProps) {
  return (
    <div
      className="fixed inset-0 overflow-y-auto z-70 flex items-center justify-center p-4 bg-slate-900/60"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="keep-today-title"
      aria-describedby="keep-today-message"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl my-auto">
        <h3 id="keep-today-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Move this booking to today?
        </h3>
        <p id="keep-today-message" className="mt-2 text-sm text-slate-600">
          {message}
        </p>
        <p className="mt-2 text-sm text-slate-600">Nothing has been saved yet.</p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onPickAnother}
            className="min-h-tap px-5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
          >
            Pick another day
          </button>
          <button
            type="button"
            onClick={onKeep}
            className="min-h-tap px-5 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white"
          >
            Keep today
          </button>
        </div>
      </div>
    </div>
  );
}
