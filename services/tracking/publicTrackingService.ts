import { createHash } from "node:crypto";
import { supabase } from "@/app/lib/supabase";
import {
  ACCEPTED_ONWARDS,
  DELIVERY_STATUS,
  FINISHED_DELIVERY_STATUSES,
  HELPER_STATUS,
  ON_THE_ROAD_ONWARDS,
  STOP_STATUS,
  type DeliveryStatus,
} from "@/app/lib/enums";
import { formatDateTime, formatTime } from "@/app/lib/datetime";
import { getDispatchTrail, type TrailPoint } from "@/services/fleet/fleetTrackingService";
import { getDispatchRoute, type DispatchRoute } from "@/services/fleet/routePlanService";
import { maskEmail, maskPhone } from "@/app/lib/mask";
import { toArrivalLabel } from "@/services/geo/routingService";
import { getFeedbackInvitation, type FeedbackInvitation } from "@/services/feedback/deliveryFeedbackService";
import { liveDispatchOf } from "@/app/lib/bookingView";
import { FORMER_TRUCK_COLUMNS, truckOf, type FormerTruck } from "@/app/lib/formerTruck";

// Data behind the customer tracking link (Order.orderLinkToken). The link is a
// capability URL - anyone holding it can read this - so the payload is limited
// to what a customer needs to follow their delivery. In particular it never
// includes Order.notes, which carries internal crew and pricing remarks.

// How long a finished delivery stays visible before the link stops working.
const LINK_LIFETIME_AFTER_COMPLETION_MS = 7 * 24 * 60 * 60 * 1000;

const COMPLETED_STOP = /complete|delivered/i;
const FAILED_STOP = /foul|fail|cancel/i;

export type TrackingStage = "completed" | "current" | "upcoming" | "problem";

/** What a step is about, so a screen can mark it without reading its title. */
export type TrackingStepKind =
  | "booked"
  | "assigned"
  | "confirmed"
  | "collection"
  | "departed"
  | "stop"
  | "completed"
  | "problem"
  | "heldup";

export interface TrackingStep {
  title: string;
  detail: string;
  stage: TrackingStage;
  kind: TrackingStepKind;
  /** When it happened, for the entries that know. */
  at?: string | null;
}

// Which audit entry records each step of a delivery. The trail has kept these
// times all along; this page was written before it did, and said so in a
// comment that has outlived its truth.
const STEP_AUDIT_ACTIONS: Record<string, TrackingStepKind> = {
  CREATE: "booked",
  ASSIGN: "assigned",
  REASSIGN: "assigned",
  CREW_ACCEPT: "confirmed",
  TRIP_PROGRESS: "departed",
  TRIP_COMPLETE: "completed",
};

/**
 * When each step of this delivery happened, from the audit trail.
 *
 * Only the times are taken. The trail's own descriptions name staff and carry
 * internal reasons, and this page is a public link.
 *
 * The earliest entry wins for each step: a trip re-assigned twice was assigned
 * when it was first assigned.
 */
async function getStepTimes(orderID: string, dispatchIDs: string[]): Promise<Map<TrackingStepKind, string>> {
  const recordIDs = [orderID, ...dispatchIDs].filter(Boolean);
  const times = new Map<TrackingStepKind, string>();
  if (recordIDs.length === 0) return times;

  const { data, error } = await supabase
    .from("AuditTrail")
    .select("action, timestamp")
    .in("recordID", recordIDs)
    .order("timestamp", { ascending: true });

  if (error) {
    console.error("Could not read the delivery's history:", error.message);
    return times;
  }

  for (const row of data ?? []) {
    const kind = STEP_AUDIT_ACTIONS[row.action as string];
    if (!kind || !row.timestamp) continue;
    if (!times.has(kind)) times.set(kind, row.timestamp as string);
  }

  return times;
}

export interface TrackingStop {
  branchID: number;
  branchName: string;
  expectedTime: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  /** When the truck reached it and when it was signed for. */
  arrivedAt: string | null;
  deliveredAt: string | null;
  /** Who took delivery, from the proof recorded at the stop. */
  receivedBy: string | null;
}

/**
 * The collection the crew have to make before any of this can be delivered.
 *
 * Warehouses are otherwise kept off this page, and the reasoning held while the
 * only question it answered was "where is my delivery". It stopped holding for
 * "what happens next": a booking that collects at 9:14 PM and drops at 3:14 AM
 * had this page announce 3:14 AM as the next stop while the truck had not yet
 * been to the warehouse. The time was right about the delivery and wrong about
 * the truck, and the line above it said "Next stop" - which was the customer's
 * own branch, hours and one other stop away.
 *
 * So the collection is named here, and nothing else about it is: no address, no
 * contact, no quantity. The route drawn on the map already runs through it.
 */
export interface TrackingCollection {
  /** Where it is collected from, as the booking named it. */
  name: string;
  /** When it is due, already readable: "9:14 PM". Null when none was given. */
  expectedTime: string | null;
  /** Every collection on this booking is finished. */
  done: boolean;
  /** The crew are at a collection point now and have not finished there. */
  arrived: boolean;
  /** When the last one finished, for the timeline entry. */
  at: string | null;
}

export interface TrackingPayload {
  found: true;
  isExpired: boolean;
  orderNumber: string;
  clientName: string | null;
  /** The client's own details, partly hidden: anyone with the link sees this page. */
  clientEmail: string | null;
  clientContact: string | null;
  deliveryStatus: string;
  isCompleted: boolean;
  /**
   * The day the delivery is booked for, YYYY-MM-DD. The page showed only a
   * time, so a delivery booked for Friday read as though it were today's.
   */
  deliveryDate: string | null;
  /** When the truck is due at whatever it is driving to next. */
  estimatedArrival: string | null;
  /**
   * When this client's own delivery is due, whatever the truck is doing first.
   * Kept separate from estimatedArrival so the page can promise a collection
   * time without the customer reading it as their delivery time.
   */
  deliveryArrival: string | null;
  /** Live driving estimate to the next stop, when both positions are known. */
  liveEta: { minutes: number; distanceKm: number; arrivalTime: string } | null;
  nextStopName: string | null;
  /** Whether that next stop is this client's delivery or a collection first. */
  nextStopKind: "collection" | "delivery";
  plateNumber: string | null;
  truckModel: string | null;
  driverName: string | null;
  /** Masked - enough to recognise a call from, not enough to dial. */
  driverContact: string | null;
  /** The helpers coming with them, by name. Empty when there are none. */
  crewHelpers: string[];
  currentLocation: { latitude: number; longitude: number; updatedAt: string | null } | null;
  trail: TrailPoint[];
  /**
   * The road still to be driven, as [longitude, latitude] pairs. Safe to show
   * here: a trip carries one booking, so every stop on this route is this
   * client's own branch.
   */
  plannedRoute: [number, number][];
  stops: TrackingStop[];
  steps: TrackingStep[];
  /**
   * Whether to ask this client how it went, and what they have already said.
   * Only once the delivery is finished.
   */
  feedback: FeedbackInvitation;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTrackingToken(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// "14:30:00" -> "2:30 PM"
/**
 * A stop's promised time, as the customer reads it.
 *
 * Through the shared formatter. This used to be its own copy of the twelve-hour
 * conversion, so the same expectedTime was rendered by two different functions
 * on the same page - this one in the timeline text, the shared one in the stops
 * panel beside it. The copy also had no idea what to do with a full timestamp,
 * where it returned null and the promised time simply vanished off the page.
 *
 * Null rather than empty, because every caller here asks whether there is one.
 */
export function formatExpectedTime(value: string | null): string | null {
  return formatTime(value) || null;
}

function isStopDone(status: string | null): boolean {
  return COMPLETED_STOP.test(status ?? "");
}

interface TrackedPickup {
  warehouseName?: string | null;
  expectedTime?: string | null;
  stopStatus?: string | null;
  sequence?: number | null;
  arrivedAt?: string | null;
  completedAt?: string | null;
}

/**
 * The booking's collections, as the one thing the customer needs to know about
 * them: whether the truck still has to make one, and when.
 *
 * Several collections are reported as one step rather than a list. The customer
 * is not waiting at any of them, and which warehouse of three the crew are at
 * does not change anything they can do; that the order is not yet picked up
 * does. The one named is the one being driven to.
 */
export function buildCollection(rows: TrackedPickup[]): TrackingCollection | null {
  if (rows.length === 0) return null;

  const inOrder = [...rows].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const outstanding = inOrder.filter((row) => !isStopDone(row.stopStatus ?? null));
  // The one being driven to - or, once they are all made, the last of them.
  const current = outstanding[0] ?? inOrder[inOrder.length - 1];

  return {
    name: current.warehouseName?.trim() || "the collection point",
    expectedTime: formatExpectedTime(current.expectedTime ?? null),
    done: outstanding.length === 0,
    arrived: outstanding.length > 0 && Boolean(current.arrivedAt),
    at: latestOf(...inOrder.map((row) => row.completedAt ?? null)),
  };
}

// The customer-facing progress list. Timestamps per status change are not
// stored, so each step is described by its stage rather than a clock time.
/** The later of two times, ignoring the ones that are not there. */
function latestOf(...times: (string | null | undefined)[]): string | null {
  const known = times.filter((time): time is string => Boolean(time));
  if (known.length === 0) return null;
  return known.reduce((latest, time) => (new Date(time) > new Date(latest) ? time : latest));
}

/** When the last stop on this delivery was signed for. */
function lastDeliveredAt(stops: TrackingStop[]): string | null {
  return latestOf(...stops.map((stop) => stop.deliveredAt));
}

/**
 * Where the truck is going next, which is not always where this customer is.
 *
 * A booking is collected before it is delivered, so until that is done the
 * truck's next stop is a warehouse. This page used to answer "next stop" with
 * the customer's own branch regardless, and headline the time promised there:
 * on a run collecting at 9:14 PM and dropping at 3:14 AM, it named a stop the
 * truck had another stop to make before reaching, and a time six hours out, as
 * the next thing that would happen.
 *
 * The delivery time is not given up for it - it is the one thing the customer
 * came here for - it is carried alongside, so the page can say both without
 * either standing in for the other.
 */
export function nextStopAhead(
  collection: TrackingCollection | null,
  delivery: TrackingStop | null,
  isCompleted: boolean,
  /** The crew have reported reaching this customer's own stop. */
  atDelivery: boolean,
): {
  name: string | null;
  kind: "collection" | "delivery";
  /** When the truck is due wherever it is driving to now. */
  estimatedArrival: string | null;
  /** When this customer's own delivery is due, whatever comes before it. */
  deliveryArrival: string | null;
} {
  // Once the crew are standing at the stop, nothing counts down to it any more.
  // The page used to go back to announcing the booked time the moment the trip
  // left In Transit for Arrived, so a truck at the door read as three hours out.
  const deliveryArrival =
    isCompleted || atDelivery ? null : formatExpectedTime(delivery?.expectedTime ?? null);

  if (collection && !collection.done && !isCompleted) {
    return {
      name: collection.name,
      kind: "collection",
      estimatedArrival: collection.expectedTime,
      deliveryArrival,
    };
  }

  return {
    name: delivery?.branchName ?? null,
    kind: "delivery",
    estimatedArrival: deliveryArrival,
    deliveryArrival,
  };
}

export { buildSteps as buildTrackingSteps };

function buildSteps(
  dispatchStatus: string | null,
  stops: TrackingStop[],
  isCompleted: boolean,
  problems: ReportedProblem[] = [],
  times: Map<TrackingStepKind, string> = new Map(),
  minutesToNextStop: number | null = null,
  heldUp: HeldUp[] = [],
  pickupProgressAt: string | null = null,
  crew: CrewConfirmation | null = null,
  collection: TrackingCollection | null = null,
): TrackingStep[] {
  const hasDispatch = Boolean(dispatchStatus);
  // Named status lists, not literals. These used to be spelled out here, so
  // adding Arrived and In Warehouse to the system silently regressed this page:
  // a truck standing at the customer's own delivery point was reported to them
  // as "waiting for the driver to confirm" and "the trip has not started yet".
  const accepted = ACCEPTED_ONWARDS.includes(dispatchStatus ?? "");
  const inTransit = ON_THE_ROAD_ONWARDS.includes(dispatchStatus ?? "");
  const confirmation = crewConfirmationStep(crew, accepted, inTransit);
  const isFoulTrip = dispatchStatus === "Foul Trip";

  const steps: TrackingStep[] = [
    {
      title: "Booking confirmed",
      detail: "Your delivery has been booked.",
      stage: "completed",
      kind: "booked",
      at: times.get("booked") ?? null,
    },
    {
      title: "Crew and truck assigned",
      detail: hasDispatch ? "A driver and truck are assigned to this delivery." : "Waiting for a truck to be assigned.",
      stage: hasDispatch ? "completed" : "current",
      kind: "assigned",
      at: hasDispatch ? (times.get("assigned") ?? null) : null,
    },
    {
      // Every assignment has to be accepted before the truck may leave, so this
      // is about the crew and not only about the driver. It said "Driver
      // confirmed" off a status that only the driver can move, which left a
      // customer watching a step that would not budge with no way of knowing a
      // helper was what it was waiting on.
      title: "Crew confirmation",
      detail: confirmation.detail,
      stage: confirmation.done ? "completed" : hasDispatch ? "current" : "upcoming",
      kind: "confirmed",
      at: confirmation.done ? (times.get("confirmed") ?? null) : null,
    },
    {
      title: "On the road",
      detail: inTransit ? "The truck has departed and is on its way." : "The trip has not started yet.",
      stage: inTransit ? "completed" : accepted ? "current" : "upcoming",
      kind: "departed",
      at: inTransit ? (times.get("departed") ?? null) : null,
    },
  ];

  let markedCurrent = false;

  // Before any of the customer's own stops, because the truck gets there first.
  //
  // Without it the ladder went from "On the road" straight to "Delivery to your
  // branch", so an overnight run - collect at 9:14 PM, drop at 3:14 AM - read
  // as though the only thing between the truck and the customer was the drive.
  if (collection) {
    const current = !collection.done && (collection.arrived || inTransit);
    if (current) markedCurrent = true;

    steps.push({
      title: collection.done ? `Collected from ${collection.name}` : `Collection from ${collection.name}`,
      detail: collection.done
        ? "Your order has been picked up."
        : collection.arrived
          ? "Our crew are collecting your order now."
          : collection.expectedTime
            ? `${inTransit ? "On the way to collect it." : "Not collected yet."} Expected by ${collection.expectedTime}.`
            : inTransit
              ? "On the way to collect it."
              : "Not collected yet.",
      stage: collection.done ? "completed" : current ? "current" : "upcoming",
      kind: "collection",
      at: collection.done ? collection.at : null,
    });
  }

  for (const stop of stops) {
    const done = isStopDone(stop.status);
    let stage: TrackingStage = "upcoming";

    if (done) {
      stage = "completed";
    } else if (inTransit && !markedCurrent) {
      stage = "current";
      markedCurrent = true;
    }

    const expected = formatExpectedTime(stop.expectedTime);
    const delivered = stop.receivedBy ? `Delivered, received by ${stop.receivedBy}` : "Delivered";

    // Only the stop being driven to can say how far away it is; the ones after
    // it depend on how long this one takes.
    const away =
      stage === "current" && minutesToNextStop !== null ? ` About ${minutesToNextStop} min away.` : "";

    // The crew have reported reaching this stop and have not finished it yet.
    //
    // Worth its own words, because "on the way" and "here, unloading" are
    // different things to a customer waiting on a delivery - and until the crew
    // began reporting arrivals this could not be said: arrivedAt was written as a
    // copy of the completion time, so it only ever existed on stops already done.
    const arrivedNotDone = !done && Boolean(stop.arrivedAt);

    steps.push({
      title: arrivedNotDone ? `Arrived at ${stop.branchName}` : `Delivery to ${stop.branchName}`,
      detail: done
        ? `${delivered}.`
        : arrivedNotDone
          ? "Our crew are at the stop now."
          : stage === "current" && expected
            ? `On the way. Expected by ${expected}.${away}`
            : stage === "current"
              ? `On the way.${away}`
              : expected
                ? `Expected by ${expected}.`
                : "Scheduled.",
      stage,
      kind: "stop",
      at: stop.deliveredAt ?? (arrivedNotDone ? stop.arrivedAt : null),
    });
  }

  // Why the delivery is running late, when the crew have said so. Not a problem
  // and not drawn as one: an ordinary hold-up on an ordinary delivery, which is
  // the thing a customer refreshing this page actually wants to know. Nothing
  // here is shown once the delivery is done - by then it is only an excuse.
  //
  // And only while it is still true. A hold-up was appended after every stop
  // and never expired, so "Held up in traffic" sat at the bottom of the
  // timeline as the newest thing that had happened - after the crew had
  // reached the stop, unloaded it and driven on. Tapping "I have arrived" is
  // the crew saying the traffic is behind them, and the page went on saying
  // otherwise for the rest of the delivery.
  //
  // Progress at a pickup counts too, though warehouses are not shown here: a
  // crew who were stuck on the way to one and have since reached it are no
  // longer stuck, whatever the customer's own stops say.
  const progressAt = latestOf(
    pickupProgressAt,
    ...stops.map((stop) => stop.arrivedAt),
    ...stops.map((stop) => stop.deliveredAt),
  );

  // Collected rather than appended, and put back in time order below. Appending
  // them after every stop meant a problem resolved at 7:18 sat underneath an
  // arrival at 7:19 and read as the newer of the two - and the page picks its
  // "Latest" card by reading the list from the bottom.
  const interjections: TrackingStep[] = [];

  if (!isCompleted) {
    for (const update of [...heldUp].reverse()) {
      if (progressAt && new Date(update.at) <= new Date(progressAt)) continue;
      interjections.push({
        title: update.wording,
        detail: "The delivery is carrying on.",
        stage: "current",
        kind: "heldup",
        at: update.at,
      });
    }
  }

  // What the crew reported. One that stopped the trip is the reason it is
  // interrupted; one they carried on through is worth saying so plainly.
  for (const problem of [...problems].reverse()) {
    // One that has been sorted is no longer a problem, and is not shown as
    // one. It stays on the timeline, because it happened and the customer was
    // already told about it - disappearing would read worse than resolving.
    const sorted = !problem.blocking && problem.resolvedAt !== null;

    interjections.push({
      title: sorted
        ? `Resolved: ${problem.issueType}`
        : problem.blocking
          ? `Trip interrupted: ${problem.issueType}`
          : `Reported: ${problem.issueType}`,
      detail: sorted
        ? "The crew sorted this out and the delivery carried on."
        : problem.blocking
          ? "Our coordinator is arranging what happens next."
          : "The delivery is carrying on.",
      stage: sorted ? "completed" : "problem",
      kind: sorted ? "completed" : "problem",
      at: sorted ? problem.resolvedAt : problem.reportedAt,
    });
  }

  // Back into the timeline where each of them happened: after the last thing
  // already on it that is no later. A step with no time yet is something still
  // to come, so anything that has actually happened belongs above it.
  for (const step of interjections) {
    const at = step.at ? new Date(step.at).getTime() : Number.MAX_SAFE_INTEGER;
    let index = steps.length;
    while (index > 0) {
      const previous = steps[index - 1].at;
      if (previous && new Date(previous).getTime() <= at) break;
      index -= 1;
    }
    steps.splice(index, 0, step);
  }

  // A reported problem above already says the trip stopped, and why.
  const saidWhy = isFoulTrip && problems.some((problem) => problem.blocking);
  if (!saidWhy) {
    steps.push({
      title: isFoulTrip ? "Trip interrupted" : "Delivery completed",
      detail: isFoulTrip
        ? "This trip was interrupted. Our coordinator will contact you."
        : isCompleted
          ? "All stops have been delivered."
          : "Pending completion of all stops.",
      stage: isCompleted || isFoulTrip ? "completed" : "upcoming",
      kind: isFoulTrip ? "problem" : "completed",
      at: isCompleted ? latestOf(times.get("completed"), lastDeliveredAt(stops)) : null,
    });
  }

  return steps;
}

/**
 * What the crew tapped when the app asked why they had gone quiet, in words a
 * customer should see.
 *
 * Only the four that are ordinary delays. "The truck has a problem" and "I need
 * help" are a call to the office, not an update for the customer - those travel
 * as an incident, if the office decides they should, and saying "the crew have
 * asked for help" on a tracking page would frighten somebody with a version of
 * events nobody has confirmed yet.
 *
 * A break is deliberately not "the driver is eating". It is lawful, required by
 * Article 85, and wording it plainly invites a complaint about something nobody
 * is allowed to skip.
 */
const HELD_UP_WORDING: Record<string, string> = {
  traffic: "Held up in traffic",
  waiting: "Waiting to be received",
  loading: "Loading at a stop",
  on_break: "Paused on a scheduled break",
};

/**
 * The last time the crew said where they were at a collection point.
 *
 * Warehouses are not on the customer's timeline - it is their delivery they
 * are watching, not our loading - but reaching one is still the crew reporting
 * progress, and it is what ends a hold-up on the way to it.
 */
async function lastPickupProgress(dispatchID: string | null): Promise<string | null> {
  if (!dispatchID) return null;

  const { data, error } = await supabase
    .from("PickupStops")
    .select("arrivedAt, completedAt")
    .eq("dispatchID", dispatchID);

  if (error) {
    console.error("[Tracking] Could not read the pickup progress:", error.message);
    return null;
  }

  return latestOf(
    ...(data ?? []).flatMap((row) => [row.arrivedAt as string | null, row.completedAt as string | null]),
  );
}

/**
 * How far the crew's own confirmations have got.
 *
 * The step used to be "Driver confirmed", worded off the dispatch status alone
 * - which only ever moves when the driver accepts. A helper who had not
 * answered was invisible here, so the page could say the trip was confirmed
 * while it could not legally start, and the customer had no idea what was
 * being waited on.
 *
 * Counts, never names. This is a public link: the driver is named in the
 * booking details because the customer has to be able to recognise whoever
 * turns up, and nobody else on the crew needs naming to a stranger.
 */
export interface CrewConfirmation {
  driverAccepted: boolean;
  helpers: number;
  helpersAccepted: number;
  helpersDeclined: number;
}

/** "helper" or "helpers", for a sentence that has to read either way. */
function helperWord(count: number): string {
  return count === 1 ? "helper" : "helpers";
}

/** And the verb to go with it, so one helper does not "have confirmed". */
function helperVerb(count: number): string {
  return count === 1 ? "has" : "have";
}

/**
 * What to say about the crew's confirmations, and whether they are all in.
 *
 * onTheRoad settles it either way: a trip that has departed was confirmed by
 * everybody it needed, and a stale helper row left behind by an office that
 * replaced somebody must not leave this step hanging for the whole delivery.
 */
function crewConfirmationStep(
  crew: CrewConfirmation | null,
  driverAccepted: boolean,
  onTheRoad: boolean,
): { done: boolean; detail: string } {
  if (!crew) {
    // An older payload with nothing to go on: the dispatch status is all there
    // ever was, and it is what this page used before.
    return {
      done: driverAccepted,
      detail: driverAccepted
        ? "Your crew have confirmed this trip."
        : "Waiting for your crew to confirm.",
    };
  }

  const pending = Math.max(0, crew.helpers - crew.helpersAccepted - crew.helpersDeclined);
  const allIn = crew.driverAccepted && pending === 0 && crew.helpersDeclined === 0;

  if (onTheRoad || allIn) {
    return {
      done: true,
      detail:
        crew.helpers > 0
          ? `Your driver and ${helperWord(crew.helpers)} have confirmed this trip.`
          : "Your driver has confirmed this trip.",
    };
  }

  if (crew.helpersDeclined > 0) {
    return {
      done: false,
      detail: "Someone on the crew turned this down. Your coordinator is arranging a replacement.",
    };
  }

  if (crew.driverAccepted) {
    return {
      done: false,
      detail: `Your driver has confirmed. Waiting for the ${helperWord(pending)} to confirm.`,
    };
  }

  if (crew.helpersAccepted > 0) {
    return {
      done: false,
      detail:
        `The ${helperWord(crew.helpersAccepted)} ${helperVerb(crew.helpersAccepted)} confirmed. ` +
        `Waiting for the driver to confirm.`,
    };
  }

  return { done: false, detail: "Waiting for your crew to confirm." };
}

interface HeldUp {
  wording: string;
  at: string;
}

/**
 * The crew's check-ins for this trip, newest first, one per kind.
 *
 * Deduplicated because a long jam produces a tap every time the alarm comes
 * back round, and a customer does not want "Held up in traffic" five times.
 */
async function heldUpUpdates(dispatchID: string | null): Promise<HeldUp[]> {
  if (!dispatchID) return [];

  const { data, error } = await supabase
    .from("StallCheckIn")
    .select("state, createdAt")
    .eq("dispatchID", dispatchID)
    .order("createdAt", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[Tracking] Could not read the crew check-ins:", error.message);
    return [];
  }

  const seen = new Set<string>();
  const updates: HeldUp[] = [];

  for (const row of data ?? []) {
    const state = row.state as string;
    const wording = HELD_UP_WORDING[state];
    if (!wording || seen.has(state)) continue;
    seen.add(state);
    updates.push({ wording, at: row.createdAt as string });
  }

  return updates;
}

interface ReportedProblem {
  issueType: string;
  reportedAt: string;
  blocking: boolean;
  /** When the crew or the office said it was sorted, if they have. */
  resolvedAt: string | null;
}

/**
 * What went wrong on this delivery, as the customer may see it: the kind of
 * problem and when, never the crew's notes, the location or the photograph.
 */
async function reportedProblems(orderID: string): Promise<ReportedProblem[]> {
  const { data, error } = await supabase
    .from("FoulTripIncident")
    .select("issueType, reportedAt, blocking, status, resolvedAt")
    .eq("orderID", orderID)
    .order("reportedAt", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[Tracking] Could not read what was reported:", error.message);
    return [];
  }

  // status was selected and thrown away, so a problem the crew had already
  // sorted out went on being shown to the customer as an open one for the rest
  // of the delivery - and the longer it stayed there the worse it read.
  return (data ?? []).map((row) => ({
    issueType: (row.issueType as string) ?? "A problem",
    reportedAt: row.reportedAt as string,
    blocking: row.blocking !== false,
    resolvedAt:
      row.status === "resolved" || row.status === "closed"
        ? ((row.resolvedAt as string | null) ?? (row.reportedAt as string))
        : null,
  }));
}


// What this page reads off a trip, from the select above it.
interface TrackedDispatch extends FormerTruck {
  dispatchID?: string;
  status?: string | null;
  completedAt?: string | null;
  current_step?: number | null;
  dispatchNote?: string | null;
  partnerDriver?: string | null;
  partnerPlate?: string | null;
  subConID?: string | null;
  SubContractor?: { companyName?: string | null } | null;
  Truck?: { plateNumber?: string | null; model?: string | null } | null;
  Employee?: { employeeName?: string | null; contact?: string | null } | null;
  /**
   * Who is coming, and whether they have accepted.
   *
   * The name is for the customer to recognise whoever gets out of the truck,
   * which is the same reason the driver is named. No contact number: the driver
   * is the one to ring, and a second number on a public page is a second number
   * on a public page.
   */
  DispatchHelper?: { status?: string | null; Helper?: { employeeName?: string | null } | { employeeName?: string | null }[] | null }[] | null;
}

interface TrackedStop {
  branchID: number;
  branchName?: string | null;
  expectedTime?: string | null;
  stopStatus?: string | null;
  deliveryLat?: number | null;
  deliverLong?: number | null;
  arrivedAt?: string | null;
  completedAt?: string | null;
  POD?: { receiverName: string | null; deliveredAt: string | null }[] | null;
}

/**
 * Minutes of driving from where the truck is to one particular stop, by adding
 * up the legs of the planned route until that stop is reached.
 *
 * Null when the route does not visit it - a stop with no coordinates is left
 * out of the route entirely, and an ETA for a stop nobody is driving to would
 * be an invention.
 */
export function legsUpTo(route: DispatchRoute, branchID: number): number | null {
  // The first waypoint is the truck itself; the legs run between waypoints, so
  // leg i ends at waypoint i + 1.
  const target = route.waypoints.findIndex((point) => point.branchID === branchID);
  if (target < 1) return null;

  let minutes = 0;
  for (let leg = 0; leg < target; leg++) {
    minutes += route.legMinutes[leg] ?? 0;
  }
  return minutes > 0 ? minutes : null;
}

export async function getTrackingByToken(
  token: string,
): Promise<
  | TrackingPayload
  | { found: false }
  // Why the page has nothing to show: the delivery was cancelled, or it
  // finished long enough ago that tracking has ended.
  | { found: true; isExpired: true; reason: "cancelled" | "ended" }
> {
  const { data: order, error } = await supabase
    .from("Order")
    .select(
      `orderID, orderCode, createdAt, isActive, notes,
       Client ( company, emailAdd, contact ),
       BranchStops ( branchID, branchName, expectedTime, stopStatus, deliveryLat, deliverLong, arrivedAt, completedAt,
         POD ( receiverName, deliveredAt ) ),
       PickupStops ( pickupID, warehouseName, expectedTime, stopStatus, sequence, arrivedAt, completedAt ),
       FoulTripIncident ( dispatchID, status ),
       DispatchOrder ( dispatchID, status, completedAt, subConID, partnerDriver, partnerPlate, ${FORMER_TRUCK_COLUMNS},
         Truck ( plateNumber, model ),
         Employee!DispatchOrder_driverID_fkey ( employeeName, contact ),
         DispatchHelper ( status, Helper:Employee!helperID ( employeeName ) ) )`,
    )
    .eq("orderLinkToken", token)
    .maybeSingle();

  if (error) throw new Error(`Supabase tracking error: ${error.message}`);
  if (!order) return { found: false };

  const dispatches = (
    Array.isArray(order.DispatchOrder) ? order.DispatchOrder : [order.DispatchOrder]
  ).filter(Boolean) as TrackedDispatch[];

  // The trip the booking is on now, by the rule every other screen uses: the
  // one still open, else the latest. This took the last one the query happened
  // to return, which for a booking with a declined or broken-down trip could be
  // the old one.
  //
  // A trip the crew declined is not one the customer is waiting on. With no
  // replacement yet, the booking is waiting for a crew - it used to say "Crew
  // assigned" about a crew who had said no.
  const live = liveDispatchOf(dispatches);
  const dispatch = live && live.status !== DELIVERY_STATUS.rejected ? live : null;

  const completedAt = dispatch?.completedAt ? new Date(dispatch.completedAt).getTime() : null;
  const expiredByAge = completedAt !== null && Date.now() - completedAt > LINK_LIFETIME_AFTER_COMPLETION_MS;

  // A cancelled booking used to land on "this link has expired", which tells
  // the customer nothing about their delivery. Both ways a booking becomes
  // inactive are cancellations, and the page now says so.
  if (order.isActive === false || dispatch?.status === DELIVERY_STATUS.cancelled) {
    return { found: true, isExpired: true, reason: "cancelled" };
  }
  if (expiredByAge) {
    return { found: true, isExpired: true, reason: "ended" };
  }

  const stops: TrackingStop[] = ((order.BranchStops as TrackedStop[] | null) ?? [])
    .map((stop) => {
      const proof = ((stop.POD as { receiverName: string | null; deliveredAt: string | null }[] | null) ?? [])[0] ?? null;
      return {
        branchID: stop.branchID,
        branchName: stop.branchName ?? "Stop",
        expectedTime: stop.expectedTime ?? null,
        status: stop.stopStatus ?? STOP_STATUS.pending,
        // 0/0 is the placeholder written when a stop has no geocoded position.
        latitude: Number(stop.deliveryLat) || null,
        longitude: Number(stop.deliverLong) || null,
        arrivedAt: stop.arrivedAt ?? null,
        deliveredAt: proof?.deliveredAt ?? stop.completedAt ?? null,
        // The name on the receipt, never the receipt itself: it carries a
        // signature and whatever else the crew photographed.
        receivedBy: proof?.receiverName && proof.receiverName !== "N/A" ? proof.receiverName : null,
      };
    })
    .sort((a, b) => a.branchID - b.branchID);

  // Finished, for the client, once the last delivery address is - not when the
  // truck is back at base. The drive home is the company's business, and the
  // page used to keep telling a customer holding their goods that the delivery
  // was still on its way. A breakdown on that drive home does not undo it.
  const deliveriesDone = stops.length > 0 && stops.every((stop) => isStopDone(stop.status));
  const isCompleted =
    FINISHED_DELIVERY_STATUSES.includes(dispatch?.status as DeliveryStatus) || (Boolean(dispatch) && deliveriesDone);
  // What the rest of the page reads the trip as: complete, once it is complete.
  const tripStatus = isCompleted ? DELIVERY_STATUS.completed : (dispatch?.status ?? null);

  // Everything else is read at once rather than one after another: these do
  // not depend on each other, and in a row they made every refresh wait on
  // eight round trips to the database.
  const dispatchID = dispatch?.dispatchID ?? null;
  const [trail, stepTimes, planned, location, problems, heldUp, pickupProgressAt, feedback] = await Promise.all([
    // The route driven so far, for drawing the line on the map.
    dispatchID ? getDispatchTrail(dispatchID) : Promise.resolve([] as TrailPoint[]),
    // When each step of this delivery actually happened.
    getStepTimes(
      order.orderID as string,
      dispatches.map((trip) => trip.dispatchID).filter((id): id is string => Boolean(id)),
    ),
    dispatchID ? getDispatchRoute(dispatchID) : Promise.resolve(null),
    dispatchID && !isCompleted
      ? supabase
          .from("FleetLocations")
          .select("latitude, longitude, updated_at")
          .eq("dispatch_id", dispatchID)
          .maybeSingle()
          .then(({ data }) => data)
      : Promise.resolve(null),
    reportedProblems(order.orderID),
    heldUpUpdates(dispatchID),
    lastPickupProgress(dispatchID),
    getFeedbackInvitation(dispatchID, tripStatus),
  ]);

  const currentLocation: TrackingPayload["currentLocation"] = location
    ? { latitude: location.latitude, longitude: location.longitude, updatedAt: location.updated_at ?? null }
    : null;

  const truck = truckOf(dispatch);
  const driver = first(dispatch?.Employee);
  const client = first(order.Client as { company?: string | null; emailAdd?: string | null; contact?: string | null } | null);

  const nextStop = stops.find((stop) => !isStopDone(stop.status));
  const collection = buildCollection((order.PickupStops as TrackedPickup[] | null) ?? []);

  // The crew have reported reaching this customer's own stop.
  //
  // Everything below that counts down to it has to stop counting. The headline
  // took the live estimate while the trip said In Transit and the booked time
  // otherwise - so the moment the crew tapped "I have arrived" the status left
  // In Transit, the estimate vanished, and the page went back to announcing the
  // booked time. A truck standing at the door was reported as arriving in three
  // hours, above a timeline saying the crew were at the stop now.
  const atNextStop = Boolean(nextStop?.arrivedAt);
  const ahead = nextStopAhead(collection, nextStop ?? null, isCompleted, atNextStop);

  // Driving time to this client's stop, read off the route already worked out
  // above rather than asked for separately.
  //
  // It used to be its own Directions request - a straight truck-to-stop
  // estimate, made on every poll of every viewer, thirty seconds apart. That
  // was both the larger half of the bill and the less accurate answer: it
  // ignored everything the truck had to do on the way, so a delivery with two
  // drops ahead of it announced a time it could not make. Summing the legs up
  // to the stop counts them.
  let liveEta: TrackingPayload["liveEta"] = null;
  if (
    !atNextStop &&
    ON_THE_ROAD_ONWARDS.includes(dispatch?.status ?? "") &&
    planned &&
    nextStop?.branchID != null
  ) {
    const legsToStop = legsUpTo(planned, nextStop.branchID);

    if (legsToStop !== null) {
      const minutes = Math.max(1, legsToStop);
      liveEta = {
        minutes,
        distanceKm: planned.distanceKm,
        arrivalTime: toArrivalLabel(minutes),
      };
    }
  }

  let deliveryStatus = "Awaiting dispatch";
  if (isCompleted) deliveryStatus = "Delivery completed";
  else if (dispatch?.status === DELIVERY_STATUS.foulTrip) {
    // What is being done about it, without any of the incident's details:
    // this page is public.
    // A trip can have several incidents (repaired, then broke down again);
    // the open one is what is happening now.
    const incidents = ((order.FoulTripIncident ?? []) as { dispatchID: string; status: string }[]).filter(
      (i) => i.dispatchID === dispatch.dispatchID,
    );
    const incident =
      incidents.find((i) => i.status === "open" || i.status === "mechanic_assigned") ?? incidents[0];
    deliveryStatus =
      incident?.status === "mechanic_assigned"
        ? "Delayed: roadside repair under way"
        : incident?.status === "open"
          ? "Delayed: arranging a replacement truck"
          : "Trip interrupted";
  }
  // A partner carrier has no app, so there is no live position to show.
  else if (dispatch?.subConID && dispatch.status === DELIVERY_STATUS.inTransit) deliveryStatus = "In transit with our partner carrier";
  else if (dispatch?.subConID) deliveryStatus = "Handed to our partner carrier";
  // Their stop, not any stop. A trip is "Arrived" at a warehouse as readily as
  // at a delivery point, and telling this customer their crew had arrived while
  // the truck was at ours would be worse than saying nothing.
  else if (atNextStop) deliveryStatus = "Crew at your stop";
  else if (ON_THE_ROAD_ONWARDS.includes(dispatch?.status ?? "")) deliveryStatus = "In transit";
  else if (dispatch?.status === DELIVERY_STATUS.accepted) deliveryStatus = "Driver confirmed";
  else if (dispatch?.status) deliveryStatus = "Crew assigned";

  // How far the crew's confirmations have got, in counts rather than names.
  const helperRows = Array.isArray(dispatch?.DispatchHelper) ? dispatch.DispatchHelper : [];
  const crewConfirmation: CrewConfirmation | null = dispatch
    ? {
        driverAccepted: ACCEPTED_ONWARDS.includes(dispatch.status ?? ""),
        helpers: helperRows.length,
        helpersAccepted: helperRows.filter((row) => row.status === HELPER_STATUS.accepted).length,
        helpersDeclined: helperRows.filter((row) => row.status === HELPER_STATUS.declined).length,
      }
    : null;

  // Who else is on the truck. A helper who declined is not coming, so they are
  // not named to somebody waiting for them to arrive.
  const crewHelpers = helperRows
    .filter((row) => row.status !== HELPER_STATUS.declined)
    .map((row) => {
      const helper = Array.isArray(row.Helper) ? row.Helper[0] : row.Helper;
      return helper?.employeeName?.trim() ?? "";
    })
    .filter(Boolean);

  const failedStops = stops.some((stop) => FAILED_STOP.test(stop.status));

  return {
    found: true,
    isExpired: false,
    orderNumber: order.orderCode,
    clientName: client?.company ?? null,
    clientEmail: maskEmail(client?.emailAdd),
    clientContact: maskPhone(client?.contact),
    deliveryStatus,
    isCompleted,
    deliveryDate: /Delivery Schedule:\s*(\d{4}-\d{2}-\d{2})/.exec((order.notes as string | null) ?? "")?.[1] ?? null,
    estimatedArrival: ahead.estimatedArrival,
    deliveryArrival: ahead.deliveryArrival,
    liveEta,
    nextStopName: ahead.name,
    nextStopKind: ahead.kind,
    plateNumber: truck?.plateNumber ?? dispatch?.partnerPlate ?? null,
    truckModel: truck?.model ?? null,
    driverName: driver?.employeeName ?? dispatch?.partnerDriver ?? null,
    // Masked like the client's own: the link reaches whoever it is forwarded
    // to, and a driver's personal number is not the client's to pass on.
    driverContact: maskPhone(driver?.contact),
    crewHelpers,
    currentLocation,
    trail,
    plannedRoute: planned?.path ?? [],
    stops,
    feedback,
    steps: buildSteps(
      tripStatus,
      stops,
      isCompleted || failedStops,
      problems,
      stepTimes,
      liveEta?.minutes ?? null,
      heldUp,
      pickupProgressAt,
      crewConfirmation,
      collection,
    ),
  };
}

/**
 * A short fingerprint of everything the tracking page shows, so an open page
 * can ask "has anything changed?" every few seconds without being sent the
 * whole delivery each time.
 *
 * The full payload is about ten reads - the route, the GPS trail, the audit
 * trail, the check-ins - and it was fetched every thirty seconds whether
 * anything had moved or not, which is why a customer could wait half a minute
 * to see "Crew at your stop". This is three reads, run together: the booking
 * with its stops and trips, the truck's last GPS fix, and the crew's last
 * check-in. Anything the page shows changes one of them.
 *
 * Returns null for a link that does not exist.
 */
export async function getTrackingVersion(token: string): Promise<string | null> {
  const { data: order, error } = await supabase
    .from("Order")
    .select(
      `orderID, isActive,
       BranchStops ( branchID, stopStatus, arrivedAt, completedAt, POD ( receiverName, deliveredAt ) ),
       PickupStops ( pickupID, stopStatus, arrivedAt, completedAt ),
       FoulTripIncident ( dispatchID, status, resolvedAt ),
       DispatchOrder ( dispatchID, status, completedAt, truckID, driverID, subConID, partnerDriver, partnerPlate,
         DispatchHelper ( helperID, status ) )`,
    )
    .eq("orderLinkToken", token)
    .maybeSingle();

  if (error) throw new Error(`Supabase tracking version error: ${error.message}`);
  if (!order) return null;

  const dispatches = (
    Array.isArray(order.DispatchOrder) ? order.DispatchOrder : [order.DispatchOrder]
  ).filter(Boolean) as TrackedDispatch[];
  const live = liveDispatchOf(dispatches);
  const dispatchID = live?.dispatchID ?? null;

  const [location, checkIn] = dispatchID
    ? await Promise.all([
        supabase.from("FleetLocations").select("updated_at").eq("dispatch_id", dispatchID).maybeSingle(),
        supabase
          .from("StallCheckIn")
          .select("createdAt")
          .eq("dispatchID", dispatchID)
          .order("createdAt", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [null, null];

  const fingerprint = JSON.stringify([order, location?.data?.updated_at ?? null, checkIn?.data?.createdAt ?? null]);
  return createHash("sha1").update(fingerprint).digest("base64url").slice(0, 16);
}
