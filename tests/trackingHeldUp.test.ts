import { describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// The module builds a Supabase client at import time, so it needs one standing
// in before it loads. These tests never reach it - buildTrackingSteps is pure -
// but the import would throw without this.
const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

// What the customer is told when the crew say why they have gone quiet.
//
// The crew already had four ordinary answers - traffic, waiting, loading, on a
// break - and all four stopped at the office. This is the part that carries them
// to the tracking page, and these are the rules about what may cross.

const STOP = {
  branchID: 1,
  branchName: "Corporate Office",
  expectedTime: null,
  status: "Pending",
  latitude: null,
  longitude: null,
  arrivedAt: null,
  deliveredAt: null,
  receivedBy: null,
};

async function steps(heldUp: { wording: string; at: string }[], done = false) {
  const { buildTrackingSteps } = await import("@/services/tracking/publicTrackingService");
  return buildTrackingSteps(
    done ? "Completed" : "In Transit",
    [{ ...STOP, status: done ? "Delivered" : "Pending" }],
    done,
    [],
    new Map(),
    null,
    heldUp,
  );
}

describe("a hold-up the crew reported", () => {
  it("reaches the customer, as a delay rather than a fault", async () => {
    const list = await steps([
      { wording: "Held up in traffic", at: "2026-09-29T02:00:00.000Z" },
    ]);

    const held = list.find((step) => step.kind === "heldup");
    expect(held).toBeDefined();
    expect(held?.title).toBe("Held up in traffic");
    expect(held?.detail).toBe("The delivery is carrying on.");
    // Not "problem": the crew answering is the system working, and drawing it in
    // red would tell the customer something worse than what happened.
    expect(held?.stage).toBe("current");
  });

  it("reads in the order the hold-ups happened", async () => {
    const list = await steps([
      { wording: "Waiting to be received", at: "2026-09-29T04:00:00.000Z" },
      { wording: "Held up in traffic", at: "2026-09-29T02:00:00.000Z" },
    ]);

    const held = list.filter((step) => step.kind === "heldup");
    expect(held.map((step) => step.title)).toEqual([
      "Held up in traffic",
      "Waiting to be received",
    ]);
  });

  it("says nothing once the delivery is done", async () => {
    const list = await steps(
      [{ wording: "Held up in traffic", at: "2026-09-29T02:00:00.000Z" }],
      true,
    );

    // By then it is an excuse rather than an update, and the customer has their
    // delivery.
    expect(list.some((step) => step.kind === "heldup")).toBe(false);
  });

  it("adds nothing when the crew have said nothing", async () => {
    const list = await steps([]);
    expect(list.some((step) => step.kind === "heldup")).toBe(false);
  });

  it("leaves the rest of the history alone", async () => {
    const withHold = await steps([
      { wording: "Held up in traffic", at: "2026-09-29T02:00:00.000Z" },
    ]);
    const without = await steps([]);

    const other = (list: Awaited<ReturnType<typeof steps>>) =>
      list.filter((step) => step.kind !== "heldup").map((step) => step.title);

    expect(other(withHold)).toEqual(other(without));
  });
});
