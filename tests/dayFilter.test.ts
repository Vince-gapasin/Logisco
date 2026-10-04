import { describe, expect, it } from "vitest";

import { matchesDayFilter } from "@/app/lib/dayFilter";

const today = "2026-10-04";

describe("delivery day filter", () => {
  it("keeps everything on Any day, even an unscheduled booking", () => {
    expect(matchesDayFilter("", "Any day", today)).toBe(true);
  });

  it("picks today and tomorrow", () => {
    expect(matchesDayFilter("2026-10-04", "Today", today)).toBe(true);
    expect(matchesDayFilter("2026-10-05", "Tomorrow", today)).toBe(true);
    expect(matchesDayFilter("2026-10-05", "Today", today)).toBe(false);
  });

  it("reaches across a month end", () => {
    expect(matchesDayFilter("2026-10-10", "Next 7 days", today)).toBe(true);
    expect(matchesDayFilter("2026-10-11", "Next 7 days", today)).toBe(false);
    expect(matchesDayFilter("2026-09-28", "Past 7 days", today)).toBe(true);
    expect(matchesDayFilter("2026-09-27", "Past 7 days", today)).toBe(false);
  });

  it("leaves out a booking with no delivery day once a day is chosen", () => {
    expect(matchesDayFilter("", "This month", today)).toBe(false);
    expect(matchesDayFilter("2026-10-30", "This month", today)).toBe(true);
  });
});
