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
// WHAT IT CANNOT CHECK
//
// Getting to the first stop. The truck could be at the yard, at a client's
// gate, or halfway through another delivery, and at booking time none of that
// is known. So this is the irreducible part of the job - from the moment they
// are at the first stop - and it stays silent about the rest rather than
// inventing a depot to measure from.

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
}

export interface FeasibilityInput {
  /** Stop times in itinerary order, as HH:MM. */
  times: (string | null | undefined)[];
  /** Driving time through those stops, or null when it is not known. */
  travelMinutes: number | null;
  /** Names in the same order, for saying which stop is the problem. */
  labels?: string[];
}

function minutesOf(clock: string | null | undefined): number | null {
  if (!clock) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(clock.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
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

  const times = input.times.map(minutesOf);
  if (times.length < 2 || times.some((time) => time === null)) return nothing;

  const clock = times as number[];

  // Promised out of order: a later stop earlier in the day than one before it.
  // Nothing about the road makes that work, and it is almost always a typo.
  for (let index = 1; index < clock.length; index += 1) {
    if (clock[index] < clock[index - 1]) {
      const later = labels[index] ?? `stop ${index + 1}`;
      const earlier = labels[index - 1] ?? `stop ${index}`;
      return {
        verdict: "impossible",
        message:
          `${later} is promised before ${earlier}, which comes before it on the route. ` +
          `Check the times on those two stops.`,
        windowMinutes: null,
        travelMinutes,
      };
    }
  }

  const windowMinutes = clock[clock.length - 1] - clock[0];
  if (travelMinutes === null) return { ...nothing, windowMinutes };

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
    };
  }

  if (windowMinutes < needed) {
    return {
      verdict: "tight",
      message:
        `This leaves ${describe(windowMinutes)} for a ${describe(travelMinutes)} drive plus ` +
        `${describe(working)} at the stops along the way. It can be driven, with nothing to spare.`,
      windowMinutes,
      travelMinutes,
    };
  }

  return { verdict: "fine", message: null, windowMinutes, travelMinutes };
}
