import { beforeEach, describe, expect, it, vi } from "vitest";

// Deleting a truck for good is for the Archive only.
//
// The button is offered only on a disabled truck, but the rule is the server's:
// a truck still in the fleet has to be disabled first, which in turn refuses a
// truck out on a delivery. What is deleted is recorded, since the truck itself
// is gone and the audit trail is all that says it existed.

let current: { truckID: string; isActive: boolean; plateNumber: string } | null;
let trip: { orderCode: string; status: string } | null;
const purged: string[] = [];
const audits: Record<string, unknown>[] = [];

vi.mock("@/app/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/app/lib/auth", () => ({
  FLEET_ROLES: ["Admin", "Coordinator", "Mechanic"],
  authorize: () =>
    Promise.resolve({ auth: { employee: { employeeID: "e1", employeeName: "Office", role: "Admin" }, user: { id: "u1" } } }),
}));
vi.mock("@/services/audit/auditService", () => ({
  auditActor: () => ({}),
  recordAudit: (entry: Record<string, unknown>) => {
    audits.push(entry);
    return Promise.resolve();
  },
}));
vi.mock("@/services/truck/truckService", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/truck/truckService")>();
  return {
    ...real,
    getTruckById: () => Promise.resolve(current),
    getCurrentTrip: () => Promise.resolve(trip),
    purgeTruck: (id: string) => {
      purged.push(id);
      return Promise.resolve(current && !current.isActive ? { ...current, truckType: "6W", truckStatus: "Out of Service" } : null);
    },
    deleteTruck: () => Promise.resolve({ truckID: "t1" }),
  };
});

const { DELETE } = await import("@/app/api/fleet-status/[id]/route");

const remove = (query = "?permanent=true") =>
  DELETE(new Request(`http://test/api/fleet-status/t1${query}`, { method: "DELETE" }), {
    params: Promise.resolve({ id: "t1" }),
  });

beforeEach(() => {
  purged.length = 0;
  audits.length = 0;
  trip = null;
  current = { truckID: "t1", isActive: false, plateNumber: "ABC-1234" };
});

describe("deleting a truck for good", () => {
  it("deletes a disabled truck and records what it was", async () => {
    const res = await remove();

    expect(res.status).toBe(204);
    expect(purged).toEqual(["t1"]);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "DELETE", recordID: "t1" });
    expect(audits[0].before).toMatchObject({ plateNumber: "ABC-1234" });
  });

  it("refuses a truck still in the fleet", async () => {
    current = { truckID: "t1", isActive: true, plateNumber: "ABC-1234" };
    const res = await remove();

    expect(res.status).toBe(409);
    expect(String((await res.json()).message)).toMatch(/disable it first/i);
    expect(purged).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it("refuses a disabled truck a trip still holds", async () => {
    trip = { orderCode: "ORD-9", status: "In Transit" };
    const res = await remove();

    expect(res.status).toBe(409);
    expect(String((await res.json()).message)).toContain("ORD-9");
    expect(purged).toHaveLength(0);
  });

  it("says when there is no such truck", async () => {
    current = null;
    const res = await remove();

    expect(res.status).toBe(404);
    expect(purged).toHaveLength(0);
  });

  it("leaves a plain DELETE as Disable", async () => {
    current = { truckID: "t1", isActive: true, plateNumber: "ABC-1234" };
    const res = await remove("");

    expect(res.status).toBe(204);
    expect(purged).toHaveLength(0);
    expect(audits[0]).toMatchObject({ action: "RETIRE" });
  });
});
