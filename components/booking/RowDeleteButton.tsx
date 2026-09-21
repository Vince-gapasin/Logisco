"use client";

import React, { useState } from "react";
import { Trash2 } from "lucide-react";

// A row's trash button that asks first. The create forms removed a pickup or
// delivery the moment the icon was touched; the edit screens already asked,
// and this is the same prompt.
export default function RowDeleteButton({
  onConfirm,
  disabled = false,
  label = "address",
}: {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const [asking, setAsking] = useState(false);

  if (asking && !disabled) {
    return (
      <div className="flex flex-col gap-1.5 items-center bg-red-50 p-2 rounded-lg border border-red-100 min-w-35">
        <span className="text-xs sm:text-[10px] font-semibold text-red-700 text-center leading-tight">
          Are you sure you want to delete this {label}?
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              // Closed before the row goes, so the row that moves up into
              // this position does not inherit an open prompt.
              setAsking(false);
              onConfirm();
            }}
            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs sm:text-[10px] font-medium transition-colors cursor-pointer"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs sm:text-[10px] font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      disabled={disabled}
      aria-label={`Delete this ${label}`}
      className="p-1.5 hover:text-red-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
    >
      <Trash2 className="w-4 h-4 mx-auto" />
    </button>
  );
}
