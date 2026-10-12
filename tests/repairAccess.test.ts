import { describe, expect, it } from "vitest";
import { mayWorkOnLog, mayWorkOnTruck, type RepairLog } from "@/app/lib/repairAccess";

// Who may work on a repair. The mechanic's screens hid the buttons, but the
// server let any mechanic change another's truck or edit and delete their
// logs; it now applies the same rule.

const ANA = "ana";
const BEN = "ben";

const log = (id: string, statusBefore: string, statusAfter: string, primary: string | null = ANA, additional: string | null = null): RepairLog => ({
  id,
  statusBefore,
  statusAfter,
  primaryMechanicID: primary,
  additionalMechanicID: additional,
});

describe("a truck under repair", () => {
  const inspection = log("1", "Available", "On Maintenance");

  it("is for the mechanics on its newest log", () => {
    expect(mayWorkOnTruck("On Maintenance", inspection, ANA)).toBe(true);
    expect(mayWorkOnTruck("On Maintenance", inspection, BEN)).toBe(false);
    expect(mayWorkOnTruck("Out of Service", log("1", "Available", "Out of Service", ANA, BEN), BEN)).toBe(true);
  });

  it("is anyone's while nobody is on it yet", () => {
    expect(mayWorkOnTruck("On Maintenance", log("1", "Available", "On Maintenance", null), BEN)).toBe(true);
  });

  it("is anyone's once the repair is over, or when it was grounded without a log", () => {
    expect(mayWorkOnTruck("Out of Service", log("1", "On Maintenance", "Available"), BEN)).toBe(true);
    expect(mayWorkOnTruck("On Maintenance", null, BEN)).toBe(true);
  });

  it("is not held at all when it is not grounded", () => {
    expect(mayWorkOnTruck("Available", inspection, BEN)).toBe(true);
    expect(mayWorkOnTruck("On Delivery", inspection, BEN)).toBe(true);
  });
});

describe("a repair's logs", () => {
  // Ana's repair, handed to Ben, finished; then a second repair of Ana's.
  const logs = [
    log("1", "Available", "On Maintenance", ANA),
    log("2", "On Maintenance", "Out of Service", BEN),
    log("3", "Out of Service", "Available", BEN),
    log("4", "Available", "On Maintenance", ANA),
  ];

  it("are for whoever is on the newest log of that repair", () => {
    for (const id of ["1", "2", "3"]) {
      expect(mayWorkOnLog(logs, id, BEN), id).toBe(true);
      expect(mayWorkOnLog(logs, id, ANA), id).toBe(false);
    }
    expect(mayWorkOnLog(logs, "4", ANA)).toBe(true);
    expect(mayWorkOnLog(logs, "4", BEN)).toBe(false);
  });

  it("are anyone's when nobody is on the repair yet", () => {
    expect(mayWorkOnLog([log("1", "Available", "On Maintenance", null)], "1", BEN)).toBe(true);
  });

  it("refuse a log that is not among them", () => {
    expect(mayWorkOnLog(logs, "9", ANA)).toBe(false);
  });
});
