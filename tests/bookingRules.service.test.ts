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

// The drive is the map's answer; each test says what the map would have said.
const getRouteGeometry = vi.fn();
vi.mock("@/services/geo/routingService", () => ({ getRouteGeometry }));

const { updateBooking, cancelBooking, RescheduleNotPossible, RescheduleNeedsConfirmation } = await import(
  "@/services/booking/bookingService"
);

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
      "North Hub's 8:00 AM has already passed today. Pick a later day.",
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

    // These stops were never placed on the map, so today could not be
    // checked and the coordinator is asked; this is the second try, kept.
    const result = await updateBooking(ORDER, { deliverySchedule: "2026-10-08", acknowledgeTightSchedule: true });
    expect(result.rescheduled).toBe(true);
  });

  it("allows tomorrow at the same 08:00", async () => {
    db.queue({ data: withStops([pickup("08:00:00")], []) }, { data: null });

    const result = await updateBooking(ORDER, { deliverySchedule: "2026-10-09" });
    expect(result.rescheduled).toBe(true);
  });
});

describe("moving a booking to today when the first stop cannot be reached in time", () => {
  // 2026-10-08, two in the afternoon in Manila.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T14:00:00+08:00"));
    getRouteGeometry.mockReset();
    getRouteGeometry.mockResolvedValue(null);
  });
  afterEach(() => vi.useRealTimers());

  const route = (legMinutes: number[]) => ({
    path: [],
    minutes: legMinutes.reduce((a, b) => a + b, 0),
    distanceKm: 0,
    legMinutes,
  });
  const pickup = (expectedTime: string, at: [number, number] | null = [14.6, 121.0]) => ({
    warehouseName: "North Hub",
    expectedTime,
    sequence: 1,
    pickupLat: at?.[0] ?? null,
    pickupLong: at?.[1] ?? null,
  });
  const branch = (branchName: string, expectedTime: string, sequence: number, at: [number, number] = [14.55, 121.02]) => ({
    branchName,
    expectedTime,
    sequence,
    deliveryLat: at[0],
    deliverLong: at[1],
  });
  const withStops = (pickups: unknown[], stops: unknown[]) => ({ ...booking("Assigned"), PickupStops: pickups, BranchStops: stops });

  it("refuses a first stop half an hour away and two hours' drive from the yard", async () => {
    getRouteGeometry.mockResolvedValue(route([120, 30]));
    db.queue({ data: withStops([pickup("14:30:00")], [branch("Makati", "18:00:00", 1)]) });

    const refusal = updateBooking(ORDER, { deliverySchedule: "2026-10-08" });
    await expect(refusal).rejects.toBeInstanceOf(RescheduleNotPossible);
    await expect(refusal).rejects.toThrow(/^North Hub is 30 minutes away .* cannot get there in time/);
    expect(db.writes).toHaveLength(0);

    // One request, from the yard through the stored stops in route order.
    expect(getRouteGeometry).toHaveBeenCalledTimes(1);
    const waypoints = getRouteGeometry.mock.calls[0][0];
    expect(waypoints.slice(1)).toEqual([
      { latitude: 14.6, longitude: 121.0 },
      { latitude: 14.55, longitude: 121.02 },
    ]);
  });

  it("asks before keeping a tight day, and saves nothing until asked", async () => {
    getRouteGeometry.mockResolvedValue(route([100, 30]));
    db.queue({ data: withStops([pickup("16:30:00")], [branch("Makati", "17:00:00", 1)]) });

    const question = updateBooking(ORDER, { deliverySchedule: "2026-10-08" });
    await expect(question).rejects.toBeInstanceOf(RescheduleNeedsConfirmation);
    await expect(question).rejects.toThrow(/nothing to spare/);
    expect(db.writes).toHaveLength(0);
  });

  it("keeps a tight day once the coordinator has chosen to", async () => {
    getRouteGeometry.mockResolvedValue(route([100, 30]));
    db.queue({ data: withStops([pickup("16:30:00")], [branch("Makati", "17:00:00", 1)]) });

    const result = await updateBooking(ORDER, { deliverySchedule: "2026-10-08", acknowledgeTightSchedule: true });
    expect(result.rescheduled).toBe(true);
    expect(db.writes.some((write) => write.table === "Order")).toBe(true);
  });

  it("asks about a day it could not check, naming the stop nobody placed, without asking the map", async () => {
    db.queue({ data: withStops([], [branch("Makati", "16:00:00", 1), branch("Pasig", "18:00:00", 2, [0, 0])]) });

    const question = updateBooking(ORDER, { deliverySchedule: "2026-10-08" });
    await expect(question).rejects.toBeInstanceOf(RescheduleNeedsConfirmation);
    await expect(question).rejects.toThrow(/could not be checked: Pasig is not placed on the map/);
    expect(getRouteGeometry).not.toHaveBeenCalled();
    expect(db.writes).toHaveLength(0);
  });

  it("still refuses a day the truck cannot make, acknowledged or not", async () => {
    getRouteGeometry.mockResolvedValue(route([120, 30]));
    db.queue({ data: withStops([pickup("14:30:00")], [branch("Makati", "18:00:00", 1)]) });

    await expect(
      updateBooking(ORDER, { deliverySchedule: "2026-10-08", acknowledgeTightSchedule: true }),
    ).rejects.toBeInstanceOf(RescheduleNotPossible);
  });

  it("does not ask the map, or the coordinator, for any day but today", async () => {
    db.queue({ data: withStops([pickup("14:30:00")], [branch("Makati", "18:00:00", 1)]) }, { data: null });

    const result = await updateBooking(ORDER, { deliverySchedule: "2026-10-09" });
    expect(result.rescheduled).toBe(true);
    expect(getRouteGeometry).not.toHaveBeenCalled();
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
