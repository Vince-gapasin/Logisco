import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "@/app/lib/datetime";
import { bookingStatusLabel, crewAnswerLabel } from "@/app/lib/statusLabels";

// One way to write a date, one name per booking state - on every screen.

describe("dates", () => {
  it("writes a calendar day the same way wherever it came from", () => {
    expect(formatDate("2026-10-06")).toBe("Oct 6, 2026");
    expect(formatDate("2026-10-06T02:00:00.000Z")).toBe("Oct 6, 2026");
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("not a date");
  });

  it("reads a late-evening UTC timestamp as the next day in Manila", () => {
    expect(formatDate("2026-10-05T18:30:00.000Z")).toBe("Oct 6, 2026");
  });

  it("pairs a date with a twelve-hour time", () => {
    expect(formatDateTime("2026-10-06T02:00:00.000Z")).toMatch(/^Oct 6, 2026, 10:00\s?AM$/);
  });
});

describe("booking status names", () => {
  it("calls the same state the same thing from every screen", () => {
    expect(bookingStatusLabel("Unassigned")).toBe("Needs a crew");
    expect(bookingStatusLabel("Assign Crew")).toBe("Needs a crew");
    expect(bookingStatusLabel("Crew Confirmed")).toBe("Crew confirmed");
    expect(bookingStatusLabel("Waiting Crew Dispatch")).toBe("Crew confirmed");
    expect(bookingStatusLabel("On Route")).toBe("On the road");
    expect(bookingStatusLabel("In-Transit")).toBe("On the road");
  });

  it("passes through anything it does not know", () => {
    expect(bookingStatusLabel("Something new")).toBe("Something new");
    expect(bookingStatusLabel(null)).toBe("");
  });

  it("says how a crew member has answered", () => {
    expect(crewAnswerLabel("Pending")).toBe("Not answered yet");
    expect(crewAnswerLabel("Accepted")).toBe("Accepted");
  });
});
