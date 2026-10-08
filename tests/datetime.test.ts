import { describe, expect, it } from "vitest";
import { clockInManila, formatDateTime, formatTime } from "@/app/lib/datetime";

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
    expect(formatTime("2026-09-22T13:05:00+08:00")).toMatch(/1:05\s?PM/i);
  });

  it("shows Philippine time wherever it runs", () => {
    // The same instant, written in UTC. A server rendering an email or the
    // client's tracking page runs in UTC and must still say 1:05 PM.
    expect(formatTime("2026-09-22T05:05:00Z")).toMatch(/1:05\s?PM/i);
    expect(formatDateTime("2026-09-22T05:05:00Z")).toMatch(/1:05\s?PM/i);
  });

  it("hands back anything it cannot read, rather than showing Invalid Date", () => {
    expect(formatTime("")).toBe("");
    expect(formatTime(null)).toBe("");
    expect(formatTime("Time to be confirmed")).toBe("Time to be confirmed");
    expect(formatTime("99:99")).toBe("99:99");
  });
});

describe("formatting a time that has already been formatted", () => {
  it("leaves it alone rather than reading the hour again", () => {
    // "2:30 PM" matches the 24-hour pattern as hour 2, so a second pass used to
    // turn an afternoon delivery into a morning one. Values are passed through
    // several layers - an API route formats, a screen formats again - and that
    // has to be harmless.
    expect(formatTime("2:30 PM")).toBe("2:30 PM");
    expect(formatTime("12:00 AM")).toBe("12:00 AM");
    expect(formatTime(formatTime("14:30"))).toBe("2:30 PM");
  });

  it("still converts anything that has not been", () => {
    expect(formatTime("14:30")).toBe("2:30 PM");
  });
});

describe("a stored timestamp with no zone on it", () => {
  // The audit trail keeps UTC without saying so. Read in a browser in Manila,
  // a trip started at 1:09 PM showed the client 5:09 AM.
  it("is read as UTC, wherever it is rendered", () => {
    const zone = process.env.TZ;
    process.env.TZ = "Asia/Manila";
    try {
      expect(formatDateTime("2026-10-06 05:09:19.531162")).toMatch(/Oct 6, 2026.*1:09\s?PM/i);
      expect(formatDateTime("2026-10-06T05:09:19.531162")).toMatch(/1:09\s?PM/i);
      expect(formatTime("2026-10-06T05:09:19")).toMatch(/1:09\s?PM/i);
      // A timestamp that names its zone is left as it says.
      expect(formatDateTime("2026-10-06T05:09:19+00:00")).toMatch(/1:09\s?PM/i);
    } finally {
      process.env.TZ = zone;
    }
  });
});

describe("the time now, where the trucks are", () => {
  it("is read in Manila, in 24-hour time", () => {
    expect(clockInManila(new Date("2026-10-05T06:05:00.000Z"))).toBe("14:05");
    // Midnight is 00, never 24 - the picker compares it as a clock.
    expect(clockInManila(new Date("2026-10-05T16:00:00.000Z"))).toBe("00:00");
  });
});
