import { afterEach, describe, expect, it, vi } from "vitest";

import { formErrorsFromIssues, formKeyForIssue } from "@/app/lib/bookingIssues";
import { createOrderSchema } from "@/app/schemas/booking/booking.schema";
import { EARLIER_SAME_DAY_RULE, RUN_TOO_LONG_RULE } from "@/app/lib/stopSchedule";

// A server refusal put back on the field it is about.
//
// It came back as "Validation failed" and nothing else: the form stayed open
// and nobody could tell which field was wrong. These run the real schema, so a
// renamed request field shows up here rather than as a cell nobody marks.

afterEach(() => vi.useRealTimers());

const booking = (pickups: Record<string, unknown>[], stops: Record<string, unknown>[]) => ({
  clientID: null,
  deliverySchedule: "2026-10-10",
  notes: "",
  items: [{ productName: "Tiles", productType: "General", quantity: 10, weightPerItem: 0 }],
  pickups: pickups.map((pickup, i) => ({
    warehouseName: `Warehouse ${i + 1}`,
    pickupAddress: `Warehouse ${i + 1}, Valenzuela`,
    quantity: 10,
    expectedDate: "2026-10-10",
    ...pickup,
  })),
  stops: stops.map((stop, i) => ({
    branchName: `Branch ${i + 1}`,
    contactPerson: "Trisha",
    contactNum: "09281112013",
    deliveryAddress: `Branch ${i + 1}, Cebu`,
    quantity: 10,
    expectedDate: "2026-10-10",
    ...stop,
  })),
});

const refusalOf = (body: unknown) => {
  const result = createOrderSchema.safeParse(body);
  if (result.success) throw new Error("expected a refusal");
  return result.error.issues.map((issue) => ({ path: issue.path as (string | number)[], message: issue.message }));
};

describe("a refused booking on the form", () => {
  it("marks the time a stop was refused on", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T02:00:00.000Z"));
    const { errors, summary } = formErrorsFromIssues(
      refusalOf(booking([{ expectedTime: "21:00" }], [{ expectedTime: "03:00" }])),
    );
    expect(errors).toEqual({ delivery_0_deliveryTime: EARLIER_SAME_DAY_RULE });
    expect(summary).toBe(`The booking was refused - Delivery 1: ${EARLIER_SAME_DAY_RULE}`);
  });

  it("marks the date of the stop past the week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T02:00:00.000Z"));
    const { errors } = formErrorsFromIssues(
      refusalOf(booking([{ expectedTime: "08:00" }], [{ expectedTime: "09:00", expectedDate: "2026-10-17" }])),
    );
    expect(errors).toEqual({ delivery_0_date: RUN_TOO_LONG_RULE });
  });

  it("marks an address on the pickup it belongs to", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T02:00:00.000Z"));
    const { errors } = formErrorsFromIssues(
      refusalOf(booking([{ expectedTime: "08:00", pickupAddress: "" }], [{ expectedTime: "14:00" }])),
    );
    expect(Object.keys(errors)).toEqual(["pickup_0_warehouseAddress"]);
  });

  it("knows every cell the form has", () => {
    expect(formKeyForIssue(["deliverySchedule"])).toBe("deliverySchedule");
    expect(formKeyForIssue(["items", 0, "productName"])).toBe("product");
    expect(formKeyForIssue(["pickups", 1, "expectedDate"])).toBe("pickup_1_date");
    expect(formKeyForIssue(["pickups", 0, "contactNum"])).toBe("pickup_0_contactNumber");
    expect(formKeyForIssue(["stops", 2, "branchName"])).toBe("delivery_2_branchName");
    expect(formKeyForIssue(["stops", 0, "quantity"])).toBe("delivery_0_quantity");
    expect(formKeyForIssue(["acknowledgeTightSchedule"])).toBeNull();
  });

  it("still says what was wrong when it is about no cell", () => {
    expect(formErrorsFromIssues([{ path: ["clientID"], message: "Invalid client ID format" }])).toEqual({
      errors: {},
      summary: "The booking was refused - Invalid client ID format",
    });
  });
});
