import { supabase } from "@/app/lib/supabase";
import { EMPLOYEE_ROLE } from "@/app/lib/enums";
import { getEmployeePerformance } from "@/services/employee/performanceService";

// Everybody in one role, best first, by the same rating their own profile shows.
//
// Only ever one role at a time. A mechanic's repairs and a coordinator's
// assignments are not on one scale, and ranking them against each other would
// be a number that means nothing.

export const RANKED_ROLES = [
  EMPLOYEE_ROLE.driver,
  EMPLOYEE_ROLE.helper,
  EMPLOYEE_ROLE.mechanic,
  EMPLOYEE_ROLE.coordinator,
  EMPLOYEE_ROLE.admin,
] as string[];

export interface RankedEmployee {
  employeeID: string;
  employeeName: string;
  /** 1 to 5, or null when there is too little to rate. */
  rating: number | null;
  ratingRange: { low: number; high: number } | null;
  /** Why there is no rating, when there is not. */
  withheld: string | null;
  /** How much work the rating rests on, in the role's own terms. */
  evidence: string;
}

export interface RoleRanking {
  role: string;
  windowLabel: string;
  /** Rated, best first. Position is the index plus one. */
  ranked: RankedEmployee[];
  /** Not rated yet, with the reason. Listed, not ranked. */
  unrated: RankedEmployee[];
}

// Rating a whole role reads every one of its records, so the answer is kept a
// few minutes rather than worked out again on every visit.
const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; ranking: RoleRanking }>();

export async function rankRole(role: string, windowDays: number | null): Promise<RoleRanking> {
  const key = `${role}|${windowDays ?? "all"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ranking;

  const { data, error } = await supabase
    .from("Employee")
    .select("employeeID, employeeName, role")
    .eq("role", role)
    .eq("isActive", true)
    .order("employeeName", { ascending: true });
  if (error) throw new Error(error.message);

  const people = (data ?? []) as { employeeID: string; employeeName: string }[];
  const results: RankedEmployee[] = [];
  let windowLabel = windowDays === null ? "All time" : `Last ${windowDays} days`;

  // A few at a time: each record is several queries of its own.
  for (let start = 0; start < people.length; start += 4) {
    const batch = await Promise.all(
      people.slice(start, start + 4).map(async (person) => {
        const record = await getEmployeePerformance(person.employeeID, { windowDays });
        if (record.performance) {
          const crew = record.performance;
          const trips = crew.facts.tripsCompleted;
          return {
            employeeID: person.employeeID,
            employeeName: person.employeeName,
            rating: crew.rating,
            ratingRange: crew.ratingRange,
            withheld: crew.withheld,
            evidence: `${trips} ${trips === 1 ? "trip" : "trips"}`,
            window: record.window.label,
          };
        }
        const other = record.roleRating;
        return {
          employeeID: person.employeeID,
          employeeName: person.employeeName,
          rating: other?.rating ?? null,
          ratingRange: other?.ratingRange ?? null,
          withheld: other?.withheld ?? record.notRatedBecause ?? "Not rated.",
          evidence: other?.evidence ?? "—",
          window: record.window.label,
        };
      }),
    );
    for (const { window, ...entry } of batch) {
      // A crew record widens to all time when the recent one is too thin; say so
      // if any of them did.
      if (window !== windowLabel && window === "All time") windowLabel = `${windowLabel} (widened where too thin)`;
      results.push(entry);
    }
  }

  const ranked = results
    .filter((entry) => entry.rating !== null)
    // Best first; between equals, the one we can be surer of; then by name.
    .sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (b.ratingRange?.low ?? 0) - (a.ratingRange?.low ?? 0) ||
        a.employeeName.localeCompare(b.employeeName),
    );
  const unrated = results.filter((entry) => entry.rating === null);

  const ranking = { role, windowLabel, ranked, unrated };
  cache.set(key, { at: Date.now(), ranking });
  return ranking;
}
