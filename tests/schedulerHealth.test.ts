import { describe, expect, it } from "vitest";

import {
  CHECKER_OVERDUE_AFTER_MIN,
  checkerHealth,
  checkerRecoveredAlert,
  checkerRecoveredDedupeKey,
  checkerWarning,
} from "@/app/lib/schedulerHealth";

// Whether the thing that watches the trucks is itself still running.
//
// The stall ladder is sent by one scheduled POST and by nothing else. The fleet
// board recomputes the same verdicts on every poll and notifies nobody, so when
// the schedule stops, the board goes on colouring quiet trips amber and not one
// alert is sent.
//
// It has happened twice. GitHub Actions honoured "*/10 * * * *" at a median of
// 277 minutes. pg_cron replaced it and fired exactly on time, for days, into a
// 401 - a 19-character secret where a 43-character one belonged, so every rung
// was written, tested, deployed, and had never once run in production.
//
// Both times the only symptom was silence, and silence is also what a fleet
// with no stalled trucks looks like.

const NOW = new Date("2026-09-30T12:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe("how long since the checker last worked", () => {
  it("counts whole minutes", () => {
    expect(checkerHealth(minutesAgo(7), NOW).ranMinutesAgo).toBe(7);
    expect(checkerHealth(minutesAgo(0), NOW).ranMinutesAgo).toBe(0);
  });

  it("is content while it is keeping up", () => {
    // Every ten minutes, so one late run is not a fault.
    expect(checkerHealth(minutesAgo(11), NOW).overdue).toBe(false);
    expect(checkerHealth(minutesAgo(CHECKER_OVERDUE_AFTER_MIN - 1), NOW).overdue).toBe(false);
  });

  it("calls it down after two missed ticks", () => {
    expect(checkerHealth(minutesAgo(CHECKER_OVERDUE_AFTER_MIN), NOW).overdue).toBe(true);
    expect(checkerHealth(minutesAgo(300), NOW).overdue).toBe(true);
  });

  it("tells never having run from being late", () => {
    // A system being set up is not a system that has failed - but it is also
    // not one anybody should trust to notify them.
    const never = checkerHealth(null, NOW);
    expect(never.neverRun).toBe(true);
    expect(never.overdue).toBe(false);
    expect(never.ranMinutesAgo).toBeNull();
  });

  it("does not trust a timestamp it cannot read", () => {
    expect(checkerHealth("not a date", NOW).neverRun).toBe(true);
  });

  it("never reports a negative age when the clocks disagree", () => {
    expect(checkerHealth(minutesAgo(-5), NOW).ranMinutesAgo).toBe(0);
  });
});

describe("what the board says", () => {
  it("says nothing while the checker is keeping up", () => {
    expect(checkerWarning(checkerHealth(minutesAgo(9), NOW))).toBeNull();
  });

  it("names the consequence rather than the fault", () => {
    // A coordinator does not need to know what pg_cron is. They need to know
    // that the amber trips in front of them will not alert anybody.
    const said = checkerWarning(checkerHealth(minutesAgo(180), NOW)) ?? "";
    expect(said).toMatch(/not running/i);
    expect(said).toMatch(/nobody is being notified/i);
    expect(said).toMatch(/3 hours ago/);
    expect(said).not.toMatch(/cron|401|vault/i);
  });

  it("speaks up when it has never run at all", () => {
    const said = checkerWarning(checkerHealth(null, NOW)) ?? "";
    expect(said).toMatch(/never run/i);
  });
});

describe("the checker owning up once it is back", () => {
  it("says which window to distrust, not that it is working now", () => {
    // "It is working now" is no use to somebody deciding whether a delivery
    // that ran quiet at four o'clock was chased.
    const alert = checkerRecoveredAlert(185);
    expect(alert.title).toMatch(/down for 3 hours/i);
    expect(alert.body).toMatch(/was not alerted on/i);
  });

  it("reads naturally at every length", () => {
    expect(checkerRecoveredAlert(1).title).toMatch(/1 minute\b/);
    expect(checkerRecoveredAlert(45).title).toMatch(/45 minutes/);
    expect(checkerRecoveredAlert(60).title).toMatch(/1 hour\b/);
    expect(checkerRecoveredAlert(60 * 72).title).toMatch(/3 days/);
  });

  it("is said once per gap, not on every run after it", () => {
    const gapStart = minutesAgo(200);
    expect(checkerRecoveredDedupeKey(gapStart)).toBe(checkerRecoveredDedupeKey(gapStart));
    expect(checkerRecoveredDedupeKey(gapStart)).not.toBe(checkerRecoveredDedupeKey(minutesAgo(5)));
  });
});
