import { beforeEach, describe, expect, it, vi } from "vitest";

// What the office is told about a trip in progress.
//
// Almost nothing was. A crew could report a delay, close a stop with no
// photograph, or ask for help, and the only thing to reach the notification
// feed was the trip finishing. The fleet board could see all of it, because it
// recomputes the state on every poll - which is what made the gap easy to miss.
// The board is a view; the feed is the record of what was said.
//
// And not everything. Announcing every arrival and every stop is six
// notifications on a four-drop delivery that went entirely to plan. What is
// here is what somebody may have to do something about.

const sent: Record<string, unknown>[] = [];

vi.mock("@/services/notifications/notify", () => ({
  OFFICE: ["admin", "coordinator"],
  tripLabel: async () => "ORD-1 (Acme)",
  notify: async (input: Record<string, unknown>) => {
    sent.push(input);
    return 2;
  },
}));

const { announceCheckIn, announceMissingProof, announceTripReport } = await import(
  "@/services/dispatch/crewUpdateService"
);

const TRIP = "11111111-2222-3333-4444-555555555555";
const ANA = { employeeID: "emp-1", employeeName: "Ana" };
const AT = "2026-09-30T02:00:00.000Z";

const last = () => sent[sent.length - 1];

beforeEach(() => {
  sent.length = 0;
});

describe("a delay the crew reported", () => {
  it("reaches the office, which only the board used to see", () => {
    return announceCheckIn(TRIP, "traffic", null, AT, ANA).then(() => {
      expect(last().title).toBe("Crew reported: Stuck in traffic");
      expect(last().body).toMatch(/customer can see the reason/);
    });
  });

  it("carries whatever the crew typed with it", async () => {
    await announceCheckIn(TRIP, "waiting", "Gate 3 is closed", AT, ANA);
    expect(last().body).toMatch(/Gate 3 is closed/);
  });

  it("stays quiet enough that the urgent ones still read as urgent", async () => {
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

  it("is said once per answer, so a second answer is still heard", async () => {
    await announceCheckIn(TRIP, "traffic", null, AT, ANA);
    const first = last().dedupeKey;
    await announceCheckIn(TRIP, "traffic", null, "2026-09-30T03:00:00.000Z", ANA);
    expect(last().dedupeKey).not.toBe(first);
  });
});

describe("a stop closed with no photograph", () => {
  it("is the one stop event worth saying, because it can still be fixed", async () => {
    // The crew are standing there. A call now is a proof recovered rather than
    // a gap in the record found weeks later.
    await announceMissingProof(TRIP, "Makati Branch", AT, ANA);
    expect(last().title).toBe("No proof at Makati Branch");
    expect(last().body).toMatch(/may still be there/);
    expect(last().severity).toBe("action");
  });

  it("is said once per stop, not once per retry", async () => {
    await announceMissingProof(TRIP, "Makati Branch", AT, ANA);
    expect(last().dedupeKey).toBe(`no-proof:${TRIP}:${AT}`);
  });
});

describe("the trip report", () => {
  it("is announced only when it names something wrong", async () => {
    // A report with nothing in it arrives beside TRIP_COMPLETED and says the
    // same thing twice.
    await announceTripReport(TRIP, false, ANA, AT);
    expect(sent).toHaveLength(0);
  });

  it("is raised when it mentions the truck", async () => {
    await announceTripReport(TRIP, true, ANA, AT);
    expect(last().title).toMatch(/truck problem/i);
    expect(last().severity).toBe("action");
    expect(last().body).toMatch(/before it goes out again/);
  });
});

describe("what is deliberately not announced", () => {
  it("has no departure, arrival or ordinary stop notice at all", async () => {
    const updates = await import("@/services/dispatch/crewUpdateService");
    // Not "they are not called" - they do not exist. A notice nobody wants is
    // better deleted than left behind a flag for somebody to switch back on.
    expect(updates).not.toHaveProperty("announceDeparture");
    expect(updates).not.toHaveProperty("announceArrival");
    expect(updates).not.toHaveProperty("announceStopDone");
  });
});

describe("when telling people fails", () => {
  it("never fails the thing that caused it", async () => {
    // A delivery that was recorded is recorded whether or not anybody was told.
    const notify = await import("@/services/notifications/notify");
    const spy = vi.spyOn(notify, "notify").mockRejectedValueOnce(new Error("down"));
    await expect(announceMissingProof(TRIP, "Makati", AT, ANA)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
