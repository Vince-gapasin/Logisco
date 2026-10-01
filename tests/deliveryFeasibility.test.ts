import { describe, expect, it } from "vitest";

import { assessFeasibility, STOP_ALLOWANCE_MIN } from "@/app/lib/deliveryFeasibility";

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

  it("refuses stops promised out of order", () => {
    // Almost always a typo, and nothing about the road makes it work.
    const result = assessFeasibility({
      times: ["10:00", "08:00"],
      travelMinutes: 30,
      labels: [warehouse, branch],
    });

    expect(result.verdict).toBe("impossible");
    expect(result.message).toMatch(/Batangas Main Plant is promised before Valenzuela Warehouse/);
  });

  it("says which stops, so there is something to go and fix", () => {
    const result = assessFeasibility({
      times: ["06:00", "07:00", "06:30"],
      travelMinutes: 30,
      labels: ["Pickup", "Makati", "Pasig"],
    });
    expect(result.message).toMatch(/Pasig is promised before Makati/);
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
