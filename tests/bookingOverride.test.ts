import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// The office ending a booking the crew cannot or will not end.
//
// The rules worth pinning down are the refusals and what each action leaves
// behind: a cancel must free the truck, a foul trip must produce the same
// incident row the crew's report produces, and a completion must not invent a
// delivery it did not witness.

const db = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: db.client }));

const released: string[] = [];
vi.mock("@/services/dispatch/dispatchService", () => ({
  releaseDispatchResources: (dispatchID: string) => {
    released.push(dispatchID);
    return Promise.resolve();
  },
}));

const incidents: Record<string, unknown>[] = [];
vi.mock("@/services/foulTrip/foulTripService", () => ({
  recordIncident: (incident: Record<string, unknown>) => {
    incidents.push(incident);
    return Promise.resolve({ incidentID: "i1" });
  },
}));

const { overrideBooking } = await import("@/services/booking/overrideService");

const ORDER = "11111111-1111-1111-1111-111111111111";
const TRIP = "22222222-2222-2222-2222-222222222222";
const ACTOR = "33333333-3333-3333-3333-333333333333";

/** The booking read that every override starts with. */
const booking = (status: string) => ({
  data: {
    orderID: ORDER,
    isActive: true,
    DispatchOrder: [
      { dispatchID: TRIP, status, truckID: "truck-1", pickupCompletedAt: "2026-09-29T01:00:00Z" },
    ],
  },
  error: null,
});

beforeEach(() => {
  db.calls.length = 0;
  db.writes.length = 0;
  released.length = 0;
  incidents.length = 0;
});

describe("what an override refuses to do", () => {
  it("will not act without a reason", async () => {
    await expect(
      overrideBooking({ orderID: ORDER, action: "complete", reason: "   ", actorID: ACTOR }),
    ).rejects.toThrow(/say why/i);
    // Refused before it read anything, so nothing was touched.
    expect(db.calls).toHaveLength(0);
  });

  it("will not finish a booking that is already finished", async () => {
    db.queue(booking("Completed"));
    await expect(
      overrideBooking({ orderID: ORDER, action: "complete", reason: "Crew went home", actorID: ACTOR }),
    ).rejects.toThrow(/already closed/i);
    expect(db.writes).toHaveLength(0);
  });

  it("will not declare a foul trip on a booking with no trip", async () => {
    db.queue({ data: { orderID: ORDER, isActive: true, DispatchOrder: [] }, error: null });
    await expect(
      overrideBooking({ orderID: ORDER, action: "foul-trip", reason: "Unreachable", actorID: ACTOR }),
    ).rejects.toThrow(/nothing on the road/i);
  });
});

describe("cancelling a trip that is already on the road", () => {
  it("cancels it, which the ordinary cancel refuses to do", async () => {
    db.queue(
      booking("In Transit"),
      { data: { dispatchID: TRIP }, error: null },
      { data: null, error: null },
    );

    const result = await overrideBooking({
      orderID: ORDER,
      action: "cancel",
      reason: "Client called it off",
      actorID: ACTOR,
    });

    expect(result.action).toBe("cancel");
    expect(result.previousStatus).toBe("In Transit");

    const trip = db.writes.find((write) => write.table === "DispatchOrder");
    expect((trip?.payload as { status: string }).status).toBe("Cancelled");
    expect((trip?.payload as { rejectionreason: string }).rejectionreason).toBe("Client called it off");
  });

  it("gives the truck and crew back", async () => {
    db.queue(booking("In Transit"), { data: { dispatchID: TRIP }, error: null }, { data: null, error: null });
    await overrideBooking({ orderID: ORDER, action: "cancel", reason: "Called off", actorID: ACTOR });
    expect(released).toEqual([TRIP]);
  });

  it("closes the booking itself, not only the trip", async () => {
    db.queue(booking("In Transit"), { data: { dispatchID: TRIP }, error: null }, { data: null, error: null });
    await overrideBooking({ orderID: ORDER, action: "cancel", reason: "Called off", actorID: ACTOR });

    const order = db.writes.find((write) => write.table === "Order");
    expect((order?.payload as { isActive: boolean }).isActive).toBe(false);
  });
});

describe("declaring a foul trip the crew never reported", () => {
  it("files the same incident the crew's report files, under the office's name", async () => {
    db.queue(booking("In Transit"), { data: { dispatchID: TRIP }, error: null });

    await overrideBooking({
      orderID: ORDER,
      action: "foul-trip",
      reason: "Driver unreachable for three hours",
      issueType: "Crew unreachable",
      actorID: ACTOR,
    });

    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      dispatchID: TRIP,
      orderID: ORDER,
      reportedBy: ACTOR,
      issueType: "Crew unreachable",
      details: "Driver unreachable for three hours",
      blocking: true,
      dispatchStatusBefore: "In Transit",
    });
  });

  it("claims no photograph and no position, because the office has neither", async () => {
    db.queue(booking("In Transit"), { data: { dispatchID: TRIP }, error: null });
    await overrideBooking({
      orderID: ORDER,
      action: "foul-trip",
      reason: "Unreachable",
      actorID: ACTOR,
    });

    expect(incidents[0]).toMatchObject({ photoPath: null, latitude: null, longitude: null });
  });

  it("refuses when somebody else moved the trip first", async () => {
    // The guarded update matched nothing: the status changed underneath.
    db.queue(booking("In Transit"), { data: null, error: null });
    await expect(
      overrideBooking({ orderID: ORDER, action: "foul-trip", reason: "Unreachable", actorID: ACTOR }),
    ).rejects.toThrow(/changed while you were looking/i);
    expect(incidents).toHaveLength(0);
  });
});

describe("closing a delivery the crew finished and drove away from", () => {
  it("closes the stops that were left open, so the record does not contradict itself", async () => {
    db.queue(
      booking("In Transit"),
      { data: [{ branchID: 1, stopStatus: "Pending" }, { branchID: 2, stopStatus: "Successfully Delivered" }], error: null },
      { data: null, error: null }, // the stop update
      { data: null, error: null }, // its proof row
      { data: { dispatchID: TRIP }, error: null }, // the trip
    );

    const result = await overrideBooking({
      orderID: ORDER,
      action: "complete",
      reason: "Client confirmed by phone",
      actorID: ACTOR,
    });

    // Only the one that was still open.
    expect(result.stopsClosed).toBe(1);
  });

  it("invents no proof: a row with no file, saying why there is none", async () => {
    db.queue(
      booking("In Transit"),
      { data: [{ branchID: 1, stopStatus: "Pending" }], error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: { dispatchID: TRIP }, error: null },
    );

    await overrideBooking({
      orderID: ORDER,
      action: "complete",
      reason: "Client confirmed by phone",
      actorID: ACTOR,
    });

    const proof = db.writes.find((write) => write.table === "POD");
    const payload = proof?.payload as Record<string, unknown>;
    expect(payload.proof).toBeNull();
    expect(payload.receiverName).toBe("N/A");
    expect(String(payload.missingReason)).toMatch(/office closed this trip/i);
    // Attributed to the person who closed it, not to the crew.
    expect(payload.recordedBy).toBe(ACTOR);
    expect(payload.source).toBe("coordinator");
  });

  it("frees the truck, the same as any other ending", async () => {
    db.queue(
      booking("In Transit"),
      { data: [], error: null },
      { data: { dispatchID: TRIP }, error: null },
    );
    await overrideBooking({ orderID: ORDER, action: "complete", reason: "Done", actorID: ACTOR });
    expect(released).toEqual([TRIP]);
  });
});

describe("what a booking has to have reached", () => {
  // The question this answers: an admin can foul-trip an In Transit booking -
  // yes, that is the point - but the first version also let them foul-trip one
  // still sitting in Assigned, which would have put a truck into the recovery
  // list over a delivery that never left the yard.
  const ON_THE_ROAD = ["Accepted", "Start Delivery", "In Warehouse", "In Transit", "Arrived"];
  const NOT_YET = ["Pending", "Assigned"];

  for (const status of ON_THE_ROAD) {
    it(`allows a foul trip once the crew have taken it: ${status}`, async () => {
      db.queue(booking(status), { data: { dispatchID: TRIP }, error: null });
      const result = await overrideBooking({
        orderID: ORDER,
        action: "foul-trip",
        reason: "Unreachable",
        actorID: ACTOR,
      });
      expect(result.previousStatus).toBe(status);
      expect(incidents).toHaveLength(1);
    });
  }

  for (const status of NOT_YET) {
    it(`refuses a foul trip before anyone has taken it: ${status}`, async () => {
      db.queue(booking(status));
      await expect(
        overrideBooking({ orderID: ORDER, action: "foul-trip", reason: "x", actorID: ACTOR }),
      ).rejects.toThrow(/no crew has accepted/i);
      // Nothing filed, nothing changed.
      expect(incidents).toHaveLength(0);
      expect(db.writes).toHaveLength(0);
    });

    it(`refuses to close it as delivered before anyone has taken it: ${status}`, async () => {
      db.queue(booking(status));
      await expect(
        overrideBooking({ orderID: ORDER, action: "complete", reason: "x", actorID: ACTOR }),
      ).rejects.toThrow(/no delivery to close/i);
      expect(db.writes).toHaveLength(0);
    });

    it(`still cancels it, because that is the right answer there: ${status}`, async () => {
      db.queue(booking(status), { data: { dispatchID: TRIP }, error: null }, { data: null, error: null });
      const result = await overrideBooking({
        orderID: ORDER,
        action: "cancel",
        reason: "Client called it off",
        actorID: ACTOR,
      });
      expect(result.action).toBe("cancel");
      expect(released).toEqual([TRIP]);
    });
  }
});
