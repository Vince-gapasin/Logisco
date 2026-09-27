"use client";

// One employee's record, as both they and their supervisor see it.
//
// The rating is the smallest part of this screen on purpose. A number on its own
// invites an argument nobody can settle, so every figure behind it is shown with
// the counts it came from and the share of the total it carries, and anything
// that did not count says why. Someone who disagrees with the number should be
// able to point at the line they disagree with.
//
// Below that is everything recorded but deliberately not scored: breakdowns,
// alerts, declines and excused delays. A driver who reports a broken truck is
// doing the job. If that cost them a star they would stop reporting, and the
// company would lose the only warning it gets.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  MessageSquare,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from "lucide-react";
import { authFetch } from "@/app/lib/apiClient";
import { formatDateTime } from "@/app/lib/datetime";

interface ScoreComponent {
  key: string;
  label: string;
  basis: string;
  rate: number | null;
  scored: boolean;
  weight: number;
  numerator: number;
  denominator: number;
  detail: string | null;
  why: string | null;
}

interface PerformanceData {
  employeeName: string;
  role: string;
  window: { days: number | null; label: string; widenedBecause: string | null };
  performance: {
    rating: number | null;
    withheld: string | null;
    coverage: number;
    components: ScoreComponent[];
    facts: {
      tripsAssigned: number;
      tripsAccepted: number;
      tripsDeclined: number;
      tripsCompleted: number;
      stopsCompleted: number;
      stopsJudged: number;
      feedbackResponses: number;
    };
  } | null;
  notRatedBecause: string | null;
  viewerCanExcuse: boolean;
  reported: {
    lateStops: {
      branchID: number;
      branchName: string;
      orderCode: string | null;
      minutesLate: number;
      completedAt: string | null;
    }[];
    breakdowns: { orderCode: string | null; issueType: string; reportedAt: string }[];
    stallAlerts: number;
    declines: { orderCode: string | null; reason: string | null; at: string | null }[];
    excusedStops: {
      branchName: string;
      reason: string;
      notes: string | null;
      minutesLate: number | null;
      excusedAt: string;
    }[];
  };
  comments: {
    orderCode: string | null;
    comment: string | null;
    goodCondition: boolean;
    courteous: boolean;
    submittedAt: string;
  }[];
  company: { feedbackAverage: number; feedbackResponses: number; notComparable: string[] };
}

// Mirrors services/employee/delayExcuseService.ts, which mirrors the table.
const EXCUSE_REASONS: [string, string][] = [
  ["client_not_ready", "Client was not ready to receive"],
  ["loading_delay", "Held up loading at the warehouse"],
  ["truck_breakdown", "Truck broke down"],
  ["weather", "Weather"],
  ["road_closure", "Road closed or blocked"],
  ["office_changed_plan", "We changed the plan"],
  ["other", "Other"],
];

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

/** Colour follows the number so the headline can be read at a glance. */
function ratingTone(rating: number): { text: string; ring: string; bg: string } {
  if (rating >= 4.5) return { text: "text-emerald-700", ring: "ring-emerald-100", bg: "bg-emerald-50" };
  if (rating >= 3.5) return { text: "text-blue-700", ring: "ring-blue-100", bg: "bg-blue-50" };
  if (rating >= 2.5) return { text: "text-amber-700", ring: "ring-amber-100", bg: "bg-amber-50" };
  return { text: "text-red-700", ring: "ring-red-100", bg: "bg-red-50" };
}

function Bar({ rate, scored }: { rate: number | null; scored: boolean }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${scored ? "bg-blue-500" : "bg-slate-300"}`}
        style={{ width: `${Math.round((rate ?? 0) * 100)}%` }}
      />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  note,
}: {
  title: string;
  icon: typeof Info;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
      <div className="border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="font-semibold text-slate-900 text-sm tracking-wide">{title}</span>
      </div>
      {note && <p className="text-xs text-slate-500 mb-3">{note}</p>}
      {children}
    </div>
  );
}

/**
 * One late stop, with the office's option to take it off the crew's record.
 *
 * The reason is required and the grant is audited, because this is the button
 * that makes a bad figure look better and it will be leaned on. Once granted it
 * appears in the excused list below, where the crew can see it too.
 */
function LateStopRow({
  stop,
  canExcuse,
  onExcused,
}: {
  stop: PerformanceData["reported"]["lateStops"][number];
  canExcuse: boolean;
  onExcused: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) return;

    setSaving(true);
    setError(null);

    try {
      const response = await authFetch(`/api/stops/${stop.branchID}/excuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, notes: notes.trim() || null }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.message ?? "Could not excuse this delay.");
        return;
      }

      setOpen(false);
      onExcused();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="text-xs text-slate-600">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium text-slate-800">{stop.branchName}</span>
        <span className="text-amber-700">{stop.minutesLate} min late</span>
        {stop.orderCode && <span className="text-slate-400">{stop.orderCode}</span>}

        {canExcuse && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-auto text-xs font-semibold text-blue-600 hover:underline"
          >
            Not the crew&apos;s fault
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-600">
            Why was this delay outside their control?
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-400 focus:outline-none"
            >
              <option value="">Choose a reason...</option>
              {EXCUSE_REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            placeholder={reason === "other" ? "Required: what happened?" : "Optional note"}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
          />

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!reason || saving || (reason === "other" && notes.trim().length === 0)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
            >
              {saving ? "Saving..." : "Excuse this delay"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function PerformancePanel({ employeeID }: { employeeID: string }) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [allTime, setAllTime] = useState(false);

  const load = useCallback(async () => {
    setState("loading");

    try {
      const response = await authFetch(
        `/api/employees/${employeeID}/performance?days=${allTime ? "all" : "180"}`,
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.message ?? "Could not load this record.");
        setState("error");
        return;
      }

      setData(result.data as PerformanceData);
      setState("ready");
    } catch {
      setMessage("Could not reach the server.");
      setState("error");
    }
  }, [employeeID, allTime]);

  useEffect(() => {
    // The record arrives in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        <span className="text-sm font-medium">Working out the record...</span>
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-slate-700">{message ?? "Could not load this record."}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // A role this does not describe - an admin, a coordinator, a mechanic.
  if (!data.performance) {
    return (
      <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 text-center">
        <Info className="w-5 h-5 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600 max-w-md mx-auto">{data.notRatedBecause}</p>
      </div>
    );
  }

  const { rating, withheld, components, facts } = data.performance;
  const tone = rating === null ? null : ratingTone(rating);
  const { reported, comments } = data;
  const nothingReported =
    reported.breakdowns.length === 0 &&
    reported.declines.length === 0 &&
    reported.excusedStops.length === 0 &&
    reported.lateStops.length === 0 &&
    reported.stallAlerts === 0;

  return (
    <div className="space-y-5 text-sm">
      {/* ---- The headline ---- */}
      <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {rating !== null && tone ? (
              <div
                className={`flex flex-col items-center justify-center h-20 w-20 rounded-2xl ring-4 ${tone.ring} ${tone.bg} shrink-0`}
              >
                <span className={`text-3xl font-bold leading-none ${tone.text}`}>{rating.toFixed(1)}</span>
                <span className="text-[10px] font-medium text-slate-500 mt-0.5">out of 5</span>
              </div>
            ) : (
              <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-slate-50 ring-4 ring-slate-100 shrink-0">
                <span className="text-2xl font-bold text-slate-300">--</span>
              </div>
            )}

            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-900">{data.employeeName}</div>
              <div className="text-xs text-slate-500">
                {data.role} · {data.window.label}
              </div>
              {withheld && <p className="text-xs font-medium text-amber-700 mt-1.5">{withheld}</p>}
              {rating !== null && (
                <p className="text-xs text-slate-500 mt-1">
                  Based on {percent(data.performance!.coverage)} of the intended measures
                  {data.performance!.coverage < 1 ? " - the rest are not counted, and say why below" : ""}.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5">
            {[
              [false, "Last 180 days"],
              [true, "All time"],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setAllTime(value as boolean)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  allTime === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>

        {data.window.widenedBecause && (
          <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            {data.window.widenedBecause}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
          {[
            ["Trips offered", facts.tripsAssigned],
            ["Finished", facts.tripsCompleted],
            ["Stops delivered", facts.stopsCompleted],
            ["Client answers", facts.feedbackResponses],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="text-lg font-bold text-slate-900">{value as number}</div>
              <div className="text-xs text-slate-500">{label as string}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- How the number was reached ---- */}
      <Section
        title="How this number was reached"
        icon={ShieldCheck}
        note="Every figure is shown with the counts behind it and the share of the rating it carries. A figure that did not count says why."
      >
        <div className="space-y-4">
          {components.map((component) => (
            <div key={component.key} className={component.scored ? "" : "opacity-70"}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-medium text-slate-900">{component.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className={`font-semibold ${component.scored ? "text-slate-900" : "text-slate-400"}`}>
                    {component.rate === null ? "No data" : percent(component.rate)}
                  </span>
                  {/* Pointless, and faintly absurd, next to a withheld rating. */}
                  {component.scored && rating !== null && (
                    <span className="text-xs text-slate-400">{percent(component.weight)} of the rating</span>
                  )}
                </span>
              </div>

              <div className="mt-1.5">
                <Bar rate={component.rate} scored={component.scored} />
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {component.denominator > 0 && (
                  <span>
                    {component.numerator} of {component.denominator} {component.basis}
                  </span>
                )}
                {component.detail && (
                  <span className="block mt-0.5 text-slate-400">{component.detail}</span>
                )}
                {component.why && (
                  <span className={component.denominator > 0 ? "block mt-0.5 text-slate-400" : "text-slate-400"}>
                    {component.why}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {data.company.notComparable.length > 0 && (
          <p className="mt-4 text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Some measures are switched off for everybody because the company does not record them
            consistently yet. Nobody is marked down for a habit the company has not adopted; the weight
            moves to what is recorded.
          </p>
        )}
      </Section>

      {/* ---- Recorded, never scored ---- */}
      <Section
        title="Recorded, but never scored"
        icon={AlertTriangle}
        note="None of this changes the rating. Somebody who reports a problem is doing their job, and a score that punished them for it would simply stop the reports."
      >
        {nothingReported ? (
          <p className="text-xs text-slate-500">Nothing reported in this period.</p>
        ) : (
          <div className="space-y-4">
            {reported.lateStops.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <Clock className="w-3.5 h-3.5" /> Stops that missed their slot ({reported.lateStops.length})
                </div>
                <p className="text-xs text-slate-400 mb-1.5">
                  These do count against the on-time figure. If one was not the crew&apos;s doing, say so and it
                  stops counting - the arrival time itself is never changed.
                </p>
                <ul className="space-y-1">
                  {reported.lateStops.map((stop) => (
                    <LateStopRow
                      key={stop.branchID}
                      stop={stop}
                      canExcuse={data.viewerCanExcuse}
                      onExcused={() => void load()}
                    />
                  ))}
                </ul>
              </div>
            )}

            {reported.breakdowns.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <Wrench className="w-3.5 h-3.5" /> Breakdowns on their trips ({reported.breakdowns.length})
                </div>
                <ul className="space-y-1">
                  {reported.breakdowns.map((breakdown, index) => (
                    <li key={`${breakdown.orderCode}-${index}`} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{breakdown.orderCode ?? "Trip"}</span>
                      {" - "}
                      {breakdown.issueType}
                      <span className="text-slate-400"> · {formatDateTime(breakdown.reportedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {reported.stallAlerts > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  <span className="font-semibold text-slate-700">{reported.stallAlerts}</span> stall alert
                  {reported.stallAlerts === 1 ? "" : "s"} raised on their trips - the truck went quiet, which may
                  be traffic, a long unload or a lost signal.
                </span>
              </div>
            )}

            {reported.declines.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <ThumbsDown className="w-3.5 h-3.5" /> Trips turned down ({reported.declines.length})
                </div>
                <p className="text-xs text-slate-400 mb-1.5">
                  These do lower the first figure above. Read the reasons before acting on it.
                </p>
                <ul className="space-y-1">
                  {reported.declines.map((decline, index) => (
                    <li key={`${decline.orderCode}-${index}`} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{decline.orderCode ?? "Trip"}</span>
                      {" - "}
                      {decline.reason?.trim() || <span className="italic text-slate-400">no reason given</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {reported.excusedStops.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Delays the office excused ({reported.excusedStops.length})
                </div>
                <ul className="space-y-1">
                  {reported.excusedStops.map((excused, index) => (
                    <li key={`${excused.branchName}-${index}`} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{excused.branchName}</span>
                      {" - "}
                      {excused.reason.replace(/_/g, " ")}
                      {excused.minutesLate !== null && excused.minutesLate > 0 && (
                        <span className="text-slate-400"> · {Math.round(excused.minutesLate)} min late</span>
                      )}
                      {excused.notes && <span className="block text-slate-500">{excused.notes}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ---- What clients wrote ---- */}
      <Section
        title="What clients said"
        icon={MessageSquare}
        note={
          data.company.feedbackResponses === 0
            ? "No client has answered yet. Clients are asked two questions on their tracking page once a delivery is finished."
            : `Across the company, ${percent(data.company.feedbackAverage)} of client answers have been positive. A thin score is pulled towards that figure rather than standing on one or two answers.`
        }
      >
        {comments.length === 0 ? (
          <p className="text-xs text-slate-500">
            {facts.feedbackResponses > 0
              ? `${facts.feedbackResponses} client answer${facts.feedbackResponses === 1 ? "" : "s"}, none with a written comment.`
              : "Nothing written yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment, index) => (
              <li key={`${comment.orderCode}-${index}`} className="border-l-2 border-slate-200 pl-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    {comment.goodCondition ? (
                      <ThumbsUp className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <ThumbsDown className="w-3 h-3 text-red-600" />
                    )}
                    condition
                  </span>
                  <span className="flex items-center gap-1">
                    {comment.courteous ? (
                      <ThumbsUp className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <ThumbsDown className="w-3 h-3 text-red-600" />
                    )}
                    conduct
                  </span>
                  <span className="text-slate-400">
                    {comment.orderCode ?? ""} · {formatDateTime(comment.submittedAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-1">{comment.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="flex items-start gap-2 text-xs text-slate-400 px-1">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Worked out fresh each time this is opened, from trips, stop times, proof of delivery and client
          answers. Nothing here is stored as a score, so correcting a record corrects the number.
        </span>
      </p>
    </div>
  );
}
