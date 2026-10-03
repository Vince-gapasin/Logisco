import { describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// The fleet lists split a truck on a booking in two: booked while the crew has
// not started the trip, on delivery once it is on the road. The record says
// "On Delivery" either way.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { getCurrentTrips } = await import("@/services/truck/truckService");
const { bookingSummary, shownTruckStatus } = await import("@/app/lib/truckBooking");

const trip = (status: string) => ({
  dispatchID: "d1",
  status,
  orderID: "o1",
  orderCode: "ORD-001",
  clientName: "Acme Foods",
  deliverySchedule: "2026-10-05",
  driverName: "Juan Cruz",
});

describe("what a fleet list calls a truck on a booking", () => {
  it("calls it booked until the crew starts the trip", () => {
    for (const status of ["Pending", "Assigned", "Accepted"]) {
      expect(shownTruckStatus("On Delivery", trip(status))).toBe("Already Booked");
    }
  });

  it("calls it on delivery once the trip has started", () => {
    for (const status of ["Start Delivery", "In Warehouse", "In Transit", "Arrived"]) {
      expect(shownTruckStatus("On Delivery", trip(status))).toBe("On Delivery");
    }
  });

  it("leaves every other status as recorded", () => {
    expect(shownTruckStatus("On Maintenance", trip("Assigned"))).toBe("On Maintenance");
    expect(shownTruckStatus("Available", null)).toBe("Available");
    expect(shownTruckStatus("On Delivery", null)).toBe("On Delivery");
  });

  it("names the booking in one line", () => {
    expect(bookingSummary(trip("Assigned"))).toBe("ORD-001 · Acme Foods · Delivery 2026-10-05 · Driver Juan Cruz");
    expect(bookingSummary({ ...trip("Assigned"), clientName: null, driverName: null, deliverySchedule: null })).toBe("ORD-001");
  });
});

describe("the trips a fleet list is sent", () => {
  it("asks once for the whole list and keys each trip by its truck", async () => {
    db.calls.length = 0;
    db.queue({
      data: [
        {
          dispatchID: "d1",
          truckID: "t1",
          status: "Accepted",
          Order: { orderID: "o1", orderCode: "ORD-001", notes: "Delivery Schedule: 2026-10-05\nOther", Client: { company: "Acme Foods" } },
          Driver: { employeeName: "Juan Cruz" },
        },
      ],
    });

    const trips = await getCurrentTrips(["t1", "t2"]);

    expect(db.calls).toHaveLength(1);
    expect(trips.get("t1")).toMatchObject({ orderCode: "ORD-001", clientName: "Acme Foods", deliverySchedule: "2026-10-05", driverName: "Juan Cruz" });
    expect(trips.has("t2")).toBe(false);
  });

  it("does not ask at all for an empty list", async () => {
    db.calls.length = 0;
    expect((await getCurrentTrips([])).size).toBe(0);
    expect(db.calls).toHaveLength(0);
  });
});
