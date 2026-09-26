// When a truck has been silent long enough to be worth saying something about.
//
// Kept apart from the database so the rules can be read and tested on their
// own: what counts as stalled, at which point, and when to say nothing.
//
// A word about what this can honestly detect. The crew app posts a position
// every fifteen metres of movement and at no other time, so a truck that has
// stopped and a phone that has died send exactly the same thing: nothing.
// Until the app sends a heartbeat while stationary, "has not reported" is all
// we know, and the wording says so.

export const STALL_THRESHOLDS_MIN = [15, 30, 45] as const;
export type StallThreshold = (typeof STALL_THRESHOLDS_MIN)[number];

/**
 * How close to one of its own stops counts as being at it.
 *
 * Loading and unloading routinely take longer than the first threshold, so a
 * truck sitting at a stop on its own itinerary is doing its job, not stuck.
 */
export const AT_STOP_METRES = 200;

export interface StallInput {
  /** When the truck last reported a position. Null: it never has. */
  lastReportedAt: string | null;
  /** The trip's status. Only a trip on the road can stall. */
  status: string;
  /** Metres to the nearest stop still on this trip, when both are known. */
  metresToNearestStop: number | null;
  now?: Date;
}

export interface StallVerdict {
  stalled: boolean;
  /** Whole minutes since the last position, when there is one. */
  silentFor: number;
  /** The highest threshold passed, or null when none has been. */
  threshold: StallThreshold | null;
  /** Why nothing is being raised, for a screen that wants to explain itself. */
  reason:
    | "on the road"
    | "not on the road"
    | "never reported"
    | "at a stop"
    | "reporting";
}

/**
 * Whether this trip has gone quiet, and for how long.
 *
 * A trip that has never reported is not treated as stalled: it has not
 * started, or the crew app has never had the chance to speak. That is worth
 * knowing and is not this alarm.
 */
export function assessStall({
  lastReportedAt,
  status,
  metresToNearestStop,
  now = new Date(),
}: StallInput): StallVerdict {
  const quiet = (reason: StallVerdict["reason"], silentFor = 0): StallVerdict => ({
    stalled: false,
    silentFor,
    threshold: null,
    reason,
  });

  if (status !== "In Transit") return quiet("not on the road");
  if (!lastReportedAt) return quiet("never reported");

  const reportedAt = new Date(lastReportedAt).getTime();
  if (Number.isNaN(reportedAt)) return quiet("never reported");

  // A clock ahead of ours would otherwise read as a fresh position forever.
  const silentFor = Math.max(0, Math.floor((now.getTime() - reportedAt) / 60_000));

  // Sitting at one of its own stops is loading, not trouble.
  if (metresToNearestStop !== null && metresToNearestStop <= AT_STOP_METRES) {
    return quiet("at a stop", silentFor);
  }

  const passed = [...STALL_THRESHOLDS_MIN].reverse().find((minutes) => silentFor >= minutes) ?? null;
  if (!passed) return quiet("reporting", silentFor);

  return { stalled: true, silentFor, threshold: passed, reason: "on the road" };
}

export interface StallAlert {
  title: string;
  body: string;
  severity: "info" | "action" | "urgent";
  /** Whether the office should be pushed, or only shown it on the board. */
  notifyOffice: boolean;
  /** Whether to ask the crew themselves whether all is well. */
  askCrew: boolean;
}

/**
 * What each threshold is worth saying, and to whom.
 *
 * Fifteen minutes tells nobody. Most quarter-hour stops are traffic, a queue
 * at a gate, or a driver eating, and an alarm that cries wolf three times a
 * day is one nobody reads by Friday. It colours the trip on the board, where
 * somebody watching will see it, and goes no further.
 */
export function stallAlert(threshold: StallThreshold, tripLabel: string, silentFor: number): StallAlert {
  const quiet = `${tripLabel} has not reported its position for ${silentFor} minutes.`;

  if (threshold === 15) {
    return {
      title: "Truck has gone quiet",
      body: quiet,
      severity: "info",
      notifyOffice: false,
      askCrew: false,
    };
  }

  if (threshold === 30) {
    return {
      title: "Truck has not moved for half an hour",
      body: `${quiet} The crew have been asked to confirm they are alright.`,
      severity: "action",
      notifyOffice: true,
      askCrew: true,
    };
  }

  return {
    title: "Truck silent for 45 minutes",
    body: `${quiet} Nobody has heard from this trip. Call the driver, or report a foul trip if something has happened to it.`,
    severity: "urgent",
    notifyOffice: true,
    askCrew: true,
  };
}

/**
 * One key per trip, per threshold, per silence.
 *
 * The last reported time is in it on purpose: the same trip going quiet again
 * tomorrow is a new thing to say, while the same silence checked every ten
 * minutes for an hour is not.
 */
export function stallDedupeKey(dispatchID: string, threshold: StallThreshold, lastReportedAt: string): string {
  return `stalled:${dispatchID}:${threshold}:${lastReportedAt}`;
}
