import { CalendarDays, ChevronDown } from "lucide-react";

// The period a rating covers. Shared by the profile's Performance tab and the
// rankings so both offer the same choices. The value is what the API's `days`
// parameter takes: a number of days, or "all".

export const PERIODS = [
  ["30", "Last 30 days"],
  ["90", "Last 3 months"],
  ["180", "Last 6 months"],
  ["365", "Last 12 months"],
  ["all", "All time"],
] as const;

export type Period = (typeof PERIODS)[number][0];

export const DEFAULT_PERIOD: Period = "180";

export function PeriodSelect({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Period</span>
      <CalendarDays className="pointer-events-none absolute left-2.5 w-4 h-4 text-slate-500" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Period)}
        className="min-h-tap md:pointer-fine:min-h-0 appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-blue-400 focus:outline-none cursor-pointer"
      >
        {PERIODS.map(([days, label]) => (
          <option key={days} value={days}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 w-4 h-4 text-slate-500" />
    </label>
  );
}
