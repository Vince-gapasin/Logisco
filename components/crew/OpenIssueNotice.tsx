"use client";

// What the crew reported and have not cleared, and the one tap that clears it.
//
// A crew could report a problem they were able to carry on through - the wrong
// product collected, a receiver who was not there - and then had no way of
// saying it was sorted. Only the office's Close button could, so the report sat
// open on their screen, and the client went on being shown a problem that no
// longer existed for the rest of the delivery.
//
// They are the ones who know it is sorted. They were standing there.
//
// Only issues appear here. A foul trip is not theirs to clear: the truck is off
// the road and a recovery is being arranged around it, so a "sorted" tap would
// take it off the list somebody is working from. The server refuses that too.

import { useCallback, useState } from "react";
import { Check, CircleAlert } from "lucide-react";
import { authFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";

interface OpenIssue {
  incidentID: string;
  issueType: string;
  details: string | null;
  reportedAt: string;
}

/** How long ago they said it, in the words somebody would use. */
function howLongAgo(at: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export default function OpenIssueNotice({
  dispatchID,
  onResolved,
}: {
  dispatchID: string | number;
  onResolved?: (message: string) => void;
}) {
  const [issues, setIssues] = useState<OpenIssue[]>([]);
  const [clearing, setClearing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await authFetch(
        `/api/crew/dispatches/issue?dispatchID=${encodeURIComponent(String(dispatchID))}`,
      );
      if (!response.ok) return;
      const body = (await response.json()) as { issues?: OpenIssue[] };
      setIssues(body.issues ?? []);
    } catch {
      // Nothing to say. The card simply does not appear, which is what the
      // screen looked like before it existed.
    }
  }, [dispatchID]);

  usePolling(() => void load(), 60000);

  const clear = async (issue: OpenIssue) => {
    setClearing(issue.incidentID);
    setError(null);
    try {
      const response = await authFetch("/api/crew/dispatches/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispatchID: String(dispatchID), incidentID: issue.incidentID }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(body?.message ?? "Could not record that. Try again.");
        return;
      }

      // Gone from this screen straight away; the poll would take a minute and
      // the crew would tap it again in the meantime.
      setIssues((previous) => previous.filter((row) => row.incidentID !== issue.incidentID));
      onResolved?.(body?.message ?? "Marked as sorted.");
    } catch {
      setError("No signal. Try again when you have one.");
    } finally {
      setClearing(null);
    }
  };

  if (issues.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <CircleAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {issues.length === 1 ? "You reported a problem" : "You reported some problems"}
          </p>
          <p className="text-xs text-slate-700 mt-0.5">
            The office and your customer can both see this. Tell us once it is sorted so it stops
            being shown.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {issues.map((issue) => (
          <li
            key={issue.incidentID}
            className="rounded-lg bg-white border border-amber-200 p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{issue.issueType}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {issue.details ? `${issue.details} · ` : ""}
                {howLongAgo(issue.reportedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void clear(issue)}
              disabled={clearing === issue.incidentID}
              className="min-h-tap sm:pointer-fine:min-h-0 px-4 py-2.5 sm:py-2 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <Check className="w-4 h-4 shrink-0" />
              {clearing === issue.incidentID ? "Saving..." : "This is sorted"}
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
