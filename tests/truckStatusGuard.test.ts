import { beforeEach, describe, expect, it, vi } from "vitest";

// A truck's status is dispatch's while a trip holds it.
//
// "On Delivery" is set by assigning a booking, and the office could also pick
// it by hand - which made a truck unbookable with no trip behind it. And a truck
// already on a trip could be put back to Available or grounded from the fleet
// screen, leaving the trip running with a truck that was officially elsewhere.

let before: { truckStatus: string } | null;
let trip: { orderCode: string; status: string } | null;
const updates: Record<string, unknown>[] = [];

vi.mock("@/app/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/app/lib/auth", () => ({
  FLEET_ROLES: ["Admin", "Coordinator", "Mechanic"],
  authorize: () =>
    Promise.resolve({ auth: { employee: { employeeID: "e1", employeeName: "Office", role: "Admin" }, user: { id: "u1" } } }),
}));
vi.mock("@/services/audit/auditService", () => ({ auditActor: () => ({}), recordAudit: () => Promise.resolve() }));
vi.mock("@/services/truck/truckService", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/truck/truckService")>();
  return {
    ...real,
    getTruckById: () => Promise.resolve(before),
    getCurrentTrip: () => Promise.resolve(trip),
    updateTruck: (_id: string, payload: Record<string, unknown>) => {
      updates.push(payload);
      return Promise.resolve({ truckID: "t1", ...payload });
    },
    announceTruckStatus: () => Promise.resolve(),
  };
});

const { PUT } = await import("@/app/api/fleet-status/[id]/route");

const put = (body: Record<string, unknown>) =>
  PUT(new Request("http://test/api/fleet-status/t1", { method: "PUT", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "t1" }),
  });

beforeEach(() => {
  updates.length = 0;
  trip = null;
  before = { truckStatus: "Available" };
});

describe("changing a truck's status by hand", () => {
  it("cannot put it On Delivery", async () => {
    const res = await put({ truckStatus: "On Delivery" });
    expect(res.status).toBe(409);
    expect(updates).toHaveLength(0);
  });

  it("cannot change it while a booking holds the truck", async () => {
    before = { truckStatus: "On Delivery" };
    trip = { orderCode: "ORD-1", status: "Accepted" };
    const res = await put({ truckStatus: "Available", reason: "Back early" });

    expect(res.status).toBe(409);
    expect(String((await res.json()).message)).toContain("ORD-1");
    expect(updates).toHaveLength(0);
  });

  it("can still ground a truck that is not on a trip", async () => {
    const res = await put({ truckStatus: "On Maintenance", reason: "Brakes" });
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ truckStatus: "On Maintenance" });
  });

  it("does not stop an edit to a truck on a trip that leaves the status alone", async () => {
    before = { truckStatus: "On Delivery" };
    trip = { orderCode: "ORD-1", status: "In Transit" };
    const res = await put({ model: "Isuzu NPR" });
    expect(res.status).toBe(200);
  });
});
