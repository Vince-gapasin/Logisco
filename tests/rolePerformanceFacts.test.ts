import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Reading a mechanic's and a coordinator's record off what the system already
// keeps: maintenance logs and roadside jobs, and the audit trail.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { gatherMechanicFacts, gatherOfficeFacts } = await import("@/services/employee/rolePerformanceService");

const MECHANIC = "m1";
const DAY = 864e5;
const ago = (days: number, minutes = 0) => new Date(Date.now() - days * DAY + minutes * 60_000).toISOString();

beforeEach(() => {
  db.calls.length = 0;
});

/** A repair: grounded by the office, picked up an hour later, signed off two days on. */
function repairLogs(startDaysAgo: number) {
  return [
    {
      id: "a", truckID: "t1", created_at: ago(startDaysAgo), date: null,
      statusBefore: "Available", statusAfter: "On Maintenance",
      LogMechanics: [], LogNotes: [{ phase: "Preliminary", issue: "Set to on maintenance", remarks: "Awaiting a mechanic." }], LogPhotos: [],
    },
    {
      id: "b", truckID: "t1", created_at: ago(startDaysAgo, 60), date: null,
      statusBefore: "On Maintenance", statusAfter: "On Maintenance",
      LogMechanics: [{ role: "Primary", employeeID: MECHANIC }],
      LogNotes: [{ phase: "Progress", issue: "Brake pads worn", remarks: "Ordered parts" }],
      LogPhotos: [{ phase: "Progress" }],
    },
    {
      id: "c", truckID: "t1", created_at: ago(startDaysAgo - 2), date: null,
      statusBefore: "On Maintenance", statusAfter: "Available",
      LogMechanics: [{ role: "Primary", employeeID: MECHANIC }],
      LogNotes: [{ phase: "Final", issue: "Replaced pads", remarks: "" }],
      LogPhotos: [],
    },
  ];
}

describe("a mechanic's record", () => {
  it("counts a repair that held, how quickly it was picked up, and how well it was written up", async () => {
    db.queue({ data: repairLogs(30) }, { data: [] });

    const facts = await gatherMechanicFacts(MECHANIC, null);

    expect(facts.repairsFinished).toBe(1);
    expect(facts.repairsObserved).toBe(1);
    expect(facts.repairsHeld).toBe(1);
    expect(facts.pickUpMinutes).toHaveLength(1);
    expect(facts.pickUpMinutes[0]).toBeCloseTo(60, 0);
    expect(facts.repairDays[0]).toBeCloseTo(2, 1);
    // Two logs as lead; only the one with a photo and remarks is documented.
    expect(facts.logsWritten).toBe(2);
    expect(facts.logsDocumented).toBe(1);
  });

  it("does not count a repair as held when the truck broke down again within two weeks", async () => {
    db.queue(
      { data: repairLogs(30) },
      { data: [{ truckID: "t1", reportedAt: ago(20), mechanicID: null, mechanicAssignedAt: null, mechanicRespondedAt: null, mechanicOutcome: null }] },
    );

    const facts = await gatherMechanicFacts(MECHANIC, null);
    expect(facts.repairsObserved).toBe(1);
    expect(facts.repairsHeld).toBe(0);
  });

  it("waits to judge a repair until two weeks have passed", async () => {
    db.queue({ data: repairLogs(5) }, { data: [] });

    const facts = await gatherMechanicFacts(MECHANIC, null);
    expect(facts.repairsFinished).toBe(1);
    expect(facts.repairsObserved).toBe(0);
  });

  it("times a roadside job from being sent to the verdict", async () => {
    db.queue(
      { data: [] },
      { data: [{ truckID: "t2", reportedAt: ago(3), mechanicID: MECHANIC, mechanicAssignedAt: ago(3), mechanicRespondedAt: ago(3, 75), mechanicOutcome: "fixed" }] },
    );

    const facts = await gatherMechanicFacts(MECHANIC, null);
    expect(facts.roadsideJobs).toBe(1);
    expect(facts.roadsideFixed).toBe(1);
    expect(facts.roadsideMinutes[0]).toBeCloseTo(75, 0);
  });
});

describe("a coordinator's record", () => {
  it("judges an assignment made a day ahead of the delivery as in good time", async () => {
    const delivery = new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10);
    db.queue(
      // Their audit rows.
      { data: [{ tableName: "DispatchOrder", action: "ASSIGN", recordID: "d1", newData: { by: { employeeID: "c1" } }, timestamp: ago(1) }] },
      // The trip's booking.
      { data: [{ dispatchID: "d1", orderID: "o1" }] },
      { data: [{ orderID: "o1", createdAt: ago(2), notes: `Delivery Schedule: ${delivery}`, BranchStops: [{ expectedTime: "10:00:00" }], DispatchOrder: [{ dispatchID: "d1" }] }] },
      // Assignments and declines on it, and helper declines.
      { data: [] },
      { data: [] },
    );

    const facts = await gatherOfficeFacts("c1", null, { includeStaff: false });
    expect(facts.assignments).toBe(1);
    expect(facts.assignmentsJudged).toBe(1);
    expect(facts.assignmentsOnNotice).toBe(1);
  });
});
