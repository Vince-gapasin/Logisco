import { describe, expect, it } from "vitest";

import { assessStall, AT_STOP_METRES } from "@/app/lib/stallRules";

// The threshold now starts from what the crew last told us, not from the last
// time the wheels turned.
//
// Why that matters: the app reports a position only when the truck moves, so an
// hour of legitimate unloading and an hour broken down on a hard shoulder arrive
// as exactly the same thing - nothing at all. The watchdog told them apart by
// guessing from how near a stop the truck happened to be, which needed a radius
// and a grace period, both invented, and left a hole a delivery could sit in at
// the depot for ever. A crew who say "I am here" and later "I am done" have
// answered the question instead.

const NOW = new Date("2026-09-29T06:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

// Far from any stop, so nothing but the crew's own words can excuse the silence.
const onTheRoad = (input: {
  movedMinutesAgo: number;
  crewSaidMinutesAgo?: number;
  atDeclaredStop?: boolean;
  stopAtRisk?: boolean;
}) =>
  assessStall({
    lastReportedAt: minutesAgo(input.movedMinutesAgo),
    lastCrewUpdateAt:
      input.crewSaidMinutesAgo === undefined ? null : minutesAgo(input.crewSaidMinutesAgo),
    atDeclaredStop: input.atDeclaredStop ?? false,
    stopAtRisk: input.stopAtRisk ?? false,
    status: "In Transit",
    metresToNearestStop: 5_000,
    now: NOW,
  });

describe("the clock the crew restart", () => {
  it("runs from movement when the crew have said nothing", () => {
    const verdict = onTheRoad({ movedMinutesAgo: 50 });
    expect(verdict.silentFor).toBe(50);
    expect(verdict.threshold).toBe(45);
  });

  it("restarts when the crew finish a stop, even before the truck pulls away", () => {
    // Fifty minutes since the wheels turned, five since they signed for it. They
    // are not stalled - they were working, and they said so. Starting the clock
    // from the last GPS movement punished them for standing still to do the
    // paperwork.
    const verdict = onTheRoad({ movedMinutesAgo: 50, crewSaidMinutesAgo: 5 });
    expect(verdict.silentFor).toBe(5);
    expect(verdict.stalled).toBe(false);
    expect(verdict.reason).toBe("reporting");
  });

  it("does not let a stale crew update hold the clock back", () => {
    // They finished a stop an hour ago and have not moved since. The later of the
    // two is what counts, and here that is still the crew update - so the ladder
    // measures from it and reports the truck as an hour quiet, not two.
    const verdict = onTheRoad({ movedMinutesAgo: 120, crewSaidMinutesAgo: 60 });
    expect(verdict.silentFor).toBe(60);
    expect(verdict.threshold).toBe(45);
  });

  it("takes whichever came last, so movement after a stop counts too", () => {
    const verdict = onTheRoad({ movedMinutesAgo: 3, crewSaidMinutesAgo: 40 });
    expect(verdict.silentFor).toBe(3);
    expect(verdict.stalled).toBe(false);
  });
});

describe("a crew who have said they are at a stop", () => {
  it("are left alone, however long the truck has been still", () => {
    const verdict = onTheRoad({ movedMinutesAgo: 200, atDeclaredStop: true });
    expect(verdict.stalled).toBe(false);
    expect(verdict.reason).toBe("at a stop");
    expect(verdict.atStop).toBe(true);
  });

  it("are asked anyway once a delivery time is threatened", () => {
    // "I am unloading" must not come to mean "do not ask me again". This is the
    // same rule the GPS guess follows, on a better signal.
    const verdict = onTheRoad({
      movedMinutesAgo: 200,
      atDeclaredStop: true,
      stopAtRisk: true,
    });
    expect(verdict.stalled).toBe(true);
  });

  it("are not excused by the guess once they have stopped being excused by their own word", () => {
    // Declared arrival false, near a stop, past the GPS grace: the old path still
    // works for a crew who never tapped anything.
    const verdict = assessStall({
      lastReportedAt: minutesAgo(90),
      atDeclaredStop: false,
      status: "In Transit",
      metresToNearestStop: AT_STOP_METRES - 1,
      now: NOW,
    });
    expect(verdict.stalled).toBe(true);
    expect(verdict.atStop).toBe(true);
  });
});

describe("what the silence is blamed on", () => {
  it("is judged on movement, not on a crew tap", () => {
    // Contact is fresh and the truck has not moved for an hour: the app is
    // talking, so the truck itself has stopped. A crew update five minutes ago
    // must not turn that into "we cannot tell" - it says nothing about whether
    // the phone is still reaching us.
    const verdict = assessStall({
      lastReportedAt: minutesAgo(60),
      lastContactAt: minutesAgo(1),
      lastCrewUpdateAt: minutesAgo(50),
      status: "In Transit",
      metresToNearestStop: 5_000,
      now: NOW,
    });
    expect(verdict.cause).toBe("stopped");
  });
});
