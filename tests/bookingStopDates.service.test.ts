import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Every stop is stored with the day it is due, and moves with its booking.
//
// A stop used to carry only a time; its day was the order's date, guessed
// forward across one midnight. A booking now stores a date on each stop from
// the moment it is made - from the coordinator's own dates when the form sends
// them, from the old overnight reading when it does not - and a reschedule
// moves the whole run, keeping each stop's place relative to the first.

const db = supabaseDouble();

vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));
// Nothing is found on the map, so the drive is never measured: these tests are
// about the dates written, not the road.
vi.mock("@/services/geo/geocodingService", () => ({ geocodeAddresses: async () => new Map() }));
vi.mock("@/services/geo/routingService", () => ({ getRouteGeometry: async () => null }));
vi.mock("@/services/dispatch/dispatchService", () => ({
  releaseDispatchResources: async () => undefined,
  isUuid: () => true,
}));
vi.mock("@/services/storage/podService", () => ({ signPodUrls: async (rows: unknown) => rows }));

const { createBooking, updateBooking, BookingNotPossible } = await import("@/services/booking/bookingService");

const ORDER = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
  vi.useFakeTimers();
  // 10:00 on Monday 5 October in Manila.
  vi.setSystemTime(new Date("2026-10-05T02:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

const written = (table: string) =>
  db.writes.filter((write) => write.table === table).flatMap((write) => write.payload as Record<string, unknown>[]);

describe("making a booking", () => {
  const dto = (pickups: Record<string, unknown>[], stops: Record<string, unknown>[], deliverySchedule = "2026-10-06") => ({
    clientID: null,
    deliverySchedule,
    notes: "",
    items: [{ productName: "Tiles", productType: "General", quantity: 10, weightPerItem: 0 }],
    pickups: pickups.map((pickup) => ({ warehouseName: "Valenzuela", pickupAddress: "Valenzuela City", quantity: 10, ...pickup })),
    stops: stops.map((stop) => ({
      branchName: "Davao",
      contactPerson: "Trisha",
      contactNum: "09281112013",
      deliveryAddress: "Davao City",
      quantity: 10,
      ...stop,
    })),
    acknowledgeTightSchedule: false,
  });

  const create = (booking: ReturnType<typeof dto>) => {
    db.queue({ data: { orderID: ORDER } });
    return createBooking(booking as Parameters<typeof createBooking>[0]);
  };

  it("stores the coordinator's dates on a run of several days", async () => {
    await create(dto([{ expectedTime: "08:00" }], [{ expectedTime: "17:00", expectedDate: "2026-10-08" }]));

    expect(written("PickupStops")[0]).toMatchObject({ expectedTime: "08:00:00", expectedDate: "2026-10-06" });
    expect(written("BranchStops")[0]).toMatchObject({ expectedTime: "17:00", expectedDate: "2026-10-08" });
  });

  it("stores the old overnight reading for a booking sent without dates", async () => {
    // The booking form before it had a date on each row.
    await create(dto([{ expectedTime: "21:00" }], [{ expectedTime: "03:00" }, { expectedTime: "06:00" }]));

    expect(written("PickupStops").map((row) => row.expectedDate)).toEqual(["2026-10-06"]);
    expect(written("BranchStops").map((row) => row.expectedDate)).toEqual(["2026-10-07", "2026-10-07"]);
  });

  it("refuses a schedule that has gone wrong between the check and the save, before writing", async () => {
    // Today at 09:00, an hour ago - the schema would have refused it; this is
    // the service's own guard for the minute between them.
    // Called directly, with nothing queued: a queued answer it never reads
    // would be handed to the next test instead.
    const booking = dto([{ expectedTime: "09:00" }], [{ expectedTime: "15:00" }], "2026-10-05");
    await expect(createBooking(booking as Parameters<typeof createBooking>[0])).rejects.toBeInstanceOf(BookingNotPossible);
    expect(db.writes).toHaveLength(0);
  });
});

describe("moving a booking to another day", () => {
  const booking = (pickups: Record<string, unknown>[], stops: Record<string, unknown>[], deliverySchedule: string | null = "2026-10-10") => ({
    orderID: ORDER,
    orderCode: "ORD-1",
    notes: `[DELIVERY DETAILS]\nPriority: Standard\nDelivery Schedule: ${deliverySchedule ?? ""}\n`,
    isActive: true,
    deliverySchedule,
    OrderDetails: [],
    DispatchOrder: [],
    PickupStops: pickups.map((pickup, index) => ({ pickupID: index + 1, warehouseName: "Valenzuela", sequence: index + 1, ...pickup })),
    BranchStops: stops.map((stop, index) => ({ branchID: 100 + index, branchName: "Davao", sequence: index + 1, ...stop })),
  });

  const stopWrites = () =>
    db.writes
      .filter((write) => write.table === "PickupStops" || write.table === "BranchStops")
      .map((write) => [write.table, (write.payload as { expectedDate: string }).expectedDate]);

  it("moves the whole run, keeping each stop's place after the first", async () => {
    db.queue({
      data: booking(
        [{ expectedTime: "08:00:00", expectedDate: "2026-10-10" }],
        [
          { expectedTime: "17:00:00", expectedDate: "2026-10-12" },
          { expectedTime: "09:00:00", expectedDate: "2026-10-13" },
        ],
      ),
    });

    await updateBooking(ORDER, { deliverySchedule: "2026-10-15" });

    expect(stopWrites()).toEqual([
      ["PickupStops", "2026-10-15"],
      ["BranchStops", "2026-10-17"],
      ["BranchStops", "2026-10-18"],
    ]);
  });

  it("gives an older booking's stops their dates as they were booked, then moves them", async () => {
    db.queue({ data: booking([{ expectedTime: "21:00:00" }], [{ expectedTime: "03:00:00" }]) });

    await updateBooking(ORDER, { deliverySchedule: "2026-10-15" });

    expect(stopWrites()).toEqual([
      ["PickupStops", "2026-10-15"],
      ["BranchStops", "2026-10-16"],
    ]);
  });

  it("moves the stops before the booking, and leaves the booking where it was if a stop fails", async () => {
    db.queue(
      { data: booking([{ expectedTime: "08:00:00", expectedDate: "2026-10-10" }], [{ expectedTime: "17:00:00", expectedDate: "2026-10-10" }]) },
      { data: null },
      { error: { message: "connection lost" } },
    );

    await expect(updateBooking(ORDER, { deliverySchedule: "2026-10-15" })).rejects.toThrow(/move this booking's stops/);
    expect(db.writes.some((write) => write.table === "Order")).toBe(false);
  });

  it("touches no stop when the day does not change", async () => {
    db.queue({ data: booking([{ expectedTime: "08:00:00", expectedDate: "2026-10-10" }], []) }, { data: null });

    await updateBooking(ORDER, { priorityLevel: "Urgent" });

    expect(stopWrites()).toEqual([]);
  });
});
