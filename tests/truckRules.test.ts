import { describe, expect, it, vi } from "vitest";

// What a truck record has to make sense of.
//
// Capacity was free text: the server stripped everything but digits and dots,
// so "-5" was saved as a 5 kg truck, "0" as one that carries nothing, and
// "abc" came back as "Capacity is required". Plates were stored as typed -
// "qat 9999" beside NKA-7536 - and the truck type was whatever was sent.

vi.mock("@/app/lib/supabase", () => ({ supabase: {} }));

const { parseCapacity, normalizePlate, isValidPlate, isTruckType, isValidLastChecked, CAPACITY_RULE, PLATE_RULE, TRUCK_TYPE_RULE, LAST_CHECKED_RULE } =
  await import("@/app/lib/truckRules");
const { toTruckPayload, validateTruckPayload } = await import("@/services/truck/truckService");

const TODAY = "2026-10-10";
const check = (body: Record<string, unknown>, isCreate = true) => validateTruckPayload(toTruckPayload(body), isCreate, TODAY);
const truck = (over: Record<string, unknown> = {}) => ({ plateNumber: "qat 9999", truckType: "Closed Van", capacity: "5,000 kg", lastChecked: "2026-10-01", ...over });

describe("a truck's capacity", () => {
  it("is read in kilograms however it was typed", () => {
    expect(parseCapacity("5000")).toBe(5000);
    expect(parseCapacity("5,000 kg")).toBe(5000);
    expect(parseCapacity("1000kgs")).toBe(1000);
    expect(parseCapacity(18000)).toBe(18000);
  });

  it("is refused when it is not a weight a truck could carry", () => {
    for (const bad of ["-5", "0", "abc", "", "5 tons", "999999"]) expect(parseCapacity(bad), bad).toBeNull();
  });

  it("is refused on the server by name, not reported as missing", () => {
    expect(check(truck({ capacity: "abc" }))).toBe(CAPACITY_RULE);
    expect(check(truck({ capacity: "-5" }))).toBe(CAPACITY_RULE);
    expect(check(truck({ capacity: "0" }))).toBe(CAPACITY_RULE);
  });
});

describe("a plate number", () => {
  it("is stored in the fleet's own form", () => {
    expect(normalizePlate("qat 9999")).toBe("QAT-9999");
    expect(normalizePlate("QAT9999")).toBe("QAT-9999");
    expect(normalizePlate(" nka-7536 ")).toBe("NKA-7536");
    expect(toTruckPayload(truck()).plateNumber).toBe("QAT-9999");
  });

  it("must look like a plate", () => {
    expect(isValidPlate("QAT-9999")).toBe(true);
    expect(isValidPlate("ABC 123")).toBe(true);
    for (const bad of ["!!!", "ABCD", "1234", "A"]) expect(isValidPlate(bad), bad).toBe(false);
    expect(check(truck({ plateNumber: "????" }))).toBe(PLATE_RULE);
  });
});

describe("the rest of a truck", () => {
  it("has a type from the list, older records' 'Others' included", () => {
    expect(isTruckType("Closed Van")).toBe(true);
    expect(isTruckType("Others")).toBe(true);
    expect(check(truck({ truckType: "Spaceship" }))).toBe(TRUCK_TYPE_RULE);
  });

  it("was last checked on a real day that has happened", () => {
    expect(isValidLastChecked("2026-10-10", TODAY)).toBe(true);
    expect(check(truck({ lastChecked: "2026-10-11" }))).toBe(LAST_CHECKED_RULE);
    expect(check(truck({ lastChecked: "2026-02-30" }))).toBe(LAST_CHECKED_RULE);
  });

  it("starts on no trip, so it cannot be added as On Delivery", () => {
    expect(check(truck({ status: "On Delivery" }))).toMatch(/On Delivery comes from a trip/);
    expect(check(truck({ status: "On Maintenance" }))).toBeNull();
  });

  it("passes when everything makes sense", () => {
    expect(check(truck())).toBeNull();
  });

  it("is judged on an edit only by what the edit sends", () => {
    // The mechanic's status change sends a status and today's date.
    expect(check({ status: "On Maintenance", lastChecked: TODAY }, false)).toBeNull();
  });
});
