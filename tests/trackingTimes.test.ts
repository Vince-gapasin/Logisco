import { describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// How a time reads on the customer's page.
//
// Three different kinds of time share that screen and were not being kept
// apart: a wall clock the office typed when the delivery was booked, a live
// driving estimate worked out from where the truck is, and the instants things
// actually happened at. The page counted down to a stop the crew were already
// standing at, and called a promise an estimate.

const double = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: double.client }));

const { formatExpectedTime } = await import("@/services/tracking/publicTrackingService");
const { formatTime, formatDateTime } = await import("@/app/lib/datetime");

describe("a stop's promised time", () => {
  it("reads the same wherever it is rendered", () => {
    // It used to be a second copy of the twelve-hour conversion, so the same
    // value went through one function in the timeline and another in the stops
    // panel beside it.
    for (const value of ["08:00", "10:34", "00:15", "12:00", "23:59"]) {
      expect(formatExpectedTime(value)).toBe(formatTime(value));
    }
  });

  it("survives a full timestamp instead of vanishing", () => {
    // The copy split on ":" and gave up, so a promised time held as a timestamp
    // came back null and simply left the page.
    expect(formatExpectedTime("2026-09-30T10:34:00.000Z")).not.toBeNull();
  });

  it("is null when there is none, which is what the callers test for", () => {
    expect(formatExpectedTime(null)).toBeNull();
    expect(formatExpectedTime("")).toBeNull();
  });

  it("hands back something unreadable rather than showing Invalid Date", () => {
    expect(formatExpectedTime("whenever")).toBe("whenever");
  });
});

describe("times that are real instants", () => {
  // Rendered by a server in UTC and read in Manila, so the zone is stated
  // rather than left to whichever machine drew the page.
  const noonManila = "2026-09-30T04:00:00.000Z";

  it("is shown in Manila, not in the server's zone", () => {
    expect(formatTime(noonManila)).toBe("12:00 PM");
    expect(formatDateTime(noonManila)).toMatch(/12:00 PM/);
  });

  it("does not shift a date across midnight on the way", () => {
    // 11:30 PM in Manila is the 30th there and the 30th on the page, though it
    // is still the 30th at 15:30 UTC.
    expect(formatDateTime("2026-09-30T15:30:00.000Z")).toMatch(/Sep 30, 2026/);
    expect(formatTime("2026-09-30T15:30:00.000Z")).toBe("11:30 PM");
  });

  it("crosses into the next day where it should", () => {
    // 16:00 UTC is midnight in Manila, which is the following day.
    expect(formatDateTime("2026-09-30T16:00:00.000Z")).toMatch(/Oct 1, 2026/);
  });
});

const { buildTrackingSteps } = await import("@/services/tracking/publicTrackingService");

describe("what the customer is told about the crew confirming", () => {
  const crew = (over: Record<string, number | boolean> = {}) => ({
    driverAccepted: false,
    helpers: 1,
    helpersAccepted: 0,
    helpersDeclined: 0,
    ...over,
  });

  const step = (status: string, over: Record<string, number | boolean> = {}) => {
    const steps = buildTrackingSteps(status, [], false, [], new Map(), null, [], null, crew(over));
    const found = steps.find((row) => row.kind === "confirmed");
    if (!found) throw new Error("no confirmation step");
    return found;
  };

  it("is about the crew, not only the driver", () => {
    // It said "Driver confirmed" off a status only the driver can move, so a
    // customer watching a step that would not budge had no way of knowing a
    // helper was what it was waiting on.
    expect(step("Assigned").title).toBe("Crew confirmation");
  });

  it("waits on everybody before anybody has answered", () => {
    expect(step("Assigned").detail).toBe("Waiting for your crew to confirm.");
    expect(step("Assigned").stage).toBe("current");
  });

  it("says the driver is in and the helper is not", () => {
    const found = step("Accepted", { driverAccepted: true });
    expect(found.detail).toBe("Your driver has confirmed. Waiting for the helper to confirm.");
    // Still outstanding: the truck may not leave until it is not.
    expect(found.stage).toBe("current");
  });

  it("says the helper is in and the driver is not", () => {
    const found = step("Assigned", { helpersAccepted: 1 });
    expect(found.detail).toBe("The helper has confirmed. Waiting for the driver to confirm.");
  });

  it("counts more than one helper in the sentence", () => {
    expect(step("Accepted", { driverAccepted: true, helpers: 2 }).detail).toMatch(
      /Waiting for the helpers to confirm/,
    );
  });

  it("is complete only once every assignment is accepted", () => {
    const found = step("Accepted", { driverAccepted: true, helpersAccepted: 1 });
    expect(found.stage).toBe("completed");
    expect(found.detail).toBe("Your driver and helper have confirmed this trip.");
  });

  it("says a refusal needs the coordinator, and names nobody", () => {
    // A public link. The driver is named in the booking details because the
    // customer has to recognise whoever turns up; nobody else needs naming.
    const found = step("Accepted", { driverAccepted: true, helpersDeclined: 1 });
    expect(found.detail).toMatch(/turned this down/i);
    expect(found.detail).toMatch(/coordinator is arranging a replacement/i);
    expect(found.stage).toBe("current");
  });

  it("settles once the truck has left, whatever a stale helper row says", () => {
    // An office that replaced somebody can leave a Declined row behind, and it
    // must not hang this step for the whole delivery.
    const found = step("In Transit", { driverAccepted: true, helpersDeclined: 1 });
    expect(found.stage).toBe("completed");
  });

  it("does not mention a helper on a trip that has none", () => {
    const found = step("Accepted", { driverAccepted: true, helpers: 0 });
    expect(found.detail).toBe("Your driver has confirmed this trip.");
  });
});
