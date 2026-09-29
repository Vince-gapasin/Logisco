import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Everybody assigned has to accept before the truck leaves.
//
// Only half of that was enforced. The driver accepting set the dispatch to
// Accepted, which is what the Start Delivery button looked at - so a helper who
// had never answered was no obstacle at all, and a two-person job could leave
// with one person on it. The office found out at the warehouse.

const double = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: double.client }));
vi.mock("@/services/truck/truckService", () => ({ announceTruckStatus: vi.fn() }));

const { crewNotReadyReason, crewReadinessFor } = await import(
  "@/services/dispatch/dispatchService"
);

const TRIP = "11111111-2222-3333-4444-555555555555";

const trip = (status: string, helpers: { status: string; name?: string }[]) => ({
  dispatchID: TRIP,
  status,
  DispatchHelper: helpers.map((helper) => ({
    status: helper.status,
    Helper: helper.name ? { employeeName: helper.name } : null,
  })),
});

const readinessOf = async (row: unknown) => {
  double.queue({ data: [row], error: null });
  const found = (await crewReadinessFor([TRIP])).get(TRIP);
  if (!found) throw new Error("no readiness was worked out");
  return found;
};

beforeEach(() => {
  double.calls.length = 0;
  double.writes.length = 0;
});

describe("who still has to say yes", () => {
  it("is ready when the driver has accepted and so has everybody else", async () => {
    const readiness = await readinessOf(trip("Accepted", [{ status: "Accepted", name: "Ana" }]));
    expect(readiness.ready).toBe(true);
    expect(readiness.waitingOn).toEqual([]);
  });

  it("is not ready while a helper has not answered", async () => {
    // The case that used to leave with one person on a two-person job.
    const readiness = await readinessOf(trip("Accepted", [{ status: "Pending", name: "Ben" }]));
    expect(readiness.ready).toBe(false);
    expect(readiness.waitingOn).toEqual(["Ben"]);
  });

  it("counts a helper row with no status at all as not having answered", async () => {
    // Older assignments were written before the column had a default.
    const readiness = await readinessOf(trip("Accepted", [{ status: null as never, name: "Cy" }]));
    expect(readiness.waitingOn).toEqual(["Cy"]);
  });

  it("reads the driver's own yes off the dispatch status", async () => {
    const assigned = await readinessOf(trip("Assigned", [{ status: "Accepted", name: "Ana" }]));
    expect(assigned.driverAccepted).toBe(false);
    expect(assigned.ready).toBe(false);

    const accepted = await readinessOf(trip("Accepted", [{ status: "Accepted", name: "Ana" }]));
    expect(accepted.driverAccepted).toBe(true);
  });

  it("is ready for a driver on their own, with nobody to wait for", async () => {
    expect((await readinessOf(trip("Accepted", []))).ready).toBe(true);
  });

  it("keeps a declined helper apart from one who has not answered", async () => {
    // Waiting resolves itself; a refusal only the office can fill.
    const readiness = await readinessOf(trip("Accepted", [{ status: "Declined", name: "Dee" }]));
    expect(readiness.declined).toEqual(["Dee"]);
    expect(readiness.waitingOn).toEqual([]);
    expect(readiness.ready).toBe(false);
  });

  it("asks once for a screenful of trips rather than once per row", async () => {
    double.queue({ data: [], error: null });
    await crewReadinessFor([TRIP, TRIP, null, undefined, "not-a-uuid"]);
    expect(double.calls.filter((call) => call.table === "DispatchOrder")).toHaveLength(1);
  });

  it("says nothing rather than failing the screen when the read fails", async () => {
    // The gate on the server is what actually holds the truck. A screen that
    // cannot say who is outstanding is better than a screen that will not load.
    double.queue({ data: null, error: { message: "down" } });
    expect((await crewReadinessFor([TRIP])).size).toBe(0);
  });
});

describe("what the person holding the phone is told", () => {
  const ready = { ready: true, driverAccepted: true, waitingOn: [], declined: [] };

  it("says nothing at all when the trip can start", () => {
    expect(crewNotReadyReason(ready, { isDriver: true })).toBeNull();
  });

  it("tells the driver to accept, and tells a helper who they are waiting on", () => {
    const unaccepted = { ready: false, driverAccepted: false, waitingOn: [], declined: [] };
    expect(crewNotReadyReason(unaccepted, { isDriver: true })).toMatch(/accept this delivery/i);
    expect(crewNotReadyReason(unaccepted, { isDriver: false })).toMatch(/driver has not accepted/i);
  });

  it("names the people who have not answered", () => {
    const waiting = {
      ready: false,
      driverAccepted: true,
      waitingOn: ["Ben", "Cy"],
      declined: [],
    };
    const said = crewNotReadyReason(waiting, { isDriver: true }) ?? "";
    expect(said).toMatch(/Ben and Cy have not accepted/);
  });

  it("agrees with itself about one person", () => {
    const waiting = { ready: false, driverAccepted: true, waitingOn: ["Ben"], declined: [] };
    expect(crewNotReadyReason(waiting, { isDriver: true })).toMatch(/Ben has not accepted/);
  });

  it("says a refusal needs the office, not more waiting", () => {
    // Telling a driver to keep waiting for somebody who has already said no is
    // how a delivery loses an hour to nobody doing anything.
    const refused = { ready: false, driverAccepted: true, waitingOn: [], declined: ["Dee"] };
    const said = crewNotReadyReason(refused, { isDriver: true }) ?? "";
    expect(said).toMatch(/Dee declined/);
    expect(said).toMatch(/replacement/i);
    expect(said).not.toMatch(/has to accept before/i);
  });

  it("leads with the refusal when somebody has also not answered", () => {
    const both = {
      ready: false,
      driverAccepted: true,
      waitingOn: ["Ben"],
      declined: ["Dee"],
    };
    expect(crewNotReadyReason(both, { isDriver: true })).toMatch(/Dee declined/);
  });
});
