"use client";

import { CalendarDays } from "lucide-react";
import { DAY_FILTERS, type DayFilter } from "@/app/lib/dayFilter";

/** A booking list's delivery-day filter, sitting beside its search box. */
export default function DayFilterSelect({
  value,
  onChange,
}: {
  value: DayFilter;
  onChange: (value: DayFilter) => void;
}) {
  return (
    <label className="relative w-full sm:w-44 shrink-0">
      <span className="sr-only">Delivery day</span>
      <CalendarDays className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as DayFilter)}
        className={`w-full appearance-none border text-sm rounded-xl pl-10 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer ${
          value === "Any day" ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-blue-50 border-blue-200 text-blue-800 font-semibold"
        }`}
      >
        {DAY_FILTERS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <svg className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
    </label>
  );
}
