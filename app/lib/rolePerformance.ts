// How the work of the people who are not on the trucks is rated: mechanics, and
// the office - coordinators and admins.
//
// The same rules as the crew's rating in performance.ts, applied to different
// work. Only what a person controls is scored; what happens to them is shown and
// never counted. Nothing is invented: a measure with nothing behind it is left
// out and its weight moves to the rest. A thin record is reported, not rated.
// And each role is only ever compared with its own - a coordinator's speed
// answering a breakdown means nothing next to a mechanic's repairs.
//
// Kept away from the database so the arithmetic can be checked on its own.

export interface RoleMeasure {
  key: string;
  /** A share of things done right, or a typical time taken. */
  kind: "share" | "time";
  label: string;
  /** What it is out of, in plain words. */
  basis: string;
  /** 0 to 1, or null when there is nothing to judge it on. */
  rate: number | null;
  scored: boolean;
  /** Its share of the rating, once the unscored measures have given theirs up. */
  weight: number;
  numerator: number;
  denominator: number;
  detail: string | null;
  /** Why it did not count, when it did not. */
  why: string | null;
}

/** Recorded and shown beside the rating; never part of it. */
export interface ShownFact {
  label: string;
  value: string;
  note?: string;
}

export interface RoleAssessment {
  /** Which kind of work this describes. */
  kind: "mechanic" | "office";
  measures: RoleMeasure[];
  /** 1 to 5, or null when withheld. */
  rating: number | null;
  ratingRange: { low: number; high: number } | null;
  withheld: string | null;
  /** Share of the intended measures the rating rests on. */
  coverage: number;
  shown: ShownFact[];
  /** How much work the record holds, said in the role's own terms. */
  evidence: string;
}

// ------------------------------------------------------------------ rules

/** Below this, a measure is reported and not counted. */
export const MIN_ROLE_OBSERVATIONS = 5;
/** A rating needs at least this many measures, carrying this much weight. */
export const MIN_ROLE_MEASURES = 2;
export const MIN_ROLE_WEIGHT = 0.4;

/** A repair that holds this long is a repair that held. */
export const REPAIR_HOLD_DAYS = 14;
/** Starting on a grounded truck: this quick counts in full, this slow for nothing. */
export const PICKUP_FULL_MIN = 120;
export const PICKUP_NONE_MIN = 24 * 60;
/** Sent to a roadside breakdown, until the verdict from the site. */
export const ROADSIDE_FULL_MIN = 90;
export const ROADSIDE_NONE_MIN = 8 * 60;
/** A rating needs this many repairs or roadside verdicts behind it. */
export const MIN_MECHANIC_JOBS = 5;

/** An assignment made this far ahead of the delivery is made in good time. */
export const NOTICE_HOURS = 24;
/** ...or this soon after the booking came in, when it came in late. */
export const PROMPT_HOURS = 2;
/** A crew declined: until the booking has another. */
export const DECLINE_FULL_MIN = 30;
export const DECLINE_NONE_MIN = 6 * 60;
/** A breakdown reported: until the office does something about it. */
export const FOUL_TRIP_FULL_MIN = 15;
export const FOUL_TRIP_NONE_MIN = 3 * 60;
/** A new employee added: until their login is sent. */
export const LOGIN_SETUP_HOURS = 48;
/** A rating needs this much handled behind it. */
export const MIN_OFFICE_ITEMS = 10;

export const MECHANIC_WEIGHTS = {
  repairsHeld: 0.35,
  documentation: 0.25,
  pickUp: 0.2,
  roadside: 0.2,
} as const;

export const OFFICE_WEIGHTS = {
  assignmentNotice: 0.35,
  declineRecovery: 0.3,
  foulTripRecovery: 0.35,
  // Admins only. Weighed against the rest rather than in place of any of them.
  loginSetup: 0.2,
} as const;

const percentOf = (share: number) => `${Math.round(share * 100)}%`;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export function median(values: number[]): number | null {
  const usable = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 === 0 ? (usable[middle - 1] + usable[middle]) / 2 : usable[middle];
}

/** Full marks at or under `full` minutes, none at or over `none`, a straight line between. */
export function timeRate(minutes: number[], full: number, none: number): number | null {
  const middle = median(minutes);
  if (middle === null) return null;
  if (middle <= full) return 1;
  if (middle >= none) return 0;
  return 1 - (middle - full) / (none - full);
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return hours < 48 ? `${Math.round(hours * 10) / 10} h` : `${Math.round(hours / 24)} days`;
}

// Wilson bounds, as the crew's rating uses: how far the true share could be
// from the one measured, given how few there are.
const Z = 1.96;
function wilson(successes: number, trials: number): { low: number; high: number } {
  if (trials <= 0) return { low: 0, high: 1 };
  const p = Math.min(1, Math.max(0, successes / trials));
  const denominator = 1 + (Z * Z) / trials;
  const centre = p + (Z * Z) / (2 * trials);
  const spread = Z * Math.sqrt((p * (1 - p)) / trials + (Z * Z) / (4 * trials * trials));
  return { low: Math.max(0, (centre - spread) / denominator), high: Math.min(1, (centre + spread) / denominator) };
}

const toRating = (share: number) => Math.round((1 + Math.min(1, Math.max(0, share)) * 4) * 10) / 10;

interface DraftMeasure {
  key: string;
  label: string;
  basis: string;
  weight: number;
  rate: number | null;
  numerator: number;
  denominator: number;
  observations: number;
  /** A share has a confidence band; a median time does not. */
  isShare: boolean;
  detail: string | null;
  /** The plain reason there is nothing, when there is nothing. */
  empty: string;
}

/** Turns measures into a rating by the shared rules. */
function assemble(
  kind: RoleAssessment["kind"],
  drafts: DraftMeasure[],
  gate: { done: number; min: number; tooNew: string },
  shown: ShownFact[],
  evidence: string,
): RoleAssessment {
  const enough = (draft: DraftMeasure) => draft.observations >= MIN_ROLE_OBSERVATIONS;
  const decided = drafts.map((draft) => ({
    ...draft,
    scored: draft.rate !== null && enough(draft),
    why:
      draft.rate === null
        ? draft.empty
        : !enough(draft)
          ? `Only ${draft.observations} to go on - ${MIN_ROLE_OBSERVATIONS} needed before this counts.`
          : null,
  }));

  const scored = decided.filter((draft) => draft.scored);
  const available = scored.reduce((total, draft) => total + draft.weight, 0);
  const intended = drafts.reduce((total, draft) => total + draft.weight, 0);
  const coverage = intended > 0 ? available / intended : 0;

  const measures: RoleMeasure[] = decided.map((draft) => ({
    key: draft.key,
    kind: draft.isShare ? "share" : "time",
    label: draft.label,
    basis: draft.basis,
    rate: draft.rate,
    scored: draft.scored,
    weight: draft.scored && available > 0 ? draft.weight / available : 0,
    numerator: draft.numerator,
    denominator: draft.denominator,
    detail: draft.detail,
    why: draft.why,
  }));

  const withheld = (reason: string): RoleAssessment => ({
    kind,
    measures,
    rating: null,
    ratingRange: null,
    withheld: reason,
    coverage,
    shown,
    evidence,
  });

  if (gate.done < gate.min) return withheld(gate.tooNew);
  if (scored.length === 0) return withheld("Nothing recorded that can be scored yet.");
  if (scored.length < MIN_ROLE_MEASURES || coverage < MIN_ROLE_WEIGHT) {
    const named = scored.map((draft) => draft.label).join(" and ");
    return withheld(
      `Too little is measured yet to put one number on it - only ${named} ${scored.length === 1 ? "counts" : "count"}, ` +
        `${percentOf(coverage)} of the whole. The figures below are what is known.`,
    );
  }

  let weighted = 0;
  let low = 0;
  let high = 0;
  for (const draft of scored) {
    const weight = draft.weight / available;
    const rate = draft.rate ?? 0;
    weighted += rate * weight;
    if (draft.isShare && draft.denominator > 0) {
      const bounds = wilson(draft.numerator, draft.denominator);
      low += bounds.low * weight;
      high += bounds.high * weight;
    } else {
      low += rate * weight;
      high += rate * weight;
    }
  }

  return {
    kind,
    measures,
    rating: toRating(weighted),
    ratingRange: { low: toRating(low), high: toRating(high) },
    withheld: null,
    coverage,
    shown,
    evidence,
  };
}

// --------------------------------------------------------------- mechanic

export interface MechanicFacts {
  /** Repairs they signed off: the final log of a maintenance cycle. */
  repairsFinished: number;
  /** Of those, the ones old enough to know whether they held. */
  repairsObserved: number;
  /** ...and that did hold: no breakdown or grounding within REPAIR_HOLD_DAYS. */
  repairsHeld: number;
  /** Logs they wrote as the primary mechanic. */
  logsWritten: number;
  /** ...with a photograph and written remarks. */
  logsDocumented: number;
  /** Minutes from a truck being grounded by someone else to their first log on it. */
  pickUpMinutes: number[];
  /** Minutes from being sent to a roadside breakdown to the verdict from the site. */
  roadsideMinutes: number[];
  roadsideJobs: number;
  roadsideFixed: number;
  /** Days each of their repairs took, grounding to sign-off. Shown, not scored. */
  repairDays: number[];
}

export const EMPTY_MECHANIC_FACTS: MechanicFacts = {
  repairsFinished: 0,
  repairsObserved: 0,
  repairsHeld: 0,
  logsWritten: 0,
  logsDocumented: 0,
  pickUpMinutes: [],
  roadsideMinutes: [],
  roadsideJobs: 0,
  roadsideFixed: 0,
  repairDays: [],
};

export function assessMechanic(facts: MechanicFacts): RoleAssessment {
  const pickUpMedian = median(facts.pickUpMinutes);
  const roadsideMedian = median(facts.roadsideMinutes);
  const repairMedian = median(facts.repairDays);

  const drafts: DraftMeasure[] = [
    {
      key: "repairsHeld",
      label: "Repairs that held",
      basis: `of their repairs, no breakdown or grounding within ${REPAIR_HOLD_DAYS} days`,
      weight: MECHANIC_WEIGHTS.repairsHeld,
      rate: facts.repairsObserved > 0 ? facts.repairsHeld / facts.repairsObserved : null,
      numerator: facts.repairsHeld,
      denominator: facts.repairsObserved,
      observations: facts.repairsObserved,
      isShare: true,
      detail:
        facts.repairsFinished > facts.repairsObserved
          ? `${plural(facts.repairsFinished - facts.repairsObserved, "repair")} too recent to tell yet`
          : null,
      empty: "No repairs signed off long enough ago to tell.",
    },
    {
      key: "documentation",
      label: "Logs documented",
      basis: "of their logs, with a photo and written remarks",
      weight: MECHANIC_WEIGHTS.documentation,
      rate: facts.logsWritten > 0 ? facts.logsDocumented / facts.logsWritten : null,
      numerator: facts.logsDocumented,
      denominator: facts.logsWritten,
      observations: facts.logsWritten,
      isShare: true,
      detail: null,
      empty: "No logs written yet.",
    },
    {
      key: "pickUp",
      label: "Picked up grounded trucks",
      basis: "trucks grounded by someone else, until their first log on it",
      weight: MECHANIC_WEIGHTS.pickUp,
      rate: timeRate(facts.pickUpMinutes, PICKUP_FULL_MIN, PICKUP_NONE_MIN),
      numerator: facts.pickUpMinutes.length,
      denominator: facts.pickUpMinutes.length,
      observations: facts.pickUpMinutes.length,
      isShare: false,
      detail:
        pickUpMedian === null
          ? null
          : `median ${formatMinutes(pickUpMedian)} (${formatMinutes(PICKUP_FULL_MIN)} or less counts in full, ` +
            `${formatMinutes(PICKUP_NONE_MIN)} or more counts for nothing)`,
      empty: "No truck grounded by someone else that they picked up.",
    },
    {
      key: "roadside",
      label: "Roadside response",
      basis: "sent to a breakdown, until the verdict from the site",
      weight: MECHANIC_WEIGHTS.roadside,
      rate: timeRate(facts.roadsideMinutes, ROADSIDE_FULL_MIN, ROADSIDE_NONE_MIN),
      numerator: facts.roadsideMinutes.length,
      denominator: facts.roadsideMinutes.length,
      observations: facts.roadsideMinutes.length,
      isShare: false,
      detail:
        roadsideMedian === null
          ? null
          : `median ${formatMinutes(roadsideMedian)} (${formatMinutes(ROADSIDE_FULL_MIN)} or less counts in full, ` +
            `${formatMinutes(ROADSIDE_NONE_MIN)} or more counts for nothing)`,
      empty: "Not sent to a roadside breakdown yet.",
    },
  ];

  const shown: ShownFact[] = [
    { label: "Repairs signed off", value: String(facts.repairsFinished) },
    {
      label: "Typical repair time",
      value: repairMedian === null ? "—" : `${Math.round(repairMedian * 10) / 10} days`,
      note: "Grounding to sign-off. Not scored: it often waits on parts.",
    },
    { label: "Roadside jobs", value: String(facts.roadsideJobs) },
    {
      label: "Fixed on site",
      value: facts.roadsideJobs > 0 ? percentOf(facts.roadsideFixed / facts.roadsideJobs) : "—",
      note: "Not scored: it depends on how bad the breakdown was.",
    },
  ];

  const jobs = facts.repairsFinished + facts.roadsideJobs;
  return assemble(
    "mechanic",
    drafts,
    {
      done: jobs,
      min: MIN_MECHANIC_JOBS,
      tooNew: `Too new to rate - ${plural(jobs, "repair or roadside job", "repairs and roadside jobs")}, ${MIN_MECHANIC_JOBS} needed.`,
    },
    shown,
    plural(jobs, "job"),
  );
}

// ----------------------------------------------------------------- office

export interface OfficeFacts {
  /** Trucks and crews they assigned, re-assigned or handed to a partner. */
  assignments: number;
  /** Of those, the ones with a delivery time or a booking time to judge by. */
  assignmentsJudged: number;
  /** ...made in good time: a day ahead, or within two hours of a late booking. */
  assignmentsOnNotice: number;
  /** Minutes from a crew declining or withdrawing to their re-assignment. */
  declineRecoveryMinutes: number[];
  /** Minutes from a breakdown report to their first recovery action. */
  foulTripMinutes: number[];
  bookingsCreated: number;
  overrides: number;

  // Admins only.
  employeesAdded: number;
  /** Added long enough ago to judge, or already sent their login. */
  loginsJudged: number;
  /** ...and sent it within LOGIN_SETUP_HOURS. */
  loginsOnTime: number;
}

export const EMPTY_OFFICE_FACTS: OfficeFacts = {
  assignments: 0,
  assignmentsJudged: 0,
  assignmentsOnNotice: 0,
  declineRecoveryMinutes: [],
  foulTripMinutes: [],
  bookingsCreated: 0,
  overrides: 0,
  employeesAdded: 0,
  loginsJudged: 0,
  loginsOnTime: 0,
};

/** Coordinators on delivery work; admins on that and on setting up new staff. */
export function assessOffice(facts: OfficeFacts, options: { includeStaff: boolean }): RoleAssessment {
  const declineMedian = median(facts.declineRecoveryMinutes);
  const foulMedian = median(facts.foulTripMinutes);

  const drafts: DraftMeasure[] = [
    {
      key: "assignmentNotice",
      label: "Crews assigned in good time",
      basis: `of their assignments, a day ahead or within ${PROMPT_HOURS} h of a late booking`,
      weight: OFFICE_WEIGHTS.assignmentNotice,
      rate: facts.assignmentsJudged > 0 ? facts.assignmentsOnNotice / facts.assignmentsJudged : null,
      numerator: facts.assignmentsOnNotice,
      denominator: facts.assignmentsJudged,
      observations: facts.assignmentsJudged,
      isShare: true,
      detail:
        facts.assignments > facts.assignmentsJudged
          ? `${plural(facts.assignments - facts.assignmentsJudged, "assignment")} had no delivery time to judge by`
          : null,
      empty: "No assignments with a delivery time to judge by.",
    },
    {
      key: "declineRecovery",
      label: "Declines re-assigned",
      basis: "a crew declined or withdrew, until they gave the booking another",
      weight: OFFICE_WEIGHTS.declineRecovery,
      rate: timeRate(facts.declineRecoveryMinutes, DECLINE_FULL_MIN, DECLINE_NONE_MIN),
      numerator: facts.declineRecoveryMinutes.length,
      denominator: facts.declineRecoveryMinutes.length,
      observations: facts.declineRecoveryMinutes.length,
      isShare: false,
      detail:
        declineMedian === null
          ? null
          : `median ${formatMinutes(declineMedian)} (${formatMinutes(DECLINE_FULL_MIN)} or less counts in full, ` +
            `${formatMinutes(DECLINE_NONE_MIN)} or more counts for nothing)`,
      empty: "No declined booking that they re-assigned.",
    },
    {
      key: "foulTripRecovery",
      label: "Breakdowns answered",
      basis: "a breakdown reported, until their first recovery action",
      weight: OFFICE_WEIGHTS.foulTripRecovery,
      rate: timeRate(facts.foulTripMinutes, FOUL_TRIP_FULL_MIN, FOUL_TRIP_NONE_MIN),
      numerator: facts.foulTripMinutes.length,
      denominator: facts.foulTripMinutes.length,
      observations: facts.foulTripMinutes.length,
      isShare: false,
      detail:
        foulMedian === null
          ? null
          : `median ${formatMinutes(foulMedian)} (${formatMinutes(FOUL_TRIP_FULL_MIN)} or less counts in full, ` +
            `${formatMinutes(FOUL_TRIP_NONE_MIN)} or more counts for nothing)`,
      empty: "No breakdown that they were first to answer.",
    },
  ];

  if (options.includeStaff) {
    drafts.push({
      key: "loginSetup",
      label: "New staff given their login",
      basis: `of the employees they added, sent a login within ${LOGIN_SETUP_HOURS} h`,
      weight: OFFICE_WEIGHTS.loginSetup,
      rate: facts.loginsJudged > 0 ? facts.loginsOnTime / facts.loginsJudged : null,
      numerator: facts.loginsOnTime,
      denominator: facts.loginsJudged,
      observations: facts.loginsJudged,
      isShare: true,
      detail: null,
      empty: "No employees added long enough ago to judge.",
    });
  }

  const shown: ShownFact[] = [
    { label: "Bookings created", value: String(facts.bookingsCreated) },
    { label: "Assignments made", value: String(facts.assignments) },
    {
      label: "Overrides used",
      value: String(facts.overrides),
      note: "Not scored: ending a booking from the office is sometimes the right call.",
    },
    ...(options.includeStaff ? [{ label: "Employees added", value: String(facts.employeesAdded) }] : []),
  ];

  const handled =
    facts.assignments +
    facts.foulTripMinutes.length +
    (options.includeStaff ? facts.employeesAdded : 0);

  return assemble(
    "office",
    drafts,
    {
      done: handled,
      min: MIN_OFFICE_ITEMS,
      tooNew: `Too little handled yet to rate - ${plural(handled, "item")}, ${MIN_OFFICE_ITEMS} needed.`,
    },
    shown,
    plural(handled, "item"),
  );
}
