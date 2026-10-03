"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Medal, Trophy } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";

// Each role's employees, best first, by the rating on their own profile.
//
// One role at a time, on purpose: a mechanic's repairs and a coordinator's
// assignments are not one scale. Anyone with too little on record to rate is
// listed under the ranking with the reason, rather than ranked last - being new
// is not the same as being worst.

const ROLES = ["Driver", "Helper", "Mechanic", "Coordinator", "Admin"] as const;
type Role = (typeof ROLES)[number];

interface Ranked {
  employeeID: string;
  employeeName: string;
  rating: number | null;
  ratingRange: { low: number; high: number } | null;
  withheld: string | null;
  evidence: string;
}

interface Ranking {
  role: string;
  windowLabel: string;
  ranked: Ranked[];
  unrated: Ranked[];
}

/** The same colours the profile's rating uses. */
function tone(rating: number): string {
  if (rating >= 4.5) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (rating >= 3.5) return "bg-blue-50 text-blue-700 border-blue-200";
  if (rating >= 2.5) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

const MEDALS = ["text-amber-500", "text-slate-400", "text-orange-700"];

export function RankingsView({ onOpen }: { onOpen: (employeeID: string) => void }) {
  const [role, setRole] = useState<Role>("Driver");
  const [allTime, setAllTime] = useState(false);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const result = await apiFetch<{ data: Ranking }>(
        `/api/employees/rankings?role=${role}&days=${allTime ? "all" : "180"}`,
      );
      setRanking(result.data);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the rankings.");
      setState("error");
    }
  }, [role, allTime]);

  useEffect(() => {
    // The ranking arrives in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Performance Rankings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Each role is ranked only against its own. {ranking ? ranking.windowLabel : ""}
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
          {/* Wraps rather than scrolls, so every role is in sight. */}
          <div className="flex flex-wrap items-center gap-2">
            {ROLES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  role === option
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                {option}s
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5 self-start xl:self-auto">
            {[
              [false, "Last 180 days"],
              [true, "All time"],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setAllTime(value as boolean)}
                className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  allTime === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>
      </div>

      {state === "loading" ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Working out the {role.toLowerCase()} rankings...
        </div>
      ) : state === "error" || !ranking ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-slate-700">{message}</p>
          <button type="button" onClick={() => void load()} className="mt-3 text-xs font-semibold text-blue-600 hover:underline">
            Try again
          </button>
        </div>
      ) : (
        <div className="px-4 sm:px-6 pb-4">
          {ranking.ranked.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No {role.toLowerCase()} has enough on record to be rated yet.
            </p>
          ) : (
            <table className="w-full text-left border-collapse my-2">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-3 w-14 text-center">#</th>
                  <th className="py-3.5 px-3">Employee</th>
                  <th className="py-3.5 px-3 text-center w-24">Rating</th>
                  <th className="hidden sm:table-cell py-3.5 px-3">Likely range</th>
                  <th className="hidden md:table-cell py-3.5 px-3 text-right">Based on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {ranking.ranked.map((entry, index) => (
                  <tr
                    key={entry.employeeID}
                    data-pressable
                    onClick={() => onOpen(entry.employeeID)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-3 text-center font-bold text-slate-700">
                      {index < 3 ? (
                        <Medal className={`w-5 h-5 mx-auto ${MEDALS[index]}`} aria-label={`Rank ${index + 1}`} />
                      ) : (
                        index + 1
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-medium text-slate-900">{entry.employeeName}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block min-w-12 px-2 py-0.5 rounded-md border text-sm font-bold ${tone(entry.rating ?? 0)}`}>
                        {entry.rating?.toFixed(1)}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell py-3.5 px-3 text-xs text-slate-500">
                      {entry.ratingRange
                        ? `${entry.ratingRange.low.toFixed(1)} - ${entry.ratingRange.high.toFixed(1)}`
                        : "—"}
                    </td>
                    <td className="hidden md:table-cell py-3.5 px-3 text-xs text-slate-500 text-right">{entry.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {ranking.unrated.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Not rated yet ({ranking.unrated.length})
              </p>
              <ul className="divide-y divide-slate-100">
                {ranking.unrated.map((entry) => (
                  <li
                    key={entry.employeeID}
                    onClick={() => onOpen(entry.employeeID)}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 cursor-pointer hover:bg-slate-50/80 px-2 rounded-lg"
                  >
                    <span className="text-sm font-medium text-slate-800">{entry.employeeName}</span>
                    <span className="text-xs text-slate-500 sm:text-right sm:max-w-md">{entry.withheld}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
