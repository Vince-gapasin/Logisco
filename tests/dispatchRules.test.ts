import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// The rules that decide whether a trip may be changed at all. Each of these
// cost a real debugging session to find: a declined booking could not be
// re-assigned in place, and the screen offering to do it had no way to say so.

const db = supabaseDouble();

vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));
vi.mock("@/services/geo/geocodingService", () => ({ geocodeAddresses: async () => [] }));

const { reassignDispatch } = await import("@/services/dispatch/dispatchService");

const TRUCK = "11111111-1111-4111-8111-111111111111";
const DRIVER = "22222222-2222-4222-8222-222222222222";
const TRIP = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
});

function assign() {
  return reassignDispatch(TRIP, { truckID: TRUCK, driverID: DRIVER, totalCargoWeight: 0 });
}

describe("re-assigning a trip in place", () => {
  it("refuses a trip a crew has declined", async () => {
    // The dispatch is closed. Assigning again starts a new one, which is what
    // the booking screens do; this path would quietly do nothing.
    db.queue({ data: { dispatchID: TRIP, status: "Rejected", DispatchHelper: [] } });

    await expect(assign()).rejects.toThrow(/Rejected can no longer be re-assigned/);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a trip already on the road", async () => {
    db.queue({ data: { dispatchID: TRIP, status: "In Transit", DispatchHelper: [] } });

    await expect(assign()).rejects.toThrow(/can no longer be re-assigned/);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a trip that is finished", async () => {
    db.queue({ data: { dispatchID: TRIP, status: "Completed", DispatchHelper: [] } });

    await expect(assign()).rejects.toThrow(/can no longer be re-assigned/);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses when the trip is not there", async () => {
    db.queue({ data: null });
    await expect(assign()).rejects.toThrow(/not found/i);
  });

  it("will not send a truck that is out of service", async () => {
    db.queue(
      { data: { dispatchID: TRIP, status: "Assigned", DispatchHelper: [] } },
      { data: { truckID: TRUCK, isActive: true, truckStatus: "Out of Service" } },
    );

    await expect(assign()).rejects.toThrow(/maintenance or out of service/i);
    expect(db.writes).toHaveLength(0);
  });

  it("will not send a retired truck", async () => {
    db.queue(
      { data: { dispatchID: TRIP, status: "Assigned", DispatchHelper: [] } },
      { data: { truckID: TRUCK, isActive: false, truckStatus: "Available" } },
    );

    await expect(assign()).rejects.toThrow(/inactive or retired/i);
  });

  it("will not put someone who is not a driver behind the wheel", async () => {
    db.queue(
      { data: { dispatchID: TRIP, status: "Assigned", DispatchHelper: [] } },
      { data: { truckID: TRUCK, isActive: true, truckStatus: "Available" } },
      { data: null }, // no other trip holds the truck
      { data: { employeeID: DRIVER, role: "Helper", isActive: true } },
    );

    await expect(assign()).rejects.toThrow(/not an active driver/i);
  });

  it("needs a truck and a driver before it looks anything up", async () => {
    await expect(reassignDispatch(TRIP, { truckID: "", driverID: DRIVER, totalCargoWeight: 0 })).rejects.toThrow(/No truck/i);
    await expect(reassignDispatch(TRIP, { truckID: TRUCK, driverID: "", totalCargoWeight: 0 })).rejects.toThrow(/No driver/i);
    expect(db.calls).toHaveLength(0);
  });
});
