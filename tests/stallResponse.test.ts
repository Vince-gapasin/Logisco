import { describe, expect, it } from "vitest";

import {
  assessStall,
  OFFICE_RESPONSE_QUIETENS_MIN,
  stallAlert,
} from "@/app/lib/stallRules";

// The office answering a stall alert.
//
// The forty-five minute rung told them to call the driver and then had no idea
// whether anybody had - so it escalated at the person who had already picked up
// the phone, and the two-hour rung repeated it to somebody who had solved it an
// hour earlier. These are the rules about what an answer buys and what it does
// not.

const NOW = new Date("2026-09-29T12:00:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

const quiet = (input: {
  silentFor: number;
  respondedMinutesAgo?: number;
  checkIn?: { state: "traffic" | "need_help"; at: string } | null;
}) =>
  assessStall({
    lastReportedAt: minutesAgo(input.silentFor),
    officeRespondedAt:
      input.respondedMinutesAgo === undefined ? null : minutesAgo(input.respondedMinutesAgo),
    checkIn: input.checkIn ?? null,
    status: "In Transit",
    metresToNearestStop: 5_000,
    now: NOW,
  });

describe("what an answer buys", () => {
  it("quietens the ladder, so the office is not chased about what they picked up", () => {
    const verdict = quiet({ silentFor: 50, respondedMinutesAgo: 5 });
    expect(verdict.stalled).toBe(false);
    expect(verdict.reason).toBe("office answered");
  });

  it("buys an hour and no more", () => {
    expect(quiet({ silentFor: 200, respondedMinutesAgo: OFFICE_RESPONSE_QUIETENS_MIN - 1 }).stalled).toBe(false);
    // Still silent an hour after somebody said they had handled it: they had not.
    expect(quiet({ silentFor: 200, respondedMinutesAgo: OFFICE_RESPONSE_QUIETENS_MIN }).stalled).toBe(true);
  });

  it("still reports the real length of the silence, not the time since the answer", () => {
    expect(quiet({ silentFor: 50, respondedMinutesAgo: 5 }).silentFor).toBe(50);
  });
});

describe("what an answer does not buy", () => {
  it("cannot be given in advance", () => {
    // Answered before the truck went quiet: that was about an earlier silence,
    // and letting it speak for this one would pre-authorise the rest of the day.
    const verdict = quiet({ silentFor: 50, respondedMinutesAgo: 90 });
    expect(verdict.stalled).toBe(true);
    expect(verdict.threshold).toBe(45);
  });

  it("does not silence a crew calling for help", () => {
    // What somebody on the truck says outranks what the office assumed.
    const verdict = quiet({
      silentFor: 50,
      respondedMinutesAgo: 1,
      checkIn: { state: "need_help", at: minutesAgo(2) },
    });
    expect(verdict.stalled).toBe(true);
    expect(verdict.reason).toBe("crew asked for help");
  });
});

describe("what the alert says about being answered", () => {
  it("names the decision at forty-five, rather than only advising a call", () => {
    const alert = stallAlert(45, "ORD-1", 45, "stopped");
    expect(alert.office.body).toMatch(/mark it handled/i);
    expect(alert.office.body).toMatch(/keep coming back/i);
  });

  it("leads with nobody having answered, once it is past that rung", () => {
    const unanswered = stallAlert(120, "ORD-1", 120, "stopped", { answered: false });
    expect(unanswered.office.body).toMatch(/nobody in the office has answered/i);

    const answered = stallAlert(120, "ORD-1", 120, "stopped", { answered: true });
    expect(answered.office.body).not.toMatch(/nobody in the office/i);
  });

  it("says it at the top rung too, where it matters most", () => {
    const alert = stallAlert(360, "ORD-1", 360, "stopped", { answered: false });
    expect(alert.office.body).toMatch(/at any point/i);
  });
});
