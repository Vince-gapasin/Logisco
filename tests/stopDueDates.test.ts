import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Everything that judges a stop by when it was due now dates it by its own day.
//
// Punctuality, stall alerts and assignment notice all used to date every stop
// with its booking's day. An overnight run's 03:00 drop was "due" at 03:00 on
// the first day, so a crew arriving on time read as a day late; on a run of
// several days, late by every day it ran.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { branchDueDates } = await import("@/services/booking/stopDueDates");
const { routeDueDates } = await import("@/app/lib/stopSchedule");
const { expectedAt, wasOnTime } = await import("@/app/lib/performance");
const { formatShortDay, formatStopWhen } = await import("@/app/lib/datetime");
const { mapOrderToBookingView, toFeedBooking } = await import("@/app/lib/bookingView");
const { bookingSummary, deliveryDays } = await import("@/app/lib/truckBooking");

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
});

describe("the day each stop on a route is due", () => {
  it("is the stop's own day when it has one", () => {
    const due = routeDueDates("2026-10-09", [{ expectedTime: "08:00", sequence: 1 }], [
      { branchID: 1, expectedTime: "17:00", expectedDate: "2026-10-11", sequence: 1 },
    ]);
    expect(due.get(1)).toBe("2026-10-11");
  });

  it("reads an older overnight booking with its collection, which is where the midnight falls", () => {
    // 21:00 collection, 03:00 drop: the drop is the next day. Read from the
    // drops alone it would land on the first day, a full day early.
    const due = routeDueDates("2026-10-09", [{ expectedTime: "21:00", sequence: 1 }], [
      { branchID: 7, expectedTime: "03:00", sequence: 1 },
    ]);
    expect(due.get(7)).toBe("2026-10-10");
  });

  it("follows the route's sequence, not the order the rows came back in", () => {
    const due = routeDueDates("2026-10-09", [], [
      { branchID: 2, expectedTime: "02:00", sequence: 2 },
      { branchID: 1, expectedTime: "22:00", sequence: 1 },
    ]);
    expect(due.get(1)).toBe("2026-10-09");
    expect(due.get(2)).toBe("2026-10-10");
  });
});

describe("dating a list of stops", () => {
  it("costs no query when every stop carries its own day", async () => {
    const due = await branchDueDates([{ branchID: 1, orderID: "o1", expectedDate: "2026-10-11" }], () => "2026-10-09");
    expect(due.get(1)).toBe("2026-10-11");
    expect(db.calls).toHaveLength(0);
  });

  it("reads older stops off their booking's route", async () => {
    db.queue(
      { data: [{ orderID: "o1", expectedTime: "21:00:00", expectedDate: null, sequence: 1 }] },
      { data: [{ orderID: "o1", branchID: 7, expectedTime: "03:00:00", expectedDate: null, sequence: 1 }] },
    );
    const due = await branchDueDates([{ branchID: 7, orderID: "o1", expectedDate: null }], () => "2026-10-09");
    expect(due.get(7)).toBe("2026-10-10");
  });

  it("leaves out a stop nothing can date, so it is not judged", async () => {
    const due = await branchDueDates([{ branchID: 9, orderID: "o1", expectedDate: null }], () => null);
    expect(due.has(9)).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("a crew judged on a run of several days", () => {
  it("is on time at a Day 3 stop reached on Day 3", async () => {
    const due = await branchDueDates([{ branchID: 3, orderID: "o1", expectedDate: "2026-10-11" }], () => "2026-10-09");
    // Due 15:00 on the 11th in Manila; arrived 14:50 that day.
    const dueAt = expectedAt(due.get(3), "15:00");
    expect(wasOnTime(dueAt, "2026-10-11T06:50:00.000Z")).toBe(true);
    // Dated by the booking's day, the same arrival was two days late.
    expect(wasOnTime(expectedAt("2026-10-09", "15:00"), "2026-10-11T06:50:00.000Z")).toBe(false);
  });
});

describe("a stop's time on the screens", () => {
  it("reads as its time alone on the booking's own day", () => {
    expect(formatStopWhen("15:00", "2026-10-09", "2026-10-09")).toBe("3:00 PM");
    expect(formatStopWhen("15:00", null, "2026-10-09")).toBe("3:00 PM");
  });

  it("names the day when it is another one", () => {
    expect(formatShortDay("2026-10-10")).toBe("Sat, Oct 10");
    expect(formatStopWhen("03:00", "2026-10-10", "2026-10-09")).toBe("3:00 AM · Sat, Oct 10");
  });
});

describe("a booking of several days on the booking screens", () => {
  const order = (stops: Record<string, unknown>[], pickups: Record<string, unknown>[] = []) => ({
    orderID: "order-1",
    orderCode: "ORD-1",
    clientID: null,
    createdAt: "2026-10-01T02:00:00.000Z",
    isActive: true,
    notes: "[DELIVERY DETAILS]\nPriority: Standard\nDelivery Schedule: 2026-10-09\n",
    Client: null,
    OrderDetails: [],
    BranchStops: stops,
    PickupStops: pickups,
    DispatchOrder: [],
  });

  it("shows the run's span and each stop's day", () => {
    const view = mapOrderToBookingView(
      order(
        [
          { branchID: 1, branchName: "Cebu", expectedTime: "17:00:00", expectedDate: "2026-10-09", sequence: 1 },
          { branchID: 2, branchName: "Davao", expectedTime: "10:00:00", expectedDate: "2026-10-11", sequence: 2 },
        ],
        [{ pickupID: 1, warehouseName: "Valenzuela", expectedTime: "08:00:00", expectedDate: "2026-10-09", sequence: 1 }],
      ) as Parameters<typeof mapOrderToBookingView>[0],
    );

    expect(view.endDate).toBe("2026-10-11");
    expect(view.displayDate).toMatch(/Oct 9, 2026 – Oct 11, 2026/);
    const feed = toFeedBooking(view);
    expect(feed.deliveryList.map((row) => row.deliveryTime)).toEqual(["5:00 PM", "10:00 AM · Sun, Oct 11"]);
    expect(feed.pickupList[0].pickupTime).toBe("8:00 AM");
  });

  it("shows an older overnight booking's drop on the day it was really due", () => {
    const view = mapOrderToBookingView(
      order(
        [{ branchID: 1, branchName: "Batangas", expectedTime: "03:00:00", sequence: 1 }],
        [{ pickupID: 1, warehouseName: "Valenzuela", expectedTime: "21:00:00", sequence: 1 }],
      ) as Parameters<typeof mapOrderToBookingView>[0],
    );
    expect(view.stops[0].expectedDate).toBe("2026-10-10");
    expect(toFeedBooking(view).deliveryList[0].deliveryTime).toBe("3:00 AM · Sat, Oct 10");
  });

  it("leaves a one-day booking looking as it always did", () => {
    const view = mapOrderToBookingView(
      order([{ branchID: 1, branchName: "Makati", expectedTime: "14:00:00", sequence: 1 }]) as Parameters<typeof mapOrderToBookingView>[0],
    );
    expect(view.endDate).toBe("2026-10-09");
    expect(view.displayDate).not.toContain("–");
    expect(toFeedBooking(view).deliveryList[0].deliveryTime).toBe("2:00 PM");
  });
});

describe("a truck on a run of several days", () => {
  const trip = { dispatchID: "d1", status: "Assigned", orderID: "o1", orderCode: "ORD-1", clientName: "Acme", deliverySchedule: "2026-10-09", driverName: null };

  it("says every day it is held", () => {
    expect(deliveryDays({ ...trip, deliveryEnd: "2026-10-11" })).toBe("2026-10-09 – 2026-10-11");
    expect(bookingSummary({ ...trip, deliveryEnd: "2026-10-11" })).toContain("Delivery 2026-10-09 – 2026-10-11");
  });

  it("says one day for a one-day trip", () => {
    expect(deliveryDays(trip)).toBe("2026-10-09");
  });
});
