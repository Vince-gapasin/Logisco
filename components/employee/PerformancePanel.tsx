"use client";

// One employee's record, as both they and their supervisor see it.
//
// Laid out to be read top to bottom in a few seconds: the verdict in one word
// and five stars, what they do well and what needs attention, then each measure
// as a card with its own plain verdict. The arithmetic - weights, likely range,
// the thresholds behind each time - is all still here, folded into "How is this
// score worked out?" at the bottom, so someone who disagrees with the number can
// still point at the line they disagree with.
//
// Below the measures is everything recorded but deliberately not scored:
// breakdowns, alerts, declines and excused delays. A driver who reports a broken
// truck is doing the job. If that cost them a star they would stop reporting,
// and the company would lose the only warning it gets.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Hourglass,
  Info,
  LifeBuoy,
  MapPin,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Siren,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Truck,
  UserPlus,
  Wrench,
} from "lucide-react";
import { authFetch } from "@/app/lib/apiClient";
import { formatDateTime } from "@/app/lib/datetime";
import { DECLINE_CODES, type DeclineCode } from "@/app/lib/enums";
import { rateVerdict, ratingVerdict, Stars } from "./ratingDisplay";

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
    ratingRange: { low: number; high: number } | null;
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
  /** A mechanic's, coordinator's or admin's rating; null for the crew. */
  roleRating: RoleRating | null;
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
    declines: { orderCode: string | null; reason: string | null; at: string | null; code: string | null; forCause: boolean }[];
    excusedStops: {
      branchName: string;
      reason: string;
      notes: string | null;
      minutesLate: number | null;
      excusedAt: string;
      excusedBy: string | null;
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

interface RoleRating {
  kind: "mechanic" | "office";
  measures: (ScoreComponent & { kind: "share" | "time" })[];
  rating: number | null;
  ratingRange: { low: number; high: number } | null;
  withheld: string | null;
  coverage: number;
  shown: { label: string; value: string; note?: string }[];
  evidence: string;
}

type Measure = ScoreComponent & { kind: "share" | "time" };

/** The crew's and the other roles' ratings, in one shape for the screen. */
interface Report {
  rating: number | null;
  ratingRange: { low: number; high: number } | null;
  withheld: string | null;
  coverage: number;
  measures: Measure[];
  stats: { label: string; value: string | number; note?: string }[];
  /** What the measures are about, for the fold-out. */
  about: string;
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

/**
 * Each measure in everyday words, with an icon and what its counts are counted
 * in. The server's own label and basis are kept for the fold-out.
 */
const PLAIN: Record<string, { name: string; means: string; icon: typeof Info; unit?: string }> = {
  // Drivers and helpers
  completion: { name: "Trips completed", means: "Took the trips offered and finished them", icon: Truck, unit: "trips" },
  responsiveness: { name: "Quick to respond", means: "How fast they answer a new trip", icon: Timer },
  evidence: { name: "Proof of delivery", means: "Uploaded proof at each stop delivered", icon: Camera, unit: "stops" },
  conduct: { name: "Client satisfaction", means: "Items arrived in good condition, crew was polite", icon: ThumbsUp },
  punctuality: { name: "On-time arrival", means: "Reached each stop within its scheduled time", icon: Clock, unit: "stops" },
  // Mechanics
  repairsHeld: { name: "Repairs that lasted", means: "No breakdown within 14 days of the fix", icon: Wrench, unit: "repairs" },
  documentation: { name: "Repair records complete", means: "Logs with a photo and written notes", icon: FileText, unit: "logs" },
  pickUp: { name: "Quick to start repairs", means: "Time to start on a grounded truck", icon: Timer },
  roadside: { name: "Roadside response", means: "Time to reach and assess a breakdown", icon: Siren },
  // Coordinators and admins
  assignmentNotice: { name: "Crews assigned early", means: "A day ahead, or within 2 h of a late booking", icon: CalendarCheck, unit: "assignments" },
  declineRecovery: { name: "Replacing declined crews", means: "Time to find a new crew after a decline", icon: RefreshCw },
  foulTripRecovery: { name: "Breakdown response", means: "Time to act after a breakdown is reported", icon: LifeBuoy },
  loginSetup: { name: "New staff set up", means: "New employees sent their login within 48 h", icon: UserPlus, unit: "new staff" },
};

const STAT_ICONS: Record<string, typeof Info> = {
  "Trips offered": Truck,
  "Trips finished": CheckCircle2,
  "Stops delivered": MapPin,
  "Client reviews": MessageSquare,
  "Repairs signed off": Wrench,
  "Typical repair time": Clock,
  "Roadside jobs": Siren,
  "Fixed on site": CheckCircle2,
  "Bookings created": ClipboardList,
  "Assignments made": CalendarCheck,
  "Overrides used": AlertTriangle,
  "Employees added": UserPlus,
};

const HEADLINES: Record<string, string> = {
  Excellent: "Top performer - keep it up",
  Good: "Doing well overall",
  Fair: "Doing okay, with room to improve",
  "Needs improvement": "Needs support to improve",
};

const percent = (rate: number) => `${Math.round(rate * 100)}%`;
const plain = (measure: Measure) =>
  PLAIN[measure.key] ?? { name: measure.label, means: measure.basis, icon: Info, unit: undefined };

/** "median 12 min to answer, ..." -> "12 min". */
const typicalTime = (detail: string | null) => detail?.match(/^median ([\d.]+ (?:min|h|days))/)?.[1] ?? null;

/** The one line of counts under a measure, in plain words. */
function evidenceLine(measure: Measure, feedbackResponses: number): string | null {
  if (measure.key === "conduct") {
    return feedbackResponses > 0 ? `From ${feedbackResponses} client review${feedbackResponses === 1 ? "" : "s"}` : null;
  }
  if (measure.kind === "time") {
    const typical = typicalTime(measure.detail);
    if (measure.numerator === 0) return null;
    return `${typical ? `Usually ${typical} · ` : ""}${measure.numerator} measured`;
  }
  if (measure.denominator === 0) return null;
  const unit = plain(measure).unit;
  return `${measure.numerator} of ${measure.denominator}${unit ? ` ${unit}` : ""}`;
}

function Section({
  title,
  icon: Icon,
  children,
  note,
  badge,
}: {
  title: string;
  icon: typeof Info;
  children: React.ReactNode;
  note?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white shadow-xs">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5 text-slate-500" />
        <h3 className="font-bold text-slate-900 text-base">{title}</h3>
        {badge}
      </div>
      {note && <p className="text-xs text-slate-500 mb-4">{note}</p>}
      {!note && <div className="mb-3" />}
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
    <li className="text-sm text-slate-600 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-slate-800">{stop.branchName}</span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
          {stop.minutesLate} min late
        </span>
        {stop.orderCode && <span className="text-xs text-slate-500">{stop.orderCode}</span>}

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
        <div className="mt-2 mb-1 rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
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
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
          />

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!reason || saving || (reason === "other" && notes.trim().length === 0)}
              className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
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

/** The period switch both views share. */
function PeriodToggle({ allTime, onChange }: { allTime: boolean; onChange: (allTime: boolean) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5">
      {[
        [false, "Last 180 days"],
        [true, "All time"],
      ].map(([value, label]) => (
        <button
          key={String(value)}
          type="button"
          onClick={() => onChange(value as boolean)}
          className={`min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            allTime === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {label as string}
        </button>
      ))}
    </div>
  );
}

/** The verdict: a big number, five stars and one word. */
function Headline({
  data,
  report,
  allTime,
  onPeriod,
}: {
  data: PerformanceData;
  report: Report;
  allTime: boolean;
  onPeriod: (allTime: boolean) => void;
}) {
  const { rating, withheld } = report;
  const verdict = rating === null ? null : ratingVerdict(rating);

  return (
    <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-lg font-bold text-slate-900">{data.employeeName}</div>
          <div className="text-xs text-slate-500">
            {data.role} · {data.window.label}
          </div>
        </div>
        <PeriodToggle allTime={allTime} onChange={onPeriod} />
      </div>

      {rating !== null && verdict ? (
        <div className={`flex flex-wrap items-center gap-5 rounded-xl border ${verdict.border} ${verdict.bg} p-4`}>
          <div className="flex items-baseline gap-1">
            <span className={`text-5xl font-extrabold leading-none ${verdict.text}`}>{rating.toFixed(1)}</span>
            <span className="text-sm font-medium text-slate-500">/ 5</span>
          </div>
          <div className="min-w-0">
            <Stars rating={rating} size="w-6 h-6" />
            <div className={`mt-1 text-xl font-bold ${verdict.text}`}>{verdict.word}</div>
            <div className="text-sm text-slate-600">{HEADLINES[verdict.word]}</div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Hourglass className="w-10 h-10 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xl font-bold text-slate-700">Not rated yet</div>
            <div className="text-sm text-slate-600">{withheld}</div>
          </div>
        </div>
      )}

      {data.window.widenedBecause && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {data.window.widenedBecause}
        </p>
      )}

      {/* The work behind it, so the number has a size. */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {report.stats.map((stat) => {
          const Icon = STAT_ICONS[stat.label] ?? Info;
          return (
            <div key={stat.label} className="rounded-lg bg-slate-50 px-3 py-2.5" title={stat.note}>
              <Icon className="w-4 h-4 text-slate-400 mb-1" />
              <div className="text-2xl font-bold text-slate-900 leading-tight">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** What they do well and what needs attention, taken from the scored measures. */
function StrengthsAndGaps({ measures }: { measures: Measure[] }) {
  const scored = measures.filter((measure) => measure.scored && measure.rate !== null);
  if (scored.length === 0) return null;

  const strengths = scored.filter((measure) => measure.rate! >= 0.9).sort((a, b) => b.rate! - a.rate!);
  const gaps = scored.filter((measure) => measure.rate! < 0.75).sort((a, b) => a.rate! - b.rate!);

  const list = (items: Measure[], tone: string) => (
    <ul className="space-y-1.5">
      {items.map((measure) => (
        <li key={measure.key} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-800">{plain(measure).name}</span>
          <span className={`font-bold ${tone}`}>{percent(measure.rate!)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center gap-2 mb-2 font-bold text-emerald-800">
          <ThumbsUp className="w-5 h-5" /> Doing well
        </div>
        {strengths.length > 0 ? (
          list(strengths, "text-emerald-700")
        ) : (
          <p className="text-sm text-slate-600">Nothing stands out yet.</p>
        )}
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-center gap-2 mb-2 font-bold text-amber-800">
          <AlertTriangle className="w-5 h-5" /> Needs attention
        </div>
        {gaps.length > 0 ? (
          list(gaps, "text-amber-700")
        ) : (
          <p className="text-sm text-slate-600">Nothing below par. Well done.</p>
        )}
      </div>
    </div>
  );
}

/** One measure as a card: what it is, how they did, in a word. */
function MeasureCard({ measure, feedbackResponses }: { measure: Measure; feedbackResponses: number }) {
  const { name, means, icon: Icon } = plain(measure);
  const counted = measure.scored && measure.rate !== null;
  const verdict = counted ? rateVerdict(measure.rate!) : null;
  const evidence = evidenceLine(measure, feedbackResponses);

  return (
    <div
      className={`rounded-xl border p-4 ${
        verdict ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            verdict ? `${verdict.bg} ${verdict.text}` : "bg-slate-100 text-slate-400"
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{name}</div>
          <div className="text-xs text-slate-500">{means}</div>
        </div>
        <div className="text-right shrink-0">
          {verdict ? (
            <div className={`text-2xl font-bold leading-none ${verdict.text}`}>{percent(measure.rate!)}</div>
          ) : (
            <div className="text-2xl font-bold leading-none text-slate-300">--</div>
          )}
        </div>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        {verdict && (
          <div className={`h-full rounded-full ${verdict.bar}`} style={{ width: percent(measure.rate!) }} />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {verdict ? (
          <span className={`rounded-full border ${verdict.border} ${verdict.bg} px-2 py-0.5 text-xs font-semibold ${verdict.text}`}>
            {verdict.word}
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
            Not counted yet
          </span>
        )}
        {evidence && <span className="text-xs text-slate-500">{evidence}</span>}
      </div>

      {!verdict && measure.why && <p className="mt-2 text-xs text-slate-500">{measure.why}</p>}
    </div>
  );
}

/** Everything behind the number, folded away until someone asks. */
function HowItsWorkedOut({ report, data }: { report: Report; data: PerformanceData }) {
  const { rating, ratingRange, coverage, measures } = report;

  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
        <ShieldCheck className="w-5 h-5 text-slate-500" />
        How is this score worked out?
        <ChevronDown className="ml-auto w-4 h-4 text-slate-500 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-slate-100 p-4 text-xs text-slate-600">
        <p>{report.about}</p>

        {rating !== null && (
          <ul className="list-disc space-y-1 pl-5">
            {ratingRange && (
              <li>
                On this much evidence the true rating is likely between{" "}
                <span className="font-semibold text-slate-800">
                  {ratingRange.low.toFixed(1)} and {ratingRange.high.toFixed(1)}
                </span>
                .
              </li>
            )}
            <li>
              Based on {percent(coverage)} of the intended measures
              {coverage < 1 ? "; the rest do not have enough data yet and their weight moves to the others" : ""}.
            </li>
          </ul>
        )}

        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-1.5 pr-2 font-semibold">Measure</th>
              <th className="py-1.5 px-2 font-semibold text-right">Result</th>
              <th className="py-1.5 pl-2 font-semibold text-right">Share of score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {measures.map((measure) => (
              <tr key={measure.key}>
                <td className="py-2 pr-2">
                  <div className="font-medium text-slate-800">{plain(measure).name}</div>
                  <div className="text-slate-500">
                    {measure.kind === "time"
                      ? `${measure.numerator} measured - ${measure.basis}`
                      : `${measure.numerator} of ${measure.denominator} ${measure.basis}`}
                  </div>
                  {measure.detail && <div className="text-slate-500">{measure.detail}</div>}
                  {measure.why && <div className="text-slate-500">{measure.why}</div>}
                </td>
                <td className="py-2 px-2 text-right font-semibold text-slate-800">
                  {measure.rate === null ? "No data" : percent(measure.rate)}
                </td>
                <td className="py-2 pl-2 text-right text-slate-500">
                  {measure.scored && rating !== null ? percent(measure.weight) : "Not counted"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {report.stats.some((stat) => stat.note) && (
          <ul className="list-disc space-y-1 pl-5">
            {report.stats
              .filter((stat) => stat.note)
              .map((stat) => (
                <li key={stat.label}>
                  <span className="font-medium text-slate-800">{stat.label}:</span> {stat.note}
                </li>
              ))}
          </ul>
        )}

        {data.company.notComparable.length > 0 && (
          <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
            Some measures are switched off for everybody because the company does not record them consistently
            yet. Nobody is marked down for a habit the company has not adopted; the weight moves to what is
            recorded.
          </p>
        )}

        <p className="flex items-start gap-2 text-slate-500">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Worked out fresh each time this is opened. Nothing here is stored as a score, so correcting a record
            corrects the number.
          </span>
        </p>
      </div>
    </details>
  );
}

/** A count that opens to its list. */
function IssueGroup({
  icon: Icon,
  title,
  count,
  defaultOpen = false,
  note,
  children,
}: {
  icon: typeof Info;
  title: string;
  count: number;
  defaultOpen?: boolean;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="font-semibold text-slate-800">{title}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{count}</span>
        <ChevronDown className="ml-auto w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 px-3 py-2">
        {note && <p className="text-xs text-slate-500 mb-1">{note}</p>}
        {children}
      </div>
    </details>
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

  // A role there are no measures for.
  if (!data.performance && !data.roleRating) {
    return (
      <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 text-center">
        <Info className="w-5 h-5 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-600 max-w-md mx-auto">{data.notRatedBecause}</p>
      </div>
    );
  }

  const isAdmin = data.role.toLowerCase() === "admin";
  const report: Report = data.performance
    ? {
        ...data.performance,
        measures: data.performance.components.map((component) => ({
          ...component,
          // Answering is judged on a typical time; the rest are shares.
          kind: component.key === "responsiveness" ? "time" : "share",
        })),
        stats: [
          { label: "Trips offered", value: data.performance.facts.tripsAssigned },
          { label: "Trips finished", value: data.performance.facts.tripsCompleted },
          { label: "Stops delivered", value: data.performance.facts.stopsCompleted },
          { label: "Client reviews", value: data.performance.facts.feedbackResponses },
        ],
        about:
          data.role.toLowerCase() === "helper"
            ? "Each measure is a share of the rating. Arriving on time, proof of delivery and the clients' verdict belong to the trip, so a helper shares them with whoever drove."
            : "Each measure is a share of the rating. A measure without enough data yet is not counted, and says why.",
      }
    : {
        ...data.roleRating!,
        stats: data.roleRating!.shown,
        about:
          data.roleRating!.kind === "mechanic"
            ? "Rated on the quality and care of their repairs and how quickly they get to a truck."
            : `Rated on how they run the deliveries${isAdmin ? " and set up new staff" : ""}, from what the system records them doing.`,
      };

  const feedbackResponses = data.performance?.facts.feedbackResponses ?? 0;

  return (
    <div className="space-y-5 text-sm">
      <Headline data={data} report={report} allTime={allTime} onPeriod={setAllTime} />

      <StrengthsAndGaps measures={report.measures} />

      <Section
        title="Score breakdown"
        icon={ShieldCheck}
        note="What the rating is made of. Green is great, blue is good, amber needs work, red is poor."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {report.measures.map((measure) => (
            <MeasureCard key={measure.key} measure={measure} feedbackResponses={feedbackResponses} />
          ))}
        </div>
      </Section>

      {data.performance && <CrewExtras data={data} onChanged={() => void load()} />}

      <HowItsWorkedOut report={report} data={data} />
    </div>
  );
}

/** The crew's late stops, reported problems and what clients wrote. */
function CrewExtras({ data, onChanged }: { data: PerformanceData; onChanged: () => void }) {
  const { reported, comments } = data;
  const feedbackResponses = data.performance?.facts.feedbackResponses ?? 0;

  const tiles: { icon: typeof Info; label: string; count: number; warn: boolean }[] = [
    { icon: Clock, label: "Late arrivals", count: reported.lateStops.length, warn: true },
    { icon: Wrench, label: "Breakdowns", count: reported.breakdowns.length, warn: false },
    { icon: Hourglass, label: "Truck stopped alerts", count: reported.stallAlerts, warn: false },
    { icon: ThumbsDown, label: "Trips declined", count: reported.declines.length, warn: false },
    { icon: ShieldCheck, label: "Delays excused", count: reported.excusedStops.length, warn: false },
  ];

  const praised = comments.filter((comment) => comment.goodCondition && comment.courteous).length;

  return (
    <>
      <Section
        title="Things to know"
        icon={Info}
        note="Only late arrivals affect the score (through On-time arrival). The rest is shown for context: reporting a problem is part of the job and is never held against anyone."
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          {tiles.map(({ icon: Icon, label, count, warn }) => (
            <div
              key={label}
              className={`rounded-lg px-3 py-2.5 ${
                count === 0 ? "bg-slate-50 text-slate-400" : warn ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <div className="text-2xl font-bold leading-tight">{count}</div>
              <div className="text-xs">{label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {reported.lateStops.length > 0 && (
            <IssueGroup
              icon={Clock}
              title="Late arrivals"
              count={reported.lateStops.length}
              defaultOpen={data.viewerCanExcuse}
              note={
                data.viewerCanExcuse
                  ? "If a delay was not the crew's doing, excuse it and it stops counting. The arrival time itself is never changed."
                  : undefined
              }
            >
              <ul className="divide-y divide-slate-100">
                {reported.lateStops.map((stop) => (
                  <LateStopRow
                    key={stop.branchID}
                    stop={stop}
                    canExcuse={data.viewerCanExcuse}
                    onExcused={onChanged}
                  />
                ))}
              </ul>
            </IssueGroup>
          )}

          {reported.breakdowns.length > 0 && (
            <IssueGroup icon={Wrench} title="Breakdowns on their trips" count={reported.breakdowns.length}>
              <ul className="space-y-1.5 py-1">
                {reported.breakdowns.map((breakdown, index) => (
                  <li key={`${breakdown.orderCode}-${index}`} className="text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{breakdown.orderCode ?? "Trip"}</span>
                    {" - "}
                    {breakdown.issueType}
                    <span className="text-xs text-slate-500"> · {formatDateTime(breakdown.reportedAt)}</span>
                  </li>
                ))}
              </ul>
            </IssueGroup>
          )}

          {reported.stallAlerts > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-600">
              <Hourglass className="w-4 h-4 shrink-0 text-slate-500" />
              <span>
                The truck went quiet {reported.stallAlerts} time{reported.stallAlerts === 1 ? "" : "s"} on their
                trips. That may be traffic, a long unload or a lost signal.
              </span>
            </p>
          )}

          {reported.declines.length > 0 && (
            <IssueGroup
              icon={ThumbsDown}
              title="Trips declined"
              count={reported.declines.length}
              note="A decline lowers Trips completed, except for safety reasons the company wants reported (an unsafe truck, a crew not fit to drive, the wrong licence). Those are marked “not counted”."
            >
              <ul className="space-y-1.5 py-1">
                {reported.declines.map((decline, index) => (
                  <li key={`${decline.orderCode}-${index}`} className="text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{decline.orderCode ?? "Trip"}</span>
                    {" - "}
                    {decline.code ? DECLINE_CODES[decline.code as DeclineCode] : null}
                    {decline.code && decline.reason?.trim() ? ": " : null}
                    {decline.reason?.trim() ||
                      (decline.code ? null : <span className="italic text-slate-500">no reason given</span>)}
                    {decline.forCause && (
                      <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        not counted
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </IssueGroup>
          )}

          {reported.excusedStops.length > 0 && (
            <IssueGroup icon={ShieldCheck} title="Delays the office excused" count={reported.excusedStops.length}>
              <ul className="space-y-1.5 py-1">
                {reported.excusedStops.map((excused, index) => (
                  <li key={`${excused.branchName}-${index}`} className="text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{excused.branchName}</span>
                    {" - "}
                    {excused.reason.replace(/_/g, " ")}
                    {excused.minutesLate !== null && excused.minutesLate > 0 && (
                      <span className="text-xs text-slate-500"> · {Math.round(excused.minutesLate)} min late</span>
                    )}
                    {excused.excusedBy && (
                      <span className="text-xs text-slate-500"> · excused by {excused.excusedBy}</span>
                    )}
                    {excused.notes && <span className="block text-xs text-slate-500">{excused.notes}</span>}
                  </li>
                ))}
              </ul>
            </IssueGroup>
          )}
        </div>
      </Section>

      <Section
        title="What clients said"
        icon={MessageSquare}
        badge={
          feedbackResponses > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
              {feedbackResponses} review{feedbackResponses === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        note={
          data.company.feedbackResponses === 0
            ? "No client has answered yet. Clients are asked two questions on their tracking page once a delivery is finished."
            : `Company-wide, ${percent(data.company.feedbackAverage)} of client answers are positive.`
        }
      >
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500">
            {feedbackResponses > 0 ? "No written comments yet." : "Nothing written yet."}
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-700">
              <span className="font-bold text-emerald-700">{praised}</span> of {comments.length} written comment
              {comments.length === 1 ? " was" : "s were"} fully positive.
            </p>
            <ul className="space-y-3">
              {comments.map((comment, index) => (
                <li key={`${comment.orderCode}-${index}`} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm text-slate-800">&ldquo;{comment.comment}&rdquo;</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <FeedbackChip good={comment.goodCondition} yes="Items in good condition" no="Condition problem" />
                    <FeedbackChip good={comment.courteous} yes="Polite crew" no="Crew not polite" />
                    <span className="text-slate-500">
                      {comment.orderCode ? `${comment.orderCode} · ` : ""}
                      {formatDateTime(comment.submittedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </>
  );
}

function FeedbackChip({ good, yes, no }: { good: boolean; yes: string; no: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
        good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {good ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
      {good ? yes : no}
    </span>
  );
}
