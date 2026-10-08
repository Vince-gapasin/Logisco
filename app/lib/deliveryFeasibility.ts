// Whether a booking promises something a truck could actually do.
//
// WHAT THIS IS INSTEAD OF
//
// The first proposal was a flat rule: a booking must be at least three hours
// ahead of now. It constrains the wrong thing. Three hours is far too much for
// a drop across Makati and nowhere near enough for Batangas, and it measures
// from when the office typed rather than from anything about the delivery. A
// booking made three days early and assigned ten minutes before the window has
// the problem it was meant to catch; one made an hour ahead for a stop down the
// road does not.
//
// What can be checked instead is the promise itself. The itinerary says the
// crew will be at the first stop at one time and the last at another, and the
// road between them takes as long as it takes. If the gap is shorter than the
// drive, the booking is promising the truck will be in two places at once, and
// no amount of notice fixes that.
//
// AND GETTING THERE IN THE FIRST PLACE
//
// Every truck starts from the same yard, which makes the other half checkable
// too: how long it takes to reach the first stop is known, so a booking whose
// first stop is sooner than that drive is one nobody can make, however early
// they leave. That is the real version of "give us three hours' notice" - the
// same intent, measured against the road rather than against a number someone
// picked.

/** How long a stop takes once the truck is there, for everything but the last. */
export const STOP_ALLOWANCE_MIN = 20;

export type FeasibilityVerdict = "unknown" | "fine" | "tight" | "impossible";

export interface Feasibility {
  verdict: FeasibilityVerdict;
  /** What to tell the coordinator, when there is anything to tell them. */
  message: string | null;
  /** The gap the itinerary promises, in minutes. */
  windowMinutes: number | null;
  /** Driving time through the itinerary, when it could be worked out. */
  travelMinutes: number | null;
  /**
   * Minutes from now by which the truck has to leave the yard, when that can
   * be worked out. Negative means the moment has gone.
   */
  leaveInMinutes?: number | null;
}

export interface FeasibilityInput {
  /** Stop times in itinerary order, as HH:MM. */
  times: (string | null | undefined)[];
  /** Driving time through those stops, or null when it is not known. */
  travelMinutes: number | null;
  /** Names in the same order, for saying which stop is the problem. */
  labels?: string[];
  /** Driving time from the yard to the first stop, when it is known. */
  fromBaseMinutes?: number | null;
  /**
   * Driving time between each stop and the next, in itinerary order - one
   * fewer than there are stops. When given, every leg is checked on its own.
   */
  legMinutes?: number[] | null;
  /**
   * Minutes from now until the first stop. Negative when it has gone, null
   * when there is no date to measure from.
   */
  minutesUntilFirstStop?: number | null;
  /** Getting the truck out of the yard, on top of the drive. */
  departureBufferMin?: number;
}

const DAY_MIN = 24 * 60;

export interface Itinerary {
  /**
   * Each stop as minutes from midnight on the day the first one falls, so a
   * stop after midnight reads as 1505 rather than 65. Never decreases.
   */
  absolute: number[];
  /** Stop indexes that fall on a later day than the one before them. */
  crossings: number[];
  /**
   * Stop indexes promised for the same minute as the stop before them. Two
   * different addresses cannot both be visited at once, whatever the map says.
   */
  sameTime: number[];
  /** First stop to last, in minutes. */
  spanMinutes: number;
}

/**
 * The stops laid out on one continuous clock.
 *
 * WHY A CLOCK TIME ALONE IS NOT ENOUGH
 *
 * A stop carries a time and no date; the date lives once, on the order. So a
 * pickup at 21:05 followed by a drop at 03:05 is ambiguous on its face - it is
 * either six hours later or eighteen hours earlier, and nothing in the record
 * says which.
 *
 * This read it as earlier and refused the booking as out of order. That is the
 * wrong half of the ambiguity to believe. An overnight run is ordinary work:
 * collect at the end of one day, deliver at the start of the next. Reading it
 * as a mistake made a whole shift of normal deliveries impossible to book, and
 * the field went red on a time that was perfectly correct.
 *
 * So a stop earlier than the one before it rolls to the next day. Each stop is
 * placed at the first moment that time occurs at or after the previous stop.
 *
 * WHAT THAT GIVES UP, AND WHAT CATCHES IT INSTEAD
 *
 * A genuine typo - 03:05 for 15:05 - now goes through this step. It has to:
 * the two cases are indistinguishable from the record, and refusing both
 * refuses the real one. What still catches a bad time is the drive, which is
 * measured either way, and the note the coordinator is shown saying the
 * itinerary was read as running overnight.
 *
 * One midnight is all a booking can hold, because it carries one date. Two
 * means the times cannot be read as a single run however they are placed, and
 * that is a real contradiction rather than an ambiguity.
 */
export function buildItinerary(clock: number[]): Itinerary {
  const absolute: number[] = clock.length > 0 ? [clock[0]] : [];
  const crossings: number[] = [];
  const sameTime: number[] = [];
  let days = 0;

  for (let index = 1; index < clock.length; index += 1) {
    const previous = absolute[index - 1];
    // Same time as the stop before it is not a new day. Only going backwards
    // on the clock is, and a stop can only cross one midnight at a time.
    if (clock[index] + days * DAY_MIN < previous) {
      days += 1;
      crossings.push(index);
    }
    absolute.push(clock[index] + days * DAY_MIN);
    if (absolute[index] === previous) sameTime.push(index);
  }

  return {
    absolute,
    crossings,
    sameTime,
    spanMinutes: absolute.length > 1 ? absolute[absolute.length - 1] - absolute[0] : 0,
  };
}

/** HH:MM as minutes from midnight, or null when it is not a time. */
export function clockMinutes(clock: string | null | undefined): number | null {
  if (!clock) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(clock.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Two things worth saying, as one thing to read. */
function join(...parts: (string | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

function describe(minutes: number): string {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} minute${whole === 1 ? "" : "s"}`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  const hoursSaid = `${hours} hour${hours === 1 ? "" : "s"}`;
  return rest === 0 ? hoursSaid : `${hoursSaid} ${rest} min`;
}

/**
 * What the itinerary promises, against what the road allows.
 *
 * Three answers worth acting on, and one that is not an answer. "unknown" is
 * returned whenever a time is missing or the route could not be worked out -
 * an address that failed to geocode, a map service that did not reply - and the
 * booking goes through, because refusing a delivery on the strength of a
 * failed lookup would be worse than taking it.
 */
export function assessFeasibility(input: FeasibilityInput): Feasibility {
  const { travelMinutes, labels = [] } = input;
  const nothing: Feasibility = {
    verdict: "unknown",
    message: null,
    windowMinutes: null,
    travelMinutes,
  };

  const times = input.times.map(clockMinutes);
  if (times.length < 2 || times.some((time) => time === null)) return nothing;

  const clock = times as number[];

  // Laid out on one continuous clock, so a run that goes past midnight reads as
  // one that goes past midnight rather than as one promised backwards.
  const itinerary = buildItinerary(clock);

  // Two midnights cannot be a single day's work, and the booking holds one
  // date. This is the contradiction the old out-of-order check was reaching
  // for, stated as the thing that is actually wrong.
  if (itinerary.crossings.length > 1) {
    const second = itinerary.crossings[1];
    const later = labels[second] ?? `stop ${second + 1}`;
    const earlier = labels[second - 1] ?? `stop ${second}`;
    return {
      verdict: "impossible",
      message:
        `These times cannot be one run. ${later} would fall two days after the first stop ` +
        `to come after ${earlier}. Check the times on those two stops.`,
      windowMinutes: null,
      travelMinutes,
    };
  }

  // Two stops in the same minute. Their addresses are never the same - that is
  // refused on its own - so this is a promise to be in two places at once, and
  // it is refused without the map: a failed lookup used to wave it through,
  // and so did a wide enough window between the first stop and the last.
  if (itinerary.sameTime.length > 0) {
    const index = itinerary.sameTime[0];
    const later = labels[index] ?? `stop ${index + 1}`;
    const earlier = labels[index - 1] ?? `stop ${index}`;
    return {
      verdict: "impossible",
      message: `${later} and ${earlier} are booked for the same time. The truck cannot be at both - give ${later} a later time.`,
      windowMinutes: null,
      travelMinutes,
    };
  }

  const windowMinutes = itinerary.spanMinutes;
  const overnight = itinerary.crossings.length === 1;

  // Said on every verdict that is not a refusal, because the system resolved an
  // ambiguity the coordinator did not know was there. Silence would read as
  // agreement with whichever reading they had in mind.
  const overnightNote = overnight
    ? `Read as an overnight run: ${labels[itinerary.crossings[0]] ?? "a later stop"} is the ` +
      `following day, ${describe(windowMinutes)} after ${labels[0] ?? "the first stop"}. ` +
      `Change the times if that is not what was meant.`
    : null;

  // Can the truck get to the first stop at all?
  //
  // Checked before the itinerary itself, because it is the earlier failure and
  // the more common one: a delivery booked for this afternoon at a warehouse
  // three hours away is refused however well the rest of the route fits.
  const { fromBaseMinutes = null, minutesUntilFirstStop = null } = input;
  const buffer = input.departureBufferMin ?? 0;
  const leaveInMinutes =
    fromBaseMinutes !== null && minutesUntilFirstStop !== null
      ? minutesUntilFirstStop - fromBaseMinutes - buffer
      : null;

  if (fromBaseMinutes !== null && minutesUntilFirstStop !== null) {
    const first = labels[0] ?? "the first stop";

    if (minutesUntilFirstStop < 0) {
      return {
        verdict: "impossible",
        message: `${first} is booked for a time that has already gone.`,
        windowMinutes,
        travelMinutes,
        leaveInMinutes,
      };
    }

    if (minutesUntilFirstStop < fromBaseMinutes) {
      return {
        verdict: "impossible",
        message:
          `${first} is ${describe(minutesUntilFirstStop)} away and it is ` +
          `${describe(fromBaseMinutes)} from the yard. The truck cannot get there in time, ` +
          `however early it leaves.`,
        windowMinutes,
        travelMinutes,
        leaveInMinutes,
      };
    }
  }

  // Each leg on its own.
  //
  // Only the whole window used to be measured against the whole drive, so a
  // long day hid an impossible leg inside it: a pickup at 08:00, a drop two
  // hours away at 08:15 and a last drop at 17:00 is nine hours for three of
  // driving, and passed as "fine" with the 08:15 promise unkeepable. Every leg
  // is now held to its own drive, plus the time spent at the stop it leaves.
  const legs = input.legMinutes;
  if (legs && legs.length === clock.length - 1) {
    const gaps = legs.map((_, index) => itinerary.absolute[index + 1] - itinerary.absolute[index]);
    const name = (index: number) => labels[index] ?? `stop ${index + 1}`;

    const short = gaps.findIndex((gap, index) => gap < legs[index]);
    if (short !== -1) {
      return {
        verdict: "impossible",
        message:
          `${name(short + 1)} is booked ${describe(gaps[short])} after ${name(short)}, and the drive ` +
          `between them is ${describe(legs[short])}. The truck cannot make it in time.`,
        windowMinutes,
        travelMinutes,
        leaveInMinutes,
      };
    }

    const tight = gaps.findIndex((gap, index) => gap < legs[index] + STOP_ALLOWANCE_MIN);
    if (tight !== -1) {
      return {
        verdict: "tight",
        message: join(
          `${name(tight + 1)} is booked ${describe(gaps[tight])} after ${name(tight)}: a ` +
            `${describe(legs[tight])} drive plus ${describe(STOP_ALLOWANCE_MIN)} at ${name(tight)}. ` +
            `It can be driven, with nothing to spare.`,
          overnightNote,
        ),
        windowMinutes,
        travelMinutes,
        leaveInMinutes,
      };
    }
  }

  if (travelMinutes === null) {
    return { ...nothing, windowMinutes, leaveInMinutes, message: overnightNote };
  }

  const working = STOP_ALLOWANCE_MIN * (clock.length - 1);
  const needed = travelMinutes + working;

  if (windowMinutes < travelMinutes) {
    return {
      verdict: "impossible",
      message:
        `This itinerary allows ${describe(windowMinutes)} between the first stop and the last, ` +
        `and the drive alone is ${describe(travelMinutes)}. The truck cannot be in both places.`,
      windowMinutes,
      travelMinutes,
      leaveInMinutes,
    };
  }

  if (windowMinutes < needed) {
    return {
      verdict: "tight",
      message: join(
        `This leaves ${describe(windowMinutes)} for a ${describe(travelMinutes)} drive plus ` +
          `${describe(working)} at the stops along the way. It can be driven, with nothing to spare.`,
        overnightNote,
      ),
      windowMinutes,
      travelMinutes,
      leaveInMinutes,
    };
  }

  // Drivable, and leaving late is the only way to miss it.
  if (leaveInMinutes !== null && leaveInMinutes < 0) {
    return {
      verdict: "tight",
      message: join(
        `The truck has to be out of the yard now to make ${labels[0] ?? "the first stop"}.`,
        overnightNote,
      ),
      windowMinutes,
      travelMinutes,
      leaveInMinutes,
    };
  }

  return {
    verdict: "fine",
    message: overnightNote,
    windowMinutes,
    travelMinutes,
    leaveInMinutes,
  };
}
