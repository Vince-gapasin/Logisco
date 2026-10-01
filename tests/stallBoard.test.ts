import { describe, expect, it } from "vitest";

import { assessStall } from "@/app/lib/stallRules";

// The parts of a verdict the board never showed.
//
// assessStall has always worked out whether the truck stopped or the phone did,
// and how long since the app last spoke. Both were computed on every verdict and
// read by nothing: the board said how long a truck had been quiet and left the
// first question a coordinator asks - is the app still talking to us - to be
// answered by ringing the driver.

const NOW = new Date("2026-09-29T14:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

const verdict = (movedMinutesAgo: number, contactMinutesAgo?: number) =>
  assessStall({
    lastReportedAt: minutesAgo(movedMinutesAgo),
    lastContactAt: contactMinutesAgo === undefined ? null : minutesAgo(contactMinutesAgo),
    status: "In Transit",
    metresToNearestStop: 5_000,
    now: NOW,
  });

describe("telling the truck stopping from the phone stopping", () => {
  it("is certain only when the app is still talking and the truck is not", () => {
    const seen = verdict(50, 1);
    expect(seen.cause).toBe("stopped");
    expect(seen.outOfContactFor).toBe(1);
  });

  it("says the phone went too, and for how long, when contact has lapsed", () => {
    const lost = verdict(50, 25);
    expect(lost.cause).toBe("out of contact");
    // The figure the board needs in order to say "app silent 25 minutes".
    expect(lost.outOfContactFor).toBe(25);
  });

  it("refuses to guess when there are no heartbeats to compare", () => {
    // An app build that does not send them moves both timestamps together, so
    // "the app has gone silent" and "the truck has not moved" are the same
    // statement - true of both, evidence of neither.
    expect(verdict(50, 50).cause).toBe("unknown");
    expect(verdict(50).cause).toBe("unknown");
  });
});

describe("a trip on the road that has never reported", () => {
  const never = assessStall({
    lastReportedAt: null,
    status: "In Transit",
    metresToNearestStop: null,
    now: NOW,
  });

  it("has no silence to measure, which is why the board used to drop it", () => {
    // The board skipped anything under fifteen minutes, and this measures zero
    // because there is no position to measure from - so the one trip with
    // nothing to go and look at was the one that never appeared.
    expect(never.silentFor).toBe(0);
    expect(never.reason).toBe("never reported");
  });

  it("is still not a stall, because nothing is known about the truck", () => {
    expect(never.stalled).toBe(false);
    expect(never.threshold).toBeNull();
  });
});
