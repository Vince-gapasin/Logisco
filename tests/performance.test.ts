import { describe, expect, it } from "vitest";

import {
  assessPerformance,
  conductRate,
  EMPTY_FACTS,
  medianAnswerMinutes,
  MIN_FEEDBACK_RESPONSES,
  MIN_SCORED_WEIGHT,
  MIN_TRIPS_FOR_RATING,
  minutesLate,
  ON_TIME_GRACE_MIN,
  responsivenessRate,
  signalsNotWorthScoring,
  wasOnTime,
  type ComponentKey,
  type PerformanceFacts,
} from "@/app/lib/performance";

/** A spotless month, which every test below spoils in exactly one way. */
const spotless: PerformanceFacts = {
  ...EMPTY_FACTS,
  tripsAssigned: 10,
  tripsAccepted: 10,
  tripsCompleted: 10,
  answerMinutes: Array(10).fill(5),
  stopsCompleted: 10,
  stopsOnTime: 10,
  proofsUploaded: 10,
  feedbackResponses: 10,
  feedbackGoodCondition: 10,
  feedbackCourteous: 10,
};

const componentOf = (facts: PerformanceFacts, key: ComponentKey, companyAverage = 1) =>
  assessPerformance(facts, { companyAverage }).components.find((c) => c.key === key)!;

describe("the one number", () => {
  it("gives a spotless record five", () => {
    expect(assessPerformance(spotless, { companyAverage: 1 }).rating).toBe(5);
  });

  it("puts a record that went wrong in every other way near the bottom", () => {
    const struggling: PerformanceFacts = {
      ...spotless,
      answerMinutes: Array(10).fill(600),
      stopsOnTime: 0,
      proofsUploaded: 0,
      feedbackGoodCondition: 0,
      feedbackCourteous: 0,
    };

    // Finishing what they took on is the only thing left standing, and it is
    // worth 30 per cent, so that is what the rating reflects.
    expect(assessPerformance(struggling, { companyAverage: 0 }).rating).toBe(2.2);
  });

  it("stays between one and five", () => {
    const facts: PerformanceFacts = { ...spotless, tripsCompleted: 5, stopsOnTime: 3, proofsUploaded: 2 };
    const rating = assessPerformance(facts).rating!;
    expect(rating).toBeGreaterThanOrEqual(1);
    expect(rating).toBeLessThanOrEqual(5);
  });

  it("is withheld from somebody too new to judge", () => {
    const newcomer = { ...spotless, tripsAccepted: 4, tripsCompleted: 4 };
    const assessed = assessPerformance(newcomer);

    expect(assessed.rating).toBeNull();
    expect(assessed.withheld).toContain(`4 finished trips, ${MIN_TRIPS_FOR_RATING} needed`);
  });

  it("says so rather than scoring zero when nothing has been recorded", () => {
    const assessed = assessPerformance({ ...EMPTY_FACTS, tripsCompleted: 8 });
    expect(assessed.rating).toBeNull();
    expect(assessed.withheld).toMatch(/nothing recorded/i);
  });
});

describe("what is not the crew's fault", () => {
  it("does not count a breakdown against finishing the trip", () => {
    // Took ten, finished nine, the tenth ended as a foul trip. That is nine
    // out of nine, not nine out of ten.
    const facts = { ...spotless, tripsCompleted: 9, tripsSetAside: 1, foulTrips: 1 };
    const completion = componentOf(facts, "completion");

    expect(completion.rate).toBe(1);
    expect(completion.denominator).toBe(9);
  });

  it("leaves punctuality alone for a delay the office excused", () => {
    const facts = { ...spotless, stopsOnTime: 8, stopsExcused: 2 };
    const punctuality = componentOf(facts, "punctuality");

    expect(punctuality.rate).toBe(1);
    expect(punctuality.denominator).toBe(8);
  });

  it("counts a trip turned down against finishing the work", () => {
    // Ten offered, one refused, nine done. Not a perfect record: the tenth
    // still had to go out with somebody else.
    const facts = { ...spotless, tripsAccepted: 9, tripsCompleted: 9, tripsDeclined: 1 };
    const completion = componentOf(facts, "completion");

    expect(completion.denominator).toBe(10);
    expect(completion.rate).toBeCloseTo(0.9, 10);
  });

  it("never lets a foul trip or a stall alert move the rating", () => {
    const reported = { ...spotless, foulTrips: 9, stallAlerts: 20 };

    expect(assessPerformance(reported, { companyAverage: 1 }).rating).toBe(
      assessPerformance(spotless, { companyAverage: 1 }).rating,
    );
  });
});

describe("a client who does not answer", () => {
  it("is not counted as a bad word", () => {
    const silent = { ...spotless, feedbackResponses: 0, feedbackGoodCondition: 0, feedbackCourteous: 0 };
    const assessed = assessPerformance(silent, { companyAverage: 1 });

    // Everything else was spotless, so the rating must not be dented by the
    // silence.
    expect(assessed.rating).toBe(5);
    expect(assessed.components.find((c) => c.key === "conduct")!.scored).toBe(false);
  });

  it("is reported rather than scored while the answers are too few", () => {
    const thin = { ...spotless, feedbackResponses: 4, feedbackGoodCondition: 4, feedbackCourteous: 3 };
    const conduct = componentOf(thin, "conduct");

    expect(conduct.scored).toBe(false);
    expect(conduct.why).toContain(`4 client answers`);
    // The counts are still there for a screen to show.
    expect(conduct.numerator).toBe(7);
    expect(conduct.denominator).toBe(8);
  });

  it("hands the weight to what was measured, not to a guess", () => {
    const silent = { ...spotless, feedbackResponses: 0 };
    const assessed = assessPerformance(silent);
    const scored = assessed.components.filter((c) => c.scored);

    expect(scored.reduce((total, c) => total + c.weight, 0)).toBeCloseTo(1, 10);
    expect(assessed.components.find((c) => c.key === "conduct")!.weight).toBe(0);
  });
});

describe("one delighted client is not a record", () => {
  it("pulls a thin score towards the company average", () => {
    const perfectButThin = {
      feedbackResponses: MIN_FEEDBACK_RESPONSES,
      feedbackGoodCondition: MIN_FEEDBACK_RESPONSES,
      feedbackCourteous: MIN_FEEDBACK_RESPONSES,
    };

    const rate = conductRate(perfectButThin, 0.9)!;
    expect(rate).toBeLessThan(1);
    expect(rate).toBeGreaterThan(0.9);
  });

  it("lets a long record speak more for itself", () => {
    const thin = conductRate({ feedbackResponses: 5, feedbackGoodCondition: 5, feedbackCourteous: 5 }, 0.9)!;
    const long = conductRate({ feedbackResponses: 50, feedbackGoodCondition: 50, feedbackCourteous: 50 }, 0.9)!;

    expect(long).toBeGreaterThan(thin);
  });

  it("works the same way upwards, so a thin bad score is not a verdict either", () => {
    const rate = conductRate(
      { feedbackResponses: 5, feedbackGoodCondition: 0, feedbackCourteous: 0 },
      0.9,
    )!;
    expect(rate).toBeGreaterThan(0);
  });
});

describe("how promptly assignments were answered", () => {
  it("counts a quick answer in full and a very slow one for nothing", () => {
    expect(responsivenessRate([5])).toBe(1);
    expect(responsivenessRate([15])).toBe(1);
    expect(responsivenessRate([120])).toBe(0);
    expect(responsivenessRate([600])).toBe(0);
  });

  it("slides between the two", () => {
    expect(responsivenessRate([67.5])).toBeCloseTo(0.5, 10);
  });

  it("is not undone by one trip answered the next morning", () => {
    // The median, not the average - otherwise a single night's sleep wipes out
    // a month of answering within minutes.
    expect(responsivenessRate([5, 5, 5, 5, 1000])).toBe(1);
  });

  it("has nothing to say when nothing was answered", () => {
    expect(responsivenessRate([])).toBeNull();
    expect(medianAnswerMinutes([])).toBeNull();
  });

  it("ignores nonsense rather than letting it through", () => {
    expect(medianAnswerMinutes([-5, Number.NaN, 10, Number.POSITIVE_INFINITY])).toBe(10);
  });
});

describe("a habit the company has not adopted", () => {
  it("is not held against an individual", () => {
    // Proof of delivery sits on a fraction of stops company-wide. Scoring it
    // would rank people by when the feature shipped.
    const noProof = { ...spotless, proofsUploaded: 0, feedbackResponses: 0 };

    const asIs = assessPerformance(noProof).rating!;
    const fairly = assessPerformance(noProof, { notComparable: ["evidence"] }).rating!;

    expect(asIs).toBeLessThan(fairly);
    expect(fairly).toBe(5);
  });

  it("is still shown, with its counts and the reason it does not count", () => {
    const component = assessPerformance(spotless, { notComparable: ["evidence"] }).components.find(
      (c) => c.key === "evidence",
    )!;

    expect(component.scored).toBe(false);
    expect(component.weight).toBe(0);
    expect(component.rate).toBe(1);
    expect(component.why).toMatch(/not record this consistently enough/i);
  });

  it("is spotted from the company's own totals", () => {
    // The real figures at the time of writing: proof on 34 of 1,746 stops, and
    // no assignment timestamps at all on the older trips.
    expect(
      signalsNotWorthScoring({
        stopsCompleted: 1746,
        proofsUploaded: 34,
        tripsAssigned: 1748,
        answered: 0,
        stopsJudged: 1746,
        stopsOnTime: 6,
      }),
    ).toEqual(["evidence", "responsiveness", "punctuality"]);
  });

  it("stops excusing a signal once the company uses it", () => {
    expect(
      signalsNotWorthScoring({
        stopsCompleted: 1000,
        proofsUploaded: 900,
        tripsAssigned: 1000,
        answered: 800,
        stopsJudged: 1000,
        stopsOnTime: 850,
      }),
    ).toEqual([]);
  });
});

describe("the workings are visible", () => {
  it("shows the counts behind every percentage", () => {
    for (const component of assessPerformance(spotless).components) {
      expect(component.numerator).toBeTypeOf("number");
      expect(component.denominator).toBeTypeOf("number");
      expect(component.label).toBeTruthy();
      expect(component.basis).toBeTruthy();
    }
  });

  it("has the scored weights add up to the whole", () => {
    const assessed = assessPerformance(spotless, { notComparable: ["evidence"] });
    const total = assessed.components.reduce((sum, c) => sum + c.weight, 0);

    expect(total).toBeCloseTo(1, 10);
  });

  it("does not let bad data push a rate above the whole", () => {
    // More proofs than stops should not read as 130%.
    const facts = { ...spotless, proofsUploaded: 13, stopsCompleted: 10 };
    expect(componentOf(facts, "evidence").rate).toBe(1);
  });
});

describe("whether a stop made its slot", () => {
  // Manila is UTC+8, and every one of these is a real delivery time compared
  // against a time of day the booking asked for.
  it("counts a stop delivered inside the slot as on time", () => {
    expect(wasOnTime("14:30:00", "2026-09-26T06:20:00.000Z")).toBe(true);
    expect(minutesLate("14:30:00", "2026-09-26T06:20:00.000Z")).toBe(-10);
  });

  it("allows the grace the office already promises clients", () => {
    expect(minutesLate("08:00:00", "2026-09-26T00:29:00.000Z")).toBe(29);
    expect(wasOnTime("08:00:00", "2026-09-26T00:29:00.000Z")).toBe(true);

    expect(minutesLate("08:00:00", "2026-09-26T00:31:00.000Z")).toBe(31);
    expect(wasOnTime("08:00:00", "2026-09-26T00:31:00.000Z")).toBe(false);
  });

  it("reads the clock in Manila, not on the server", () => {
    // 8 AM in Manila is midnight UTC. Judged in UTC this stop is eight hours
    // early, every single time, which is how a whole fleet comes to look
    // faultless on punctuality.
    expect(wasOnTime("08:00:00", "2026-09-26T00:00:00.000Z")).toBe(true);
    expect(wasOnTime("08:00:00", "2026-09-26T08:00:00.000Z")).toBe(false);
    expect(minutesLate("08:00:00", "2026-09-26T08:00:00.000Z")).toBe(480);
  });

  it("does not read a delivery made after midnight as a day early", () => {
    // Asked for 11 PM, delivered 12:30 AM: ninety minutes late.
    expect(minutesLate("23:00:00", "2026-09-26T16:30:00.000Z")).toBe(90);
    expect(wasOnTime("23:00:00", "2026-09-26T16:30:00.000Z")).toBe(false);
  });

  it("says nothing rather than guessing when either end is missing", () => {
    expect(wasOnTime(null, "2026-09-26T06:20:00.000Z")).toBeNull();
    expect(wasOnTime("14:30:00", null)).toBeNull();
    expect(wasOnTime("not a time", "2026-09-26T06:20:00.000Z")).toBeNull();
    expect(wasOnTime("14:30:00", "not a date")).toBeNull();
  });

  it("has a grace anyone can read off the module", () => {
    expect(ON_TIME_GRACE_MIN).toBe(30);
  });
});

describe("a yardstick that is not real", () => {
  it("is not used to rank anybody", () => {
    // Every historical stop here carries an expectedTime set two hours before
    // its own completion, so judged against it the whole fleet is late on
    // everything. That distinguishes nobody, and pretending otherwise would put
    // every driver at the floor of a figure worth 15 per cent.
    const flagged = signalsNotWorthScoring({
      stopsCompleted: 1746,
      proofsUploaded: 1700,
      tripsAssigned: 1748,
      answered: 1700,
      stopsJudged: 1746,
      stopsOnTime: 6,
    });

    expect(flagged).toEqual(["punctuality"]);
  });

  it("comes back into use once real slots are being met", () => {
    const flagged = signalsNotWorthScoring({
      stopsCompleted: 1000,
      proofsUploaded: 900,
      tripsAssigned: 1000,
      answered: 900,
      stopsJudged: 1000,
      stopsOnTime: 700,
    });

    expect(flagged).toEqual([]);
  });
});

describe("when too little is measured to make one number", () => {
  it("withholds the rating rather than dressing one figure as five", () => {
    // Today's real state: proof, answer times and slots are all unusable, which
    // leaves finishing trips carrying 30 per cent of a rating on its own.
    const assessed = assessPerformance(spotless, {
      notComparable: ["evidence", "responsiveness", "punctuality"],
      companyAverage: 1,
    });

    expect(assessed.rating).toBeNull();
    expect(assessed.withheld).toMatch(/too little is measured/i);
    // It names what did count, so the screen is not a shrug.
    expect(assessed.withheld).toContain("Trips taken and finished");
  });

  it("still shows every figure it does know", () => {
    const assessed = assessPerformance(spotless, {
      notComparable: ["evidence", "responsiveness", "punctuality"],
    });

    expect(assessed.components).toHaveLength(5);
    expect(assessed.components.filter((c) => c.rate !== null)).toHaveLength(5);
  });

  it("gives a number once half the rating rests on something", () => {
    // Finishing trips and proof together are half of it, which is enough.
    const assessed = assessPerformance(spotless, {
      notComparable: ["responsiveness", "punctuality"],
      companyAverage: 1,
    });

    expect(assessed.rating).toBe(5);
  });

  it("has a threshold anyone can read off the module", () => {
    expect(MIN_SCORED_WEIGHT).toBe(0.5);
  });
});
