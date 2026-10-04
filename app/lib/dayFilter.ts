import { todayInManila } from "@/app/lib/datetime";

// Narrowing a booking list by its delivery day. The booking feeds could only
// be searched by text, so "what is going out tomorrow" meant reading every row.

export const DAY_FILTERS = ["Any day", "Today", "Tomorrow", "Next 7 days", "Past 7 days", "This month"] as const;
export type DayFilter = (typeof DAY_FILTERS)[number];

const DAY = 864e5;

function shift(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10);
}

/** Whether a booking delivered on `deliveryDay` (YYYY-MM-DD) falls in the chosen range. */
export function matchesDayFilter(deliveryDay: string | null | undefined, filter: DayFilter, today = todayInManila()): boolean {
  if (filter === "Any day") return true;
  const day = (deliveryDay ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  switch (filter) {
    case "Today":
      return day === today;
    case "Tomorrow":
      return day === shift(today, 1);
    case "Next 7 days":
      return day >= today && day <= shift(today, 6);
    case "Past 7 days":
      return day <= today && day >= shift(today, -6);
    case "This month":
      return day.slice(0, 7) === today.slice(0, 7);
    default:
      return true;
  }
}
