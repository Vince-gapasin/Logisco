"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

// Deleting a truck for good, from the Archive.
//
// Unlike Disable there is no way back, so the plate has to be typed to confirm
// - a second click on the same spot is too easy to make. What is kept is said
// plainly, because "delete" reads as losing the truck's history, and it does not.

const normalise = (plate: string) => plate.replace(/[^a-z0-9]/gi, "").toUpperCase();

export default function DeleteTruckModal({
  plateNumber,
  onCancel,
  onConfirm,
}: {
  plateNumber: string;
  onCancel: () => void;
  /** Deletes it; the modal stays open and busy until this settles. */
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const matches = normalise(typed) !== "" && normalise(typed) === normalise(plateNumber);

  const confirm = async () => {
    if (!matches || isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 relative my-auto"
      >
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2 text-center">Delete Truck</h3>
        <p className="text-sm text-slate-600 mb-3 text-center">
          <strong className="text-slate-900">{plateNumber}</strong> will be removed for good. It cannot be
          restored.
        </p>
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-4">
          Its trips, breakdowns and maintenance logs are kept, and still show this plate number.
        </p>

        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Type <span className="font-mono text-slate-900">{plateNumber}</span> to confirm
        </label>
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={isDeleting}
          className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl px-3 py-2.5 mb-5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!matches || isDeleting}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer inline-flex items-center justify-center gap-2 disabled:bg-red-300 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete Truck
          </button>
        </div>
      </form>
    </div>
  );
}
