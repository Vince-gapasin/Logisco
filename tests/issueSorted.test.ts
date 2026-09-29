import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseDouble } from "./support/supabaseDouble";

// Saying a reported problem is over.
//
// The crew could report something they were able to carry on through - the
// wrong product collected, a receiver who was not there - and then had no way
// of saying it was sorted. Only the office's Close button could. So the report
// sat open on the office's screen, and the customer went on being shown a
// problem that no longer existed for the rest of the delivery.

const double = supabaseDouble();
vi.mock("@/app/lib/supabase", () => ({ supabase: double.client }));

const { FoulTripError, markIssueSorted } = await import("@/services/foulTrip/foulTripService");
const { buildTrackingSteps } = await import("@/services/tracking/publicTrackingService");

const TRIP = "11111111-2222-3333-4444-555555555555";
const OTHER_TRIP = "99999999-8888-7777-6666-555555555555";
const INCIDENT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CREW = { employeeID: "cccccccc-cccc-cccc-cccc-cccccccccccc", employeeName: "Ana" };

const incident = (over: Record<string, unknown> = {}) => ({
  incidentID: INCIDENT,
  dispatchID: TRIP,
  orderID: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  issueType: "Wrong product collected",
  status: "open",
  blocking: false,
  ...over,
});

beforeEach(() => {
  double.calls.length = 0;
  double.writes.length = 0;
});

describe("the crew clearing what they reported", () => {
  it("records who sorted it, and that it is resolved", async () => {
    double.queue({ data: incident(), error: null }, { data: null, error: null });

    const result = await markIssueSorted(INCIDENT, TRIP, CREW, "Went back for the right pallets");
    expect(result.issueType).toBe("Wrong product collected");

    const written = double.writes.at(-1)?.payload as Record<string, unknown>;
    expect(written.status).toBe("resolved");
    expect(written.resolvedBy).toBe(CREW.employeeID);
    expect(written.resolutionNotes).toMatch(/Sorted on the road by Ana/);
    // What they typed is kept: it is the only account of how it was sorted.
    expect(written.resolutionNotes).toMatch(/right pallets/);
  });

  it("still records it when they say nothing beyond tapping", async () => {
    double.queue({ data: incident(), error: null }, { data: null, error: null });
    await markIssueSorted(INCIDENT, TRIP, CREW, null);
    const written = double.writes.at(-1)?.payload as Record<string, unknown>;
    expect(written.resolutionNotes).toBe("Sorted on the road by Ana.");
  });
});

describe("what the crew may not clear", () => {
  it("refuses a foul trip", async () => {
    // The truck is off the road and a recovery is being arranged around it. A
    // "sorted" tap would take it off the list somebody is working from.
    double.queue({ data: incident({ blocking: true }), error: null });
    await expect(markIssueSorted(INCIDENT, TRIP, CREW, null)).rejects.toThrow(/office has to clear it/i);
    expect(double.writes).toHaveLength(0);
  });

  it("refuses a report belonging to another delivery", async () => {
    double.queue({ data: incident(), error: null });
    await expect(markIssueSorted(INCIDENT, OTHER_TRIP, CREW, null)).rejects.toThrow(/not on this delivery/i);
    expect(double.writes).toHaveLength(0);
  });

  it("refuses one that has already been cleared", async () => {
    double.queue({ data: incident({ status: "resolved" }), error: null });
    await expect(markIssueSorted(INCIDENT, TRIP, CREW, null)).rejects.toThrow(/already been resolved/i);
  });

  it("carries a status code, so the crew app can tell a refusal from a fault", async () => {
    double.queue({ data: incident({ blocking: true }), error: null });
    await markIssueSorted(INCIDENT, TRIP, CREW, null).catch((error) => {
      expect(error).toBeInstanceOf(FoulTripError);
      expect((error as InstanceType<typeof FoulTripError>).status).toBe(403);
    });
    expect.assertions(2);
  });
});

describe("what the customer is shown about it", () => {
  const problem = (over: Record<string, unknown> = {}) => ({
    issueType: "Wrong product collected",
    reportedAt: "2026-09-30T02:00:00.000Z",
    blocking: false,
    resolvedAt: null,
    ...over,
  });

  const stepFor = (over: Record<string, unknown> = {}) => {
    const steps = buildTrackingSteps("In Transit", [], false, [problem(over)]);
    const found = steps.find((step) => step.title.includes("Wrong product collected"));
    if (!found) throw new Error("the problem was not on the timeline");
    return found;
  };

  it("reads as an open problem while it is one", () => {
    const step = stepFor();
    expect(step.title).toBe("Reported: Wrong product collected");
    expect(step.stage).toBe("problem");
  });

  it("reads as resolved once the crew have said so", () => {
    const step = stepFor({ resolvedAt: "2026-09-30T02:40:00.000Z" });
    expect(step.title).toBe("Resolved: Wrong product collected");
    expect(step.stage).toBe("completed");
    // Stamped when it was sorted, not when it was reported.
    expect(step.at).toBe("2026-09-30T02:40:00.000Z");
  });

  it("keeps it on the timeline rather than making it disappear", () => {
    // The customer was already told. Something vanishing reads worse than
    // something resolving.
    const steps = buildTrackingSteps("In Transit", [], false, [
      problem({ resolvedAt: "2026-09-30T02:40:00.000Z" }),
    ]);
    expect(steps.some((step) => step.title.includes("Wrong product collected"))).toBe(true);
  });

  it("does not soften a trip that actually stopped", () => {
    // A foul trip has no crew-facing "sorted" path, and must not pick one up
    // from a stray resolvedAt written by the office's recovery.
    const step = stepFor({ blocking: true, resolvedAt: "2026-09-30T02:40:00.000Z" });
    expect(step.title).toBe("Trip interrupted: Wrong product collected");
    expect(step.stage).toBe("problem");
  });
});

describe("a hold-up the crew have since driven out of", () => {
  const stop = (over: Record<string, unknown> = {}) => ({
    branchID: 1,
    branchName: "Makati",
    expectedTime: null,
    status: "Arrived",
    latitude: null,
    longitude: null,
    arrivedAt: null,
    deliveredAt: null,
    receivedBy: null,
    ...over,
  });

  const traffic = [{ wording: "Held up in traffic", at: "2026-09-30T02:00:00.000Z" }];
  const heldUpShown = (stops: ReturnType<typeof stop>[], pickupProgressAt: string | null = null) =>
    buildTrackingSteps("In Transit", stops, false, [], new Map(), null, traffic, pickupProgressAt).some(
      (step) => step.title === "Held up in traffic",
    );

  it("is still shown while they are in it", () => {
    expect(heldUpShown([stop()])).toBe(true);
  });

  it("stops being shown once they say they have arrived", () => {
    // The tap that says "I am here" is the crew saying the traffic is behind
    // them. The page used to go on saying otherwise for the rest of the trip:
    // the hold-up was appended after every stop and never expired, so it sat at
    // the bottom of the timeline as the newest thing that had happened.
    expect(heldUpShown([stop({ arrivedAt: "2026-09-30T02:30:00.000Z" })])).toBe(false);
  });

  it("stops being shown once the stop is signed for", () => {
    expect(heldUpShown([stop({ deliveredAt: "2026-09-30T02:30:00.000Z" })])).toBe(false);
  });

  it("counts reaching a warehouse, which the customer never sees", () => {
    // Their own stops show no progress at all, but the crew are demonstrably
    // not in that jam any more.
    expect(heldUpShown([stop()], "2026-09-30T02:30:00.000Z")).toBe(false);
  });

  it("comes back for a jam they hit after that progress", () => {
    // Stuck again on the way to the next stop is a new hold-up, not a stale one.
    const later = [{ wording: "Held up in traffic", at: "2026-09-30T03:00:00.000Z" }];
    const steps = buildTrackingSteps(
      "In Transit",
      [stop({ arrivedAt: "2026-09-30T02:30:00.000Z" })],
      false,
      [],
      new Map(),
      null,
      later,
    );
    expect(steps.some((step) => step.title === "Held up in traffic")).toBe(true);
  });
});
