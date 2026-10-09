"use client";

import { daysBetween, isRealDate } from "@/app/lib/bookingRules";
import { formatShortDay } from "@/app/lib/datetime";

// The day a stop on the booking form is due, under its time.
//
// Always shown, on every pickup and every delivery. It used to wait behind the
// Delivery Schedule further down the form and then hide behind a "Change day"
// link, so a coordinator filling the form from the top saw no date on any stop
// and reasonably concluded there was none.
//
// A stop starts on the same day as the stop before it, so a one-day booking is
// filled in without touching these. The first stop's day is the booking's day:
// changing it here changes the Delivery Schedule, and the reverse.

interface StopDayFieldProps {
  /** "Pickup Date" or "Delivery Date". */
  label: string;
  /** The day this stop falls on: its own, or the stop before it's. */
  date: string;
  /** The booking's first day, for "Day 2". */
  firstDay: string;
  /** Earliest choosable: the day of the stop before it. */
  min?: string;
  /** Latest choosable: the last day the run may reach. */
  max?: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function StopDayField({ label, date, firstDay, min, max, onChange, error }: StopDayFieldProps) {
  const later = isRealDate(firstDay) && isRealDate(date) && date > firstDay;

  return (
    <div className="mt-1.5">
      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
        {label}
        <input
          type="date"
          value={date}
          min={min || undefined}
          max={max || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-0.5 block w-full bg-transparent border rounded px-1.5 py-1 text-xs font-normal text-slate-900 ${
            error ? "border-red-500 bg-red-50" : "border-slate-200"
          }`}
        />
      </label>
      {/* Said only on a later day: on a one-day booking every stop is Day 1,
          and repeating it on every row is noise. */}
      {later && (
        <p className="text-[11px] leading-tight text-blue-700">
          Day {daysBetween(firstDay, date) + 1} · {formatShortDay(date)}
        </p>
      )}
      {error && <p className="mt-0.5 text-[11px] leading-tight text-red-600">{error}</p>}
    </div>
  );
}
