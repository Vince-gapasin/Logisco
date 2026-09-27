import { describe, expect, it } from "vitest";

import {
  assessPerformance,
  conductRate,
  expectedAt,
  EMPTY_FACTS,
  medianAnswerMinutes,
  MIN_FEEDBACK_RESPONSES,
  MIN_OBSERVATIONS,
  MIN_SCORED_COMPONENTS,
  MIN_SCORED_WEIGHT,
  MIN_TRIPS_FOR_RATING,
  minutesLate,
  ON_TIME_GRACE_MIN,
  responsivenessRate,
  signalsNotWorthScoring,
  wasOnTime,
  WEIGHTS,
  type ComponentKey,
  type PerformanceFacts,
} from "@/app/lib/performance";

/** A spotless month, which every test below spoils in exactly one way. */
const spotless: PerformanceFacts = {
  ...EMPTY_FACTS,
  tripsAssigned: 12,
  tripsHandedOver: 12,
  tripsAccepted: 12,
  tripsCompleted: 12,
  answerMinutes: Array(12).fill(5),
  stopsCompleted: 12,
  stopsJudged: 12,
  stopsOnTime: 12,
  proofsUploaded: 12,
  feedbackResponses: 12,
  feedbackGoodCondition: 12,
  feedbackCourteous: 12,
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
      answerMinutes: Array(12).fill(600),
      stopsOnTime: 0,
      proofsUploaded: 0,
      feedbackGoodCondition: 0,
      feedbackCourteous: 0,
    };

    // Only finishing what they took on is left standing, and it is worth 20 per
    // cent, so that is what the rating reflects.
    expect(assessPerformance(struggling, { companyAverage: 0 }).rating).toBe(1.8);
  });

  it("stays between one and five", () => {
    const facts: PerformanceFacts = { ...spotless, tripsCompleted: 6, stopsOnTime: 4, proofsUploaded: 3 };
    const rating = assessPerformance(facts).rating!;
    expect(rating).toBeGreaterThanOrEqual(1);
    expect(rating).toBeLessThanOrEqual(5);
  });

  it("is withheld from somebody too new to judge", () => {
    const newcomer = { ...EMPTY_FACTS, tripsAssigned: 4, tripsAccepted: 4, tripsCompleted: 4 };
    const assessed = assessPerformance(newcomer);

    expect(assessed.rating).toBeNull();
    expect(assessed.withheld).toContain(`4 finished trips, ${MIN_TRIPS_FOR_RATING} needed`);
  });

  it("does not call somebody new when they were offered plenty and finished little", () => {
    // Forty trips offered, thirty-eight turned down, two finished. That is not
    // inexperience, and it used to be reported in the same words as a newcomer.
    const refuser = { ...EMPTY_FACTS, tripsAssigned: 40, tripsAccepted: 2, tripsDeclined: 38, tripsCompleted: 2 };
    const assessed = assessPerformance(refuser);

    expect(assessed.rating).toBeNull();
    expect(assessed.withheld).toMatch(/not too new to judge/i);
    expect(assessed.withheld).toContain("40 offered");
  });

  it("says so rather than scoring zero when nothing has been recorded", () => {
    const assessed = assessPerformance({ ...EMPTY_FACTS, tripsCompleted: 8 });
    expect(assessed.rating).toBeNull();
    expect(assessed.withheld).toMatch(/nothing recorded/i);
  });
});

describe("the gate can actually open", () => {
  it("gives a rating once client feedback and completion are both there", () => {
    // This is the regression that matters. The weight floor used to be 0.5,
    // which no achievable combination could reach: with proof, answer times and
    // slots all ungated the most that remained was 0.30 + 0.15 = 0.45, so five
    // hundred perfect client answers still produced no number at all.
    const assessed = assessPerformance(spotless, {
      notComparable: ["evidence", "responsiveness", "punctuality"],
      companyAverage: 1,
    });

    expect(assessed.rating).toBe(5);
    expect(assessed.coverage).toBeCloseTo(WEIGHTS.conduct + WEIGHTS.completion, 10);
    expect(assessed.coverage).toBeGreaterThanOrEqual(MIN_SCORED_WEIGHT);
  });

  it("still refuses to call one measure a composite", () => {
    const onlyCompletion = { ...spotless, feedbackResponses: 0, feedbackGoodCondition: 0, feedbackCourteous: 0 };
    const assessed = assessPerformance(onlyCompletion, {
      notComparable: ["evidence", "responsiveness", "punctuality"],
    });

    expect(assessed.rating).toBeNull();
    expect(assessed.withheld).toMatch(/too little is measured/i);
  });

  it("refuses two measures that are not enough of the whole between them", () => {
    // Proof and answer times together are 30 per cent. Two components, but not
    // enough of the rating to call the result a rating.
    const assessed = assessPerformance(spotless, {
      notComparable: ["conduct", "completion", "punctuality"],
    });

    expect(assessed.components.filter((c) => c.scored)).toHaveLength(MIN_SCORED_COMPONENTS);
    expect(assessed.rating).toBeNull();
  });

  it("has thresholds anyone can read off the module", () => {
    expect(MIN_SCORED_WEIGHT).toBe(0.4);
    expect(MIN_SCORED_COMPONENTS).toBe(2);
    // The weights still add up to a whole rating.
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("a thin record is not a good one", () => {
  it("does not score a component with too little behind it", () => {
    const barely = { ...spotless, stopsCompleted: MIN_OBSERVATIONS - 1, proofsUploaded: MIN_OBSERVATIONS - 1 };
    const evidence = componentOf(barely, "evidence");

    // The rate is a perfect 100%, and it still does not count.
    expect(evidence.rate).toBe(1);
    expect(evidence.scored).toBe(false);
    expect(evidence.why).toContain(`Only ${MIN_OBSERVATIONS - 1} to go on`);
  });

  it("counts answer times against the answers, not the assignments", () => {
    // Five fast answers out of fifty trips is five observations, not fifty. This
    // used to score a flawless 100% on a fifth of the rating.
    const thin = { ...spotless, tripsHandedOver: 50, answerMinutes: [5, 5, 5, 5, 5] };
    const responsiveness = componentOf(thin, "responsiveness");

    expect(responsiveness.rate).toBe(1);
    expect(responsiveness.scored).toBe(false);
    expect(responsiveness.why).toContain("Only 5 to go on");
  });

  it("counts it once there is enough of it", () => {
    const enough = { ...spotless, tripsHandedOver: 50, answerMinutes: Array(MIN_OBSERVATIONS).fill(5) };
    expect(componentOf(enough, "responsiveness").scored).toBe(true);
  });
});

describe("what is not the crew's fault", () => {
  it("does not count a breakdown against finishing the trip", () => {
    const facts = { ...spotless, tripsCompleted: 11, tripsSetAside: 1, foulTrips: 1 };
    const completion = componentOf(facts, "completion");

    expect(completion.rate).toBe(1);
    expect(completion.denominator).toBe(11);
  });

  it("counts a trip turned down against finishing the work", () => {
    const facts = { ...spotless, tripsAccepted: 11, tripsCompleted: 11, tripsDeclined: 1 };
    const completion = componentOf(facts, "completion");

    expect(completion.denominator).toBe(12);
    expect(completion.rate).toBeCloseTo(11 / 12, 10);
  });

  it("leaves punctuality alone for a delay the office excused", () => {
    const facts = { ...spotless, stopsOnTime: 10, stopsExcused: 2 };
    const punctuality = componentOf(facts, "punctuality");

    expect(punctuality.rate).toBe(1);
    expect(punctuality.denominator).toBe(10);
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

    expect(assessed.rating).toBe(5);
    expect(assessed.components.find((c) => c.key === "conduct")!.scored).toBe(false);
  });

  it("is reported rather than scored while the answers are too few", () => {
    const thin = { ...spotless, feedbackResponses: 4, feedbackGoodCondition: 4, feedbackCourteous: 3 };
    const conduct = componentOf(thin, "conduct");

    expect(conduct.scored).toBe(false);
    expect(conduct.why).toContain("4 client answers");
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
    const rate = conductRate({ feedbackResponses: 5, feedbackGoodCondition: 0, feedbackCourteous: 0 }, 0.9)!;
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
    expect(responsivenessRate([5, 5, 5, 5, 1000])).toBe(1);
  });

  it("has nothing to say when nothing was answered", () => {
    expect(responsivenessRate([])).toBeNull();
    expect(medianAnswerMinutes([])).toBeNull();
  });

  it("ignores nonsense rather than letting it through", () => {
    expect(medianAnswerMinutes([-5, Number.NaN, 10, Number.POSITIVE_INFINITY])).toBe(10);
  });

  it("explains its percentage, because the counts cannot", () => {
    // "5 of 50" is coverage, not the rate. The median is what the rate is made
    // of, so it is said out loud.
    const detail = componentOf(spotless, "responsiveness").detail!;
    expect(detail).toMatch(/median 5 min/i);
    expect(detail).toMatch(/15 min or less/i);
  });
});

describe("when a stop was actually due", () => {
  it("combines the booking's date with the asked-for time", () => {
    // 2 PM in Manila is 6 AM UTC.
    expect(expectedAt("2026-09-26", "14:00:00")).toBe("2026-09-26T14:00:00+08:00");
    expect(Date.parse(expectedAt("2026-09-26", "14:00")!)).toBe(Date.parse("2026-09-26T06:00:00.000Z"));
  });

  it("has no answer without a date, and says so instead of inventing one", () => {
    // The version this replaces took the date from the completion timestamp,
    // which cannot ever report a stop as a day late: the day came from the day
    // it finished.
    expect(expectedAt(null, "14:00:00")).toBeNull();
    expect(expectedAt("", "14:00:00")).toBeNull();
    expect(expectedAt("26/09/2026", "14:00:00")).toBeNull();
    expect(expectedAt("2026-09-26", null)).toBeNull();
    expect(expectedAt("2026-09-26", "not a time")).toBeNull();
    expect(expectedAt("2026-09-26", "25:00")).toBeNull();
  });
});

describe("whether a stop made its slot", () => {
  const due = expectedAt("2026-09-26", "08:00:00")!;

  it("counts a stop delivered inside the slot as on time", () => {
    expect(wasOnTime(due, "2026-09-25T23:50:00.000Z")).toBe(true);
    expect(minutesLate(due, "2026-09-25T23:50:00.000Z")).toBe(-10);
  });

  it("allows the grace the office already promises clients", () => {
    expect(minutesLate(due, "2026-09-26T00:29:00.000Z")).toBe(29);
    expect(wasOnTime(due, "2026-09-26T00:29:00.000Z")).toBe(true);

    expect(minutesLate(due, "2026-09-26T00:31:00.000Z")).toBe(31);
    expect(wasOnTime(due, "2026-09-26T00:31:00.000Z")).toBe(false);
  });

  it("reads a very late stop as very late, not as early", () => {
    // The old wrap-around arithmetic turned anything beyond twelve hours late
    // into a stop that was hours early, and therefore on time.
    expect(minutesLate(due, "2026-09-26T13:00:00.000Z")).toBe(780);
    expect(wasOnTime(due, "2026-09-26T13:00:00.000Z")).toBe(false);

    expect(minutesLate(due, "2026-09-27T00:00:00.000Z")).toBe(1440);
    expect(wasOnTime(due, "2026-09-27T00:00:00.000Z")).toBe(false);
  });

  it("reads a delivery after midnight against an evening slot correctly", () => {
    const evening = expectedAt("2026-09-26", "23:00:00")!;
    expect(minutesLate(evening, "2026-09-26T16:30:00.000Z")).toBe(90);
  });

  it("says nothing rather than guessing when either end is missing", () => {
    expect(wasOnTime(null, "2026-09-26T06:20:00.000Z")).toBeNull();
    expect(wasOnTime(due, null)).toBeNull();
    expect(wasOnTime("not a date", "2026-09-26T06:20:00.000Z")).toBeNull();
    expect(wasOnTime(due, "not a date")).toBeNull();
  });

  it("has a grace anyone can read off the module", () => {
    expect(ON_TIME_GRACE_MIN).toBe(30);
  });
});

describe("a habit the company has not adopted", () => {
  it("is not held against an individual", () => {
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

  it("is spotted from the company's own recent totals", () => {
    // The real figures: proof on 10 of 1,746 stops, six on time, and answer
    // times on almost nothing.
    expect(
      signalsNotWorthScoring({
        stopsCompleted: 1746,
        proofsUploaded: 10,
        tripsHandedOver: 27,
        answered: 19,
        stopsJudged: 1746,
        stopsOnTime: 6,
      }),
    ).toEqual(["evidence", "responsiveness", "punctuality"]);
  });

  it("will not judge the company's habits from a handful of rows", () => {
    // Three stops with two proofs is 67%, which used to switch proof scoring on
    // for everybody. A habit needs more than a handful to be a habit.
    expect(
      signalsNotWorthScoring({
        stopsCompleted: 3,
        proofsUploaded: 2,
        tripsHandedOver: 3,
        answered: 3,
        stopsJudged: 3,
        stopsOnTime: 3,
      }),
    ).toEqual(["evidence", "responsiveness", "punctuality"]);
  });

  it("stops excusing a signal once the company uses it", () => {
    expect(
      signalsNotWorthScoring({
        stopsCompleted: 1000,
        proofsUploaded: 900,
        tripsHandedOver: 1000,
        answered: 800,
        stopsJudged: 1000,
        stopsOnTime: 700,
      }),
    ).toEqual([]);
  });

  it("measures answer-time coverage against trips that were actually handed over", () => {
    // 19 answers against 2,073 dispatches reads as 0.9%; against the 27 trips
    // whose hand-over was recorded it is 70%. The second is the question worth
    // asking - it just needs a bigger sample before it decides anything.
    expect(
      signalsNotWorthScoring({
        stopsCompleted: 1000,
        proofsUploaded: 900,
        tripsHandedOver: 100,
        answered: 70,
        stopsJudged: 1000,
        stopsOnTime: 700,
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

  it("reports how much of the rating rests on something measured", () => {
    expect(assessPerformance(spotless).coverage).toBeCloseTo(1, 10);
    expect(assessPerformance(spotless, { notComparable: ["evidence"] }).coverage).toBeCloseTo(0.85, 10);
  });

  it("does not let bad data push a rate above the whole", () => {
    const facts = { ...spotless, proofsUploaded: 15, stopsCompleted: 12 };
    expect(componentOf(facts, "evidence").rate).toBe(1);
  });

  it("says how many of their stops could not be judged at all", () => {
    const facts = { ...spotless, stopsCompleted: 12, stopsJudged: 4 };
    expect(componentOf(facts, "punctuality").detail).toContain("8 of their stops had no scheduled date");
  });
});
