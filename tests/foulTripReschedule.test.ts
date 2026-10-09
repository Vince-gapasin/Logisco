import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// A foul trip picked up again on a later day.
//
// The reschedule rewrote the "Delivery Schedule" line of the notes and nothing
// else: the deliverySchedule column kept the day the truck broke down, a time
// given with it made the line unreadable as a date, and the stops - which now
// carry their own day - stayed on the old one, so the recovery crew would have
// been judged days late. Now the remaining run moves as a whole, and a day that
// cannot work is refused before a truck is taken for it.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const assignDispatch = vi.fn(async () => ({ dispatchID: "new-trip" }));
vi.mock("@/services/dispatch/dispatchService", () => ({
  assignDispatch,
  releaseDispatchResources: async () => undefined,
  isUuid: () => true,
}));

const { reassign, FoulTripError } = await import("@/services/foulTrip/foulTripService");

const ORDER = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const ACTOR = { employeeID: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", employeeName: "Office" };
const CREW = { truckID: "t1", driverID: "e1" };

const incident = { incidentID: "i1", dispatchID: "old-trip", orderID: ORDER, status: "open", cargoLoaded: false };

const order = (stops: { pickups: Record<string, unknown>[]; branches: Record<string, unknown>[] }) => ({
  notes: "[DELIVERY DETAILS]\nPriority: Standard\nDelivery Schedule: 2026-10-10\n",
  deliverySchedule: "2026-10-10",
  PickupStops: stops.pickups,
  BranchStops: stops.branches,
});

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
  assignDispatch.mockClear();
  vi.useFakeTimers();
  // 10:00 on Friday 9 October in Manila... moved on to the 14th where needed.
  vi.setSystemTime(new Date("2026-10-09T02:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

const run = {
  pickups: [{ pickupID: 1, warehouseName: "Valenzuela", expectedTime: "08:00:00", expectedDate: "2026-10-10", sequence: 1, stopStatus: "Completed" }],
  branches: [
    { branchID: 11, branchName: "Cebu", expectedTime: "11:00:00", expectedDate: "2026-10-10", sequence: 1, stopStatus: "Successfully Delivered" },
    { branchID: 12, branchName: "Bohol", expectedTime: "15:00:00", expectedDate: "2026-10-10", sequence: 2, stopStatus: "Pending" },
    { branchID: 13, branchName: "Davao", expectedTime: "09:00:00", expectedDate: "2026-10-11", sequence: 3, stopStatus: "Pending" },
  ],
};

describe("rescheduling a foul trip", () => {
  it("moves the stops still to make, keeps the made ones, and dates the booking in column and note", async () => {
    db.queue({ data: incident }, { data: order(run) }, { data: [] });

    await reassign("i1", CREW, ACTOR, { date: "2026-10-14", time: "14:00" });

    const stopDates = db.writes
      .filter((write) => write.table === "PickupStops" || write.table === "BranchStops")
      .map((write) => [write.table, (write.payload as { expectedDate: string }).expectedDate]);
    expect(stopDates).toEqual([
      ["PickupStops", "2026-10-10"],
      ["BranchStops", "2026-10-10"],
      ["BranchStops", "2026-10-14"],
      ["BranchStops", "2026-10-15"],
    ]);

    const booking = db.writes.find((write) => write.table === "Order")?.payload as { notes: string; deliverySchedule: string };
    expect(booking.deliverySchedule).toBe("2026-10-14");
    // The date alone, so every screen can read it; the time is in the resolution notes.
    expect(booking.notes).toContain("Delivery Schedule: 2026-10-14\n");
    expect(booking.notes).not.toContain("14:00");
  });

  it("refuses a day whose first remaining stop has already gone, before taking a truck", async () => {
    // 16:00 on the 14th: Bohol's 15:00 is gone.
    vi.setSystemTime(new Date("2026-10-14T08:00:00.000Z"));
    db.queue({ data: incident }, { data: order(run) });

    await expect(reassign("i1", CREW, ACTOR, { date: "2026-10-14" })).rejects.toBeInstanceOf(FoulTripError);
    expect(assignDispatch).not.toHaveBeenCalled();
    expect(db.writes).toHaveLength(0);
  });

  it("leaves the schedule alone on a plain re-assignment", async () => {
    db.queue({ data: incident }, { data: [] });

    await reassign("i1", CREW, ACTOR);

    expect(db.writes.some((write) => write.table === "Order")).toBe(false);
    expect(db.writes.some((write) => (write.payload as { expectedDate?: string })?.expectedDate)).toBe(false);
  });
});
