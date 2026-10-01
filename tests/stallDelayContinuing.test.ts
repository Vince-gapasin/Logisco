import { describe, expect, it } from "vitest";

import {
  ANSWERED_DELAY_ESCALATES_MIN,
  assessStall,
  CHECK_IN_QUIETENS_MIN,
  delayContinuingAlert,
  delayDedupeKey,
  mayAskCrewAgain,
} from "@/app/lib/stallRules";

// What a crew answer buys, and what it does not.
//
// It used to silence everybody: "Stuck in traffic" bought sixty minutes of
// nothing at all, and the office was never told the crew had answered - it
// surfaced only as a line on the fleet board, for whoever happened to be looking
// at it. So an hour could pass on a delivery that was visibly going wrong with
// nobody in the office aware there was anything to prepare for.
//
// The answer was meant to stop the crew being asked the same question every
// quarter of an hour. That is not the same as the office hearing nothing, and
// half an hour is not every quarter of an hour - so at thirty minutes the office
// is told and the crew are asked once whether it has cleared. Only a meal break
// is left alone, and only because Article 85 says uninterrupted.

const NOW = new Date("2026-09-29T15:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

const afterAnswer = (minutesSinceAnswer: number, state: "traffic" | "on_break" = "traffic") =>
  assessStall({
    // Quiet throughout; the crew answered partway in.
    lastReportedAt: minutesAgo(minutesSinceAnswer + 15),
    checkIn: { state, at: minutesAgo(minutesSinceAnswer) },
    status: "In Transit",
    metresToNearestStop: 5_000,
    now: NOW,
  });

describe("just after the crew answer", () => {
  it("says nothing to anybody, because they have just told us", () => {
    const verdict = afterAnswer(5);
    expect(verdict.stalled).toBe(false);
    expect(verdict.reason).toBe("crew answered");
  });

  it("holds that right up to the half hour", () => {
    expect(afterAnswer(ANSWERED_DELAY_ESCALATES_MIN - 1).stalled).toBe(false);
  });
});

describe("once a stated delay has run half an hour", () => {
  it("reaches the office, which it never used to", () => {
    const verdict = afterAnswer(ANSWERED_DELAY_ESCALATES_MIN);
    expect(verdict.stalled).toBe(true);
    expect(verdict.reason).toBe("delay continuing");
  });

  it("carries what they said, so the alert can name it", () => {
    const verdict = afterAnswer(40);
    expect(verdict.crewSaid).toMatchObject({ state: "traffic", minutesAgo: 40 });
  });

  it("still happens inside the window the answer bought", () => {
    // The point of the fix: the window is for the crew, not for the office.
    const inside = 40;
    expect(inside).toBeLessThan(CHECK_IN_QUIETENS_MIN.traffic);
    expect(afterAnswer(inside).stalled).toBe(true);
  });

  it("applies to a break as much as to traffic", () => {
    // A break buys the crew ninety minutes, for a reason in the Labor Code. It
    // does not follow that the office should hear nothing for ninety minutes.
    expect(afterAnswer(35, "on_break").reason).toBe("delay continuing");
  });
});

describe("what the office is told", () => {
  it("names the delay rather than reporting a silence", () => {
    const alert = delayContinuingAlert("ORD-1 (Acme)", "traffic", 35).office;
    expect(alert.title).toMatch(/still stuck in traffic/i);
    expect(alert.body).toMatch(/still going/i);
    // The lead time is the whole point of it.
    expect(alert.body).toMatch(/client should be told or the load moved/i);
  });

  it("says the crew have been asked, so the decision is not on old information", () => {
    const alert = delayContinuingAlert("ORD-1", "waiting", 45).office;
    expect(alert.body).toMatch(/asked whether it has cleared/i);
  });

  it("says instead that a break was left alone, because it was", () => {
    const alert = delayContinuingAlert("ORD-1", "on_break", 35).office;
    expect(alert.body).toMatch(/have not been disturbed/i);
  });
});

describe("what the crew are asked", () => {
  it("asks once at the half hour rather than waiting out the window", () => {
    // The complaint this answers: an hour of hearing nothing back from a truck
    // that told us it was held up is an hour of taking their word for it.
    const crew = delayContinuingAlert("ORD-1", "traffic", 30).crew;
    expect(crew?.title).toMatch(/still stuck in traffic\?/i);
    expect(crew?.body).toMatch(/update your status/i);
    // Not an accusation: they answered, and the question is only whether it holds.
    expect(crew?.body).not.toMatch(/alright|not moved/i);
  });

  it("leaves a meal break alone, whatever the clock says", () => {
    // Article 85: sixty uninterrupted minutes. The office still hears at thirty.
    expect(delayContinuingAlert("ORD-1", "on_break", 35).crew).toBeNull();
    expect(mayAskCrewAgain("on_break")).toBe(false);
    expect(mayAskCrewAgain("traffic")).toBe(true);
  });
});

describe("how often either of them hears it", () => {
  it("is said once per answer, not once per check", () => {
    const answeredAt = minutesAgo(35);
    expect(delayDedupeKey("d1", answeredAt)).toBe(delayDedupeKey("d1", answeredAt));
    // A crew who answer again have made a new statement about where they are,
    // and the half hour runs again from it.
    expect(delayDedupeKey("d1", answeredAt)).not.toBe(delayDedupeKey("d1", minutesAgo(5)));
  });

  it("does not let one audience silence the other", () => {
    const answeredAt = minutesAgo(35);
    expect(delayDedupeKey("d1", answeredAt, "office")).not.toBe(
      delayDedupeKey("d1", answeredAt, "crew"),
    );
  });
});
