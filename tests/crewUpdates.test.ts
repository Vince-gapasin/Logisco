import { beforeEach, describe, expect, it, vi } from "vitest";

// Telling the office what the crew just did.
//
// Almost none of it reached them. A crew could set off, reach a warehouse,
// collect a load, reach a delivery point, hand it over and report a delay, and
// the office would be told exactly once - when the whole trip completed. The
// fleet board could see all of it, because it recomputes the state on every
// poll; the feed is the record of what was said, and nothing was saying it.

const sent: Record<string, unknown>[] = [];

vi.mock("@/services/notifications/notify", () => ({
  OFFICE: ["admin", "coordinator"],
  tripLabel: async () => "ORD-1 (Acme)",
  notify: async (input: Record<string, unknown>) => {
    sent.push(input);
    return 2;
  },
}));

const {
  announceArrival,
  announceCheckIn,
  announceDeparture,
  announceStopDone,
  announceTripReport,
} = await import("@/services/dispatch/crewUpdateService");

const TRIP = "11111111-2222-3333-4444-555555555555";
const ANA = { employeeID: "emp-1", employeeName: "Ana" };
const AT = "2026-09-30T02:00:00.000Z";

const last = () => sent[sent.length - 1];

beforeEach(() => {
  sent.length = 0;
});

describe("what reaches the office now", () => {
  it("says the trip has set off", async () => {
    await announceDeparture(TRIP, ANA, "Accepted");
    expect(last().title).toBe("Trip started");
    expect(last().body).toMatch(/Ana has set off/);
  });

  it("says where the crew have arrived", async () => {
    await announceArrival(TRIP, "Bonchon Valenzuela", AT, ANA);
    expect(last().title).toBe("Arrived at Bonchon Valenzuela");
  });

  it("tells a collection from a hand-over", async () => {
    await announceStopDone(
      TRIP,
      { name: "Valenzuela Warehouse", isPickup: true, hasProof: true },
      AT,
      ANA,
    );
    expect(last().title).toBe("Collected from Valenzuela Warehouse");

    await announceStopDone(
      TRIP,
      { name: "Makati Branch", isPickup: false, receiverName: "Trisha", hasProof: true },
      AT,
      ANA,
    );
    expect(last().title).toBe("Delivered to Makati Branch");
    expect(last().body).toMatch(/Received by Trisha/);
  });

  it("says plainly when a stop was closed with no photograph", async () => {
    // The one the office may want to ask about while the crew are still near it,
    // rather than discover in the report afterwards.
    await announceStopDone(
      TRIP,
      { name: "Makati Branch", isPickup: false, hasProof: false },
      AT,
      ANA,
    );
    expect(last().body).toMatch(/No photograph was taken/);
  });

  it("does not claim a receiver when the crew app sent its placeholder", async () => {
    await announceStopDone(
      TRIP,
      { name: "Makati Branch", isPickup: false, receiverName: "N/A", hasProof: true },
      AT,
      ANA,
    );
    expect(last().body).not.toMatch(/Received by/);
  });

  it("passes on a delay the crew reported, which only the board used to see", async () => {
    await announceCheckIn(TRIP, "traffic", null, AT, ANA);
    expect(last().title).toBe("Crew reported: Stuck in traffic");
    expect(last().body).toMatch(/customer can see the reason/);
  });

  it("carries whatever the crew typed with it", async () => {
    await announceCheckIn(TRIP, "waiting", "Gate 3 is closed", AT, ANA);
    expect(last().body).toMatch(/Gate 3 is closed/);
  });

  it("files the trip report", async () => {
    await announceTripReport(TRIP, false, ANA, AT);
    expect(last().title).toBe("Trip report filed");
  });
});

describe("how loudly each one arrives", () => {
  it("keeps ordinary progress quiet, so the urgent ones still read as urgent", async () => {
    await announceDeparture(TRIP, ANA, "Accepted");
    expect(last().severity).toBe("info");

    await announceArrival(TRIP, "Makati", AT, ANA);
    expect(last().severity).toBe("info");

    await announceCheckIn(TRIP, "traffic", null, AT, ANA);
    expect(last().severity).toBe("info");
  });

  it("does not wait for a cron tick to pass on a call for help", async () => {
    // The scheduled watchdog would carry this in up to ten minutes, and an
    // ordinary delay is suppressed for the first half hour on purpose. Neither
    // is the right answer to somebody asking for help.
    await announceCheckIn(TRIP, "need_help", null, AT, ANA);
    expect(last().severity).toBe("urgent");
    expect(last().title).toMatch(/Crew need help/);
    expect(last().body).toMatch(/Call them now/);

    await announceCheckIn(TRIP, "vehicle_problem", null, AT, ANA);
    expect(last().severity).toBe("urgent");
  });

  it("raises a trip report that mentions the truck", async () => {
    // Something to act on before it goes out again.
    await announceTripReport(TRIP, true, ANA, AT);
    expect(last().severity).toBe("action");
    expect(last().body).toMatch(/before it goes out again/);
  });
});

describe("saying each thing once", () => {
  it("keys a departure on the status it left, not on the clock", async () => {
    await announceDeparture(TRIP, ANA, "Accepted");
    const first = last().dedupeKey;
    await announceDeparture(TRIP, ANA, "Accepted");
    expect(last().dedupeKey).toBe(first);
  });

  it("keys an arrival on the moment reported", async () => {
    await announceArrival(TRIP, "Makati", AT, ANA);
    expect(last().dedupeKey).toBe(`arrived:${TRIP}:${AT}`);
  });

  it("keys a check-in per answer, so a second answer is heard", async () => {
    await announceCheckIn(TRIP, "traffic", null, AT, ANA);
    const first = last().dedupeKey;
    await announceCheckIn(TRIP, "traffic", null, "2026-09-30T03:00:00.000Z", ANA);
    expect(last().dedupeKey).not.toBe(first);
  });
});

describe("when telling people fails", () => {
  it("never fails the thing that caused it", async () => {
    // A delivery that was recorded is recorded whether or not anybody was told.
    const notify = await import("@/services/notifications/notify");
    const spy = vi.spyOn(notify, "notify").mockRejectedValueOnce(new Error("down"));
    await expect(announceArrival(TRIP, "Makati", AT, ANA)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
