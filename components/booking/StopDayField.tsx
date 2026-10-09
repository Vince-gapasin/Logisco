"use client";

import { useState } from "react";
import { daysBetween, isRealDate } from "@/app/lib/bookingRules";

// The day a stop on the booking form is due, under its time.
//
// Most bookings are one day, so a stop shows which day it falls on and asks for
// nothing more. A run of several days - up to a week - is written by choosing
// "Change day" on the stop that moves to a later day; every stop after it
// follows it until one is changed again. The first stop never shows the
// choice: its day is the booking's Delivery Schedule.

interface StopDayFieldProps {
  /** The day this stop resolves to, own or followed; empty while there is no booking date. */
  date: string;
  /** The date set on this row, or "" when it follows the stop before it. */
  own: string;
  /** The booking's first day, for "Day 2". */
  firstDay: string;
  /** Earliest choosable: the day of the stop before it. */
  min: string;
  /** Latest choosable: the last day the run may reach. */
  max: string;
  /** False for the first stop, whose day is the booking's. */
  canChange: boolean;
  onChange: (value: string) => void;
  error?: string;
}

/** "2026-10-10" as "Sat, Oct 10", read as that calendar day wherever it is shown. */
function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function StopDayField({ date, own, firstDay, min, max, canChange, onChange, error }: StopDayFieldProps) {
  // Open is its own state, not "has a date": a date box reports "" while a day
  // is half typed, and closing on that would snatch the box away mid-entry.
  const [open, setOpen] = useState(Boolean(own));
  const editing = canChange && (open || Boolean(own));
  if (!firstDay || !isRealDate(firstDay)) return null;
  const label = isRealDate(date) ? `Day ${daysBetween(firstDay, date) + 1} · ${dayLabel(date)}` : null;

  return (
    <div className="mt-1 text-[11px] leading-tight">
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="Day this stop is due"
            value={own}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            className={`min-w-0 flex-1 border rounded px-1 py-0.5 ${error ? "border-red-500 bg-red-50" : "border-slate-200"}`}
          />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChange("");
            }}
            className="shrink-0 text-blue-700 hover:underline"
          >
            Same day
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-slate-500">
          {label && <span>{label}</span>}
          {canChange && label && (
            // Starts the picker on the day it already falls on, so choosing
            // the next day is one step, not a hunt from today.
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                onChange(date);
              }}
              className="text-blue-700 hover:underline"
            >
              Change day
            </button>
          )}
        </div>
      )}
      {editing && label && <p className="mt-0.5 text-slate-500">{label}</p>}
      {error && <p className="mt-0.5 text-red-600">{error}</p>}
    </div>
  );
}
