"use client";

// The truck has stopped and the app is open: say so, out loud, wherever the
// crew are in the app.
//
// The "Are you alright?" question used to live only inside the trip's own
// screen, and only showed there. A driver on the list, the calendar or their
// profile - or with the trip open but the phone face down on the seat - was asked
// nothing until the office's schedule pushed them, and Android throws away a push
// that arrives while the app is in front. So the one situation this exists for,
// a truck standing still with the app running, was the one where the phone said
// nothing.
//
// This watches from the crew portal itself, so it runs on every crew screen.
// It opens the question, with a sound, in three cases:
//
//   the phone posting this trip's positions sees no movement for fifteen
//   minutes, and again at every rung after that until somebody answers;
//
//   a stall push arrives while the app is open (PushNotifications hands it
//   over instead of letting Android drop it);
//
//   the crew open a stall alert, from the notification or the bell, which
//   arrives here as ?trip=...&checkin=1.
//
// It is a sheet, not a modal: it sits over the bottom of the screen, can be
// closed, and never stands between a driver and their job. Closing it quietens
// it until the next rung, not for good.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import StallCheckInPrompt from "@/components/crew/StallCheckInPrompt";
import { trackedTripID } from "@/app/crew/dashboard/_components/liveTracking";
import { lastMovedAt, minutesSinceMove } from "@/app/lib/trackingPulse";
import { askCrew, soundTheAlarm, STALL_ASK_EVENT, type StallAsk } from "@/app/lib/stallAsk";
import { STALL_THRESHOLDS_MIN } from "@/app/lib/stallRules";

/**
 * What has already been raised, kept for as long as the app is.
 *
 * A rung is keyed by the moment the truck last moved, so a new stop is a new
 * set of questions and the same stop is asked once per rung. An answer quietens
 * the rest of that stop: from then on it is the office's schedule that decides
 * when to ask again - it does, half an hour later - and its push still opens
 * this, answered or not.
 */
const raised = new Set<string>();
const answered = new Set<string>();

function rungFor(minutes: number | null): number | null {
  if (minutes === null) return null;
  return [...STALL_THRESHOLDS_MIN].reverse().find((rung) => minutes >= rung) ?? null;
}

export default function StallWatch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [ask, setAsk] = useState<(StallAsk & { key: number }) | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Every ask arrives here, whatever raised it.
  useEffect(() => {
    const onAsk = (event: Event) => {
      const detail = (event as CustomEvent<StallAsk>).detail;
      if (!detail?.trip) return;
      soundTheAlarm();
      setAsk({ ...detail, key: Date.now() });
    };
    window.addEventListener(STALL_ASK_EVENT, onAsk);
    return () => window.removeEventListener(STALL_ASK_EVENT, onAsk);
  }, []);

  // This phone's own clock. Only the phone posting positions has one, which is
  // why the office's push matters too: a helper's phone is told by that.
  useEffect(() => {
    const check = () => {
      const trip = trackedTripID();
      if (!trip) return;
      const movedAt = lastMovedAt(trip);
      const rung = rungFor(minutesSinceMove(trip));
      if (movedAt === null || rung === null) return;

      const stop = `${trip}:${movedAt}`;
      const key = `${stop}:${rung}`;
      if (answered.has(stop) || raised.has(key)) return;
      raised.add(key);
      askCrew({ trip, from: "phone" });
    };

    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Opened from a stall alert: the link names the trip and asks the question.
  // Taken off the address once handled, so a reload does not ask again.
  const linkTrip = searchParams.get("checkin") === "1" ? searchParams.get("trip") : null;
  useEffect(() => {
    if (!linkTrip) return;
    askCrew({
      trip: linkTrip,
      from: "office",
      title: "Are you alright?",
      body: "The office has not seen your truck move.",
    });
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("checkin");
    rest.delete("trip");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [linkTrip, pathname, router, searchParams]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const onAnswered = useCallback(() => {
    if (!ask) return;
    const movedAt = lastMovedAt(ask.trip);
    if (movedAt !== null) answered.add(`${ask.trip}:${movedAt}`);
    // Long enough to read the thank-you, then out of the way.
    closeTimer.current = setTimeout(() => setAsk(null), 3_000);
  }, [ask]);

  if (!ask) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Are you alright?"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-[calc(var(--safe-bottom,0px)+16px)] pt-2 pointer-events-none"
    >
      <div className="mx-auto max-w-lg pointer-events-auto shadow-2xl rounded-xl bg-white">
        <StallCheckInPrompt
          key={ask.key}
          dispatchID={ask.trip}
          force
          heading={ask.title && ask.body ? { title: ask.title, body: ask.body } : null}
          onAnswered={onAnswered}
          onDismiss={() => setAsk(null)}
        />
      </div>
    </div>
  );
}
