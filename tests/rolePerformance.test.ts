import { describe, expect, it } from "vitest";

import {
  assessMechanic,
  assessOffice,
  EMPTY_MECHANIC_FACTS,
  EMPTY_OFFICE_FACTS,
  timeRate,
} from "@/app/lib/rolePerformance";

// The ratings for the people who are not on the trucks follow the crew's rules:
// only what they control, nothing invented, a thin record reported and not
// rated.

describe("a time-based measure", () => {
  it("counts in full when quick, for nothing when slow, and in between on a line", () => {
    expect(timeRate([10, 20, 30], 30, 90)).toBe(1);
    expect(timeRate([100, 120], 30, 90)).toBe(0);
    expect(timeRate([60], 30, 90)).toBeCloseTo(0.5);
  });

  it("is nothing, not zero, when there is nothing", () => {
    expect(timeRate([], 30, 90)).toBeNull();
  });

  it("goes by the median, so one bad day does not sink it", () => {
    expect(timeRate([10, 12, 15, 2000], 30, 90)).toBe(1);
  });
});

describe("a mechanic", () => {
  const steady = {
    ...EMPTY_MECHANIC_FACTS,
    repairsFinished: 12,
    repairsObserved: 10,
    repairsHeld: 9,
    logsWritten: 20,
    logsDocumented: 16,
    pickUpMinutes: [30, 45, 60, 90, 100],
    roadsideMinutes: [60, 70, 80, 85, 90],
    roadsideJobs: 5,
    roadsideFixed: 3,
    repairDays: [1, 2, 4],
  };

  it("is rated on repairs that held, documentation, pick-up and roadside response", () => {
    const result = assessMechanic(steady);
    expect(result.rating).not.toBeNull();
    expect(result.measures.map((m) => m.key)).toEqual(["repairsHeld", "documentation", "pickUp", "roadside"]);
    expect(result.measures.every((m) => m.scored)).toBe(true);
    // 0.35*0.9 + 0.25*0.8 + 0.2*1 + 0.2*1 = 0.915 -> 1 + 0.915*4 = 4.66
    expect(result.rating).toBeCloseTo(4.7, 1);
  });

  it("does not score repair time or the fix rate - it shows them", () => {
    const result = assessMechanic(steady);
    expect(result.measures.some((m) => /repair time|fixed/i.test(m.label))).toBe(false);
    expect(result.shown.map((fact) => fact.label)).toEqual(
      expect.arrayContaining(["Typical repair time", "Fixed on site"]),
    );
  });

  it("is too new to rate with fewer than five jobs", () => {
    const result = assessMechanic({ ...EMPTY_MECHANIC_FACTS, repairsFinished: 3, repairsObserved: 3, repairsHeld: 3 });
    expect(result.rating).toBeNull();
    expect(result.withheld).toMatch(/too new/i);
  });

  it("leaves out a measure with too little behind it, and moves its weight to the rest", () => {
    const result = assessMechanic({ ...steady, roadsideMinutes: [60], roadsideJobs: 1 });
    const roadside = result.measures.find((m) => m.key === "roadside")!;
    expect(roadside.scored).toBe(false);
    expect(roadside.why).toMatch(/only 1/i);
    const total = result.measures.reduce((sum, m) => sum + m.weight, 0);
    expect(total).toBeCloseTo(1);
  });
});

describe("the office", () => {
  const busy = {
    ...EMPTY_OFFICE_FACTS,
    assignments: 20,
    assignmentsJudged: 18,
    assignmentsOnNotice: 15,
    declineRecoveryMinutes: [20, 25, 30, 40, 60],
    foulTripMinutes: [5, 10, 12, 14, 20],
    bookingsCreated: 25,
    overrides: 2,
  };

  it("rates a coordinator on assignment notice, declines and breakdowns", () => {
    const result = assessOffice(busy, { includeStaff: false });
    expect(result.rating).not.toBeNull();
    expect(result.measures.map((m) => m.key)).toEqual(["assignmentNotice", "declineRecovery", "foulTripRecovery"]);
  });

  it("adds new staff's logins for an admin, weighed against the rest", () => {
    const result = assessOffice(
      { ...busy, employeesAdded: 6, loginsJudged: 6, loginsOnTime: 3 },
      { includeStaff: true },
    );
    const login = result.measures.find((m) => m.key === "loginSetup")!;
    expect(login.scored).toBe(true);
    expect(login.weight).toBeCloseTo(0.2 / 1.2);
    // Slow with logins pulls an otherwise good record down.
    const without = assessOffice(busy, { includeStaff: false });
    expect(result.rating!).toBeLessThan(without.rating!);
  });

  it("does not score overrides", () => {
    const result = assessOffice(busy, { includeStaff: false });
    expect(result.measures.some((m) => /override/i.test(m.label))).toBe(false);
    expect(result.shown.find((fact) => fact.label === "Overrides used")?.value).toBe("2");
  });

  it("is withheld with too little handled", () => {
    const result = assessOffice({ ...EMPTY_OFFICE_FACTS, assignments: 4, assignmentsJudged: 4, assignmentsOnNotice: 4 }, { includeStaff: false });
    expect(result.rating).toBeNull();
    expect(result.withheld).toMatch(/too little handled/i);
  });

  it("will not rate on one measure alone", () => {
    const result = assessOffice(
      { ...EMPTY_OFFICE_FACTS, assignments: 30, assignmentsJudged: 30, assignmentsOnNotice: 30 },
      { includeStaff: false },
    );
    expect(result.rating).toBeNull();
    expect(result.withheld).toMatch(/too little is measured/i);
  });
});
