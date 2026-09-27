// When a truck has been silent long enough to be worth saying something about.
//
// Kept apart from the database so the rules can be read and tested on their
// own: what counts as stalled, at which point, what to say, and to whom.
//
// WHAT THIS CAN HONESTLY DETECT
//
// The crew app posts a position every fifteen metres of movement and at no
// other time, so all of these arrive as exactly the same thing - nothing:
//
//   the truck has stopped
//   Android killed the app to save battery
//   the driver swiped it away
//   the phone lost signal, or its battery died
//
// The alarm cannot tell them apart, and the last three are collectively more
// likely than the first. So the wording names both possibilities and asks for
// both to be checked, rather than sending somebody to look for a broken truck.
// It used to say "call the driver, or report a foul trip", which is the right
// advice for the one cause it cannot actually distinguish.
//
// Guessing the cause from the last reported speed was considered and dropped:
// speed is null on about nine pings in ten, so the guess would be "unknown"
// almost always and confidently wrong the rest of the time. The honest fix is a
// heartbeat - the app reporting every few minutes whether or not it has moved -
// which separates "stopped" from "out of contact" properly. That needs a new
// build of the app.

/**
 * The rungs, in minutes of silence.
 *
 * It used to stop at 45, which meant a truck missing for two days produced one
 * notification and then nothing, because the highest rung had already been
 * said. The upper rungs widen so that a long silence keeps being raised without
 * becoming a drumbeat.
 */
export const STALL_THRESHOLDS_MIN = [15, 30, 45, 120, 360] as const;
export type StallThreshold = (typeof STALL_THRESHOLDS_MIN)[number];

/**
 * Past this, a trip is not a stalled truck any more.
 *
 * A day of silence on a trip still marked In Transit almost always means the
 * delivery finished and nobody closed it. Chasing it as an emergency is wrong,
 * and it would otherwise sit in every check for ever. It gets its own, calmer
 * alert asking somebody to close the trip.
 */
export const LEFT_OPEN_AFTER_MIN = 24 * 60;

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
  /** Metres to the nearest stop on this trip, done or not, when both are known. */
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
    | "reporting"
    | "left open";
}

/**
 * A length of time as somebody would say it.
 *
 * The title used to name the threshold rather than the silence, so a truck that
 * had been quiet for 1,407 minutes was announced as "silent for 45 minutes"
 * while the body underneath gave the real figure. Whatever is shown, it is the
 * truth about this trip.
 */
export function describeSilence(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.round(minutes / 60);
  if (minutes < LEFT_OPEN_AFTER_MIN) return `${hours} hour${hours === 1 ? "" : "s"}`;

  // Rounded, not floored: a trip quiet for 2,701 minutes is nearly two days
  // gone, and calling that "1 day" is the same understatement this replaced.
  const days = Math.max(1, Math.round(minutes / LEFT_OPEN_AFTER_MIN));
  return `${days} day${days === 1 ? "" : "s"}`;
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

  // Sitting at one of its own stops is loading, not trouble. Every stop counts,
  // not only the ones still to come: a crew doing paperwork where they have
  // just delivered are where they are supposed to be.
  if (metresToNearestStop !== null && metresToNearestStop <= AT_STOP_METRES) {
    return quiet("at a stop", silentFor);
  }

  // A day of silence is a trip nobody closed, not a truck in trouble.
  if (silentFor >= LEFT_OPEN_AFTER_MIN) return quiet("left open", silentFor);

  const passed = [...STALL_THRESHOLDS_MIN].reverse().find((minutes) => silentFor >= minutes) ?? null;
  if (!passed) return quiet("reporting", silentFor);

  return { stalled: true, silentFor, threshold: passed, reason: "on the road" };
}

export interface StallMessage {
  title: string;
  body: string;
}

export interface StallAlert {
  severity: "info" | "action" | "urgent";
  /** Whether the office should be pushed, or only shown it on the board. */
  notifyOffice: boolean;
  /** What the office is told. */
  office: StallMessage;
  /**
   * What the crew are told, when they are told anything.
   *
   * Written separately because they used to receive the office's message word
   * for word: at forty-five minutes the driver was advised to "call the driver,
   * or report a foul trip", and at thirty they were informed that "the crew
   * have been asked to confirm they are alright".
   */
  crew: StallMessage | null;
}

/** Both things it could be, said in one breath. */
function bothCauses(label: string, silentFor: number): string {
  return (
    `${label} has not reported its position for ${describeSilence(silentFor)}. ` +
    `Either the truck has stopped or the app has lost contact - the two look the same from here.`
  );
}

const CREW_TITLE = "Are you alright?";

function askTheCrew(silentFor: number): StallMessage {
  return {
    title: CREW_TITLE,
    body:
      `We have not had your position for ${describeSilence(silentFor)}. ` +
      `If you are held up, waiting, or the truck has a problem, tell your coordinator so we can stop chasing it.`,
  };
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
  const quiet = bothCauses(tripLabel, silentFor);
  const forHowLong = describeSilence(silentFor);

  if (threshold === 15) {
    return {
      severity: "info",
      notifyOffice: false,
      office: { title: "Truck has gone quiet", body: quiet },
      crew: null,
    };
  }

  if (threshold === 30) {
    return {
      severity: "action",
      notifyOffice: true,
      office: {
        title: `No position for ${forHowLong}`,
        body: `${quiet} The crew have been asked to get in touch.`,
      },
      crew: askTheCrew(silentFor),
    };
  }

  if (threshold === 45) {
    return {
      severity: "urgent",
      notifyOffice: true,
      office: {
        title: `Silent for ${forHowLong}`,
        body:
          `${quiet} Call the driver. If you cannot reach them, treat it as a possible breakdown; ` +
          `if you reach them and all is well, the app may need restarting.`,
      },
      crew: askTheCrew(silentFor),
    };
  }

  if (threshold === 120) {
    return {
      severity: "urgent",
      notifyOffice: true,
      office: {
        title: `Still nothing after ${forHowLong}`,
        body:
          `${quiet} Nobody has heard from this trip in ${forHowLong}. ` +
          `If the driver cannot be reached, report a foul trip so a replacement can be arranged.`,
      },
      crew: askTheCrew(silentFor),
    };
  }

  return {
    severity: "urgent",
    notifyOffice: true,
    office: {
      title: `No contact for ${forHowLong}`,
      body:
        `${quiet} This has gone on for ${forHowLong}. Either report a foul trip, or close the trip ` +
        `if the delivery is in fact finished.`,
    },
    crew: askTheCrew(silentFor),
  };
}

/**
 * A trip still on the road a day later, which is almost always one that
 * finished without anybody closing it.
 *
 * Deliberately not urgent and deliberately not a stall: it is a tidying job,
 * and dressing it as an emergency is how people learn to ignore emergencies.
 */
export function leftOpenAlert(tripLabel: string, silentFor: number): StallMessage {
  return {
    title: "Trip still marked on the road",
    body:
      `${tripLabel} has been In Transit with no position for ${describeSilence(silentFor)}. ` +
      `If it was delivered, close it; if it was not, report a foul trip. Until then it stays on the fleet board.`,
  };
}

/**
 * One key per trip, per threshold, per silence, per audience.
 *
 * The last reported time is in it on purpose: the same trip going quiet again
 * tomorrow is a new thing to say, while the same silence checked every ten
 * minutes for an hour is not. The audience is in it because the office and the
 * crew are told different things and neither should silence the other.
 */
export function stallDedupeKey(
  dispatchID: string,
  threshold: StallThreshold,
  lastReportedAt: string,
  audience: "office" | "crew" = "office",
): string {
  return `stalled:${dispatchID}:${threshold}:${lastReportedAt}:${audience}`;
}

/**
 * One key per trip per day for the tidying alert, so it is a daily reminder
 * rather than one notification that scrolls away and is never seen again.
 */
export function leftOpenDedupeKey(dispatchID: string, now: Date): string {
  return `left-open:${dispatchID}:${now.toISOString().slice(0, 10)}`;
}
