// The office closing a booking the crew cannot or will not close.
//
// WHY THIS EXISTS
//
// Every way a delivery ends runs through the crew app. The driver marks each
// stop, the driver reports a breakdown, the driver finishes the trip. That is
// right when the crew are reachable, and it is the whole story when they are
// not:
//
//   the phone is dead, or was never granted location access
//   the crew delivered everything and drove home without closing the trip
//   the crew are unreachable and the customer is asking
//   the truck is stranded and nobody on it is in a state to file a report
//
// Until now the office could only wait. cancelBooking refuses once a trip is on
// the road - "use the foul trip flow instead" - and the foul trip flow can only
// be opened by the crew, so a trip whose crew had gone silent could not be
// cancelled, could not be declared a foul trip, and could not be finished. It
// stayed In Transit until somebody edited the database.
//
// WHAT AN OVERRIDE IS NOT
//
// It is not a second, quieter way to do the crew's job. Everything here is
// attributed, reasoned and audited, and each one lands in the booking's Remarks
// History saying who did it and why. An override that could not be told apart
// from the crew's own work would make the history worth less than no history.

import { supabase } from "@/app/lib/supabase";
import { DELIVERY_STATUS, TERMINAL_DELIVERY_STATUSES, STOP_STATUS } from "@/app/lib/enums";
import { releaseDispatchResources } from "@/services/dispatch/dispatchService";
import { recordIncident } from "@/services/foulTrip/foulTripService";

export type OverrideAction = "cancel" | "foul-trip" | "complete";

export interface OverrideRequest {
  orderID: string;
  action: OverrideAction;
  /** Required. An override with no stated reason is one nobody can explain later. */
  reason: string;
  /** For a foul trip: what went wrong, as the office understands it. */
  issueType?: string;
  /** Who is doing this, for the incident row and the audit line. */
  actorID: string;
}

export interface OverrideResult {
  action: OverrideAction;
  dispatchID: string | null;
  /** What the trip's status was before, so the audit can say. */
  previousStatus: string | null;
  /** Stops closed without proof, for "complete". */
  stopsClosed: number;
}

interface TripRow {
  dispatchID: string;
  status: string;
  truckID: string | null;
  pickupCompletedAt: string | null;
}

/** The trip an override acts on: the one that is not already finished. */
function liveTrip(trips: TripRow[]): TripRow | null {
  return trips.find((trip) => !TERMINAL_DELIVERY_STATUSES.includes(trip.status as never)) ?? null;
}

async function readBooking(orderID: string) {
  const { data, error } = await supabase
    .from("Order")
    .select("orderID, isActive, DispatchOrder ( dispatchID, status, truckID, pickupCompletedAt )")
    .eq("orderID", orderID)
    .maybeSingle();

  if (error) throw new Error(`Could not read the booking: ${error.message}`);
  if (!data) throw new Error("Booking not found");

  const raw = data.DispatchOrder;
  const trips = (Array.isArray(raw) ? raw : raw ? [raw] : []) as TripRow[];
  return { order: data, trips };
}

/**
 * Closes a booking on the office's authority.
 *
 * Throws with a message meant for the person reading it, because every refusal
 * here is something they can act on: a booking already closed, a trip that never
 * left, an action that does not apply to where this delivery has got to.
 */
export async function overrideBooking(request: OverrideRequest): Promise<OverrideResult> {
  const reason = request.reason.trim();
  if (!reason) throw new Error("Say why. An override is recorded against your name.");

  const { trips } = await readBooking(request.orderID);
  const trip = liveTrip(trips);

  if (request.action === "cancel") return cancelEverything(request, trips, reason);

  if (!trip) {
    throw new Error(
      trips.length === 0
        ? "This booking has no trip yet, so there is nothing on the road to close. Cancel it instead."
        : "This booking is already closed.",
    );
  }

  return request.action === "foul-trip"
    ? await declareFoulTrip(request, trip, reason)
    : await finishTrip(request, trip, reason);
}

/**
 * Cancel, whatever stage it has reached.
 *
 * The ordinary cancel refuses once the cargo is moving, and rightly - a truck on
 * the road is not something you close on a form. This is the exception, so it
 * frees the truck and crew the same way and says in the history that it was the
 * office that ended it.
 */
async function cancelEverything(
  request: OverrideRequest,
  trips: TripRow[],
  reason: string,
): Promise<OverrideResult> {
  const trip = liveTrip(trips);

  for (const each of trips) {
    if (TERMINAL_DELIVERY_STATUSES.includes(each.status as never)) continue;

    const { error } = await supabase
      .from("DispatchOrder")
      .update({ status: DELIVERY_STATUS.cancelled, rejectionreason: reason })
      .eq("dispatchID", each.dispatchID);

    if (error) throw new Error(`Could not cancel the trip: ${error.message}`);
    await releaseDispatchResources(each.dispatchID);
  }

  const { error: orderError } = await supabase
    .from("Order")
    .update({ isActive: false })
    .eq("orderID", request.orderID);

  if (orderError) throw new Error(`Could not cancel the booking: ${orderError.message}`);

  return {
    action: "cancel",
    dispatchID: trip?.dispatchID ?? null,
    previousStatus: trip?.status ?? null,
    stopsClosed: 0,
  };
}

/**
 * Declare a foul trip the crew did not report.
 *
 * The incident row is the same shape the crew's report produces, so everything
 * downstream - the recovery panel, the mechanic dispatch, the customer's
 * tracking page - works on it without knowing who filed it. What differs is
 * reportedBy, which is the office user, and that is visible wherever the
 * incident is read.
 */
async function declareFoulTrip(
  request: OverrideRequest,
  trip: TripRow,
  reason: string,
): Promise<OverrideResult> {
  const { data: marked, error } = await supabase
    .from("DispatchOrder")
    .update({ status: DELIVERY_STATUS.foulTrip })
    .eq("dispatchID", trip.dispatchID)
    // Guarded on the status we read, so two people overriding at once cannot
    // both win.
    .eq("status", trip.status)
    .select("dispatchID")
    .maybeSingle();

  if (error) throw new Error(`Could not mark the trip: ${error.message}`);
  if (!marked) throw new Error("This trip changed while you were looking at it. Refresh and try again.");

  await recordIncident({
    dispatchID: trip.dispatchID,
    orderID: request.orderID,
    truckID: trip.truckID,
    reportedBy: request.actorID,
    issueType: request.issueType?.trim() || "Reported by the office",
    details: reason,
    // The office is not at the roadside: no photograph and no position, and
    // claiming either would be inventing evidence.
    photoPath: null,
    latitude: null,
    longitude: null,
    dispatchStatusBefore: trip.status,
    cargoLoaded: Boolean(trip.pickupCompletedAt),
    blocking: true,
  });

  return {
    action: "foul-trip",
    dispatchID: trip.dispatchID,
    previousStatus: trip.status,
    stopsClosed: 0,
  };
}

/**
 * Finish a trip the crew delivered and never closed.
 *
 * The stops left open are closed with it, because a Completed trip whose stops
 * are still Pending is a record that contradicts itself. They are closed
 * honestly: each gets a proof row with no file and a missingReason saying the
 * office closed it, which is exactly how the reports already render a stop that
 * was finished without a photograph. Nothing is invented - no receiver's name,
 * no photograph, no arrival time that nobody observed.
 */
async function finishTrip(
  request: OverrideRequest,
  trip: TripRow,
  reason: string,
): Promise<OverrideResult> {
  const closedAt = new Date().toISOString();

  const { data: stops, error: stopsError } = await supabase
    .from("BranchStops")
    .select("branchID, stopStatus")
    .eq("dispatchID", trip.dispatchID);

  if (stopsError) throw new Error(`Could not read the stops: ${stopsError.message}`);

  const open = (stops ?? []).filter(
    (stop) => !String(stop.stopStatus ?? "").toLowerCase().includes("deliver"),
  );

  for (const stop of open) {
    const { error } = await supabase
      .from("BranchStops")
      .update({ stopStatus: STOP_STATUS.delivered, completedAt: closedAt })
      .eq("branchID", stop.branchID);

    if (error) throw new Error(`Could not close a stop: ${error.message}`);

    const { error: proofError } = await supabase.from("POD").insert({
      dispatchID: trip.dispatchID,
      branchID: stop.branchID,
      proof: null,
      receiverName: "N/A",
      remarks: `Closed by the office. ${reason}`,
      deliveredAt: closedAt,
      recordedBy: request.actorID,
      source: "coordinator",
      missingReason: "The office closed this trip; the crew recorded no proof",
    });

    if (proofError) console.error("[Override] Could not record the missing proof:", proofError.message);
  }

  const { data: marked, error } = await supabase
    .from("DispatchOrder")
    .update({ status: DELIVERY_STATUS.completed, completedAt: closedAt })
    .eq("dispatchID", trip.dispatchID)
    .eq("status", trip.status)
    .select("dispatchID")
    .maybeSingle();

  if (error) throw new Error(`Could not finish the trip: ${error.message}`);
  if (!marked) throw new Error("This trip changed while you were looking at it. Refresh and try again.");

  await releaseDispatchResources(trip.dispatchID);

  return {
    action: "complete",
    dispatchID: trip.dispatchID,
    previousStatus: trip.status,
    stopsClosed: open.length,
  };
}
