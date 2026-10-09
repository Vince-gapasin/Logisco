import { describe, expect, it } from "vitest";

import {
  BOOKING_DATE_RULE,
  checkStopSchedule,
  EARLIER_RULE,
  EARLIER_SAME_DAY_RULE,
  effectiveStopDates,
  legacyStopDates,
  MAX_RUN_DAYS,
  NO_DATE_RULE,
  PAST_DATE_RULE,
  resolveStopDates,
  RUN_TOO_LONG_RULE,
  SAME_TIME_RULE,
  stopMoment,
} from "@/app/lib/stopSchedule";
import { PAST_TIME_RULE, TOO_FAR_RULE } from "@/app/lib/bookingRules";
import { assessFeasibility } from "@/app/lib/deliveryFeasibility";

// When each stop is due, as a date and a time.
//
// Stops used to carry only a time; the day was guessed from the order of the
// times and could stretch across one midnight. Bookings run for up to a week,
// so each stop now has a date, and nothing about a new booking is guessed.

// 10:00 on Monday 5 October in Manila.
const NOW = new Date("2026-10-05T02:00:00.000Z");

const check = (stops: { date?: string; time?: string }[], bookingDate = "2026-10-05") =>
  checkStopSchedule(stops, { bookingDate, now: NOW });

const issuesOf = (stops: { date?: string; time?: string }[], bookingDate?: string) =>
  check(stops, bookingDate).issues;

describe("a stop's date", () => {
  it("follows the stop before it when it is left blank", () => {
    expect(resolveStopDates([{ time: "11:00" }, { time: "14:00" }, { date: "2026-10-07", time: "08:00" }, { time: "12:00" }], "2026-10-05"))
      .toEqual(["2026-10-05", "2026-10-05", "2026-10-07", "2026-10-07"]);
  });

  it("is never rolled to the next day by a lower clock - that has to be chosen", () => {
    const result = check([{ time: "21:00" }, { time: "03:00" }]);
    expect(result.dates).toEqual(["2026-10-05", "2026-10-05"]);
    expect(result.issues).toEqual([{ index: 1, field: "time", message: EARLIER_SAME_DAY_RULE }]);
  });

  it("allows an overnight run once the next day is chosen", () => {
    expect(issuesOf([{ time: "21:00" }, { date: "2026-10-06", time: "03:00" }])).toEqual([]);
  });

  it("refuses a day the calendar does not have", () => {
    expect(issuesOf([{ time: "11:00" }, { date: "2026-02-30", time: "08:00" }])).toContainEqual({
      index: 1,
      field: "date",
      message: NO_DATE_RULE,
    });
  });

  it("refuses a day that has gone, and one a year out", () => {
    expect(issuesOf([{ date: "2026-10-04", time: "11:00" }], "2026-10-04")).toContainEqual({ index: 0, field: "date", message: PAST_DATE_RULE });
    expect(issuesOf([{ date: "2027-10-06", time: "11:00" }], "2027-10-06")).toContainEqual({ index: 0, field: "date", message: TOO_FAR_RULE });
  });

  it("is reported only where it was typed, not on every stop that follows it", () => {
    const issues = issuesOf([{ time: "11:00" }, { date: "2026-02-30", time: "08:00" }, { time: "12:00" }]);
    expect(issues.filter((issue) => issue.field === "date")).toEqual([{ index: 1, field: "date", message: NO_DATE_RULE }]);
  });
});

describe("the order of the stops", () => {
  it("passes a single day in order", () => {
    expect(issuesOf([{ time: "11:00" }, { time: "13:30" }, { time: "16:00" }])).toEqual([]);
  });

  it("refuses two stops in the same minute", () => {
    expect(issuesOf([{ time: "11:00" }, { time: "11:00" }])).toEqual([{ index: 1, field: "time", message: SAME_TIME_RULE }]);
  });

  it("says earlier, not next day, when the stop is on an earlier date", () => {
    const issues = issuesOf([{ time: "11:00" }, { date: "2026-10-07", time: "08:00" }, { date: "2026-10-06", time: "09:00" }]);
    expect(issues).toEqual([{ index: 2, field: "time", message: EARLIER_RULE }]);
  });

  it("reports one typo once, measuring the next stop against where the run really was", () => {
    // 15:05 typed as 03:05: the stop after it is still in order after 13:00.
    const issues = issuesOf([{ time: "11:00" }, { time: "13:00" }, { time: "03:05" }, { time: "17:00" }]);
    expect(issues).toEqual([{ index: 2, field: "time", message: EARLIER_SAME_DAY_RULE }]);
  });

  it("leaves an unreadable time to the field rules and compares across it", () => {
    expect(issuesOf([{ time: "11:00" }, { time: "banana" }, { time: "10:00" }])).toEqual([
      { index: 2, field: "time", message: EARLIER_SAME_DAY_RULE },
    ]);
    expect(issuesOf([{ time: "11:00" }, { time: "" }, { time: "14:00" }])).toEqual([]);
  });
});

describe("the first stop", () => {
  it("cannot already be behind the clock", () => {
    expect(issuesOf([{ time: "09:45" }, { time: "14:00" }])).toEqual([{ index: 0, field: "time", message: PAST_TIME_RULE }]);
    expect(issuesOf([{ time: "10:00" }, { time: "14:00" }])).toEqual([]);
  });

  it("is on the booking's date, which is the run's first day", () => {
    expect(issuesOf([{ date: "2026-10-06", time: "08:00" }], "2026-10-05")).toEqual([{ index: 0, field: "date", message: BOOKING_DATE_RULE }]);
    expect(check([{ date: "2026-10-06", time: "08:00" }], "").bookingDate).toBe("2026-10-06");
  });
});

describe("a run of several days", () => {
  it(`fits in ${MAX_RUN_DAYS} calendar days: Day 1 to Day ${MAX_RUN_DAYS}`, () => {
    expect(issuesOf([{ time: "11:00" }, { date: "2026-10-11", time: "17:00" }])).toEqual([]);
  });

  it("is refused on the first stop past the limit", () => {
    const issues = issuesOf([{ time: "11:00" }, { date: "2026-10-09", time: "08:00" }, { date: "2026-10-12", time: "08:00" }, { time: "12:00" }]);
    expect(issues).toEqual([{ index: 2, field: "date", message: RUN_TOO_LONG_RULE }]);
  });
});

describe("a stop as a moment", () => {
  it("is read in Manila", () => {
    // 08:00 on the 5th in Manila is midnight UTC.
    expect(stopMoment("2026-10-05", "08:00")).toBe(Date.parse("2026-10-05T00:00:00Z") / 60_000);
    expect(stopMoment("2026-10-05", "08:00:00")).toBe(stopMoment("2026-10-05", "08:00"));
  });

  it("is nothing when the date or time cannot be read", () => {
    expect(stopMoment("2026-02-30", "08:00")).toBeNull();
    expect(stopMoment("2026-10-05", "25:00")).toBeNull();
  });
});

describe("a booking stored before stops had dates", () => {
  it("keeps the overnight reading it was made under", () => {
    expect(legacyStopDates("2026-10-05", ["21:00", "23:00", "03:00", "06:00"])).toEqual([
      "2026-10-05",
      "2026-10-05",
      "2026-10-06",
      "2026-10-06",
    ]);
  });

  it("keeps a stop with no time on the day of the stop before it", () => {
    expect(legacyStopDates("2026-10-05", ["21:00", null, "03:00"])).toEqual(["2026-10-05", "2026-10-05", "2026-10-06"]);
  });

  it("is read that way only when no stop has a date of its own", () => {
    expect(effectiveStopDates("2026-10-05", [{ time: "21:00" }, { time: "03:00" }])).toEqual(["2026-10-05", "2026-10-06"]);
    expect(effectiveStopDates("2026-10-05", [{ date: "2026-10-05", time: "21:00" }, { time: "03:00" }])).toEqual(["2026-10-05", "2026-10-05"]);
  });
});

describe("the drive check, given real moments", () => {
  const momentsOf = (stops: [string, string][]) => stops.map(([date, time]) => stopMoment(date, time) as number);

  it("measures a leg across days as the hours it really is", () => {
    // Collected on the 5th, delivered two days later: 46 hours for a 10-hour drive.
    const result = assessFeasibility({
      times: ["20:00", "18:00"],
      travelMinutes: 600,
      legMinutes: [600],
      moments: momentsOf([["2026-10-05", "20:00"], ["2026-10-07", "18:00"]]),
      labels: ["Valenzuela", "Davao"],
    });
    expect(result.verdict).toBe("fine");
    expect(result.windowMinutes).toBe(46 * 60);
    // No overnight guess to explain: the day was chosen.
    expect(result.message).toBeNull();
  });

  it("does not refuse a run of several days as 'two midnights'", () => {
    const result = assessFeasibility({
      times: ["22:00", "21:00", "20:00"],
      travelMinutes: 60,
      moments: momentsOf([["2026-10-05", "22:00"], ["2026-10-06", "21:00"], ["2026-10-07", "20:00"]]),
    });
    expect(result.verdict).not.toBe("impossible");
  });

  it("still refuses a leg shorter than its drive", () => {
    const result = assessFeasibility({
      times: ["08:00", "08:30"],
      travelMinutes: 120,
      legMinutes: [120],
      moments: momentsOf([["2026-10-05", "08:00"], ["2026-10-05", "08:30"]]),
      labels: ["Valenzuela", "Batangas"],
    });
    expect(result.verdict).toBe("impossible");
  });

  it("falls back to the clock reading when the moments do not line up with the stops", () => {
    const result = assessFeasibility({
      times: ["21:00", "03:00"],
      travelMinutes: 60,
      moments: momentsOf([["2026-10-05", "21:00"]]),
    });
    expect(result.message).toMatch(/overnight/i);
  });
});
