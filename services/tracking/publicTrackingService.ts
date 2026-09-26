import { supabase } from "@/app/lib/supabase";
import { DELIVERY_STATUS, STOP_STATUS } from "@/app/lib/enums";
import { formatDateTime } from "@/app/lib/datetime";
import { getDispatchTrail, type TrailPoint } from "@/services/fleet/fleetTrackingService";
import { getDispatchRoute } from "@/services/fleet/routePlanService";
import { maskEmail, maskPhone } from "@/app/lib/mask";
import { getTravelEstimate, toArrivalLabel } from "@/services/geo/routingService";

// Data behind the customer tracking link (Order.orderLinkToken). The link is a
// capability URL - anyone holding it can read this - so the payload is limited
// to what a customer needs to follow their delivery. In particular it never
// includes Order.notes, which carries internal crew and pricing remarks.

// How long a finished delivery stays visible before the link stops working.
const LINK_LIFETIME_AFTER_COMPLETION_MS = 7 * 24 * 60 * 60 * 1000;

const COMPLETED_STOP = /complete|delivered/i;
const FAILED_STOP = /foul|fail|cancel/i;

export type TrackingStage = "completed" | "current" | "upcoming" | "problem";

export interface TrackingStep {
  title: string;
  detail: string;
  stage: TrackingStage;
  /** When it happened, for the entries that know. */
  at?: string | null;
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
  estimatedArrival: string | null;
  /** Live driving estimate to the next stop, when both positions are known. */
  liveEta: { minutes: number; distanceKm: number; arrivalTime: string } | null;
  nextStopName: string | null;
  plateNumber: string | null;
  truckModel: string | null;
  driverName: string | null;
  driverContact: string | null;
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
export function formatExpectedTime(value: string | null): string | null {
  if (!value) return null;
  const [hourPart, minutePart] = value.split(":");
  const hour = Number(hourPart);
  if (Number.isNaN(hour)) return null;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minutePart ?? "00"} ${suffix}`;
}

function isStopDone(status: string | null): boolean {
  return COMPLETED_STOP.test(status ?? "");
}

// The customer-facing progress list. Timestamps per status change are not
// stored, so each step is described by its stage rather than a clock time.
function buildSteps(
  dispatchStatus: string | null,
  stops: TrackingStop[],
  isCompleted: boolean,
  problems: ReportedProblem[] = [],
): TrackingStep[] {
  const hasDispatch = Boolean(dispatchStatus);
  const accepted = ["Accepted", "In Transit", "Completed"].includes(dispatchStatus ?? "");
  const inTransit = ["In Transit", "Completed"].includes(dispatchStatus ?? "");
  const isFoulTrip = dispatchStatus === "Foul Trip";

  const steps: TrackingStep[] = [
    { title: "Booking confirmed", detail: "Your delivery has been booked.", stage: "completed" },
    {
      title: "Crew and truck assigned",
      detail: hasDispatch ? "A driver and truck are assigned to this delivery." : "Waiting for a truck to be assigned.",
      stage: hasDispatch ? "completed" : "current",
    },
    {
      title: "Driver confirmed",
      detail: accepted ? "The driver accepted this trip." : "Waiting for the driver to confirm.",
      stage: accepted ? "completed" : hasDispatch ? "current" : "upcoming",
    },
    {
      title: "On the road",
      detail: inTransit ? "The truck has departed and is on its way." : "The trip has not started yet.",
      stage: inTransit ? "completed" : accepted ? "current" : "upcoming",
    },
  ];

  let markedCurrent = false;
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
    const delivered = stop.deliveredAt
      ? [`Delivered ${formatDateTime(stop.deliveredAt)}`, stop.receivedBy ? `received by ${stop.receivedBy}` : null]
          .filter(Boolean)
          .join(", ")
      : null;

    steps.push({
      title: `Delivery to ${stop.branchName}`,
      detail: done
        ? `${delivered ?? "Delivered"}.`
        : stage === "current" && expected
          ? `On the way. Expected by ${expected}.`
          : expected
            ? `Expected by ${expected}.`
            : "Scheduled.",
      stage,
      at: stop.deliveredAt ?? null,
    });
  }

  // What the crew reported. One that stopped the trip is the reason it is
  // interrupted; one they carried on through is worth saying so plainly.
  for (const problem of [...problems].reverse()) {
    steps.push({
      title: problem.blocking ? `Trip interrupted: ${problem.issueType}` : `Reported: ${problem.issueType}`,
      detail: problem.blocking
        ? "Our coordinator is arranging what happens next."
        : "The delivery is carrying on.",
      stage: "problem",
      at: problem.reportedAt,
    });
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
    });
  }

  return steps;
}

interface ReportedProblem {
  issueType: string;
  reportedAt: string;
  blocking: boolean;
}

/**
 * What went wrong on this delivery, as the customer may see it: the kind of
 * problem and when, never the crew's notes, the location or the photograph.
 */
async function reportedProblems(orderID: string): Promise<ReportedProblem[]> {
  const { data, error } = await supabase
    .from("FoulTripIncident")
    .select("issueType, reportedAt, blocking, status")
    .eq("orderID", orderID)
    .order("reportedAt", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[Tracking] Could not read what was reported:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    issueType: (row.issueType as string) ?? "A problem",
    reportedAt: row.reportedAt as string,
    blocking: row.blocking !== false,
  }));
}


// What this page reads off a trip, from the select above it.
interface TrackedDispatch {
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

export async function getTrackingByToken(
  token: string,
): Promise<TrackingPayload | { found: false } | { found: true; isExpired: true }> {
  const { data: order, error } = await supabase
    .from("Order")
    .select(
      `orderID, orderCode, createdAt, isActive,
       Client ( company, emailAdd, contact ),
       BranchStops ( branchID, branchName, expectedTime, stopStatus, deliveryLat, deliverLong, arrivedAt, completedAt,
         POD ( receiverName, deliveredAt ) ),
       FoulTripIncident ( dispatchID, status ),
       DispatchOrder ( dispatchID, status, completedAt, subConID, partnerDriver, partnerPlate,
         Truck ( plateNumber, model ),
         Employee!DispatchOrder_driverID_fkey ( employeeName, contact ) )`,
    )
    .eq("orderLinkToken", token)
    .maybeSingle();

  if (error) throw new Error(`Supabase tracking error: ${error.message}`);
  if (!order) return { found: false };

  // The most recent dispatch is the live one for this order.
  const dispatches = (
    Array.isArray(order.DispatchOrder) ? order.DispatchOrder : [order.DispatchOrder]
  ).filter(Boolean) as TrackedDispatch[];
  const dispatch = dispatches[dispatches.length - 1] ?? null;

  const isCompleted = dispatch?.status === DELIVERY_STATUS.completed;
  const completedAt = dispatch?.completedAt ? new Date(dispatch.completedAt).getTime() : null;
  const expiredByAge = completedAt !== null && Date.now() - completedAt > LINK_LIFETIME_AFTER_COMPLETION_MS;

  if (order.isActive === false || expiredByAge) {
    return { found: true, isExpired: true };
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

  // The route driven so far, for drawing the line on the map.
  const trail = dispatch?.dispatchID ? await getDispatchTrail(dispatch.dispatchID) : [];
  const planned = dispatch?.dispatchID ? await getDispatchRoute(dispatch.dispatchID) : null;

  let currentLocation: TrackingPayload["currentLocation"] = null;
  if (dispatch?.dispatchID && !isCompleted) {
    const { data: location } = await supabase
      .from("FleetLocations")
      .select("latitude, longitude, updated_at")
      .eq("dispatch_id", dispatch.dispatchID)
      .maybeSingle();

    if (location) {
      currentLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        updatedAt: location.updated_at ?? null,
      };
    }
  }

  const truck = first(dispatch?.Truck);
  const driver = first(dispatch?.Employee);
  const client = first(order.Client as { company?: string | null; emailAdd?: string | null; contact?: string | null } | null);

  const nextStop = stops.find((stop) => !isStopDone(stop.status));
  const estimatedArrival = isCompleted ? null : formatExpectedTime(nextStop?.expectedTime ?? null);

  // Real driving time from where the truck is now to the next stop. Needs both
  // a live position and a geocoded stop, so it is skipped when either is absent.
  let liveEta: TrackingPayload["liveEta"] = null;
  if (
    dispatch?.status === DELIVERY_STATUS.inTransit &&
    currentLocation &&
    nextStop?.latitude != null &&
    nextStop?.longitude != null
  ) {
    const estimate = await getTravelEstimate(
      { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
      { latitude: nextStop.latitude, longitude: nextStop.longitude },
    );

    if (estimate) {
      liveEta = { ...estimate, arrivalTime: toArrivalLabel(estimate.minutes) };
    }
  }

  let deliveryStatus = "Awaiting dispatch";
  if (dispatch?.status === DELIVERY_STATUS.foulTrip) {
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
  else if (isCompleted) deliveryStatus = "Delivery completed";
  // A partner carrier has no app, so there is no live position to show.
  else if (dispatch?.subConID && dispatch.status === DELIVERY_STATUS.inTransit) deliveryStatus = "In transit with our partner carrier";
  else if (dispatch?.subConID) deliveryStatus = "Handed to our partner carrier";
  else if (dispatch?.status === DELIVERY_STATUS.inTransit) deliveryStatus = "In transit";
  else if (dispatch?.status === DELIVERY_STATUS.accepted) deliveryStatus = "Driver confirmed";
  else if (dispatch?.status) deliveryStatus = "Crew assigned";

  const failedStops = stops.some((stop) => FAILED_STOP.test(stop.status));
  const problems = await reportedProblems(order.orderID);

  return {
    found: true,
    isExpired: false,
    orderNumber: order.orderCode,
    clientName: client?.company ?? null,
    clientEmail: maskEmail(client?.emailAdd),
    clientContact: maskPhone(client?.contact),
    deliveryStatus,
    isCompleted,
    estimatedArrival,
    liveEta,
    nextStopName: nextStop?.branchName ?? null,
    plateNumber: truck?.plateNumber ?? dispatch?.partnerPlate ?? null,
    truckModel: truck?.model ?? null,
    driverName: driver?.employeeName ?? dispatch?.partnerDriver ?? null,
    driverContact: driver?.contact ?? null,
    currentLocation,
    trail,
    plannedRoute: planned?.path ?? [],
    stops,
    steps: buildSteps(dispatch?.status ?? null, stops, isCompleted || failedStops, problems),
  };
}
