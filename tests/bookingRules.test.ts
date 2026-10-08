import { describe, expect, it } from "vitest";
import {
  addDays,
  findAddressClashes,
  isRealDate,
  isTooFarAhead,
  isValidPhone,
  normalizePhone,
  parseQuantity,
  sanitizeQuantityInput,
} from "@/app/lib/bookingRules";

describe("phone numbers", () => {
  it("accepts an 11-digit mobile number however it is spaced", () => {
    expect(normalizePhone("09171234567")).toBe("09171234567");
    expect(normalizePhone("0917-123-4567")).toBe("09171234567");
    expect(normalizePhone("0917 123 4567")).toBe("09171234567");
  });

  it("converts the international form", () => {
    expect(normalizePhone("+63 917 123 4567")).toBe("09171234567");
    expect(normalizePhone("639171234567")).toBe("09171234567");
  });

  it("rejects fewer or more than 11 digits", () => {
    expect(isValidPhone("0917123456")).toBe(false);
    expect(isValidPhone("091712345678")).toBe(false);
  });

  it("rejects numbers that are not mobiles, and letters", () => {
    expect(isValidPhone("02-8123-4567")).toBe(false);
    expect(isValidPhone("19171234567")).toBe(false);
    expect(isValidPhone("0917abc4567")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("quantities", () => {
  it("keeps only whole positive numbers while typing", () => {
    expect(sanitizeQuantityInput("-2")).toBe("2");
    expect(sanitizeQuantityInput("0")).toBe("");
    expect(sanitizeQuantityInput("007")).toBe("7");
    expect(sanitizeQuantityInput("1.5")).toBe("15");
    expect(sanitizeQuantityInput("1e3")).toBe("13");
  });

  it("needs at least 1", () => {
    expect(parseQuantity("50")).toBe(50);
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("-2")).toBeNull();
    expect(parseQuantity("")).toBeNull();
  });
});

describe("repeated addresses", () => {
  it("finds the same pickup twice, ignoring case and punctuation", () => {
    const clashes = findAddressClashes(
      [{ address: "Imus City, Cavite" }, { address: "imus city cavite" }],
      [{ address: "Makati" }],
    );
    expect(clashes).toEqual([{ section: "pickup", index: 1, message: "Same address as pickup 1." }]);
  });

  it("finds a delivery that is also a pickup", () => {
    const clashes = findAddressClashes([{ address: "Pasig" }], [{ address: "Makati" }, { address: "Pasig" }]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ section: "delivery", index: 1 });
    expect(clashes[0].message).toContain("Already used as pickup 1");
  });

  it("leaves blank rows to the required check", () => {
    expect(findAddressClashes([{ address: "" }], [{ address: " " }])).toEqual([]);
  });
});

describe("a day on the calendar", () => {
  it("is refused when it does not exist, rather than rolled into next month", () => {
    // Date.parse read 2026-02-30 as 2 March.
    for (const day of ["2026-02-30", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "26-10-05", ""]) {
      expect(isRealDate(day), day).toBe(false);
    }
    for (const day of ["2028-02-29", "2026-12-31", "2026-01-01"]) {
      expect(isRealDate(day), day).toBe(true);
    }
  });

  it("counts days on the calendar, across months and years", () => {
    expect(addDays("2026-10-08", 365)).toBe("2027-10-08");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is a year out at most", () => {
    expect(isTooFarAhead("2027-10-08", "2026-10-08")).toBe(false);
    expect(isTooFarAhead("2027-10-09", "2026-10-08")).toBe(true);
    expect(isTooFarAhead("2062-10-08", "2026-10-08")).toBe(true);
  });
});
