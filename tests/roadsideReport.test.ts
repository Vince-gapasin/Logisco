import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// A mechanic's roadside report, sent twice.
//
// A double tap could act on the job twice: the second found the trip already
// resumed, took that for the crew having been given another trip, set the
// truck Available while it was out on the delivery and reopened the job. The
// report now claims the job before doing anything, and gives it back when it
// fails before anything has changed.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));
vi.mock("@/services/dispatch/dispatchService", () => ({
  assignDispatch: async () => ({}),
  releaseDispatchResources: async () => undefined,
  isUuid: () => true,
}));

const { mechanicReport, FoulTripError } = await import("@/services/foulTrip/foulTripService");

const MECHANIC = "mmmmmmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm";
const incident = { incidentID: "i1", dispatchID: "trip-1", truckID: "t1", status: "mechanic_assigned", mechanicID: MECHANIC };

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
});

describe("a roadside report", () => {
  it("is refused when the job has already been reported, and changes nothing", async () => {
    db.queue(
      { data: incident }, // the job
      { data: null }, // the claim finds it already taken
    );

    const report = mechanicReport("i1", MECHANIC, { outcome: "fixed" });
    await expect(report).rejects.toBeInstanceOf(FoulTripError);
    await expect(report).rejects.toMatchObject({ status: 409 });

    // Only the claim itself was attempted.
    expect(db.writes.map((write) => write.table)).toEqual(["FoulTripIncident"]);
    expect(db.writes[0].payload).toEqual({ mechanicRespondedAt: expect.any(String) });
  });

  it("gives the job back when it fails before anything has changed", async () => {
    db.queue(
      { data: incident },
      { data: { incidentID: "i1" } }, // claimed
      { data: null, error: { message: "down" } }, // the trip cannot be read
    );

    await expect(mechanicReport("i1", MECHANIC, { outcome: "fixed" })).rejects.toThrow("Failed to load the trip.");

    const release = db.writes.at(-1);
    expect(release?.table).toBe("FoulTripIncident");
    expect(release?.payload).toEqual({ mechanicRespondedAt: null });
    expect(db.writes.some((write) => write.table === "Truck" || write.table === "DispatchOrder")).toBe(false);
  });
});
