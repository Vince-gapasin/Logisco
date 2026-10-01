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
