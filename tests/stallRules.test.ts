import { describe, expect, it } from "vitest";

import { assessStall, stallAlert, stallDedupeKey, AT_STOP_METRES } from "@/app/lib/stallRules";

const NOW = new Date("2026-09-26T10:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const onTheRoad = (minutes: number, metresToNearestStop: number | null = 5_000) =>
  assessStall({
    lastReportedAt: minutesAgo(minutes),
    status: "In Transit",
    metresToNearestStop,
    now: NOW,
  });

describe("deciding a truck has gone quiet", () => {
  it("says nothing before the first threshold", () => {
    expect(onTheRoad(14).stalled).toBe(false);
    expect(onTheRoad(14).reason).toBe("reporting");
  });

  it("passes each threshold in turn", () => {
    expect(onTheRoad(15).threshold).toBe(15);
    expect(onTheRoad(29).threshold).toBe(15);
    expect(onTheRoad(30).threshold).toBe(30);
    expect(onTheRoad(44).threshold).toBe(30);
    expect(onTheRoad(45).threshold).toBe(45);
    expect(onTheRoad(600).threshold).toBe(45);
  });

  it("counts the minutes it has been quiet", () => {
    expect(onTheRoad(37).silentFor).toBe(37);
  });

  it("leaves a truck alone while it sits at one of its own stops", () => {
    // Unloading takes longer than any of these thresholds, routinely.
    const loading = onTheRoad(50, AT_STOP_METRES - 1);
    expect(loading.stalled).toBe(false);
    expect(loading.reason).toBe("at a stop");
    // It still says how long, so a screen can show it without alarm.
    expect(loading.silentFor).toBe(50);
  });

  it("raises it once the truck is clear of the stop", () => {
    expect(onTheRoad(50, AT_STOP_METRES + 1).stalled).toBe(true);
  });

  it("only watches trips that are on the road", () => {
    for (const status of ["Assigned", "Accepted", "Completed", "Foul Trip", "Rejected"]) {
      const verdict = assessStall({ lastReportedAt: minutesAgo(90), status, metresToNearestStop: 9_000, now: NOW });
      expect(verdict.stalled).toBe(false);
      expect(verdict.reason).toBe("not on the road");
    }
  });

  it("does not call a trip that has never reported stalled", () => {
    // It may not have set off, or the app may never have been opened. Worth
    // knowing, but it is not this alarm.
    const verdict = assessStall({ lastReportedAt: null, status: "In Transit", metresToNearestStop: null, now: NOW });
    expect(verdict.stalled).toBe(false);
    expect(verdict.reason).toBe("never reported");
  });

  it("is not fooled by a position timestamped in the future", () => {
    const verdict = assessStall({
      lastReportedAt: new Date(NOW.getTime() + 60 * 60_000).toISOString(),
      status: "In Transit",
      metresToNearestStop: 9_000,
      now: NOW,
    });
    expect(verdict.silentFor).toBe(0);
    expect(verdict.stalled).toBe(false);
  });

  it("raises it when the nearest stop is unknown rather than staying silent", () => {
    // A stop with no coordinates cannot vouch for the truck sitting at it.
    expect(onTheRoad(50, null).stalled).toBe(true);
  });
});

describe("what each threshold is worth saying", () => {
  it("tells nobody at fifteen minutes", () => {
    const alert = stallAlert(15, "ORD-1 (Acme)", 15);
    expect(alert.notifyOffice).toBe(false);
    expect(alert.askCrew).toBe(false);
    expect(alert.severity).toBe("info");
  });

  it("asks the crew and tells the office at thirty", () => {
    const alert = stallAlert(30, "ORD-1 (Acme)", 31);
    expect(alert.notifyOffice).toBe(true);
    expect(alert.askCrew).toBe(true);
    expect(alert.severity).toBe("action");
  });

  it("is urgent at forty-five, and says what to do", () => {
    const alert = stallAlert(45, "ORD-1 (Acme)", 46);
    expect(alert.severity).toBe("urgent");
    expect(alert.body).toMatch(/call the driver/i);
    expect(alert.body).toMatch(/foul trip/i);
  });

  it("says how long, and does not claim to know why", () => {
    // The app reports on movement alone, so silence is all we can honestly
    // claim - not that the truck has stopped.
    const alert = stallAlert(45, "ORD-1 (Acme)", 46);
    expect(alert.body).toContain("46 minutes");
    expect(alert.body).toMatch(/not reported/i);
  });
});

describe("saying a thing once", () => {
  it("is the same key for the same silence", () => {
    const reported = minutesAgo(40);
    expect(stallDedupeKey("d1", 30, reported)).toBe(stallDedupeKey("d1", 30, reported));
  });

  it("is a different key for each threshold", () => {
    const reported = minutesAgo(40);
    expect(stallDedupeKey("d1", 30, reported)).not.toBe(stallDedupeKey("d1", 45, reported));
  });

  it("is a different key when the truck has moved since and gone quiet again", () => {
    expect(stallDedupeKey("d1", 30, minutesAgo(40))).not.toBe(stallDedupeKey("d1", 30, minutesAgo(90)));
  });
});
