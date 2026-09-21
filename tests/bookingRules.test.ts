import { describe, expect, it } from "vitest";
import {
  findAddressClashes,
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
