"use client";

// "Are you alright?" - asked on the truck, answered in one tap.
//
// The office has always been told at thirty minutes that "the crew have been
// asked to get in touch". This is the first thing that lets them answer.
//
// It appears when the truck has stopped moving, which is the moment the question
// makes sense. It is not a modal, it cannot be the thing between a driver and
// their job, and it is dismissable - a driver who ignores it is not punished for
// it, they simply get a phone call from the office instead, which is the old
// behaviour.
//
// It used to watch the contact clock instead, and so never appeared. markPing
// fires on every successful post and the heartbeat posts every three minutes
// whether or not the truck has moved, so on a working app the contact clock
// never reached fifteen. A driver who started a delivery and sat at the depot
// was asked nothing, the office was told nothing - the at-stop rule suppresses
// that case on purpose - and the customer heard nothing at all.
//
// Watching movement fixes all three at once: the driver is asked, and their
// answer is what the customer sees on the tracking page.
//
// The reason it matters more than it looks: Article 85 of the Labor Code
// requires at least sixty uninterrupted minutes for a meal, and the app reports
// only when the truck moves. So a lawful lunch break is indistinguishable from a
// breakdown and outlasts the fifteen, thirty and forty-five minute rungs put
// together. Without this button the urgent alert fires every working day at
// noon.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Coffee, Clock, PackageOpen, TrafficCone, Wrench, X } from "lucide-react";
import { authFetch } from "@/app/lib/apiClient";
import { minutesSinceMove, minutesSincePing } from "@/app/lib/trackingPulse";
import {
  CHECK_IN_LABELS,
  CONTACT_LOST_MIN,
  STALL_THRESHOLDS_MIN,
  type CheckInState,
} from "@/app/lib/stallRules";

/** The first rung: below this, nobody is asking anything. */
const ASK_AFTER_MIN = STALL_THRESHOLDS_MIN[0];

const OPTIONS: { state: CheckInState; icon: typeof Coffee; tone: string }[] = [
  { state: "on_break", icon: Coffee, tone: "border-slate-200 hover:border-slate-400" },
  { state: "traffic", icon: TrafficCone, tone: "border-slate-200 hover:border-slate-400" },
  { state: "waiting", icon: Clock, tone: "border-slate-200 hover:border-slate-400" },
  { state: "loading", icon: PackageOpen, tone: "border-slate-200 hover:border-slate-400" },
  { state: "vehicle_problem", icon: Wrench, tone: "border-amber-300 hover:border-amber-500 bg-amber-50/50" },
  { state: "need_help", icon: AlertTriangle, tone: "border-red-300 hover:border-red-500 bg-red-50/50" },
];

export default function StallCheckInPrompt({
  dispatchID,
  force = false,
  heading,
  onAnswered,
  onDismiss,
}: {
  dispatchID: string | number;
  /**
   * Show it whatever this phone's own clock says. For when the server has
   * already decided the crew should be asked - a helper's phone, or one whose
   * clock was lost, has no movement record of its own to wait for.
   */
  force?: boolean;
  /** What the office said, when it was the office that asked. */
  heading?: { title: string; body: string } | null;
  onAnswered?: (state: CheckInState) => void;
  onDismiss?: () => void;
}) {
  const [stillFor, setStillFor] = useState<number | null>(null);
  // Whether the movement figure can be trusted. If this phone has not reached
  // the server for a while, the last thing it heard is all it knows - the truck
  // may have been moving the whole time.
  const [outOfTouch, setOutOfTouch] = useState(false);
  const [sending, setSending] = useState<CheckInState | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Checked on a timer rather than on every render: the answer changes once a
  // minute at most, and reading a clock during render makes the render impure.
  useEffect(() => {
    const read = () => {
      // For this trip. Both clocks used to be about whichever trip last posted,
      // so the morning delivery answered for the afternoon one and a crew who
      // had just set off were asked why they had not moved.
      setStillFor(minutesSinceMove(dispatchID));
      const sincePing = minutesSincePing(dispatchID);
      setOutOfTouch(sincePing !== null && sincePing >= CONTACT_LOST_MIN);
    };
    read();

    const timer = setInterval(read, 30_000);
    return () => clearInterval(timer);
  }, [dispatchID]);

  const answer = useCallback(
    async (state: CheckInState) => {
      setSending(state);
      setError(null);

      try {
        const response = await authFetch("/api/crew/dispatches/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dispatch_id: String(dispatchID), state }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(result.message ?? "Could not send that. Try again.");
          return;
        }

        setSent(result.message ?? "Thank you.");
        onAnswered?.(state);
      } catch {
        setError("No signal. Try again when you have one.");
      } finally {
        setSending(null);
      }
    },
    [dispatchID, onAnswered],
  );

  // Nothing to ask about: either no position has landed yet for this trip, so
  // there is no baseline to measure from, or the truck is moving.
  if (dismissed) return null;
  if (!force && (stillFor === null || stillFor < ASK_AFTER_MIN)) return null;

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
        <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-900">{sent}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{heading?.title ?? "Still here?"}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {heading?.body ??
              (outOfTouch
                ? "We have lost signal from this phone, so the office cannot see where you are."
                : stillFor !== null
                  ? `The truck has not moved for ${stillFor} minutes.`
                  : "The office cannot see the truck moving.")}{" "}
            One tap tells the office why - and the customer sees the reason on their tracking page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          aria-label="Dismiss"
          className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-white/60 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(({ state, icon: Icon, tone }) => (
          <button
            key={state}
            type="button"
            onClick={() => void answer(state)}
            disabled={sending !== null}
            className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-800 transition-colors disabled:opacity-60 ${tone}`}
          >
            <Icon className="w-4 h-4 shrink-0 text-slate-500" />
            <span className="min-w-0">{sending === state ? "Sending..." : CHECK_IN_LABELS[state]}</span>
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
