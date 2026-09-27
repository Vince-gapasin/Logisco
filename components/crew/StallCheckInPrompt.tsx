"use client";

// "Are you alright?" - asked on the truck, answered in one tap.
//
// The office has always been told at thirty minutes that "the crew have been
// asked to get in touch". This is the first thing that lets them answer.
//
// It appears only when this device has actually stopped getting positions
// through, because that is the only moment the question makes sense. It is not a
// modal, it cannot be the thing between a driver and their job, and it is
// dismissable - a driver who ignores it is not punished for it, they simply get
// a phone call from the office instead, which is the old behaviour.
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
import { minutesSincePing } from "@/app/lib/trackingPulse";
import { CHECK_IN_LABELS, STALL_THRESHOLDS_MIN, type CheckInState } from "@/app/lib/stallRules";

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

export default function StallCheckInPrompt({ dispatchID }: { dispatchID: string | number }) {
  const [silentFor, setSilentFor] = useState<number | null>(null);
  const [sending, setSending] = useState<CheckInState | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Checked on a timer rather than on every render: the answer changes once a
  // minute at most, and reading a clock during render makes the render impure.
  useEffect(() => {
    const read = () => setSilentFor(minutesSincePing());
    read();

    const timer = setInterval(read, 30_000);
    return () => clearInterval(timer);
  }, []);

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
      } catch {
        setError("No signal. Try again when you have one.");
      } finally {
        setSending(null);
      }
    },
    [dispatchID],
  );

  // Nothing to ask about: either this device has never reported, or it is
  // reporting normally, which means the truck is moving.
  if (dismissed || silentFor === null || silentFor < ASK_AFTER_MIN) return null;

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
          <p className="text-sm font-semibold text-slate-900">Are you alright?</p>
          <p className="text-xs text-slate-600 mt-0.5">
            We have not had your position for {silentFor} minutes. One tap and the office will stop
            chasing it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 shrink-0"
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
