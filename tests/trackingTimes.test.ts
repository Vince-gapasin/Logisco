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
