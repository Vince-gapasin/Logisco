import { describe, expect, it } from "vitest";

import {
  assessStall,
  AT_STOP_GRACE_MIN,
  AT_STOP_METRES,
  neverReportedAlert,
  neverReportedDedupeKey,
  stallAlert,
  STOP_AT_RISK_MIN,
} from "@/app/lib/stallRules";

// The two ways this watchdog used to say nothing at all, and the case for saying
// something sooner when a delay is eating a time somebody promised.

const NOW = new Date("2026-09-29T06:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

const atStop = (minutes: number, stopAtRisk = false) =>
  assessStall({
    lastReportedAt: minutesAgo(minutes),
    status: "In Transit",
    metresToNearestStop: AT_STOP_METRES - 1,
    stopAtRisk,
    now: NOW,
  });

describe("a truck parked at its own stop", () => {
  it("is left alone for the first hour, because loading takes time", () => {
    expect(atStop(20).stalled).toBe(false);
    expect(atStop(20).reason).toBe("at a stop");
    expect(atStop(AT_STOP_GRACE_MIN - 1).stalled).toBe(false);
  });

  it("stops being excused once the hour is up", () => {
    // The case this fixes: a driver starts a delivery, never leaves the depot -
    // which is a pickup stop on the trip's own itinerary - and ignores the
    // check-in prompt. Every rung was suppressed and nobody heard anything.
    const verdict = atStop(AT_STOP_GRACE_MIN);
    expect(verdict.stalled).toBe(true);
    expect(verdict.reason).toBe("on the road");
    expect(verdict.atStop).toBe(true);
  });

  it("says where it is, so the office is not sent looking for a breakdown", () => {
    const alert = stallAlert(45, "ORD-1 (Acme)", 70, "stopped", { atStop: true });
    expect(alert.office.body).toMatch(/parked at one of its own stops/i);
  });

  it("gets no grace at all once a delivery time is threatened", () => {
    // The hole this closes: the at-stop branch returned before the ladder ran, so
    // the early escalation could not reach a truck at a stop. A delivery that
    // started at the depot and sat there while its first promised time slid past
    // was excused for a full hour - the exact case the escalation exists for.
    expect(atStop(20, false).stalled).toBe(false);
    expect(atStop(20, true).stalled).toBe(true);
    expect(atStop(20, true).threshold).toBe(15);
  });

  it("still excuses the first hour when nothing is at risk", () => {
    // Loading genuinely takes time, and this is the noise the grace prevents.
    expect(atStop(59, false).reason).toBe("at a stop");
  });
});

describe("a trip on the road that has never reported", () => {
  it("is not treated as a stall, because nothing is known about the truck", () => {
    const verdict = assessStall({
      lastReportedAt: null,
      status: "In Transit",
      metresToNearestStop: null,
      now: NOW,
    });
    expect(verdict.stalled).toBe(false);
    expect(verdict.reason).toBe("never reported");
  });

  it("is reported as tracking being off, not as a breakdown", () => {
    const alert = neverReportedAlert("ORD-1 (Acme)");
    expect(alert.body).toMatch(/never sent a position/i);
    expect(alert.body).toMatch(/location access/i);
    // The client cannot see it either, which is the part that makes it urgent
    // to somebody even though nothing is wrong with the truck.
    expect(alert.body).toMatch(/client/i);
    expect(alert.title).not.toMatch(/emergency|breakdown/i);
  });

  it("is a daily reminder rather than one notification that scrolls away", () => {
    const morning = new Date("2026-09-29T01:00:00.000Z");
    const evening = new Date("2026-09-29T13:00:00.000Z");
    const tomorrow = new Date("2026-09-30T01:00:00.000Z");

    expect(neverReportedDedupeKey("d1", morning)).toBe(neverReportedDedupeKey("d1", evening));
    expect(neverReportedDedupeKey("d1", morning)).not.toBe(neverReportedDedupeKey("d1", tomorrow));
  });
});

describe("when the delay is eating a promised delivery time", () => {
  const risk = { stopName: "SM North", minutesLate: 20 };

  it("pulls the office in at fifteen minutes, which normally tells nobody", () => {
    const quiet = stallAlert(15, "ORD-1", 15, "stopped");
    expect(quiet.notifyOffice).toBe(false);
    expect(quiet.crew).toBeNull();

    const pressing = stallAlert(15, "ORD-1", 15, "stopped", { atRisk: risk });
    expect(pressing.notifyOffice).toBe(true);
    expect(pressing.severity).toBe("action");
    // And asks the crew at the same moment, rather than waiting for thirty.
    expect(pressing.crew).not.toBeNull();
  });

  it("says which stop and how late, so the office knows what is at stake", () => {
    const alert = stallAlert(15, "ORD-1", 15, "stopped", { atRisk: risk });
    expect(alert.office.body).toContain("SM North");
    expect(alert.office.body).toMatch(/was due 20 minutes ago/i);
  });

  it("reads a time still ahead as time remaining, not as lateness", () => {
    const alert = stallAlert(30, "ORD-1", 30, "stopped", {
      atRisk: { stopName: "SM North", minutesLate: -12 },
    });
    expect(alert.office.body).toMatch(/due in 12 minutes/i);
    expect(alert.office.body).not.toMatch(/ago/i);
  });

  it("makes thirty minutes urgent instead of something to get round to", () => {
    expect(stallAlert(30, "ORD-1", 30, "stopped").severity).toBe("action");
    expect(stallAlert(30, "ORD-1", 30, "stopped", { atRisk: risk }).severity).toBe("urgent");
  });

  it("leaves a trip with slack alone at fifteen, as it always did", () => {
    // STOP_AT_RISK_MIN is the line: further off than that and the service does
    // not report a risk at all, so the rung behaves exactly as before.
    const alert = stallAlert(15, "ORD-1", 15, "stopped", { atRisk: null });
    expect(alert.notifyOffice).toBe(false);
    expect(STOP_AT_RISK_MIN).toBeGreaterThan(0);
  });
});
