// How an employee's work is summarised, and how the one number is arrived at.
//
// Kept away from the database so the rules can be read, argued with and tested
// on their own. Somebody's standing at work is decided here; it should be
// possible to check the arithmetic without a login.
//
// Three principles run through it.
//
// Only what a person controls is scored. Whether a truck broke down, whether a
// client kept them waiting, whether a phone lost signal - all recorded, none of
// it scored. Reporting a problem must never cost somebody a star, or they will
// stop reporting problems, and that is the one outcome worse than a bad score.
//
// Nothing is invented. A client who does not answer is not a bad review; a
// component with no data does not quietly become zero. Where there is no
// evidence the weight moves to what there is evidence for, and the screen says
// how many answers the number rests on.
//
// And nobody is marked down for a habit the company has not adopted. Proof of
// delivery sits on a fraction of past stops, so measuring it today would say
// more about when the feature shipped than about who uses it. A component whose
// company-wide coverage is too thin to compare people fairly is shown as a fact
// and left out of the score until it is worth scoring.

export interface PerformanceFacts {
  // ---- What this person did ----
  /** Trips put in front of them. */
  tripsAssigned: number;
  /** Trips they took, and which have since reached an outcome. */
  tripsAccepted: number;
  /**
   * Trips they turned down.
   *
   * These count against the completion figure, because a trip nobody would
   * take still had to go out. That is a deliberate choice and a contestable
   * one - a driver right to refuse an unsafe truck is marked down the same as
   * one who could not be bothered - so every decline is listed with the reason
   * beside the number. The reason is the point; the number on its own is not
   * enough to act on.
   */
  tripsDeclined: number;
  /**
   * Accepted and seen through to the end.
   *
   * What this can and cannot catch is worth knowing. There is no status meaning
   * "accepted, then walked away from": a trip a driver abandons is either
   * re-assigned or recorded as a foul trip, and neither is filed against them.
   * So for a driver this figure moves on declines alone, and reads 100% for
   * anybody who has never turned a trip down. For a helper it does more work,
   * because their own acceptance is recorded separately from the trip's fate.
   *
   * Catching abandonment properly needs the re-assignment trail, which has 27
   * entries in total at the time of writing. It is not usable yet.
   */
  tripsCompleted: number;
  /**
   * Accepted trips that ended for reasons outside the crew's hands - a
   * breakdown, or the office cancelling. Taken out of the denominator rather
   * than counted as a failure to finish.
   *
   * Inert for drivers, where a foul trip already stops counting as accepted.
   * It earns its keep for helpers, whose own acceptance stands whatever later
   * happened to the trip.
   */
  tripsSetAside: number;
  /** Minutes between being assigned a trip and answering, one per trip. */
  answerMinutes: number[];

  stopsCompleted: number;
  stopsOnTime: number;
  /** Late, but a coordinator recorded a reason it was not the crew's doing. */
  stopsExcused: number;

  /** Stops where proof of delivery was uploaded. */
  proofsUploaded: number;

  // ---- What happened to them: shown, never scored ----
  foulTrips: number;
  stallAlerts: number;

  // ---- What clients said ----
  feedbackResponses: number;
  feedbackGoodCondition: number;
  feedbackCourteous: number;
}

export const EMPTY_FACTS: PerformanceFacts = {
  tripsAssigned: 0,
  tripsAccepted: 0,
  tripsDeclined: 0,
  tripsCompleted: 0,
  tripsSetAside: 0,
  answerMinutes: [],
  stopsCompleted: 0,
  stopsOnTime: 0,
  stopsExcused: 0,
  proofsUploaded: 0,
  foulTrips: 0,
  stallAlerts: 0,
  feedbackResponses: 0,
  feedbackGoodCondition: 0,
  feedbackCourteous: 0,
};

export type ComponentKey = "completion" | "responsiveness" | "evidence" | "conduct" | "punctuality";

export interface ScoreComponent {
  key: ComponentKey;
  label: string;
  /** What it is out of, in plain words, so a number can be checked. */
  basis: string;
  /** 0 to 1, or null when there is nothing to judge it on. */
  rate: number | null;
  /** Whether it counted towards the rating. */
  scored: boolean;
  /** Share of the final score, after redistribution. Zero when not scored. */
  weight: number;
  /** The counts behind the rate, so nobody has to trust the percentage. */
  numerator: number;
  denominator: number;
  /** Why it did not count, when it did not. */
  why: string | null;
}

export interface Performance {
  facts: PerformanceFacts;
  components: ScoreComponent[];
  /** One to five, or null when there is too little to say. */
  rating: number | null;
  /** Why there is no rating, when there is none. */
  withheld: string | null;
}

export interface PerformanceContext {
  /**
   * The share of all client answers across the company that were positive.
   * The same figure for everybody, so that a thin score is pulled towards the
   * firm's own standard rather than an invented one.
   */
  companyAverage?: number;
  /**
   * Components the company does not yet record consistently enough to compare
   * people on. Reported as facts, left out of the score.
   */
  notComparable?: ComponentKey[];
}

// ==========================================
// THE DIALS
// ==========================================
// Named and exported so a screen can show them. A score whose workings are
// hidden is one nobody can dispute, and everybody resents.

/** Answering this quickly counts in full. */
export const ANSWER_FULL_MARKS_MIN = 15;
/** Answering this slowly counts for nothing. Between the two it slides. */
export const ANSWER_NO_MARKS_MIN = 120;

/** Below this many client answers, their opinion is reported but not scored. */
export const MIN_FEEDBACK_RESPONSES = 5;

/** Below this many finished trips, no overall rating is given at all. */
export const MIN_TRIPS_FOR_RATING = 5;

/**
 * How hard a thin client score is pulled towards the company average.
 *
 * Everyone is treated as starting with this many notional answers at the
 * company's own average. Without it, whoever has been rated once by one
 * delighted client tops the list for ever.
 */
export const FEEDBACK_PRIOR_RESPONSES = 5;

/**
 * How much of the company's work must carry a signal before that signal is
 * used to rank anybody. Below this it says more about when the feature shipped
 * than about who bothers with it.
 */
export const MIN_COMPANY_COVERAGE = 0.5;

/**
 * How much of the company's work must have made its slot before slots are used
 * to rank anybody.
 *
 * This is not a standard to live up to; it is a check that the yardstick is
 * real. If almost nothing the company has ever delivered counts as on time, the
 * asked-for times are not a yardstick - and in this database they demonstrably
 * are not. 1,735 of 1,746 historical stops carry an expectedTime set to exactly
 * 120 minutes before their own completion time, sub-second digits included:
 * seeded data, derived from the answer. Judged against it every driver who has
 * ever worked here is late on every stop, equally, which distinguishes nobody.
 *
 * Real bookings with real asked-for times switch this back on by themselves.
 */
export const MIN_COMPANY_ON_TIME = 0.2;

/**
 * How much of the rating must rest on something measured before a single number
 * is shown at all.
 *
 * Redistributing weight is right when one measure is missing. It is not right
 * when four of five are: what comes out is one figure wearing a composite's
 * clothes, and 4.9 out of 5 reads as a verdict on the whole job rather than on
 * the only part anybody counted. Below this, the facts are shown and the number
 * is withheld.
 */
export const MIN_SCORED_WEIGHT = 0.5;

export const WEIGHTS: Record<ComponentKey, number> = {
  completion: 0.3,
  responsiveness: 0.2,
  evidence: 0.2,
  conduct: 0.15,
  punctuality: 0.15,
};

const LABELS: Record<ComponentKey, { label: string; basis: string }> = {
  completion: { label: "Trips taken and finished", basis: "of the trips offered that reached an outcome" },
  responsiveness: { label: "Answered promptly", basis: "how quickly assignments were answered" },
  evidence: { label: "Proof uploaded", basis: "of the stops they delivered" },
  conduct: { label: "Clients' verdict", basis: "of what clients who answered said" },
  punctuality: { label: "Arrived on time", basis: "of stops, excluding delays the office excused" },
};

/**
 * How late a stop may be and still count as on time.
 *
 * A booking asks for a time of day, not a minute. Treating 8:01 as a failure
 * against an 8:00 slot would make the figure meaningless and the screen
 * distrusted, and half an hour is what the office already tells clients.
 */
export const ON_TIME_GRACE_MIN = 30;

/** "14:30" or "14:30:00" as minutes since midnight. */
function clockMinutes(time: string | null | undefined): number | null {
  const parts = /^(\d{1,2}):(\d{2})/.exec((time ?? "").trim());
  if (!parts) return null;

  const hours = Number(parts[1]);
  const minutes = Number(parts[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/**
 * The time of day a timestamp fell on, in the Philippines.
 *
 * BranchStops.expectedTime is a time of day with no date; completedAt is an
 * instant, stored in UTC and worked out on a server that runs in UTC. Comparing
 * the two without naming the zone puts every delivery eight hours early, which
 * would have made half the fleet look like it beat every slot it ever missed.
 */
function zonedMinutes(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;

  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const hours = Number(parts.find((part) => part.type === "hour")?.value);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

/**
 * Minutes past the asked-for time, negative when early. Null when either end is
 * unknown, which means "cannot say" rather than "on time".
 */
export function minutesLate(
  expectedTime: string | null | undefined,
  completedAt: string | null | undefined,
): number | null {
  const expected = clockMinutes(expectedTime);
  const actual = zonedMinutes(completedAt);
  if (expected === null || actual === null) return null;

  let late = actual - expected;
  // A stop asked for at 11 PM and delivered at half past midnight is half an
  // hour late, not twenty-three hours early. Whichever side of midnight the
  // clock fell on, the nearer reading is the true one.
  if (late < -720) late += 1440;
  if (late > 720) late -= 1440;

  return late;
}

/** Whether a stop made its slot. Null when there is nothing to compare. */
export function wasOnTime(
  expectedTime: string | null | undefined,
  completedAt: string | null | undefined,
  graceMin = ON_TIME_GRACE_MIN,
): boolean | null {
  const late = minutesLate(expectedTime, completedAt);
  return late === null ? null : late <= graceMin;
}

const percentOf = (share: number) => `${Math.round(share * 100)}%`;

/** A rate between 0 and 1, or null when there is no denominator. */
function rateOf(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.min(1, Math.max(0, numerator / denominator)) : null;
}

/**
 * How promptly assignments were answered, as a rate.
 *
 * The median, not the average: one trip answered the next morning because the
 * driver was asleep should not undo a month of answering within minutes.
 */
export function responsivenessRate(answerMinutes: number[]): number | null {
  const median = medianAnswerMinutes(answerMinutes);
  if (median === null) return null;

  if (median <= ANSWER_FULL_MARKS_MIN) return 1;
  if (median >= ANSWER_NO_MARKS_MIN) return 0;
  return 1 - (median - ANSWER_FULL_MARKS_MIN) / (ANSWER_NO_MARKS_MIN - ANSWER_FULL_MARKS_MIN);
}

/** The median of the answer times, for showing beside the rate. */
export function medianAnswerMinutes(answerMinutes: number[]): number | null {
  const answered = answerMinutes.filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
  if (answered.length === 0) return null;

  const sorted = [...answered].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * What the clients said, pulled towards the company average by however little
 * they said it.
 *
 * Null below the threshold: the answers themselves are still worth showing,
 * but they are too few to put a number on.
 */
export function conductRate(
  facts: Pick<PerformanceFacts, "feedbackResponses" | "feedbackGoodCondition" | "feedbackCourteous">,
  companyAverage: number,
): number | null {
  if (facts.feedbackResponses < MIN_FEEDBACK_RESPONSES) return null;

  // Two questions per answer, so two chances to be satisfied.
  const good = facts.feedbackGoodCondition + facts.feedbackCourteous;
  const asked = facts.feedbackResponses * 2;
  const prior = FEEDBACK_PRIOR_RESPONSES * 2;

  return (good + companyAverage * prior) / (asked + prior);
}

/** Everything, in the round. */
export function assessPerformance(
  facts: PerformanceFacts,
  context: PerformanceContext = {},
): Performance {
  const companyAverage = context.companyAverage ?? 0.9;
  const notComparable = new Set(context.notComparable ?? []);

  // Everything offered that has since reached an outcome: taken and settled,
  // plus turned down. A breakdown is lifted back out - the trip ended, but not
  // by anyone here.
  const tripsJudged = Math.max(0, facts.tripsAccepted + facts.tripsDeclined - facts.tripsSetAside);
  const stopsJudged = Math.max(0, facts.stopsCompleted - facts.stopsExcused);

  const raw: Omit<ScoreComponent, "weight" | "scored" | "why">[] = [
    {
      key: "completion",
      ...LABELS.completion,
      rate: rateOf(facts.tripsCompleted, tripsJudged),
      numerator: facts.tripsCompleted,
      denominator: tripsJudged,
    },
    {
      key: "responsiveness",
      ...LABELS.responsiveness,
      rate: responsivenessRate(facts.answerMinutes),
      numerator: facts.answerMinutes.length,
      denominator: facts.tripsAssigned,
    },
    {
      key: "evidence",
      ...LABELS.evidence,
      rate: rateOf(facts.proofsUploaded, facts.stopsCompleted),
      numerator: facts.proofsUploaded,
      denominator: facts.stopsCompleted,
    },
    {
      key: "conduct",
      ...LABELS.conduct,
      rate: conductRate(facts, companyAverage),
      numerator: facts.feedbackGoodCondition + facts.feedbackCourteous,
      denominator: facts.feedbackResponses * 2,
    },
    {
      key: "punctuality",
      ...LABELS.punctuality,
      rate: rateOf(facts.stopsOnTime, stopsJudged),
      numerator: facts.stopsOnTime,
      denominator: stopsJudged,
    },
  ];

  const why = (component: (typeof raw)[number]): string | null => {
    if (notComparable.has(component.key)) {
      return "The company does not record this consistently enough yet to compare people on it.";
    }
    if (component.rate !== null) return null;
    if (component.key === "conduct") {
      return facts.feedbackResponses === 0
        ? "No client has answered yet."
        : `Only ${facts.feedbackResponses} client answers - ${MIN_FEEDBACK_RESPONSES} needed before this counts.`;
    }
    return "Nothing recorded yet.";
  };

  // A component with nothing behind it hands its weight to the ones that have
  // something, rather than counting as a zero nobody earned.
  const decided = raw.map((component) => ({
    ...component,
    scored: component.rate !== null && !notComparable.has(component.key),
    why: why(component),
  }));

  const availableWeight = decided
    .filter((component) => component.scored)
    .reduce((total, component) => total + WEIGHTS[component.key], 0);

  const components: ScoreComponent[] = decided.map((component) => ({
    ...component,
    weight: component.scored && availableWeight > 0 ? WEIGHTS[component.key] / availableWeight : 0,
  }));

  if (facts.tripsCompleted < MIN_TRIPS_FOR_RATING) {
    const trips = facts.tripsCompleted === 1 ? "trip" : "trips";
    return {
      facts,
      components,
      rating: null,
      withheld: `Too new to rate - ${facts.tripsCompleted} finished ${trips}, ${MIN_TRIPS_FOR_RATING} needed.`,
    };
  }

  if (availableWeight === 0) {
    return { facts, components, rating: null, withheld: "Nothing recorded that can be scored yet." };
  }

  if (availableWeight < MIN_SCORED_WEIGHT) {
    const measured = components.filter((component) => component.scored).map((component) => component.label);
    return {
      facts,
      components,
      rating: null,
      withheld:
        `Too little is measured yet to put one number on it - only ${measured.join(" and ")} ` +
        `${measured.length === 1 ? "counts" : "count"}, ${percentOf(availableWeight)} of the whole. ` +
        `The figures below are what is known.`,
    };
  }

  const weighted = components.reduce(
    (total, component) => total + (component.scored ? (component.rate ?? 0) * component.weight : 0),
    0,
  );

  // One to five, because that is how people read a rating. A flawless record is
  // five; nothing right at all is one.
  const rating = Math.round((1 + weighted * 4) * 10) / 10;

  return { facts, components, rating, withheld: null };
}

/**
 * Which signals the company records too rarely to rank people on.
 *
 * Fed the same totals across everybody's work, so the answer is one judgement
 * about the company's habits rather than a per-person excuse.
 */
export function signalsNotWorthScoring(company: {
  stopsCompleted: number;
  proofsUploaded: number;
  tripsAssigned: number;
  answered: number;
  /** Stops with a slot to compare against, company-wide. */
  stopsJudged: number;
  /** How many of those made it. */
  stopsOnTime: number;
}): ComponentKey[] {
  const thin: ComponentKey[] = [];

  const proofCoverage = rateOf(company.proofsUploaded, company.stopsCompleted);
  if (proofCoverage === null || proofCoverage < MIN_COMPANY_COVERAGE) thin.push("evidence");

  const answerCoverage = rateOf(company.answered, company.tripsAssigned);
  if (answerCoverage === null || answerCoverage < MIN_COMPANY_COVERAGE) thin.push("responsiveness");

  // Not "is the company punctual" but "are the asked-for times a real
  // yardstick". A fleet that missed every slot it ever had is indistinguishable
  // from a schedule that was never real.
  const onTimeShare = rateOf(company.stopsOnTime, company.stopsJudged);
  if (onTimeShare === null || onTimeShare < MIN_COMPANY_ON_TIME) thin.push("punctuality");

  return thin;
}
