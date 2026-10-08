import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// When a booking may still be changed, and when it is a record of something
// already happening.

const db = supabaseDouble();

vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));
vi.mock("@/services/geo/geocodingService", () => ({ geocodeAddresses: async () => [] }));
vi.mock("@/services/dispatch/dispatchService", () => ({
  releaseDispatchResources: async () => undefined,
  isUuid: () => true,
}));
vi.mock("@/services/storage/podService", () => ({ signPodUrls: async (rows: unknown) => rows }));

const { updateBooking, cancelBooking, RescheduleNotPossible } = await import("@/services/booking/bookingService");

const ORDER = "44444444-4444-4444-8444-444444444444";

const booking = (status: string | null, items: { itemID: string; productName: string }[] = []) => ({
  orderID: ORDER,
  orderCode: "ORD-000001-AAAA",
  notes: "[DELIVERY DETAILS]\nPriority: Standard\nDelivery Schedule: 2026-09-05\n\n[NOTES]\nCall ahead",
  isActive: true,
  OrderDetails: items,
  DispatchOrder: status ? [{ dispatchID: "d1", status }] : [],
});

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
});

describe("editing a booking", () => {
  it("saves the schedule while the trip has not left", async () => {
    db.queue({ data: booking("Assigned") }, { data: null });

    const result = await updateBooking(ORDER, { deliverySchedule: "2026-09-11" });

    expect(result.changed).toEqual(["deliverySchedule"]);
    expect(result.rescheduled).toBe(true);

    const written = db.writes.find((write) => write.table === "Order");
    const notes = (written?.payload as { notes: string }).notes;
    expect(notes).toContain("Delivery Schedule: 2026-09-11");
    // Everything else in the document survives the edit.
    expect(notes).toContain("Priority: Standard");
    expect(notes).toContain("Call ahead");
  });

  it("refuses once the truck is on the road", async () => {
    db.queue({ data: booking("In Transit") });

    await expect(updateBooking(ORDER, { deliverySchedule: "2026-09-11" })).rejects.toThrow(/already on the road/i);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a delivery that is over", async () => {
    db.queue({ data: booking("Completed") });

    await expect(updateBooking(ORDER, { priorityLevel: "Urgent" })).rejects.toThrow(/finished/i);
    expect(db.writes).toHaveLength(0);
  });

  it("still allows editing after a crew declined: it needs assigning again", async () => {
    db.queue({ data: booking("Rejected") }, { data: null });

    const result = await updateBooking(ORDER, { priorityLevel: "Urgent" });
    expect(result.changed).toEqual(["priorityLevel"]);
  });

  it("refuses a cancelled booking", async () => {
    db.queue({ data: { ...booking(null), isActive: false } });

    await expect(updateBooking(ORDER, { priorityLevel: "Urgent" })).rejects.toThrow(/cancelled/i);
  });

  it("renames the product of a booking carrying one item", async () => {
    db.queue({ data: booking("Assigned", [{ itemID: "i1", productName: "Rice" }]) }, { data: null });

    const result = await updateBooking(ORDER, { product: "Sugar" });

    expect(result.changed).toEqual(["product"]);
    expect(db.writes.find((write) => write.table === "OrderDetails")?.payload).toEqual({ productName: "Sugar" });
  });

  it("will not rename several items with one line", async () => {
    db.queue({
      data: booking("Assigned", [
        { itemID: "i1", productName: "Rice" },
        { itemID: "i2", productName: "Sugar" },
      ]),
    });

    await expect(updateBooking(ORDER, { product: "Everything" })).rejects.toThrow(/several items/i);
    expect(db.writes.some((write) => write.table === "OrderDetails")).toBe(false);
  });

  it("reports nothing changed when the values are the ones already there", async () => {
    db.queue({ data: booking("Assigned") });

    const result = await updateBooking(ORDER, { deliverySchedule: "2026-09-05", priorityLevel: "Standard" });

    expect(result.changed).toEqual([]);
    expect(result.rescheduled).toBe(false);
  });
});

describe("moving a booking to a day whose first stop has gone", () => {
  // 2026-10-08, two in the afternoon in Manila.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T14:00:00+08:00"));
  });
  afterEach(() => vi.useRealTimers());

  type Stop = { expectedTime: string; sequence: number };
  const pickup = (expectedTime: string, sequence = 1) => ({ warehouseName: "North Hub", expectedTime, sequence });
  const branch = (branchName: string, expectedTime: string, sequence: number) => ({ branchName, expectedTime, sequence });
  const withStops = (pickups: Stop[], stops: Stop[]) => ({ ...booking("Assigned"), PickupStops: pickups, BranchStops: stops });

  it("refuses today when the first pickup was at 08:00, naming the stop and time", async () => {
    db.queue({ data: withStops([pickup("08:00:00")], [branch("Makati", "16:00:00", 1)]) });

    const refusal = updateBooking(ORDER, { deliverySchedule: "2026-10-08" });
    await expect(refusal).rejects.toBeInstanceOf(RescheduleNotPossible);
    await expect(refusal).rejects.toThrow(
      "North Hub's 8:00 AM has already passed today. Pick a later day, or change the stop times.",
    );
    expect(db.writes).toHaveLength(0);
  });

  it("judges the first stop in route order, not the first row returned", async () => {
    db.queue({
      data: withStops(
        [],
        [branch("Pasig", "18:00:00", 2), branch("Makati", "09:00:00", 1)],
      ),
    });

    await expect(updateBooking(ORDER, { deliverySchedule: "2026-10-08" })).rejects.toThrow(/^Makati's 9:00 AM/);
  });

  it("allows today when the first stop is still ahead, and a later stop earlier on the clock is overnight", async () => {
    db.queue(
      { data: withStops([pickup("16:00:00")], [branch("Makati", "02:00:00", 1)]) },
      { data: null },
    );

    const result = await updateBooking(ORDER, { deliverySchedule: "2026-10-08" });
    expect(result.rescheduled).toBe(true);
  });

  it("allows tomorrow at the same 08:00", async () => {
    db.queue({ data: withStops([pickup("08:00:00")], []) }, { data: null });

    const result = await updateBooking(ORDER, { deliverySchedule: "2026-10-09" });
    expect(result.rescheduled).toBe(true);
  });
});

describe("cancelling a booking", () => {
  it("refuses one that is finished", async () => {
    db.queue({ data: { orderID: ORDER, isActive: true, DispatchOrder: [{ dispatchID: "d1", status: "Completed" }] } });

    await expect(cancelBooking(ORDER, "no longer needed")).rejects.toThrow(/already completed/i);
  });

  it("sends one already on the road to the foul trip flow instead", async () => {
    db.queue({ data: { orderID: ORDER, isActive: true, DispatchOrder: [{ dispatchID: "d1", status: "In Transit" }] } });

    await expect(cancelBooking(ORDER, "no longer needed")).rejects.toThrow(/foul trip/i);
  });
});
