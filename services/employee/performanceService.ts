// What one employee's record actually says.
//
// Nothing here is stored. The rating is worked out each time it is asked for,
// from rows that were already being written: trips on DispatchOrder, stop times
// on BranchStops, proof on POD, breakdowns on FoulTripIncident, assignment and
// acceptance times in AuditTrail. A stored score would be a second version of
// the truth, and the one that went stale.
//
// Two tables are new because the system could not observe what they hold:
// DeliveryFeedback (nobody had ever been asked) and StopDelayExcuse (a late
// stop the office accepts was not the crew's doing).
//
// The arithmetic is in app/lib/performance.ts and is tested on its own. This
// file only fetches and counts.

import { supabase } from "@/app/lib/supabase";
import { selectAll, selectAllIn } from "@/app/lib/selectAll";
import {
  DELIVERY_STATUS,
  EMPLOYEE_ROLE,
  FINISHED_DELIVERY_STATUSES,
  HELPER_STATUS,
  hasDriverAccepted,
  isDeliveryTerminal,
  isStopDelivered,
  type DeliveryStatus,
} from "@/app/lib/enums";
import { readNote } from "@/app/lib/bookingNotes";
import {
  assessPerformance,
  EMPTY_FACTS,
  MIN_TRIPS_FOR_RATING,
  expectedAt,
  minutesLate,
  COMPANY_WINDOW_DAYS,
  ON_TIME_GRACE_MIN,
  signalsNotWorthScoring,
  wasOnTime,
  type ComponentKey,
  type Performance,
  type PerformanceFacts,
} from "@/app/lib/performance";

export class PerformanceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PerformanceError";
  }
}

/** Only the people who actually run deliveries. See judgedRoles below. */
const RATED_ROLES: string[] = [EMPLOYEE_ROLE.driver, EMPLOYEE_ROLE.helper];

/** How far back a rating looks by default. */
export const DEFAULT_WINDOW_DAYS = 180;

/** Which audit entries mark a trip being handed over and answered. */
const ASSIGNED_ACTIONS = ["ASSIGN", "REASSIGN"];
const ACCEPTED_ACTION = "CREW_ACCEPT";

export interface PerformanceWindow {
  /** Null when the window was widened to everything on record. */
  days: number | null;
  from: string | null;
  label: string;
  /** Set when the recent window held too little and the window was widened. */
  widenedBecause: string | null;
}

export interface DeclineNote {
  orderCode: string | null;
  reason: string | null;
  at: string | null;
}

export interface BreakdownNote {
  orderCode: string | null;
  issueType: string;
  reportedAt: string;
}

export interface ExcusedNote {
  branchName: string;
  reason: string;
  notes: string | null;
  minutesLate: number | null;
  excusedAt: string;
}

export interface LateStop {
  branchID: number;
  branchName: string;
  orderCode: string | null;
  minutesLate: number;
  completedAt: string | null;
}

export interface ClientComment {
  orderCode: string | null;
  comment: string | null;
  goodCondition: boolean;
  courteous: boolean;
  submittedAt: string;
}

export interface EmployeePerformance {
  employeeID: string;
  employeeName: string;
  role: string;
  window: PerformanceWindow;
  /** Null for a role this does not describe - an admin, a coordinator. */
  performance: Performance | null;
  notRatedBecause: string | null;
  /**
   * Recorded and shown, never scored. Somebody who reports a breakdown is
   * doing their job; a system that costs them a star for it teaches them to
   * drive on and say nothing.
   */
  reported: {
    breakdowns: BreakdownNote[];
    stallAlerts: number;
    declines: DeclineNote[];
    excusedStops: ExcusedNote[];
    /**
     * Stops that missed their slot and have not been put aside. Listed so a
     * coordinator can excuse one from the screen that shows the figure it
     * affects, which is where anybody disputes it.
     */
    lateStops: LateStop[];
  };
  comments: ClientComment[];
  company: {
    /** Share of all client answers across the company that were positive. */
    feedbackAverage: number;
    feedbackResponses: number;
    notComparable: ComponentKey[];
  };
}

// ---------------------------------------------------------------- fetching

type Embed<T> = T | T[] | null;
const first = <T,>(value: Embed<T> | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

interface DispatchRow {
  dispatchID: string;
  orderID: string | null;
  status: string;
  completedAt: string | null;
  rejectionreason: string | null;
  Order: Embed<{ orderCode: string | null; createdAt: string | null; notes: string | null }>;
}

/** One trip this person was on, with their own answer to it. */
interface Trip {
  dispatchID: string;
  status: string;
  orderCode: string | null;
  /** The date the booking asked for, as "YYYY-MM-DD", when it recorded one. */
  scheduledDate: string | null;
  /** When this trip counts as having happened, for the window. */
  at: number;
  accepted: boolean;
  declined: boolean;
  declineReason: string | null;
  declinedAt: string | null;
}

async function readEmployee(employeeID: string) {
  const { data, error } = await supabase
    .from("Employee")
    .select("employeeID, employeeName, role")
    .eq("employeeID", employeeID)
    .maybeSingle();

  if (error) throw new PerformanceError(`Could not read the employee: ${error.message}`, 500);
  if (!data) throw new PerformanceError("Employee not found.", 404);

  return data as { employeeID: string; employeeName: string; role: string };
}

/** Every trip this person has ever been crew on, whatever the window. */
async function readTrips(employeeID: string, role: string): Promise<Trip[]> {
  // The booking notes carry "Delivery Schedule", the only place a delivery DATE
  // is recorded - BranchStops.expectedTime is a time of day with no date.
  const columns =
    "dispatchID, orderID, status, completedAt, rejectionreason, Order ( orderCode, createdAt, notes )";

  if (role === EMPLOYEE_ROLE.driver) {
    const rows = await selectAll<DispatchRow>((from, to) =>
      supabase.from("DispatchOrder").select(columns).eq("driverID", employeeID).range(from, to),
    );

    return rows.map((row) => ({
      dispatchID: row.dispatchID,
      status: row.status,
      orderCode: first(row.Order)?.orderCode ?? null,
      scheduledDate: scheduleDateOf(row),
      at: tripTime(row),
      // The dispatch status is the driver's own answer: a trip on the road was
      // accepted to get there.
      accepted: hasDriverAccepted(row.status),
      declined: row.status === DELIVERY_STATUS.rejected,
      declineReason: row.rejectionreason,
      declinedAt: row.status === DELIVERY_STATUS.rejected ? (row.completedAt ?? null) : null,
    }));
  }

  // A helper's answer lives on their own row, not on the dispatch.
  const assignments = await selectAll<{ dispatchID: string | null; status: string | null; declinereason: string | null }>(
    (from, to) =>
      supabase
        .from("DispatchHelper")
        .select("dispatchID, status, declinereason")
        .eq("helperID", employeeID)
        .range(from, to),
  );

  const answerOf = new Map(assignments.filter((row) => row.dispatchID).map((row) => [row.dispatchID!, row]));
  const dispatchIDs = [...answerOf.keys()];
  if (dispatchIDs.length === 0) return [];

  const rows = await selectAllIn<DispatchRow, string>(dispatchIDs, (chunk, from, to) =>
    supabase.from("DispatchOrder").select(columns).in("dispatchID", chunk).range(from, to),
  );

  return rows.map((row) => {
    const answer = answerOf.get(row.dispatchID);
    return {
      dispatchID: row.dispatchID,
      status: row.status,
      orderCode: first(row.Order)?.orderCode ?? null,
      scheduledDate: scheduleDateOf(row),
      at: tripTime(row),
      accepted: answer?.status === HELPER_STATUS.accepted,
      declined: answer?.status === HELPER_STATUS.declined,
      declineReason: answer?.declinereason ?? null,
      declinedAt: null,
    };
  });
}

/**
 * The delivery date the booking asked for.
 *
 * Kept as text in the notes blob under "Delivery Schedule", which is where the
 * calendar reads it from too. Only 24 of 2,065 bookings carry one, because the
 * rest are seeded - so most stops have no date and cannot be judged for
 * punctuality at all, which is the honest position rather than inventing one
 * from the completion time.
 */
function scheduleDateOf(row: DispatchRow): string | null {
  const raw = readNote(first(row.Order)?.notes ?? "", "Delivery Schedule").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * The date a trip is filed under.
 *
 * When it finished, or failing that when the booking was made. A trip still on
 * the road has no completion time and belongs to now.
 */
function tripTime(row: DispatchRow): number {
  const finished = row.completedAt ? Date.parse(row.completedAt) : Number.NaN;
  if (Number.isFinite(finished)) return finished;

  const booked = first(row.Order)?.createdAt;
  const created = booked ? Date.parse(booked) : Number.NaN;
  return Number.isFinite(created) ? created : Date.now();
}

interface StopRow {
  branchID: number;
  branchName: string | null;
  dispatchID: string | null;
  expectedTime: string | null;
  completedAt: string | null;
  stopStatus: string | null;
}

async function readStops(dispatchIDs: string[]): Promise<StopRow[]> {
  if (dispatchIDs.length === 0) return [];

  return selectAllIn<StopRow, string>(dispatchIDs, (chunk, from, to) =>
    supabase
      .from("BranchStops")
      .select("branchID, branchName, dispatchID, expectedTime, completedAt, stopStatus")
      .in("dispatchID", chunk)
      .range(from, to),
  );
}

/**
 * How long each trip sat unanswered, in minutes.
 *
 * Read from the audit trail, the only place the two moments are recorded. The
 * trail is new, so most older trips have neither entry and simply do not
 * appear - which is why the whole component drops out of the score until the
 * company has enough of them. It is never treated as a slow answer.
 *
 * Only meaningful for a driver: CREW_ACCEPT is written when the driver accepts,
 * and a helper's answer carries no timestamp anywhere.
 */
async function readAnswerMinutes(dispatchIDs: string[]): Promise<number[]> {
  if (dispatchIDs.length === 0) return [];

  const rows = await selectAllIn<{ recordID: string; action: string; timestamp: string | null }, string>(
    dispatchIDs,
    (chunk, from, to) =>
      supabase
        .from("AuditTrail")
        .select("recordID, action, timestamp")
        .in("recordID", chunk)
        .in("action", [...ASSIGNED_ACTIONS, ACCEPTED_ACTION])
        .order("timestamp", { ascending: true })
        .range(from, to),
  );

  const handedOver = new Map<string, number>();
  const answered = new Map<string, number>();

  for (const row of rows) {
    if (!row.timestamp) continue;
    const at = Date.parse(row.timestamp);
    if (!Number.isFinite(at)) continue;

    // The earliest of each wins: a trip re-assigned twice was handed over when
    // it was first handed over.
    const into = row.action === ACCEPTED_ACTION ? answered : handedOver;
    const seen = into.get(row.recordID);
    if (seen === undefined || at < seen) into.set(row.recordID, at);
  }

  const minutes: number[] = [];
  for (const [dispatchID, assignedAt] of handedOver) {
    const acceptedAt = answered.get(dispatchID);
    if (acceptedAt === undefined || acceptedAt < assignedAt) continue;
    minutes.push((acceptedAt - assignedAt) / 60_000);
  }

  return minutes;
}

// ---------------------------------------------------------------- the company

/**
 * What the company as a whole records, and how much of its work carries a
 * client answer.
 *
 * One judgement for everybody. A signal the firm barely records is not used to
 * rank anyone - it would sort people by when a feature shipped - and a thin
 * client score is pulled towards this average rather than towards an invented
 * number.
 */
const COMPANY_CACHE_MS = 10 * 60 * 1000;
let companyCache: { at: number; value: CompanyFigures } | null = null;

interface CompanyFigures {
  feedbackAverage: number;
  feedbackResponses: number;
  notComparable: ComponentKey[];
}

async function readCompany(): Promise<CompanyFigures> {
  // The company's habits change over months, not between page loads, and
  // working them out means reading every stop. Held for ten minutes per server
  // instance.
  if (companyCache && Date.now() - companyCache.at < COMPANY_CACHE_MS) {
    return companyCache.value;
  }

  const value = await computeCompany();
  companyCache = { at: Date.now(), value };
  return value;
}

/** Only for tests and scripts: drops the cached company figures. */
export function forgetCompanyFigures(): void {
  companyCache = null;
}

/**
 * What the company as a whole records, and how much of its work carries each
 * signal.
 *
 * One judgement for everybody. A signal the firm barely records, or one whose
 * yardstick is not real, is not used to rank anyone - it would sort people by
 * when a feature shipped, or by nothing at all. A thin client score is pulled
 * towards this average rather than towards an invented number.
 */
async function computeCompany(): Promise<CompanyFigures> {
  // A trailing window, not all time. The gates ask "is this how the company
  // works?", which is a question about now; asked of the whole history it was
  // answered by 1,700 seeded rows and could essentially never change.
  const since = new Date(Date.now() - COMPANY_WINDOW_DAYS * 864e5).toISOString();

  const [stops, proofs, handedOver, accepts, feedback] = await Promise.all([
    // Stops finished in the window, with their booking's schedule date so the
    // on-time share is measured against a real moment.
    selectAll<{
      branchID: number;
      expectedTime: string | null;
      completedAt: string | null;
      stopStatus: string | null;
      Order: Embed<{ notes: string | null }>;
    }>((from, to) =>
      supabase
        .from("BranchStops")
        .select("branchID, expectedTime, completedAt, stopStatus, Order ( notes )")
        .not("completedAt", "is", null)
        .gte("completedAt", since)
        .range(from, to),
    ),
    selectAll<{ branchID: number | null }>((from, to) =>
      supabase.from("POD").select("branchID").gte("deliveredAt", since).range(from, to),
    ),
    // Trips whose hand-over moment was recorded. The denominator used to be
    // every dispatch in the table, including ones never assigned to anybody,
    // which put answer-time coverage at 0.9% when the true figure was 70%.
    selectAll<{ recordID: string }>((from, to) =>
      supabase
        .from("AuditTrail")
        .select("recordID")
        .in("action", ASSIGNED_ACTIONS)
        .gte("timestamp", since)
        .range(from, to),
    ),
    selectAll<{ recordID: string }>((from, to) =>
      supabase
        .from("AuditTrail")
        .select("recordID")
        .eq("action", ACCEPTED_ACTION)
        .gte("timestamp", since)
        .range(from, to),
    ),
    supabase.from("DeliveryFeedback").select("goodCondition, courteous").gte("submittedAt", since),
  ]);

  const delivered = stops.filter((stop) => isStopDelivered(stop.stopStatus));

  let stopsJudged = 0;
  let stopsOnTime = 0;
  for (const stop of delivered) {
    const scheduled = readNote(first(stop.Order)?.notes ?? "", "Delivery Schedule").trim();
    const madeIt = wasOnTime(expectedAt(scheduled, stop.expectedTime), stop.completedAt);
    if (madeIt === null) continue;
    stopsJudged++;
    if (madeIt) stopsOnTime++;
  }

  const provenStops = new Set(
    proofs.map((row) => row.branchID).filter((id): id is number => id !== null),
  );
  const deliveredIDs = new Set(delivered.map((stop) => stop.branchID));

  // Apply the migration before deploying this: without DeliveryFeedback and
  // StopDelayExcuse every read here fails, loudly and on purpose. A screen that
  // quietly reported "no client answers" because the table was missing would be
  // indistinguishable from one where nobody had answered.
  if (feedback.error) {
    throw new PerformanceError(`Could not read client feedback: ${feedback.error.message}`, 500);
  }

  const answers = (feedback.data ?? []) as { goodCondition: boolean; courteous: boolean }[];
  const positive = answers.reduce(
    (total, row) => total + (row.goodCondition ? 1 : 0) + (row.courteous ? 1 : 0),
    0,
  );

  return {
    // No answers yet, so no company standard. Nine in ten is the assumption
    // until the first few arrive, and it barely matters: with nothing to shrink
    // towards, nobody clears the minimum to be scored on it anyway.
    feedbackAverage: answers.length > 0 ? positive / (answers.length * 2) : 0.9,
    feedbackResponses: answers.length,
    notComparable: signalsNotWorthScoring({
      stopsCompleted: delivered.length,
      proofsUploaded: [...provenStops].filter((id) => deliveredIDs.has(id)).length,
      tripsHandedOver: new Set(handedOver.map((row) => row.recordID)).size,
      answered: new Set(accepts.map((row) => row.recordID)).size,
      stopsJudged,
      stopsOnTime,
    }),
  };
}

// ---------------------------------------------------------------- the whole thing

export async function getEmployeePerformance(
  employeeID: string,
  options: { windowDays?: number | null } = {},
): Promise<EmployeePerformance> {
  const employee = await readEmployee(employeeID);
  const company = await readCompany();

  const empty: EmployeePerformance = {
    employeeID: employee.employeeID,
    employeeName: employee.employeeName,
    role: employee.role,
    window: { days: null, from: null, label: "All time", widenedBecause: null },
    performance: null,
    notRatedBecause: null,
    reported: { breakdowns: [], stallAlerts: 0, declines: [], excusedStops: [], lateStops: [] },
    comments: [],
    company,
  };

  if (!RATED_ROLES.includes(employee.role)) {
    return {
      ...empty,
      notRatedBecause: `This measures the crew who run deliveries. ${employee.role} work is not what it describes, and a number that does not mean anything is worse than none.`,
    };
  }

  const allTrips = await readTrips(employee.employeeID, employee.role);

  // The window, and widening it when a recent record is too thin to rate.
  const asked = options.windowDays === undefined ? DEFAULT_WINDOW_DAYS : options.windowDays;
  const window = chooseWindow(allTrips, asked);
  const trips = window.from ? allTrips.filter((trip) => trip.at >= Date.parse(window.from!)) : allTrips;

  const facts = await gatherFacts(trips, employee.role);
  const performance = assessPerformance(facts, {
    companyAverage: company.feedbackAverage,
    notComparable: company.notComparable,
  });

  // Late stops are only worth listing when lateness is actually being counted.
  // With the seeded expectedTime values every delivered stop reads as late, and
  // offering a coordinator sixty-nine delays to excuse one at a time would make
  // a real tool look broken.
  const countingLateness = !company.notComparable.includes("punctuality");
  const extras = await gatherReported(trips, countingLateness);

  return {
    ...empty,
    window,
    performance,
    reported: extras.reported,
    comments: extras.comments,
  };
}

/**
 * Which stretch of time to judge.
 *
 * Recent work is what a rating should be about, but most of this history is
 * older than any sensible window, and a blank screen is not an answer. So the
 * window widens when the recent one holds too little to rate, and says that it
 * did rather than quietly showing an old number as a current one.
 */
function chooseWindow(trips: Trip[], days: number | null): PerformanceWindow {
  if (days === null) {
    return { days: null, from: null, label: "All time", widenedBecause: null };
  }

  const from = new Date(Date.now() - days * 864e5).toISOString();
  const finishedRecently = trips.filter(
    (trip) => trip.at >= Date.parse(from) && FINISHED_DELIVERY_STATUSES.includes(trip.status as DeliveryStatus),
  ).length;

  if (finishedRecently >= MIN_TRIPS_FOR_RATING) {
    return { days, from, label: `Last ${days} days`, widenedBecause: null };
  }

  const trips_ = finishedRecently === 1 ? "trip" : "trips";
  return {
    days: null,
    from: null,
    label: "All time",
    widenedBecause: `Only ${finishedRecently} finished ${trips_} in the last ${days} days, so this covers their whole record.`,
  };
}

async function gatherFacts(trips: Trip[], role: string): Promise<PerformanceFacts> {
  const settled = trips.filter((trip) => isDeliveryTerminal(trip.status));
  const accepted = trips.filter((trip) => trip.accepted);
  const acceptedIDs = accepted.map((trip) => trip.dispatchID);

  // The booking's schedule date, per trip, so a stop can be compared against a
  // real moment rather than a date copied from its own completion.
  const scheduleOf = new Map(accepted.map((trip) => [trip.dispatchID, trip.scheduledDate]));

  const stops = await readStops(acceptedIDs);
  const delivered = stops.filter((stop) => isStopDelivered(stop.stopStatus) && stop.completedAt);
  const excused = await readExcuses(delivered.map((stop) => stop.branchID));

  let judged = 0;
  let onTime = 0;
  let excusedStops = 0;

  for (const stop of delivered) {
    const dueAt = expectedAt(stop.dispatchID ? scheduleOf.get(stop.dispatchID) : null, stop.expectedTime);
    const madeIt = wasOnTime(dueAt, stop.completedAt);

    // No scheduled date means nobody can say whether this was late. It is left
    // out of the punctuality figure entirely and counted nowhere, rather than
    // being judged against a date taken from when the crew happened to finish.
    if (madeIt === null) continue;

    judged++;
    if (excused.has(stop.branchID)) {
      excusedStops++;
      continue;
    }
    if (madeIt) onTime++;
  }

  const proofs = await readProofCount(delivered.map((stop) => stop.branchID));
  const feedback = await readFeedback(acceptedIDs);
  const answerMinutes = role === EMPLOYEE_ROLE.driver ? await readAnswerMinutes(acceptedIDs) : [];

  return {
    ...EMPTY_FACTS,
    tripsAssigned: trips.length,
    // Only trips whose hand-over was actually recorded can be judged on how
    // quickly they were answered.
    tripsHandedOver: role === EMPLOYEE_ROLE.driver ? await countHandedOver(trips.map((t) => t.dispatchID)) : 0,
    tripsAccepted: accepted.filter((trip) => isDeliveryTerminal(trip.status)).length,
    tripsDeclined: trips.filter((trip) => trip.declined).length,
    tripsCompleted: accepted.filter((trip) =>
      FINISHED_DELIVERY_STATUSES.includes(trip.status as DeliveryStatus),
    ).length,
    tripsSetAside: settled.filter(
      (trip) =>
        trip.accepted &&
        (trip.status === DELIVERY_STATUS.foulTrip || trip.status === DELIVERY_STATUS.cancelled),
    ).length,
    // A helper's acceptance carries no timestamp, so there is nothing to time.
    answerMinutes,
    stopsCompleted: delivered.length,
    stopsJudged: judged,
    stopsOnTime: onTime,
    stopsExcused: excusedStops,
    proofsUploaded: proofs,
    foulTrips: trips.filter((trip) => trip.status === DELIVERY_STATUS.foulTrip).length,
    feedbackResponses: feedback.length,
    feedbackGoodCondition: feedback.filter((row) => row.goodCondition).length,
    feedbackCourteous: feedback.filter((row) => row.courteous).length,
  };
}

/** How many of these trips have a recorded moment of being handed over. */
async function countHandedOver(dispatchIDs: string[]): Promise<number> {
  if (dispatchIDs.length === 0) return 0;

  const rows = await selectAllIn<{ recordID: string }, string>(dispatchIDs, (chunk, from, to) =>
    supabase
      .from("AuditTrail")
      .select("recordID")
      .in("recordID", chunk)
      .in("action", ASSIGNED_ACTIONS)
      .range(from, to),
  );

  return new Set(rows.map((row) => row.recordID)).size;
}

async function readExcuses(branchIDs: number[]) {
  if (branchIDs.length === 0) return new Map<number, ExcuseRow>();

  const rows = await selectAllIn<ExcuseRow, number>(branchIDs, (chunk, from, to) =>
    supabase
      .from("StopDelayExcuse")
      .select("branchID, reason, notes, excusedAt")
      .in("branchID", chunk)
      .range(from, to),
  );

  return new Map(rows.map((row) => [row.branchID, row]));
}

interface ExcuseRow {
  branchID: number;
  reason: string;
  notes: string | null;
  excusedAt: string;
}

/** How many of these stops carry proof of delivery. */
async function readProofCount(branchIDs: number[]): Promise<number> {
  if (branchIDs.length === 0) return 0;

  const rows = await selectAllIn<{ branchID: number | null }, number>(branchIDs, (chunk, from, to) =>
    supabase.from("POD").select("branchID").in("branchID", chunk).range(from, to),
  );

  // A stop photographed twice is still one stop with proof.
  return new Set(rows.map((row) => row.branchID).filter((id): id is number => id !== null)).size;
}

interface FeedbackRow {
  dispatchID: string;
  goodCondition: boolean;
  courteous: boolean;
  comment: string | null;
  submittedAt: string;
}

async function readFeedback(dispatchIDs: string[]): Promise<FeedbackRow[]> {
  if (dispatchIDs.length === 0) return [];

  return selectAllIn<FeedbackRow, string>(dispatchIDs, (chunk, from, to) =>
    supabase
      .from("DeliveryFeedback")
      .select("dispatchID, goodCondition, courteous, comment, submittedAt")
      .in("dispatchID", chunk)
      .order("submittedAt", { ascending: false })
      .range(from, to),
  );
}

/** The things that are shown but never scored, plus what clients wrote. */
async function gatherReported(trips: Trip[], countingLateness: boolean) {
  const codeOf = new Map(trips.map((trip) => [trip.dispatchID, trip.orderCode]));
  const scheduleOf = new Map(trips.map((trip) => [trip.dispatchID, trip.scheduledDate]));
  const dueAtOf = (stop: StopRow) =>
    expectedAt(stop.dispatchID ? scheduleOf.get(stop.dispatchID) : null, stop.expectedTime);
  const acceptedIDs = trips.filter((trip) => trip.accepted).map((trip) => trip.dispatchID);
  const allIDs = trips.map((trip) => trip.dispatchID);

  const [breakdowns, stalls, feedback, stops] = await Promise.all([
    allIDs.length === 0
      ? Promise.resolve([])
      : selectAllIn<{ dispatchID: string; issueType: string; reportedAt: string }, string>(
          allIDs,
          (chunk, from, to) =>
            supabase
              .from("FoulTripIncident")
              .select("dispatchID, issueType, reportedAt")
              .in("dispatchID", chunk)
              .range(from, to),
        ),
    allIDs.length === 0
      ? Promise.resolve([])
      : selectAllIn<{ entityID: string | null }, string>(allIDs, (chunk, from, to) =>
          supabase
            .from("Notification")
            .select("entityID")
            .eq("event", "TRUCK_STALLED")
            .in("entityID", chunk)
            .range(from, to),
        ),
    readFeedback(acceptedIDs),
    readStops(acceptedIDs),
  ]);

  const delivered = stops.filter((stop) => isStopDelivered(stop.stopStatus) && stop.completedAt);
  const excuses = await readExcuses(delivered.map((stop) => stop.branchID));
  const stopOf = new Map(delivered.map((stop) => [stop.branchID, stop]));

  const excusedStops: ExcusedNote[] = [...excuses.values()].map((excuse) => {
    const stop = stopOf.get(excuse.branchID);
    return {
      branchName: stop?.branchName ?? "Stop",
      reason: excuse.reason,
      notes: excuse.notes,
      minutesLate: stop ? minutesLate(dueAtOf(stop), stop.completedAt) : null,
      excusedAt: excuse.excusedAt,
    };
  });

  // Late and not put aside: the stops a coordinator might still excuse.
  const lateStops: LateStop[] = (countingLateness ? delivered : [])
    .map((stop) => {
      if (excuses.has(stop.branchID)) return null;

      const late = minutesLate(dueAtOf(stop), stop.completedAt);
      if (late === null || late <= ON_TIME_GRACE_MIN) return null;

      return {
        branchID: stop.branchID,
        branchName: stop.branchName ?? "Stop",
        orderCode: stop.dispatchID ? (codeOf.get(stop.dispatchID) ?? null) : null,
        minutesLate: Math.round(late),
        completedAt: stop.completedAt,
      };
    })
    .filter((stop): stop is LateStop => stop !== null)
    .sort((a, b) => b.minutesLate - a.minutesLate);

  return {
    reported: {
      lateStops,
      breakdowns: breakdowns.map((row) => ({
        orderCode: codeOf.get(row.dispatchID) ?? null,
        issueType: row.issueType,
        reportedAt: row.reportedAt,
      })),
      stallAlerts: stalls.length,
      declines: trips
        .filter((trip) => trip.declined)
        .map((trip) => ({ orderCode: trip.orderCode, reason: trip.declineReason, at: trip.declinedAt })),
      excusedStops,
    },
    comments: feedback
      .filter((row) => row.comment && row.comment.trim().length > 0)
      .map((row) => ({
        orderCode: codeOf.get(row.dispatchID) ?? null,
        comment: row.comment,
        goodCondition: row.goodCondition,
        courteous: row.courteous,
        submittedAt: row.submittedAt,
      })),
  };
}

