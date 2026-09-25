import { describe, expect, it } from "vitest";
import { formatTime } from "@/app/lib/datetime";

describe("times as people read them", () => {
  it("turns a stored 24-hour time into a 12-hour one", () => {
    expect(formatTime("08:00")).toBe("8:00 AM");
    expect(formatTime("08:00:00")).toBe("8:00 AM");
    expect(formatTime("13:05")).toBe("1:05 PM");
    expect(formatTime("23:59")).toBe("11:59 PM");
  });

  it("gets midnight and noon right", () => {
    expect(formatTime("00:15")).toBe("12:15 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("12:30")).toBe("12:30 PM");
  });

  it("reads a full timestamp too", () => {
    // Written with an offset so the result does not depend on the machine.
    expect(formatTime("2026-09-22T13:05:00+08:00")).toMatch(/1:05\s?PM/i);
  });

  it("hands back anything it cannot read, rather than showing Invalid Date", () => {
    expect(formatTime("")).toBe("");
    expect(formatTime(null)).toBe("");
    expect(formatTime("Time to be confirmed")).toBe("Time to be confirmed");
    expect(formatTime("99:99")).toBe("99:99");
  });
});
