import { describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Who changed a truck's record, and what. Admins, coordinators and mechanics can
// all add, edit and archive trucks; each change carries the person who made it,
// and this is how it reads back.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const { getTruckChanges } = await import("@/services/truck/truckService");

describe("a truck's change history", () => {
  it("names who made each change and shows only what moved", async () => {
    db.queue(
      {
        data: [
          {
            auditID: "a2",
            action: "UPDATE",
            timestamp: "2026-10-03T06:00:00Z",
            // An edit sends the whole form; only the model actually changed.
            oldData: { plateNumber: "ABC-123", model: "Isuzu NPR", fuelTypeID: "f1" },
            newData: {
              plateNumber: "ABC-123",
              model: "Isuzu NQR",
              fuelTypeID: "f1",
              by: { name: "Rosa Cruz", role: "Coordinator" },
            },
          },
          {
            auditID: "a1",
            action: "CREATE",
            timestamp: "2026-10-01T06:00:00Z",
            oldData: null,
            newData: { plateNumber: "ABC-123", fuelTypeID: "f1", by: { name: "Admin One", role: "Admin" } },
          },
        ],
      },
      { data: [{ fuelTypeID: "f1", name: "Diesel" }] },
    );

    const [edit, added] = await getTruckChanges("t1");

    expect(edit).toMatchObject({
      action: "Edited",
      byName: "Rosa Cruz",
      byRole: "Coordinator",
      changes: [{ field: "Model", from: "Isuzu NPR", to: "Isuzu NQR" }],
    });
    expect(added.action).toBe("Added");
    expect(added.byName).toBe("Admin One");
    // Fuel by name, not by id.
    expect(added.changes).toContainEqual({ field: "Fuel type", from: null, to: "Diesel" });
  });
});
