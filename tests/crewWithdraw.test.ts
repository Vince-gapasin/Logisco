import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// A crew member's answer can change until the trip starts.
//
// Accepting used to be final from the moment of the tap. A driver who fell ill
// the night before had no way to say so in the app, and the office found out
// when the truck did not leave. Now somebody who accepted can withdraw, with a
// reason, until the trip starts - and not after, when it is a foul trip.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const ME = { employeeID: "11111111-1111-1111-1111-111111111111", employeeName: "Juan", role: "Driver" };
vi.mock("@/app/lib/auth", () => ({
  CREW_ROLES: ["Driver", "Helper"],
  authorize: () => Promise.resolve({ auth: { employee: ME, user: { id: "u1" } } }),
}));
vi.mock("@/services/audit/auditService", () => ({
  auditActor: () => ({}),
  recordAudit: () => Promise.resolve(),
}));
const sent: Record<string, unknown>[] = [];
vi.mock("@/services/notifications/notify", () => ({
  OFFICE: ["Admin", "Coordinator"],
  crewOf: () => Promise.resolve([]),
  tripLabel: () => Promise.resolve("ORD-1"),
  notify: (message: Record<string, unknown>) => {
    sent.push(message);
    return Promise.resolve(1);
  },
}));

let assignment: { dispatch: { status: string }; isDriver: boolean; helper: { dhID: string; status: string | null } | null };
const released: string[] = [];
vi.mock("@/services/dispatch/dispatchService", () => ({
  isUuid: () => true,
  getCrewAssignment: () => Promise.resolve(assignment),
  crewReadinessFor: () => Promise.resolve(new Map()),
  releaseDispatchResources: (id: string) => {
    released.push(id);
    return Promise.resolve();
  },
}));

const { POST } = await import("@/app/api/crew/dispatches/respond/route");

const TRIP = "22222222-2222-2222-2222-222222222222";
const respond = (action: "accept" | "decline") =>
  POST(
    new Request("http://test/api/crew/dispatches/respond", {
      method: "POST",
      body: JSON.stringify({ dispatchID: TRIP, action, reason: action === "decline" ? "Sick" : undefined }),
    }),
  );

beforeEach(() => {
  db.writes.length = 0;
  sent.length = 0;
  released.length = 0;
});

describe("a driver", () => {
  it("can withdraw after accepting, before the trip starts", async () => {
    assignment = { dispatch: { status: "Accepted" }, isDriver: true, helper: null };
    const res = await respond("decline");

    expect(res.status).toBe(200);
    // The trip is closed and its truck and crew freed, as for any decline.
    expect(db.writes[0].payload).toMatchObject({ status: "Rejected", rejectionreason: "Sick" });
    expect(released).toEqual([TRIP]);
    // And the office hears it was a withdrawal.
    expect(String(sent[0].title)).toMatch(/withdrew/i);
  });

  it("cannot withdraw once the trip has started", async () => {
    assignment = { dispatch: { status: "In Transit" }, isDriver: true, helper: null };
    const res = await respond("decline");

    expect(res.status).toBe(409);
    expect(db.writes).toHaveLength(0);
  });

  it("cannot accept twice", async () => {
    assignment = { dispatch: { status: "Accepted" }, isDriver: true, helper: null };
    expect((await respond("accept")).status).toBe(409);
  });
});

describe("a helper", () => {
  it("can withdraw after accepting, before the trip starts", async () => {
    assignment = { dispatch: { status: "Accepted" }, isDriver: false, helper: { dhID: "dh1", status: "Accepted" } };
    const res = await respond("decline");

    expect(res.status).toBe(200);
    expect(db.writes[0]).toMatchObject({ table: "DispatchHelper" });
    expect(db.writes[0].payload).toMatchObject({ status: "Declined" });
    expect(String(sent[0].title)).toMatch(/withdrew/i);
  });

  it("cannot withdraw once the trip has started", async () => {
    assignment = { dispatch: { status: "In Transit" }, isDriver: false, helper: { dhID: "dh1", status: "Accepted" } };
    expect((await respond("decline")).status).toBe(409);
    expect(db.writes).toHaveLength(0);
  });

  it("still answers an assignment they have not replied to", async () => {
    assignment = { dispatch: { status: "Assigned" }, isDriver: false, helper: { dhID: "dh1", status: "Pending" } };
    expect((await respond("accept")).status).toBe(200);
  });
});
