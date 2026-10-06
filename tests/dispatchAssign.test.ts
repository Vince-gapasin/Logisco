import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Putting a truck and crew on a booking. Two holes were found here: nothing
// stopped one booking getting two trips (a double-click on Assign was enough),
// and helpers were never checked for a trip they were already on.

const db = supabaseDouble();

vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));
vi.mock("@/services/geo/geocodingService", () => ({ geocodeAddresses: async () => [] }));
vi.mock("@/services/truck/truckService", () => ({ announceTruckStatus: async () => undefined }));

const { assignDispatch, reassignDispatch } = await import("@/services/dispatch/dispatchService");

const ORDER = "44444444-4444-4444-8444-444444444444";
const TRUCK = "11111111-1111-4111-8111-111111111111";
const DRIVER = "22222222-2222-4222-8222-222222222222";
const HELPER = "55555555-5555-4555-8555-555555555555";
const TRIP = "33333333-3333-4333-8333-333333333333";

const READY = { isActive: true, activation_completed_at: "2026-09-01T00:00:00Z" };
const FREE_TRUCK = { data: { truckID: TRUCK, isActive: true, truckStatus: "Available" } };
const CREW = {
  data: [
    { employeeID: DRIVER, employeeName: "Dan", role: "Driver", ...READY },
    { employeeID: HELPER, employeeName: "Hal", role: "Helper", ...READY },
  ],
};

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
});

function assign(helper1ID?: string) {
  return assignDispatch(ORDER, { truckID: TRUCK, driverID: DRIVER, helper1ID, totalCargoWeight: 0 });
}

describe("assigning a booking", () => {
  it("refuses a booking that already has a live trip", async () => {
    db.queue({ data: { orderID: ORDER, isActive: true, DispatchOrder: [{ dispatchID: TRIP, status: "Assigned" }] } });

    await expect(assign()).rejects.toThrow(/already has a trip/i);
    expect(db.writes).toHaveLength(0);
  });

  it("lets a foul trip's booking be given a new trip", async () => {
    // The failed trip is Foul Trip, which is not live, so recovery still works.
    db.queue(
      { data: { orderID: ORDER, isActive: true, DispatchOrder: [{ dispatchID: TRIP, status: "Foul Trip" }] } },
      FREE_TRUCK,
      { data: [] },
      CREW,
      { data: [] },
      { data: { dispatchID: "66666666-6666-4666-8666-666666666666" } },
    );

    await expect(assign()).resolves.toMatchObject({ dispatchID: expect.any(String) });
  });

  it("refuses a cancelled booking", async () => {
    db.queue({ data: { orderID: ORDER, isActive: false, DispatchOrder: [] } });

    await expect(assign()).rejects.toThrow(/cancelled/i);
    expect(db.writes).toHaveLength(0);
  });

  it("refuses a booking that is not there", async () => {
    db.queue({ data: null });
    await expect(assign()).rejects.toThrow(/Booking not found/i);
  });

  it("will not put a helper on two trips", async () => {
    db.queue(
      { data: { orderID: ORDER, isActive: true, DispatchOrder: [] } },
      FREE_TRUCK,
      { data: [] }, // no other trip holds the truck
      CREW,
      { data: [] }, // nor the driver
      { data: [{ helperID: HELPER, status: "Accepted" }] },
    );

    await expect(assign(HELPER)).rejects.toThrow(/Hal is already assigned/);
    expect(db.writes).toHaveLength(0);
  });

  it("does not count a trip the helper declined", async () => {
    db.queue(
      { data: { orderID: ORDER, isActive: true, DispatchOrder: [] } },
      FREE_TRUCK,
      { data: [] },
      CREW,
      { data: [] },
      { data: [{ helperID: HELPER, status: "Declined" }] },
      { data: { dispatchID: TRIP } },
    );

    await expect(assign(HELPER)).resolves.toMatchObject({ dispatchID: TRIP });
  });

  it("says plainly when somebody else assigned at the same moment", async () => {
    db.queue(
      { data: { orderID: ORDER, isActive: true, DispatchOrder: [] } },
      FREE_TRUCK,
      { data: [] },
      CREW,
      { data: [] },
      { error: { message: "duplicate key value", code: "23505" } },
    );

    await expect(assign()).rejects.toThrow(/Someone else just assigned/);
  });
});

describe("re-assigning a trip's helpers", () => {
  function reassign() {
    return reassignDispatch(TRIP, { truckID: TRUCK, driverID: DRIVER, helper1ID: HELPER, totalCargoWeight: 0 });
  }

  const UP_TO_THE_DRIVER = [
    { data: { dispatchID: TRIP, status: "Assigned", DispatchHelper: [] } },
    FREE_TRUCK,
    { data: null },
    { data: { employeeID: DRIVER, role: "Driver", isActive: true } },
    { data: null },
  ];

  it("will not take a non-helper as a helper", async () => {
    db.queue(...UP_TO_THE_DRIVER, { data: [{ employeeID: HELPER, employeeName: "Hal", role: "Mechanic", ...READY }] });

    await expect(reassign()).rejects.toThrow(/Hal is not a helper/);
    expect(db.writes).toHaveLength(0);
  });

  it("will not take a helper already on another trip", async () => {
    db.queue(
      ...UP_TO_THE_DRIVER,
      { data: [{ employeeID: HELPER, employeeName: "Hal", role: "Helper", ...READY }] },
      { data: [{ helperID: HELPER, status: null }] },
    );

    await expect(reassign()).rejects.toThrow(/Hal is already assigned to another/);
    expect(db.writes).toHaveLength(0);
  });
});
