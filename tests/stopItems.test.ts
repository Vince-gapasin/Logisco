import { afterEach, describe, expect, it, vi } from "vitest";

import {
  describeItem,
  describeItems,
  loadBalance,
  orderDetailsFromStops,
  productTotals,
  readStopItems,
  totalUnits,
  type StopItem,
} from "@/app/lib/stopItems";
import { createOrderSchema } from "@/app/schemas/booking/booking.schema";
import { formKeyForIssue } from "@/app/lib/bookingIssues";

// Several products on every stop: what a pickup loads and what each delivery
// drops off. The office lists them once, on the booking form; everything else
// - the cargo line, the stop totals, the crew's list - is worked out from them.

afterEach(() => vi.useRealTimers());

const buns = (quantity: number): StopItem => ({ productName: "Buns", quantity, unit: "trays" });
const cake = (quantity: number): StopItem => ({ productName: "Cake", quantity, unit: "boxes" });
const utensils = (quantity: number): StopItem => ({ productName: "Utensils", quantity, unit: "packs" });
const biscuits = (quantity: number): StopItem => ({ productName: "Biscuits", quantity, unit: "pcs" });

describe("a stop's products", () => {
  it("read as a line for the crew and the office", () => {
    expect(describeItem(buns(50))).toBe("Buns 50 trays");
    expect(describeItem(biscuits(1))).toBe("Biscuits 1 pc");
    expect(describeItem(biscuits(1200))).toBe("Biscuits 1,200 pcs");
    expect(describeItems([buns(50), cake(20)])).toBe("Buns 50 trays, Cake 20 boxes");
    expect(describeItems([])).toBe("");
  });

  it("add up to the stop's quantity", () => {
    expect(totalUnits([buns(50), cake(20), utensils(10), biscuits(30)])).toBe(110);
  });

  it("are one product however the name is spaced or cased", () => {
    const totals = productTotals([[buns(20)], [{ productName: "  buns ", quantity: 30, unit: "trays" }]]);
    expect(totals).toEqual([buns(50)]);
  });

  it("are two products when the unit differs", () => {
    const totals = productTotals([[buns(20), { productName: "Buns", quantity: 5, unit: "boxes" }]]);
    expect(totals).toHaveLength(2);
  });

  it("come back from the database in the office's order, unknown units read as pieces", () => {
    expect(
      readStopItems([
        { productName: "Cake", quantity: 20, unit: "boxes", position: 2 },
        { productName: "Buns", quantity: 50, unit: "trays", position: 1 },
        { productName: "Mystery", quantity: 3, unit: "gallons", position: 3 },
        { productName: "", quantity: 4, unit: "pcs", position: 4 },
      ]),
    ).toEqual([buns(50), cake(20), { productName: "Mystery", quantity: 3, unit: "pcs" }]);
    expect(readStopItems(null)).toEqual([]);
  });
});

describe("loaded against dropped off", () => {
  // The client's example: one warehouse loads all four, two branches split them.
  const pickup = [[buns(50), cake(20), utensils(10), biscuits(30)]];
  const branchA = [buns(30), cake(5), biscuits(30)];
  const branchB = [buns(20), cake(15), utensils(10)];

  it("balances when every product loaded is dropped off", () => {
    const rows = loadBalance(pickup, [branchA, branchB]);
    expect(rows.every((row) => row.loaded === row.dropped)).toBe(true);
    expect(rows.map((row) => row.productName)).toEqual(["Buns", "Cake", "Utensils", "Biscuits"]);
  });

  it("points out a product that does not add up", () => {
    const rows = loadBalance(pickup, [branchA, [buns(10), cake(15), utensils(10)]]);
    expect(rows.filter((row) => row.loaded !== row.dropped)).toEqual([
      { productName: "Buns", unit: "trays", loaded: 50, dropped: 40 },
    ]);
  });

  it("writes the booking's cargo from what is dropped off, one row per product", () => {
    expect(orderDetailsFromStops(pickup, [branchA, branchB])).toEqual([
      { productName: "Buns", productType: "trays", quantity: 50, weightPerItem: 0 },
      { productName: "Cake", productType: "boxes", quantity: 20, weightPerItem: 0 },
      { productName: "Biscuits", productType: "pcs", quantity: 30, weightPerItem: 0 },
      { productName: "Utensils", productType: "packs", quantity: 10, weightPerItem: 0 },
    ]);
  });

  it("falls back to what is loaded when the drop-offs list nothing", () => {
    expect(orderDetailsFromStops([[buns(50)]], [[]])).toEqual([
      { productName: "Buns", productType: "trays", quantity: 50, weightPerItem: 0 },
    ]);
  });
});

describe("the server's check of products on a new booking", () => {
  const booking = (pickupItems: unknown, stopItems: unknown) => ({
    clientID: null,
    deliverySchedule: "2026-10-10",
    notes: "",
    items: [{ productName: "Buns, Cake", productType: "General", quantity: 10, weightPerItem: 0 }],
    pickups: [
      {
        warehouseName: "Warehouse 1",
        pickupAddress: "Warehouse 1, Valenzuela",
        expectedDate: "2026-10-10",
        expectedTime: "08:00",
        items: pickupItems,
      },
    ],
    stops: [
      {
        branchName: "Branch 1",
        contactPerson: "Trisha",
        contactNum: "09281112013",
        deliveryAddress: "Branch 1, Quezon City",
        expectedDate: "2026-10-10",
        expectedTime: "14:00",
        items: stopItems,
      },
    ],
  });

  const parse = (body: unknown) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T02:00:00.000Z"));
    return createOrderSchema.safeParse(body);
  };

  it("takes a stop with several products, tidying the names", () => {
    const result = parse(booking([buns(50), cake(20)], [{ productName: "  Buns  ", quantity: "50", unit: "trays" }]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.pickups[0].items).toEqual([buns(50), cake(20)]);
    expect(result.data.stops[0].items).toEqual([buns(50)]);
  });

  it("still takes a stop that only sends a quantity, as older screens do", () => {
    const body = booking(undefined, undefined);
    expect(parse(body).success).toBe(true);
  });

  it("refuses a product with no name, no amount, or a unit it does not know", () => {
    const result = parse(
      booking(
        [{ productName: " ", quantity: 5, unit: "pcs" }],
        [
          { productName: "Cake", quantity: 0, unit: "boxes" },
          { productName: "Buns", quantity: 5, unit: "gallons" },
        ],
      ),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    const keys = result.error.issues.map((issue) => formKeyForIssue(issue.path as (string | number)[]));
    expect(keys).toEqual(
      expect.arrayContaining(["pickup_0_item_0_productName", "delivery_0_item_0_quantity", "delivery_0_item_1_unit"]),
    );
  });

  it("refuses the same product twice on one stop, and an empty list", () => {
    const result = parse(booking([buns(10), { productName: "buns", quantity: 5, unit: "trays" }], []));
    expect(result.success).toBe(false);
    if (result.success) return;
    const keys = result.error.issues.map((issue) => formKeyForIssue(issue.path as (string | number)[]));
    expect(keys).toEqual(expect.arrayContaining(["pickup_0_item_1_productName", "delivery_0_items"]));
  });
});
