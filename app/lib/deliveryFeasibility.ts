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
   * Minutes from now until the first stop. Negative when it has gone, null
   * when there is no date to measure from.
   */
  minutesUntilFirstStop?: number | null;
  /** Getting the truck out of the yard, on top of the drive. */
  departureBufferMin?: number;
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

  if (travelMinutes === null) {
    return { ...nothing, windowMinutes, leaveInMinutes };
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
      message:
        `This leaves ${describe(windowMinutes)} for a ${describe(travelMinutes)} drive plus ` +
        `${describe(working)} at the stops along the way. It can be driven, with nothing to spare.`,
      windowMinutes,
      travelMinutes,
      leaveInMinutes,
    };
  }

  // Drivable, and leaving late is the only way to miss it.
  if (leaveInMinutes !== null && leaveInMinutes < 0) {
    return {
      verdict: "tight",
      message:
        `The truck has to be out of the yard now to make ${labels[0] ?? "the first stop"}.`,
      windowMinutes,
      travelMinutes,
      leaveInMinutes,
    };
  }

  return { verdict: "fine", message: null, windowMinutes, travelMinutes, leaveInMinutes };
}
