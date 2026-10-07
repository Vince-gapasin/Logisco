// How an employee's work is summarised, and how the one number is arrived at.
//
// Kept away from the database so the rules can be read, argued with and tested
// on their own. Somebody's standing at work is decided here; it should be
// possible to check the arithmetic without a login.
//
// Four principles run through it.
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
// Nobody is marked down for a habit the company has not adopted. A component
// whose company-wide coverage is too thin to compare people fairly is shown as a
// fact and left out of the score until it is worth scoring.
//
// And a thin record is not a good one. A driver with two fast answers out of
// eighty trips does not score 100% on responsiveness; below a minimum number of
// observations a component is reported and not counted, which is the rule client
// feedback has always followed and the others now follow too.

export interface PerformanceFacts {
  // ---- What this person did ----
  /** Trips put in front of them. */
  tripsAssigned: number;
  /**
   * Trips where the moment of handing over was actually recorded.
   *
   * The denominator for responsiveness. It used to be every dispatch in the
   * table, including ones never assigned to anybody, which made company-wide
   * coverage read 0.9% when measured against trips that had genuinely been
   * handed over it was 70%.
   */
  tripsHandedOver: number;
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
   *
   * The three reasons the company actively wants reported - an unsafe truck, a
   * crew not fit to drive, the wrong licence - are counted separately and left
   * out. See tripsDeclinedForCause.
   */
  tripsDeclined: number;
  /**
   * Declines the company asked for: an unsafe truck, a crew not fit to drive, the
   * wrong licence for the load.
   *
   * Taken out of the completion figure, because refusing a truck with no brakes
   * is the crew doing their job. Counting it would teach them to take the truck.
   */
  tripsDeclinedForCause: number;
  /**
   * Accepted and seen through to the end.
   *
   * What this can and cannot catch is worth knowing. There is no status meaning
   * "accepted, then walked away from": a trip a driver abandons is either
   * re-assigned or recorded as a foul trip, and neither is filed against them.
   * So for a driver this figure moves on declines alone, and reads 100% for
   * anybody who has never turned a trip down. For a helper it does more work,
   * because their own acceptance is recorded separately from the trip's fate.
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
  /** Stops with a real scheduled time to compare against. */
  stopsJudged: number;
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
  tripsHandedOver: 0,
  tripsAccepted: 0,
  tripsDeclined: 0,
  tripsDeclinedForCause: 0,
  tripsCompleted: 0,
  tripsSetAside: 0,
  answerMinutes: [],
  stopsCompleted: 0,
  stopsJudged: 0,
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
  /**
   * How the rate was arrived at, where the counts do not show it.
   *
   * Responsiveness is a transformed median, so "5 of 50" explains its coverage
   * and not its percentage. Anything whose arithmetic is not visible in the
   * counts says it here instead.
   */
  detail: string | null;
  /** Why it did not count, when it did not. */
  why: string | null;
}

export interface Performance {
  facts: PerformanceFacts;
  components: ScoreComponent[];
  /** One to five, or null when there is too little to say. */
  rating: number | null;
  /**
   * How wide the rating's true value plausibly is, one to five.
   *
   * A single figure to one decimal place claims a precision a short record does
   * not have: twelve stops and two hundred stops both produced "4.6". The range
   * makes thin evidence visible without a footnote, and two people whose ranges
   * overlap are not meaningfully apart - which is the honest answer to most
   * comparisons anybody will want to make with this screen.
   */
  ratingRange: { low: number; high: number } | null;
  /** Why there is no rating, when there is none. */
  withheld: string | null;
  /** The share of the intended rating that rests on something measured. */
  coverage: number;
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

/**
 * Below this many observations, any other component is reported but not scored.
 *
 * Client feedback has always had such a rule; nothing else did, so five quick
 * answers out of fifty trips scored a flawless 100% on a component carrying a
 * fifth of the rating. This is that rule, applied evenly.
 *
 * A minimum was chosen over shrinking every rate towards the company average.
 * Shrinkage is the more elegant mechanism and it is what client feedback uses,
 * but doing it for all five components needs a company-wide rate for each, which
 * means five more figures to compute and five more constants to defend - and
 * "not enough of your own record yet" is a sentence a driver can check, while
 * "your figure was pulled 40% towards the company mean" is not.
 */
export const MIN_OBSERVATIONS = 10;

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
 * asked-for times are not a yardstick.
 *
 * Real bookings with real asked-for times switch this back on by themselves.
 */
export const MIN_COMPANY_ON_TIME = 0.2;

/**
 * How much of the company's own work a coverage judgement needs before it means
 * anything.
 *
 * Without this, three stops with two proofs read as 67% coverage and switched
 * proof-of-delivery scoring on for everybody. A judgement about the company's
 * habits needs to be made from enough of the company's work to be a habit.
 */
export const MIN_COMPANY_SAMPLE = 50;

/**
 * How recent the company's work must be for a coverage judgement to use it.
 *
 * The gates ask "is this the company's habit?", which is a question about now.
 * Asking it of all time answers a different question and is dominated by dead
 * data: measured over the whole history, proof-of-delivery needed about 1,730
 * consecutive new proofed stops to switch on, so a company at 100% compliance
 * from tomorrow would wait years. A trailing window answers the question asked.
 */
export const COMPANY_WINDOW_DAYS = 90;

/**
 * How many components must carry the rating before one number is shown.
 *
 * Two, because one measure is not a composite. This is the part of the old rule
 * that was doing real work; the weight floor below is the part that was set
 * without checking it could ever be met.
 */
export const MIN_SCORED_COMPONENTS = 2;

/**
 * How much of the rating must rest on something measured before a single number
 * is shown at all.
 *
 * It was 0.5, which no achievable combination could reach: with proof, answer
 * times and slots all ungated, the most that remained was completion plus client
 * feedback, and 0.30 + 0.15 is 0.45. Five hundred perfect client answers still
 * produced no rating. Forty per cent is clear of that, and completion plus
 * feedback - the two that will realistically arrive first - now opens the gate.
 */
export const MIN_SCORED_WEIGHT = 0.4;

/**
 * What each measure is worth.
 *
 * Re-weighted once the data was actually measured. The first set was written
 * before anybody had looked: completion carried 30% while being tautological for
 * drivers - it moves only on declines - and the client's verdict carried 15%
 * while being the one genuinely new signal that will accumulate. The weights now
 * follow what the measures are worth rather than the order they were thought of.
 */
export const WEIGHTS: Record<ComponentKey, number> = {
  conduct: 0.3,
  completion: 0.2,
  punctuality: 0.2,
  evidence: 0.15,
  responsiveness: 0.15,
};

const LABELS: Record<ComponentKey, { label: string; basis: string }> = {
  completion: { label: "Trips taken and finished", basis: "of the trips offered that reached an outcome" },
  responsiveness: { label: "Answered promptly", basis: "assignments with a recorded answer time" },
  evidence: { label: "Proof uploaded", basis: "of the stops they delivered" },
  conduct: { label: "Clients' verdict", basis: "of what clients who answered said" },
  punctuality: { label: "Arrived on time", basis: "of stops with a scheduled time, excluding excused delays" },
};

/** Manila, which has no daylight saving, so the offset is fixed. */
const PH_OFFSET = "+08:00";

const percentOf = (share: number) => `${Math.round(share * 100)}%`;

/** 95%, as a normal deviate. */
const Z = 1.96;

/**
 * A Wilson score interval for a proportion.
 *
 * Wilson rather than the textbook normal interval because it behaves at the
 * edges: eleven successes out of eleven gives a range that stops short of
 * certainty, where the normal interval collapses to a point and claims it.
 */
function wilson(successes: number, trials: number): { low: number; high: number } {
  if (trials <= 0) return { low: 0, high: 1 };

  const p = Math.min(1, Math.max(0, successes / trials));
  const denominator = 1 + (Z * Z) / trials;
  const centre = p + (Z * Z) / (2 * trials);
  const spread = Z * Math.sqrt((p * (1 - p)) / trials + (Z * Z) / (4 * trials * trials));

  return {
    low: Math.max(0, (centre - spread) / denominator),
    high: Math.min(1, (centre + spread) / denominator),
  };
}

/** A rate between 0 and 1, or null when there is no denominator. */
function rateOf(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.min(1, Math.max(0, numerator / denominator)) : null;
}

/**
 * How late a stop may be and still count as on time.
 *
 * A booking asks for a time of day, not a minute. Treating 8:01 as a failure
 * against an 8:00 slot would make the figure meaningless and the screen
 * distrusted, and half an hour is what the office already tells clients.
 */
export const ON_TIME_GRACE_MIN = 30;

/**
 * The moment a stop was actually due.
 *
 * BranchStops.expectedTime is a time of day with no date. The date lives in the
 * booking's notes blob as "Delivery Schedule", which is where the calendar reads
 * it from. Both are needed; with only the time there is no way to know which day
 * was meant.
 *
 * Returns null when the date is missing, and null is the honest answer. The
 * previous version took the date from the completion timestamp, which is
 * circular - you cannot be a day late if the day is copied from when you
 * finished - and it silently reported a punctuality figure for 1,736 stops that
 * had no scheduled date at all.
 */
export function expectedAt(
  scheduledDate: string | null | undefined,
  expectedTime: string | null | undefined,
): string | null {
  if (!scheduledDate || !expectedTime) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate.trim())) return null;

  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(expectedTime.trim());
  if (!clock) return null;

  const hours = Number(clock[1]);
  const minutes = Number(clock[2]);
  if (hours > 23 || minutes > 59) return null;

  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${scheduledDate.trim()}T${pad(hours)}:${pad(minutes)}:${clock[3] ?? "00"}${PH_OFFSET}`;

  return Number.isNaN(Date.parse(stamp)) ? null : stamp;
}

/**
 * Minutes past the moment it was due, negative when early. Null when either end
 * is unknown, which means "cannot say" rather than "on time".
 *
 * Two instants subtracted, with no zone arithmetic and no wrap-around guessing.
 * The version this replaces compared a time of day against a timestamp and had
 * to guess which side of midnight the answer fell on; its guess turned any stop
 * more than twelve hours late into one that was early, and therefore on time.
 */
export function minutesLate(
  dueAt: string | null | undefined,
  arrivedAt: string | null | undefined,
): number | null {
  if (!dueAt || !arrivedAt) return null;

  const due = Date.parse(dueAt);
  const arrived = Date.parse(arrivedAt);
  if (Number.isNaN(due) || Number.isNaN(arrived)) return null;

  return Math.round((arrived - due) / 60_000);
}

/** Whether a stop made its slot. Null when there is nothing to compare. */
export function wasOnTime(
  dueAt: string | null | undefined,
  arrivedAt: string | null | undefined,
  graceMin = ON_TIME_GRACE_MIN,
): boolean | null {
  const late = minutesLate(dueAt, arrivedAt);
  return late === null ? null : late <= graceMin;
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
  const tripsJudged = Math.max(
    0,
    facts.tripsAccepted + facts.tripsDeclined - facts.tripsDeclinedForCause - facts.tripsSetAside,
  );
  const stopsJudged = Math.max(0, facts.stopsJudged - facts.stopsExcused);
  const answered = facts.answerMinutes.filter((m) => Number.isFinite(m) && m >= 0).length;
  const median = medianAnswerMinutes(facts.answerMinutes);

  // What the minimum is counted against differs by component. For most it is
  // the denominator, but responsiveness is judged on a median of the answers it
  // actually has - fifty trips handed over with five answered is five
  // observations, not fifty.
  const raw: (Omit<ScoreComponent, "weight" | "scored" | "why"> & { observations: number })[] = [
    {
      key: "completion",
      ...LABELS.completion,
      rate: rateOf(facts.tripsCompleted, tripsJudged),
      numerator: facts.tripsCompleted,
      denominator: tripsJudged,
      detail: null,
      observations: tripsJudged,
    },
    {
      key: "responsiveness",
      ...LABELS.responsiveness,
      rate: responsivenessRate(facts.answerMinutes),
      numerator: answered,
      denominator: facts.tripsHandedOver,
      observations: answered,
      // The counts show coverage; the percentage comes from the median.
      detail:
        median === null
          ? null
          : `median ${Math.round(median)} min to answer, across ${answered} assignment${answered === 1 ? "" : "s"}` +
            ` (${ANSWER_FULL_MARKS_MIN} min or less counts in full, ${ANSWER_NO_MARKS_MIN} min or more counts for nothing)`,
    },
    {
      key: "evidence",
      ...LABELS.evidence,
      rate: rateOf(facts.proofsUploaded, facts.stopsCompleted),
      numerator: facts.proofsUploaded,
      denominator: facts.stopsCompleted,
      detail: null,
      observations: facts.stopsCompleted,
    },
    {
      key: "conduct",
      ...LABELS.conduct,
      rate: conductRate(facts, companyAverage),
      numerator: facts.feedbackGoodCondition + facts.feedbackCourteous,
      denominator: facts.feedbackResponses * 2,
      observations: facts.feedbackResponses,
      detail:
        facts.feedbackResponses >= MIN_FEEDBACK_RESPONSES
          ? `${facts.feedbackResponses} client answers, held towards the company average of ` +
            `${percentOf(companyAverage)} while the record is short`
          : null,
    },
    {
      key: "punctuality",
      ...LABELS.punctuality,
      rate: rateOf(facts.stopsOnTime, stopsJudged),
      numerator: facts.stopsOnTime,
      denominator: stopsJudged,
      observations: stopsJudged,
      detail:
        facts.stopsCompleted > facts.stopsJudged
          ? `${facts.stopsCompleted - facts.stopsJudged} of their stops had no scheduled date, or no arrival the crew recorded, so ` +
            `cannot be judged either way`
          : null,
    },
  ];

  /** Client feedback has its own, lower bar; everything else shares one. */
  const enoughOf = (component: (typeof raw)[number]): boolean =>
    component.key === "conduct"
      ? component.observations >= MIN_FEEDBACK_RESPONSES
      : component.observations >= MIN_OBSERVATIONS;

  const why = (component: (typeof raw)[number]): string | null => {
    if (notComparable.has(component.key)) {
      return "The company does not record this consistently enough yet to compare people on it.";
    }
    if (component.rate === null) {
      if (component.key !== "conduct") return "Nothing recorded yet.";
      // conductRate returns null below the minimum as well as at zero, so the
      // two have to be told apart here or four answers read as none.
      return facts.feedbackResponses === 0
        ? "No client has answered yet."
        : `Only ${facts.feedbackResponses} client answers - ${MIN_FEEDBACK_RESPONSES} needed before this counts.`;
    }
    if (!enoughOf(component)) {
      return component.key === "conduct"
        ? `Only ${facts.feedbackResponses} client answers - ${MIN_FEEDBACK_RESPONSES} needed before this counts.`
        : `Only ${component.observations} to go on - ${MIN_OBSERVATIONS} needed before this counts.`;
    }
    return null;
  };

  // A component with nothing behind it, or too little behind it, hands its
  // weight to the ones that have enough, rather than counting as a zero nobody
  // earned or a hundred nobody proved.
  const decided = raw.map((component) => ({
    ...component,
    scored: component.rate !== null && enoughOf(component) && !notComparable.has(component.key),
    why: why(component),
  }));

  const scored = decided.filter((component) => component.scored);
  const availableWeight = scored.reduce((total, component) => total + WEIGHTS[component.key], 0);

  const components: ScoreComponent[] = decided.map(({ observations: _observations, ...component }) => ({
    ...component,
    weight: component.scored && availableWeight > 0 ? WEIGHTS[component.key] / availableWeight : 0,
  }));

  const withheldAs = (reason: string): Performance => ({
    facts,
    components,
    rating: null,
    ratingRange: null,
    withheld: reason,
    coverage: availableWeight,
  });

  // Too new, or plenty offered and none finished - which are not the same thing
  // and used to be reported in the same words.
  if (facts.tripsCompleted < MIN_TRIPS_FOR_RATING) {
    const offered = facts.tripsAssigned;
    const trips = facts.tripsCompleted === 1 ? "trip" : "trips";

    if (offered >= MIN_TRIPS_FOR_RATING * 2) {
      return withheldAs(
        `${facts.tripsCompleted} finished ${trips} out of ${offered} offered. Not too new to judge - ` +
          `too little finished to judge on. The figures below are what is known.`,
      );
    }

    return withheldAs(`Too new to rate - ${facts.tripsCompleted} finished ${trips}, ${MIN_TRIPS_FOR_RATING} needed.`);
  }

  if (availableWeight === 0) {
    return withheldAs("Nothing recorded that can be scored yet.");
  }

  if (scored.length < MIN_SCORED_COMPONENTS || availableWeight < MIN_SCORED_WEIGHT) {
    const measured = scored.map((component) => component.label);
    return withheldAs(
      `Too little is measured yet to put one number on it - only ${measured.join(" and ")} ` +
        `${measured.length === 1 ? "counts" : "count"}, ${percentOf(availableWeight)} of the whole. ` +
        `The figures below are what is known.`,
    );
  }

  const weighted = components.reduce(
    (total, component) => total + (component.scored ? (component.rate ?? 0) * component.weight : 0),
    0,
  );

  // One to five, because that is how people read a rating. A flawless record is
  // five; nothing right at all is one.
  const toRating = (share: number) => Math.round((1 + Math.min(1, Math.max(0, share)) * 4) * 10) / 10;
  const rating = toRating(weighted);

  // The same weighted sum, taken at each component's plausible extremes.
  //
  // It treats the components as independent, which they are not entirely - a bad
  // week tends to be bad in several ways at once - so the range is a little wider
  // than a full treatment would give. Wider is the safe direction for a number
  // people are judged by. Responsiveness has no interval because it comes from a
  // median rather than a proportion, so it contributes its point value.
  let low = 0;
  let high = 0;
  for (const component of decided) {
    if (!component.scored) continue;

    const weight = WEIGHTS[component.key] / availableWeight;
    if (component.key === "responsiveness" || component.denominator <= 0) {
      low += (component.rate ?? 0) * weight;
      high += (component.rate ?? 0) * weight;
      continue;
    }

    const bounds = wilson(component.numerator, component.denominator);
    low += bounds.low * weight;
    high += bounds.high * weight;
  }

  return {
    facts,
    components,
    rating,
    ratingRange: { low: toRating(low), high: toRating(high) },
    withheld: null,
    coverage: availableWeight,
  };
}

/**
 * Which signals the company records too rarely to rank people on.
 *
 * Fed the company's own totals over a recent window, so the answer is one
 * judgement about how the company works now rather than a per-person excuse or a
 * verdict on its whole history.
 *
 * A note on what this cannot do. Because it is a threshold shared by everybody,
 * crossing it moves every employee's rating at once - somebody who uploads no
 * proof loses when the company starts uploading it, without their own work
 * changing. Removing that step entirely needs the previous period's decision to
 * be remembered, which needs somewhere to remember it; until then the window is
 * deliberately long and company-wide, so it moves slowly rather than flapping.
 */
export function signalsNotWorthScoring(company: {
  stopsCompleted: number;
  proofsUploaded: number;
  /** Trips whose hand-over moment was recorded, not every trip in the table. */
  tripsHandedOver: number;
  answered: number;
  /** Stops with a real scheduled time to compare against. */
  stopsJudged: number;
  /** How many of those made it. */
  stopsOnTime: number;
}): ComponentKey[] {
  const thin: ComponentKey[] = [];

  const tooFew = (denominator: number) => denominator < MIN_COMPANY_SAMPLE;

  const proofCoverage = rateOf(company.proofsUploaded, company.stopsCompleted);
  if (tooFew(company.stopsCompleted) || proofCoverage === null || proofCoverage < MIN_COMPANY_COVERAGE) {
    thin.push("evidence");
  }

  const answerCoverage = rateOf(company.answered, company.tripsHandedOver);
  if (tooFew(company.tripsHandedOver) || answerCoverage === null || answerCoverage < MIN_COMPANY_COVERAGE) {
    thin.push("responsiveness");
  }

  // Not "is the company punctual" but "are the asked-for times a real
  // yardstick". A fleet that missed every slot it ever had is indistinguishable
  // from a schedule that was never real.
  const onTimeShare = rateOf(company.stopsOnTime, company.stopsJudged);
  if (tooFew(company.stopsJudged) || onTimeShare === null || onTimeShare < MIN_COMPANY_ON_TIME) {
    thin.push("punctuality");
  }

  return thin;
}
