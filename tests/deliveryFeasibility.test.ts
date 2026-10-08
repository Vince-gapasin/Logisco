import { describe, expect, it } from "vitest";

import {
  assessFeasibility,
  buildItinerary,
  clockMinutes,
  STOP_ALLOWANCE_MIN,
} from "@/app/lib/deliveryFeasibility";

// Whether a booking promises something a truck could do.
//
// The first proposal was a flat three hours' notice. It measures from when the
// office typed rather than from anything about the delivery: far too much for a
// drop across Makati, nowhere near enough for Batangas, and no help at all
// against a booking made three days early and assigned ten minutes before the
// window. What can be checked is the promise itself - if the gap between the
// first stop and the last is shorter than the road between them, the booking
// says the truck will be in two places at once.

const warehouse = "Valenzuela Warehouse";
const branch = "Batangas Main Plant";

describe("a promise the road cannot keep", () => {
  it("refuses a window shorter than the drive", () => {
    const result = assessFeasibility({
      times: ["08:00", "09:00"],
      travelMinutes: 180,
      labels: [warehouse, branch],
    });

    expect(result.verdict).toBe("impossible");
    expect(result.message).toMatch(/cannot be in both places/i);
    // Both figures named, because "impossible" without them is an argument.
    expect(result.message).toMatch(/1 hour/);
    expect(result.message).toMatch(/3 hours/);
  });

  it("refuses times that cannot be one run however they are read", () => {
    // Three stops going backwards need two midnights to be put in order, and
    // the booking carries one date. This is the real contradiction - not a stop
    // whose clock time is simply lower than the one before it.
    const result = assessFeasibility({
      times: ["22:00", "21:00", "20:00"],
      travelMinutes: 30,
      labels: [warehouse, "Makati", branch],
    });

    expect(result.verdict).toBe("impossible");
    expect(result.message).toMatch(/cannot be one run/);
  });

  it("says which stops, so there is something to go and fix", () => {
    const result = assessFeasibility({
      times: ["06:00", "05:00", "04:00"],
      travelMinutes: 30,
      labels: ["Pickup", "Makati", "Pasig"],
    });
    expect(result.message).toMatch(/Pasig would fall two days after the first stop/);
  });
});

describe("a run that goes past midnight", () => {
  // The bug this was written for: a pickup at 9:05 PM and a drop at 3:05 AM,
  // which is six hours of ordinary overnight work. The times were compared as
  // text, so "03:05" sorted below "21:05" and the booking was refused as
  // promised backwards - on a delivery time that was correct.
  const overnight = { times: ["21:05", "03:05"], labels: [warehouse, branch] };

  it("is six hours, not minus eighteen", () => {
    const result = assessFeasibility({ ...overnight, travelMinutes: 120 });
    expect(result.windowMinutes).toBe(360);
  });

  it("is allowed, where the drive fits in it", () => {
    const result = assessFeasibility({ ...overnight, travelMinutes: 120 });
    expect(result.verdict).toBe("fine");
  });

  it("says it was read as overnight, rather than assuming agreement", () => {
    // The record cannot distinguish 03:05 tomorrow from 15:05 mistyped, so the
    // reading it chose is stated instead of applied in silence.
    const result = assessFeasibility({ ...overnight, travelMinutes: 120 });
    expect(result.message).toMatch(/Read as an overnight run/);
    expect(result.message).toMatch(/Batangas Main Plant is the following day/);
    expect(result.message).toMatch(/6 hours after Valenzuela Warehouse/);
  });

  it("still refuses one where the drive does not fit", () => {
    // Crossing midnight buys six hours, not a free pass.
    const result = assessFeasibility({ ...overnight, travelMinutes: 500 });
    expect(result.verdict).toBe("impossible");
    expect(result.message).toMatch(/cannot be in both places/);
  });

  it("carries the note on a tight verdict too", () => {
    const result = assessFeasibility({ ...overnight, travelMinutes: 350 });
    expect(result.verdict).toBe("tight");
    expect(result.message).toMatch(/nothing to spare/);
    expect(result.message).toMatch(/Read as an overnight run/);
  });
});

describe("laying the stops on one clock", () => {
  const at = (...times: string[]) =>
    buildItinerary(times.map((time) => clockMinutes(time) as number));

  it("leaves a run inside one day alone", () => {
    const line = at("08:00", "10:00", "14:00");
    expect(line.absolute).toEqual([480, 600, 840]);
    expect(line.crossings).toEqual([]);
    expect(line.spanMinutes).toBe(360);
  });

  it("rolls a stop past midnight onto the next day", () => {
    const line = at("21:05", "03:05");
    // 03:05 the next day is 1625 minutes after midnight on the first day.
    expect(line.absolute).toEqual([1265, 1625]);
    expect(line.crossings).toEqual([1]);
  });

  it("treats two stops at the same time as the same day", () => {
    // A stop is only a new day when the clock goes backwards, not when it
    // stands still. Two drops booked for the same minute is odd, and it is the
    // drive that should say so, not a phantom midnight.
    const line = at("09:00", "09:00");
    expect(line.crossings).toEqual([]);
    expect(line.spanMinutes).toBe(0);
  });

  it("crosses only once per stop, however far back the clock goes", () => {
    const line = at("23:50", "00:05", "01:00");
    expect(line.crossings).toEqual([1]);
    expect(line.spanMinutes).toBe(70);
  });

  it("records every crossing, so a second one can be refused", () => {
    const line = at("22:00", "21:00", "20:00");
    expect(line.crossings).toEqual([1, 2]);
  });
});

describe("a promise with nothing to spare", () => {
  it("warns when the drive fits but the stops do not", () => {
    // Two hours of road in a two-hour window: drivable, with no time to load.
    const result = assessFeasibility({
      times: ["08:00", "10:00"],
      travelMinutes: 120,
      labels: [warehouse, branch],
    });

    expect(result.verdict).toBe("tight");
    expect(result.message).toMatch(/nothing to spare/i);
  });

  it("counts time at every stop but the last", () => {
    // Three stops, so two of them have to be worked before the final arrival.
    const travel = 60;
    const working = STOP_ALLOWANCE_MIN * 2;

    const justShort = assessFeasibility({
      times: ["08:00", "09:00", `0${8 + Math.floor((travel + working - 1) / 60)}:${String((travel + working - 1) % 60).padStart(2, "0")}`],
      travelMinutes: travel,
    });
    expect(justShort.verdict).toBe("tight");

    const enough = assessFeasibility({
      times: ["08:00", "09:00", "09:40"],
      travelMinutes: travel,
    });
    expect(enough.verdict).toBe("fine");
    expect(enough.message).toBeNull();
  });
});

describe("when it cannot tell", () => {
  it("says nothing rather than refusing on a failed lookup", () => {
    // An address that would not geocode, or a map service that did not answer.
    // Refusing a real delivery on the strength of that would be worse than
    // taking it.
    const result = assessFeasibility({ times: ["08:00", "17:00"], travelMinutes: null });
    expect(result.verdict).toBe("unknown");
    expect(result.message).toBeNull();
    // The window is still worked out, because that part did not depend on it.
    expect(result.windowMinutes).toBe(540);
  });

  it("says nothing when a stop has no time on it", () => {
    expect(assessFeasibility({ times: ["08:00", null], travelMinutes: 30 }).verdict).toBe("unknown");
    expect(assessFeasibility({ times: ["08:00", "oops"], travelMinutes: 30 }).verdict).toBe("unknown");
  });

  it("says nothing about a single stop, which promises no window at all", () => {
    expect(assessFeasibility({ times: ["08:00"], travelMinutes: 30 }).verdict).toBe("unknown");
  });
});

describe("what it deliberately does not judge", () => {
  it("has no opinion on how far ahead the booking was made", () => {
    // The thing the flat three-hour rule measured. A delivery booked for this
    // afternoon is as drivable as one booked last week; whether anybody is
    // ready for it is a different question, answered elsewhere.
    const sameAnswer = { times: ["08:00", "12:00"], travelMinutes: 120 };
    expect(assessFeasibility(sameAnswer).verdict).toBe("fine");
  });
});

// ---------------------------------------------------------------------------
// Getting there in the first place
// ---------------------------------------------------------------------------
// Every truck starts from the same yard, which makes the other half checkable:
// how long it takes to reach the first stop is known, so a booking whose first
// stop is sooner than that drive is one nobody can make however early they
// leave. This is the real version of "give us three hours' notice" - the same
// intent, measured against the road instead of a number somebody picked.

describe("reaching the first stop", () => {
  const fromYard = (over: Record<string, unknown> = {}) =>
    assessFeasibility({
      times: ["08:00", "12:00"],
      travelMinutes: 60,
      labels: [warehouse, branch],
      fromBaseMinutes: 120,
      minutesUntilFirstStop: 300,
      departureBufferMin: 30,
      ...over,
    });

  it("refuses a stop nearer in time than it is in distance", () => {
    const result = fromYard({ minutesUntilFirstStop: 45 });
    expect(result.verdict).toBe("impossible");
    expect(result.message).toMatch(/45 minutes away/);
    expect(result.message).toMatch(/2 hours from the yard/);
    expect(result.message).toMatch(/however early it leaves/);
  });

  it("refuses a first stop whose time has gone", () => {
    const result = fromYard({ minutesUntilFirstStop: -20 });
    expect(result.verdict).toBe("impossible");
    expect(result.message).toMatch(/already gone/);
  });

  it("says when the truck has to be out of the yard", () => {
    // Five hours until the stop, two of them driving, half an hour to get
    // moving: two and a half hours of slack.
    expect(fromYard().leaveInMinutes).toBe(150);
  });

  it("warns when that moment has passed but the drive still fits", () => {
    // Two hours and ten minutes out from a two-hour drive: reachable, but only
    // by leaving now rather than in the half hour nobody schedules.
    const result = fromYard({ minutesUntilFirstStop: 130 });
    expect(result.verdict).toBe("tight");
    expect(result.message).toMatch(/out of the yard now/);
    expect(result.leaveInMinutes).toBeLessThan(0);
  });

  it("is checked before the itinerary, because it fails earlier", () => {
    // Unreachable first stop and an impossible window. The one worth saying is
    // the one that happens first.
    const result = fromYard({ minutesUntilFirstStop: 10, travelMinutes: 600 });
    expect(result.message).toMatch(/from the yard/);
  });

  it("stays quiet when there is no yard distance to go on", () => {
    const result = fromYard({ fromBaseMinutes: null });
    expect(result.verdict).toBe("fine");
    expect(result.leaveInMinutes).toBeNull();
  });

  it("stays quiet about a booking with no date to count from", () => {
    expect(fromYard({ minutesUntilFirstStop: null }).verdict).toBe("fine");
  });
});

describe("a check that did not run", () => {
  it("is not the same answer as a check that passed", () => {
    // Both come back "unknown" from the rules, and the service tells them
    // apart by why: no coordinates is a different problem from no route, and
    // both are different from "we looked and it is fine".
    const noRoute = assessFeasibility({
      times: ["08:00", "17:00"],
      travelMinutes: null,
      fromBaseMinutes: null,
      minutesUntilFirstStop: 600,
    });
    expect(noRoute.verdict).toBe("unknown");

    const checked = assessFeasibility({
      times: ["08:00", "17:00"],
      travelMinutes: 120,
      fromBaseMinutes: 60,
      minutesUntilFirstStop: 600,
    });
    expect(checked.verdict).toBe("fine");
  });
});

describe("every leg on its own", () => {
  // The whole window used to be measured against the whole drive, so a long
  // day hid a leg nobody could drive.
  const run = (times: string[], legMinutes: number[] | null) =>
    assessFeasibility({
      times,
      travelMinutes: legMinutes ? legMinutes.reduce((a, b) => a + b, 0) : null,
      legMinutes,
      labels: [warehouse, "Makati", branch],
    });

  it("refuses a leg shorter than its drive, however wide the day", () => {
    // Nine hours for three of driving - and 08:15 two hours from 08:00.
    const result = run(["08:00", "08:15", "17:00"], [120, 60]);
    expect(result.verdict).toBe("impossible");
    expect(result.message).toMatch(/Makati is booked 15 minutes after Valenzuela Warehouse/);
    expect(result.message).toMatch(/2 hours/);
  });

  it("holds a leg with no time to spend at the stop it leaves", () => {
    const result = run(["08:00", "10:10", "17:00"], [120, 60]);
    expect(result.verdict).toBe("tight");
    expect(result.message).toMatch(new RegExp(`${STOP_ALLOWANCE_MIN} minutes at ${warehouse}`));
  });

  it("passes when every leg has its drive and its stop", () => {
    expect(run(["08:00", "10:30", "17:00"], [120, 60]).verdict).toBe("fine");
  });

  it("measures an overnight leg across midnight", () => {
    // 23:00 to 01:00 is two hours, not twenty-two backwards.
    expect(run(["22:00", "23:00", "01:30"], [30, 90]).verdict).toBe("fine");
    expect(run(["22:00", "23:00", "00:00"], [30, 90]).verdict).toBe("impossible");
  });

  it("falls back to the whole window when the legs do not line up with the stops", () => {
    expect(run(["08:00", "08:15", "17:00"], [120]).verdict).not.toBe("impossible");
  });
});

describe("two stops in the same minute", () => {
  it("are refused without the map", () => {
    const result = assessFeasibility({
      times: ["08:00", "08:00"],
      travelMinutes: null,
      labels: [warehouse, branch],
    });
    expect(result.verdict).toBe("impossible");
    expect(result.message).toMatch(/same time/);
  });

  it("are refused even inside a wide day", () => {
    const result = assessFeasibility({
      times: ["08:00", "12:00", "12:00", "17:00"],
      travelMinutes: 60,
      labels: [warehouse, "Makati", "Pasig", branch],
    });
    expect(result.verdict).toBe("impossible");
    expect(result.message).toMatch(/Pasig and Makati/);
  });

  it("are found by the itinerary, so the form can mark the field", () => {
    expect(buildItinerary([480, 480, 600]).sameTime).toEqual([1]);
    // A full day later is not the same minute.
    expect(buildItinerary([480, 600, 480]).sameTime).toEqual([]);
  });
});
