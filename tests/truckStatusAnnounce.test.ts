import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Who is told when a truck leaves the road, and - just as importantly - when
// nobody is told anything.
//
// The fact "this truck is On Maintenance" used to reach mechanics when an admin
// typed it into a form and reach nobody when a truck actually broke down: the
// breakdown path grounded the truck through a bare UPDATE. Both paths call this
// now, so the rule about when it speaks is worth pinning down.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const sent: Record<string, unknown>[] = [];
vi.mock("@/services/notifications/notify", () => ({
  notify: (message: Record<string, unknown>) => {
    sent.push(message);
    return Promise.resolve(1);
  },
  OFFICE: ["Admin", "Coordinator"],
  MECHANICS: ["Mechanic"],
}));

const opened: Record<string, unknown>[] = [];
vi.mock("@/services/history-logs/historyLogsService", () => ({
  createHistoryLog: (log: Record<string, unknown>) => {
    opened.push(log);
    return Promise.resolve({ id: "log-1" });
  },
}));

const { announceTruckStatus } = await import("@/services/truck/truckService");

const TRUCK = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  db.calls.length = 0;
  sent.length = 0;
  opened.length = 0;
});

/** The plate lookup the announcement makes before it speaks. */
const plate = () => db.queue({ data: { plateNumber: "ABC-1234" }, error: null });

describe("when a truck leaves the road", () => {
  it("tells the office and the mechanics", async () => {
    plate();
    await announceTruckStatus(TRUCK, "Available", "On Maintenance");

    expect(sent).toHaveLength(1);
    expect(sent[0].roles).toEqual(["Admin", "Coordinator", "Mechanic"]);
    expect(String(sent[0].title)).toMatch(/on maintenance/i);
    expect(String(sent[0].body)).toContain("ABC-1234");
    expect(sent[0].severity).toBe("action");
  });

  it("does the same for out of service", async () => {
    plate();
    await announceTruckStatus(TRUCK, "On Delivery", "Out of Service");
    expect(sent).toHaveLength(1);
    expect(String(sent[0].title)).toMatch(/out of service/i);
  });

  it("says so when it comes back, more quietly", async () => {
    plate();
    await announceTruckStatus(TRUCK, "On Maintenance", "Available");

    expect(sent).toHaveLength(1);
    expect(String(sent[0].title)).toMatch(/back in service/i);
    expect(sent[0].severity).toBe("info");
  });
});

describe("when nobody needs telling", () => {
  it("says nothing about the ordinary comings and goings of a working truck", async () => {
    // Trucks move between these all day. A mechanic told about every one of them
    // is a mechanic who turns the alerts off.
    await announceTruckStatus(TRUCK, "Available", "On Delivery");
    await announceTruckStatus(TRUCK, "On Delivery", "Available");
    expect(sent).toHaveLength(0);
  });

  it("says nothing when the status has not actually changed", async () => {
    await announceTruckStatus(TRUCK, "On Maintenance", "On Maintenance");
    expect(sent).toHaveLength(0);
  });

  it("says nothing between two kinds of grounded", async () => {
    // Still off the road either way; the office already knows it is down.
    await announceTruckStatus(TRUCK, "On Maintenance", "Out of Service");
    expect(sent).toHaveLength(0);
  });

  it("does not look up a plate it is not going to use", async () => {
    await announceTruckStatus(TRUCK, "Available", "On Delivery");
    expect(db.calls).toHaveLength(0);
  });
});

describe("what it does with a truck it cannot name", () => {
  it("still speaks, rather than swallowing the fact that a truck is down", async () => {
    db.queue({ data: null, error: null });
    await announceTruckStatus(TRUCK, "Available", "On Maintenance");

    expect(sent).toHaveLength(1);
    expect(String(sent[0].body)).toMatch(/^A truck/);
  });

  it("ignores a call with no truck", async () => {
    await announceTruckStatus("", "Available", "On Maintenance");
    expect(sent).toHaveLength(0);
  });
});

describe("what is left behind for the mechanics", () => {
  it("opens a maintenance log, carrying what stopped the truck and who said so", async () => {
    plate();
    await announceTruckStatus(
      TRUCK,
      "On Delivery",
      "On Maintenance",
      { employeeID: "e1", name: "Christian Bacani" },
      "Foul trip: Broken Truck",
    );

    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      truckID: TRUCK,
      statusBefore: "On Delivery",
      statusAfter: "On Maintenance",
      driversReport: "Foul trip: Broken Truck",
    });
    expect(String(opened[0].preliminaryRemarks)).toContain("Christian Bacani");
  });

  it("leaves the mechanic empty, because nobody has been sent yet", async () => {
    plate();
    await announceTruckStatus(TRUCK, "Available", "On Maintenance");
    // An open job with no name on it is what the office is looking at until they
    // send somebody.
    expect(opened[0].primaryMechanicID).toBeUndefined();
    expect(String(opened[0].preliminaryRemarks)).toMatch(/awaiting a mechanic/i);
  });

  it("says what happened even when nobody reported it by name", async () => {
    plate();
    await announceTruckStatus(TRUCK, "Available", "Out of Service");
    expect(String(opened[0].driversReport)).toMatch(/out of service/i);
  });

  it("opens nothing when a truck comes back", async () => {
    plate();
    await announceTruckStatus(TRUCK, "On Maintenance", "Available");
    // Coming back is the closing of a repair somebody was already logging.
    expect(opened).toHaveLength(0);
  });

  it("opens nothing for the churn nobody is told about", async () => {
    await announceTruckStatus(TRUCK, "Available", "On Delivery");
    expect(opened).toHaveLength(0);
  });
});
