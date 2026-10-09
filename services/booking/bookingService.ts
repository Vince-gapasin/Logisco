import { supabase } from "@/app/lib/supabase";
import { geocodeAddresses, type Coordinates } from "@/services/geo/geocodingService";
import { getRouteGeometry } from "@/services/geo/routingService";
import { assessFeasibility, type Feasibility } from "@/app/lib/deliveryFeasibility";
import { BASE_LOCATION, DEPARTURE_BUFFER_MIN } from "@/app/lib/baseLocation";
import { formatTime, minutesUntil, todayInManila } from "@/app/lib/datetime";
import { addDays, daysBetween, isRealDate, stopTimeHasPassed } from "@/app/lib/bookingRules";
import { checkStopSchedule, effectiveStopDates, legacyStopDates, stopMoment } from "@/app/lib/stopSchedule";
import {
  BEFORE_DEPARTURE_STATUSES,
  CARRYING_OR_DONE_STATUSES,
  CLOSED_DISPATCH_STATUSES,
  CLOSED_OR_CANCELLED_STATUSES,
  DELIVERY_STATUS,
  FINISHED_DELIVERY_STATUSES,
  isDeliveryFinished,
  STOP_STATUS,
} from "@/app/lib/enums";
import { releaseDispatchResources } from "@/services/dispatch/dispatchService";
import { signPodUrls } from "@/services/storage/podService";
import type { Order, CreateOrderDto } from "@/types/booking";
import type { UpdateOrderDto } from "@/app/schemas/booking/booking.schema";
import { readNote, readNotesBody, setNote, setNotesBody } from "@/app/lib/bookingNotes";
import { fingerprint } from "@/app/lib/fingerprint";

// ==========================================
// HELPERS
// ==========================================

// The pickup time column is a Postgres `time`, and the form sends either
// "08:00", "08:00:00" or an empty string. Anything else is dropped rather
// than failing the whole booking over a malformed time.
function normalizeTime(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) return null;
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

const generateOrderCode = (): string => {
  const timestampPart = Date.now().toString().slice(-6);
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestampPart}-${randomPart}`;
};

// ==========================================
// BOOKINGS (ORDERS) SERVICE
// ==========================================

// Only the columns the booking screens actually read. Selecting "*" across
// four nested relations pulled every column of every related row - including
// the customer tracking token - on every page load.
const BOOKING_COLUMNS = `
  orderID,
  orderCode,
  notes,
  createdAt,
  isActive,
  clientID,
  Client ( clientID, company, contactName, contact, emailAdd, businessAdd ),
  OrderDetails ( itemID, productName, productType, quantity, weightPerItem ),
  BranchStops ( branchID, branchName, deliveryAddress, contactPerson, contactNum, expectedTime, expectedDate, quantity, sequence, stopStatus, arrivedAt, completedAt, deliveryLat, deliverLong, dispatchID,
    POD ( podID, proof, receiverName, remarks, deliveredAt, source, missingReason, fileType ) ),
  PickupStops ( pickupID, warehouseID, warehouseName, pickupAddress, contactPerson, contactNum, expectedTime, expectedDate, quantity, sequence, stopStatus, arrivedAt, completedAt, pickupLat, pickupLong, dispatchID,
    POD ( podID, proof, receiverName, remarks, deliveredAt, source, missingReason, fileType ) ),
  DispatchOrder (
    dispatchID,
    dispatchCode,
    status,
    current_step,
    completedAt,
    pickupCompletedAt,
    pod_url,
    dispatchNote,
    rejectionreason,
    truckID,
    driverID,
    subConID,
    partnerDriver,
    partnerPlate,
    partnerContact,
    formerTruckPlate,
    formerTruckModel,
    formerTruckType,
    SubContractor ( companyName, contactNumber ),
    Truck ( plateNumber, model ),
    Driver:Employee!driverID ( employeeName ),
    DispatchHelper ( helperID, status, declinereason, Helper:Employee!helperID ( employeeName ) )
  )
`;

// Dispatch statuses behind each booking screen, so the database does the
// filtering instead of every screen downloading every order.
const STAGE_STATUSES: Record<string, string[]> = {
  "awaiting-crew": [DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned],
  departing: [DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned, DELIVERY_STATUS.accepted],
  "in-transit": [
    DELIVERY_STATUS.startDelivery,
    DELIVERY_STATUS.inWarehouse,
    DELIVERY_STATUS.inTransit,
    DELIVERY_STATUS.arrived,
  ],
  completed: FINISHED_DELIVERY_STATUSES,
  "foul-trip": [DELIVERY_STATUS.foulTrip],
  cancelled: [DELIVERY_STATUS.cancelled],
};

// What a list of bookings needs: enough to categorise, filter and label a
// row. The reports screen used to pull BOOKING_COLUMNS for every order ever
// created - every stop, pickup, item and crew member - to render a ten-row
// table, then fetch nothing more when a row was opened.
//
// rejectionreason is in here for the reports list: it is short, and it is the
// only thing a list of finished deliveries can say about the ones that did not
// finish - a driver's reason for declining, or a coordinator's for cancelling.
// The note itself goes here rather than inside the string, because this is a
// PostgREST select and not SQL: a "--" in it is read as part of a column name.
const SUMMARY_COLUMNS = `
  orderID,
  orderCode,
  notes,
  createdAt,
  isActive,
  clientID,
  Client ( company ),
  DispatchOrder (
    dispatchID,
    status,
    completedAt,
    rejectionreason,
    Driver:Employee!driverID ( employeeName ),
    DispatchHelper ( status, Helper:Employee!helperID ( employeeName ) )
  )
`;

const DEFAULT_STAGE_LIMIT = 300;

/** A stage getBookings filters by. Anything else means every order. */
export function isBookingStage(stage: string): boolean {
  return stage === "unassigned" || stage === "foul-trip" || stage in STAGE_STATUSES;
}

export interface BookingQuery {
  /** A key of STAGE_STATUSES, "unassigned", or undefined for every order. */
  stage?: string;
  limit?: number;
  /**
   * "summary" returns only the columns a list of bookings renders. Screens
   * that show one booking in detail fetch it by id instead.
   */
  view?: "summary" | "full";
}

// DispatchOrder.pod_url holds the storage path of the delivery receipt.
// Screens get a signed URL that expires; the path itself never reaches the
// browser. Signed in one call for the whole response rather than per row.
// The shapes these functions read back from a query, as opposed to the shapes
// they hand out. A select embeds whatever each caller asked for, so every
// relation may arrive as a list, a single row, or not at all.
type Embedded<T> = T | T[] | null | undefined;

function embedded<T>(value: Embedded<T>): T[] {
  if (Array.isArray(value)) return value.filter(Boolean) as T[];
  return value ? [value] : [];
}

interface DispatchLike {
  dispatchID?: string;
  status?: string;
  pod_url?: string | null;
}

interface ProofLike {
  proof?: string | null;
}

interface StopLike {
  POD?: Embedded<ProofLike>;
}

interface OrderLike {
  orderID?: string;
  DispatchOrder?: Embedded<DispatchLike>;
  BranchStops?: Embedded<StopLike>;
  PickupStops?: Embedded<StopLike>;
  OrderDetails?: Embedded<{ itemID?: string; productName?: string }>;
}

async function withSignedProofs(orders: Order[]): Promise<Order[]> {
  const dispatches = orders.flatMap((order) => embedded((order as OrderLike).DispatchOrder));
  // Both halves of the itinerary. Signing only the branch stops would leave every
  // warehouse proof rendering as a bare object path, which is a broken image on
  // the report rather than a picture of a signed delivery note.
  const stopProofs = [
    ...orders.flatMap((order) =>
      embedded((order as OrderLike).BranchStops).flatMap((stop) =>
        embedded(stop?.POD).filter((pod) => pod?.proof),
      ),
    ),
    ...orders.flatMap((order) =>
      embedded((order as OrderLike).PickupStops).flatMap((stop) =>
        embedded(stop?.POD).filter((pod) => pod?.proof),
      ),
    ),
  ];

  const withProof = dispatches.filter((dispatch) => dispatch.pod_url);
  if (withProof.length === 0 && stopProofs.length === 0) return orders;

  const signed = await signPodUrls([
    ...withProof.map((dispatch) => dispatch.pod_url as string),
    ...stopProofs.map((pod) => pod.proof as string),
  ]);
  for (const dispatch of withProof) {
    dispatch.pod_url = signed.get(dispatch.pod_url ?? "") ?? null;
  }
  for (const pod of stopProofs) {
    pod.proof = signed.get(pod.proof ?? "") ?? null;
  }

  return orders;
}

// Foul trips someone still has to act on. This used to be every order with
// a Foul Trip dispatch anywhere in its history - so a recovered booking would
// have appeared here and on its new stage's screen at once, and the 123
// historical ones never left.
async function getOpenFoulTripBookings(limit: number, columns: string): Promise<Order[]> {
  const { data: incidents, error } = await supabase
    .from("FoulTripIncident")
    .select("orderID")
    .eq("blocking", true)
    .in("status", ["open", "mechanic_assigned"])
    .order("reportedAt", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const orderIDs = [...new Set((incidents ?? []).map((incident) => incident.orderID as string))];
  if (orderIDs.length === 0) return [];

  const { data, error: rowsError } = await supabase
    .from("Order")
    .select(columns)
    .in("orderID", orderIDs)
    .order("createdAt", { ascending: false });

  if (rowsError) throw rowsError;
  return withSignedProofs((data ?? []) as unknown as Order[]);
}

// Orders with no dispatch yet, or whose only dispatches were rejected.
// Resolved in two cheap steps: ids first, then the full rows for those ids.
async function getUnassignedBookings(limit: number): Promise<Order[]> {
  const { data: candidates, error } = await supabase
    .from("Order")
    .select("orderID, createdAt, DispatchOrder ( status )")
    .eq("isActive", true)
    .order("createdAt", { ascending: false });

  if (error) throw error;

  const orderIDs = (candidates ?? [])
    .filter((order) => {
      const dispatches = embedded((order as OrderLike).DispatchOrder);
      return dispatches.every((dispatch) => dispatch?.status === DELIVERY_STATUS.rejected);
    })
    .slice(0, limit)
    .map((order) => (order as OrderLike).orderID as string);

  if (orderIDs.length === 0) return [];

  const { data, error: rowsError } = await supabase
    .from("Order")
    .select(BOOKING_COLUMNS)
    .in("orderID", orderIDs)
    .order("createdAt", { ascending: false });

  if (rowsError) throw rowsError;
  return (data ?? []) as unknown as Order[];
}

export async function getBookings(query: BookingQuery = {}): Promise<Order[]> {
  const limit = query.limit && query.limit > 0 ? query.limit : DEFAULT_STAGE_LIMIT;
  const columns = query.view === "summary" ? SUMMARY_COLUMNS : BOOKING_COLUMNS;

  if (query.stage === "unassigned") {
    return getUnassignedBookings(limit);
  }

  if (query.stage === "foul-trip") {
    return getOpenFoulTripBookings(limit, columns);
  }

  // A stage maps to dispatch statuses: an inner join keeps only matching orders.
  const statuses = query.stage ? STAGE_STATUSES[query.stage] : undefined;
  if (statuses) {
    const { data, error } = await supabase
      .from("Order")
      .select(columns.replace("DispatchOrder (", "DispatchOrder!inner ("))
      .eq("isActive", true)
      .in("DispatchOrder.status", statuses)
      .order("createdAt", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return withSignedProofs((data ?? []) as unknown as Order[]);
  }

  // No stage: every order, paged. Used by the dashboard and reports, which
  // aggregate across all history.
  const batchSize = 1000;
  let start = 0;
  const allBookings: Order[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("Order")
      .select(columns)
      .order("createdAt", { ascending: false })
      .range(start, start + batchSize - 1);

    if (error) {
      throw error;
    }

    const batch = (data ?? []) as unknown as Order[];
    allBookings.push(...batch);

    if (batch.length < batchSize) {
      break;
    }

    start += batchSize;
  }

  return withSignedProofs(allBookings);
}

// Trips that have not finished, one way or another: everything on the board
// that can still move. A trip that finishes, is declined, cancelled or becomes
// a foul trip leaves this set, so the move is seen without reading the
// finished ones at all.
const UNFINISHED_STATUSES = [...new Set([...STAGE_STATUSES.departing, ...STAGE_STATUSES["in-transit"]])];

const byKey = <T>(key: (row: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));

/**
 * A short fingerprint of what the dashboard's board shows, so an open
 * dashboard can ask "has anything changed?" every few seconds and fetch the
 * board - five stages, each with its stops, crew and trucks - only when it has.
 *
 * Three reads, run together: the active orders (how many, and the newest, for
 * a booking made or withdrawn), the unfinished trips with their crew and
 * truck, and the open foul trips. Moving a card, or changing what one says
 * about its trip, changes one of them. Edits to a booking's own details - its
 * client, items, notes - are not in here; the board picks those up on its
 * full refresh a minute later.
 */
export async function getDashboardVersion(): Promise<string> {
  const [orders, trips, foulTrips] = await Promise.all([
    supabase
      .from("Order")
      .select("orderID, createdAt", { count: "exact" })
      .eq("isActive", true)
      .order("createdAt", { ascending: false })
      .limit(1),
    supabase
      .from("DispatchOrder")
      .select(
        "dispatchID, orderID, status, current_step, truckID, driverID, subConID, partnerDriver, partnerPlate, DispatchHelper ( helperID, status )",
      )
      .in("status", UNFINISHED_STATUSES),
    supabase
      .from("FoulTripIncident")
      .select("incidentID, orderID, dispatchID, status")
      .eq("blocking", true)
      .in("status", ["open", "mechanic_assigned"]),
  ]);

  const failed = orders.error ?? trips.error ?? foulTrips.error;
  if (failed) throw new Error(`Supabase dashboard version error: ${failed.message}`);

  // In a fixed order: the database returns rows in whatever order is
  // cheapest, and the same rows in another order must not read as a change.
  type Trip = { dispatchID: string; DispatchHelper?: Embedded<{ helperID?: string; status?: string }> };
  const tripRows = ((trips.data ?? []) as unknown as Trip[])
    .map((trip) => ({
      ...trip,
      DispatchHelper: embedded(trip.DispatchHelper).sort(byKey((helper) => String(helper.helperID))),
    }))
    .sort(byKey((trip) => trip.dispatchID));
  const foulRows = [...((foulTrips.data ?? []) as { incidentID: string }[])].sort(
    byKey((incident) => incident.incidentID),
  );

  return fingerprint([orders.count ?? null, orders.data?.[0] ?? null, tripRows, foulRows]);
}

// supabase-js has no transactions: if a later insert fails, remove what was
// already written so a half-created order never shows up in the queues.
async function rollbackOrder(orderID: string) {
  await supabase.from("PickupStops").delete().eq("orderID", orderID);
  await supabase.from("BranchStops").delete().eq("orderID", orderID);
  await supabase.from("OrderDetails").delete().eq("orderID", orderID);
  const { error } = await supabase.from("Order").delete().eq("orderID", orderID);
  if (error) console.error("Order rollback failed:", error.message);
}

// ==========================================
// SINGLE BOOKING
// ==========================================
export async function getBookingById(orderID: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("Order")
    .select(
      // Named rather than "*": Order holds orderLinkToken, the capability
      // URL a customer tracks their delivery with, and it has no business
      // being sent to a screen that never shows it.
      `orderID, orderCode, notes, createdAt, isActive, clientID,
        Client (*), OrderDetails (*), PickupStops ( *, POD ( podID, proof, receiverName, remarks, deliveredAt, source, missingReason, fileType ) ),
        BranchStops ( *, POD ( podID, proof, receiverName, remarks, deliveredAt, source, missingReason, fileType ) ),
        DispatchOrder ( *, Truck ( plateNumber, model ),
          Driver:Employee!driverID ( employeeName, contact ),
          DispatchHelper ( helperID, status, Helper:Employee!helperID ( employeeName ) ) )`,
    )
    .eq("orderID", orderID)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [signed] = await withSignedProofs([data as unknown as Order]);
  return signed ?? null;
}

// ==========================================
// CANCEL BOOKING
// ==========================================
// Deactivates the order and rejects any dispatch that has not left yet,
// returning the truck and crew to the pool. A trip that is already on the
// road cannot be cancelled here - that is an emergency/foul trip.
export async function cancelBooking(orderID: string, reason: string) {
  const { data: order, error } = await supabase
    .from("Order")
    .select("orderID, isActive, DispatchOrder ( dispatchID, status )")
    .eq("orderID", orderID)
    .maybeSingle();

  if (error) throw new Error(`Supabase Order Error: ${error.message}`);
  if (!order) throw new Error("Booking not found");

  const dispatches = embedded(order.DispatchOrder as Embedded<{ dispatchID: string; status: string }>);
  const running = dispatches.find((d) => CARRYING_OR_DONE_STATUSES.includes(d.status));

  if (running) {
    throw new Error(
      running.status === DELIVERY_STATUS.completed
        ? "This booking is already completed and cannot be cancelled."
        : "This delivery is already on the road. Use the foul trip flow instead.",
    );
  }

  for (const dispatch of dispatches) {
    if (CLOSED_DISPATCH_STATUSES.includes(dispatch.status)) continue;

    const { error: dispatchError } = await supabase
      .from("DispatchOrder")
      .update({ status: DELIVERY_STATUS.rejected, rejectionreason: reason })
      .eq("dispatchID", dispatch.dispatchID);

    if (dispatchError) throw new Error(`Failed to cancel dispatch: ${dispatchError.message}`);

    await releaseDispatchResources(dispatch.dispatchID);
  }

  const { error: orderError } = await supabase
    .from("Order")
    .update({ isActive: false })
    .eq("orderID", orderID);

  if (orderError) throw new Error(`Failed to cancel booking: ${orderError.message}`);

  return { orderID, cancelledDispatches: dispatches.length };
}

interface StopTime {
  pickupID?: number | null;
  branchID?: number | string | null;
  expectedTime?: string | null;
  expectedDate?: string | null;
  sequence?: number | null;
  warehouseName?: string | null;
  branchName?: string | null;
  pickupLat?: number | null;
  pickupLong?: number | null;
  deliveryLat?: number | null;
  deliverLong?: number | null;
}

/** Where a stop was placed when it was booked. 0/0 and null both mean nowhere. */
function storedCoordinates(latitude?: number | null, longitude?: number | null): Coordinates | undefined {
  if (latitude == null || longitude == null) return undefined;
  if (latitude === 0 && longitude === 0) return undefined;
  return { latitude, longitude };
}

/**
 * Refused because the new day puts the booking's first stop behind the clock,
 * or closer than the drive out to it. Its message names the stop, since the
 * coordinator changed the date, not a time.
 */
export class RescheduleNotPossible extends Error {}

/**
 * Held back because moving the booking to today leaves the crew nothing to
 * spare, or because whether they can make it could not be checked. Nothing is
 * written; the coordinator decides, and sends it again acknowledged.
 */
export class RescheduleNeedsConfirmation extends Error {}

/**
 * Changes what a booking says about itself: when it is for, how urgent it is,
 * what is being carried and any instructions with it.
 *
 * The screens that assign a crew have always shown these as editable fields,
 * and nothing saved them - there was no endpoint that could. Everything here
 * belongs to the booking. A client's contact details and addresses belong to
 * the client record, and are edited under Clients & Partners, so one booking
 * can never quietly rewrite another's.
 *
 * Returns what changed, so the caller can record it and tell whoever is
 * affected - a crew who accepted a trip needs to know the day moved.
 */
export async function updateBooking(orderID: string, dto: UpdateOrderDto) {
  const { data: order, error } = await supabase
    .from("Order")
    .select(
      "orderID, orderCode, notes, isActive, deliverySchedule, OrderDetails ( itemID, productName ), DispatchOrder ( dispatchID, status ), PickupStops ( pickupID, warehouseName, expectedTime, expectedDate, expectedDate, sequence, pickupLat, pickupLong ), BranchStops ( branchID, branchName, expectedTime, expectedDate, sequence, deliveryLat, deliverLong )",
    )
    .eq("orderID", orderID)
    .maybeSingle();

  if (error) throw new Error(`Supabase Order Error: ${error.message}`);
  if (!order) throw new Error("Booking not found");
  if (order.isActive === false) throw new Error("This booking was cancelled and can no longer be edited.");

  const dispatches = embedded(order.DispatchOrder as Embedded<{ dispatchID: string; status: string }>);
  const live = dispatches.find((dispatch) => !CLOSED_OR_CANCELLED_STATUSES.includes(dispatch.status));

  // Once a truck has left, the booking is a record of what is happening, not
  // a plan to change: a schedule edited from the office would never reach the
  // crew already driving it.
  if (live && !BEFORE_DEPARTURE_STATUSES.includes(live.status)) {
    throw new Error(
      isDeliveryFinished(live.status)
        ? "This delivery is finished and can no longer be edited."
        : "This delivery is already on the road. Report a foul trip to change it.",
    );
  }

  const items = embedded(order.OrderDetails as Embedded<{ itemID?: string; productName?: string }>);
  const before = {
    deliverySchedule: readNote(order.notes ?? "", "Delivery Schedule"),
    priorityLevel: readNote(order.notes ?? "", "Priority"),
    product: items.map((item) => item.productName).filter(Boolean).join(", "),
    notes: readNotesBody(order.notes ?? ""),
  };

  // Moved to a day whose first stop is already behind the clock - today, at
  // 2 PM, for a run that starts at 08:00. The same rule a new booking meets,
  // on the same stop: the first pickup if there is one, else the first
  // delivery, as createBooking lays the route out.
  // Every stop's new date, written once the checks below have passed.
  let movedStops: { table: "PickupStops" | "BranchStops"; key: "pickupID" | "branchID"; id: unknown; date: string }[] = [];
  if (dto.deliverySchedule && dto.deliverySchedule !== before.deliverySchedule) {
    const bySequence = (rows: Embedded<StopTime>) =>
      [...embedded(rows)].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const pickups = bySequence(order.PickupStops as Embedded<StopTime>);
    const branches = bySequence(order.BranchStops as Embedded<StopTime>);
    const route = [...pickups, ...branches];
    const first = route[0];

    // The whole run moves, not just its first day: every stop keeps its place
    // relative to the first. A run of three days moved to Friday ends on
    // Sunday. Stops stored before they had dates are read the way they were
    // booked, and get their dates written now.
    const oldDay = String(order.deliverySchedule ?? "").slice(0, 10) || before.deliverySchedule;
    const newDay = dto.deliverySchedule;
    const current = isRealDate(oldDay)
      ? effectiveStopDates(oldDay, route.map((stop) => ({ date: stop.expectedDate, time: stop.expectedTime })))
      : legacyStopDates(newDay, route.map((stop) => stop.expectedTime));
    const shift = isRealDate(oldDay) ? daysBetween(oldDay, newDay) : 0;
    const dates = current.map((date) => addDays(date, shift));
    movedStops = route.map((stop, index) =>
      index < pickups.length
        ? { table: "PickupStops" as const, key: "pickupID" as const, id: stop.pickupID, date: dates[index] }
        : { table: "BranchStops" as const, key: "branchID" as const, id: stop.branchID, date: dates[index] },
    );
    const moments = route.map((stop, index) => stopMoment(dates[index], stop.expectedTime ?? ""));
    if (first?.expectedTime && stopTimeHasPassed(dto.deliverySchedule, first.expectedTime)) {
      const label = first.warehouseName || first.branchName || "The first stop";
      throw new RescheduleNotPossible(
        // A later day, and only that: stop times cannot be changed once a
        // booking is made, so offering it pointed at nothing.
        `${label}'s ${formatTime(first.expectedTime)} has already passed today. Pick a later day.`,
      );
    }

    // Still ahead on the clock is not the same as reachable: a first stop half
    // an hour from now and two hours from the yard is one no truck can make.
    // The drive is measured as createBooking measures it, from where the stops
    // were placed when they were booked. Only for today - any later day leaves
    // the crew a night to get there - so a reschedule costs at most one
    // Directions request.
    if (dto.deliverySchedule === todayInManila()) {
      const itinerary = [
        ...pickups.map((stop) => ({
          label: stop.warehouseName || "Pickup",
          time: stop.expectedTime,
          at: storedCoordinates(stop.pickupLat, stop.pickupLong),
        })),
        ...branches.map((stop) => ({
          label: stop.branchName || "Stop",
          time: stop.expectedTime,
          at: storedCoordinates(stop.deliveryLat, stop.deliverLong),
        })),
      ];
      const feasibility = await assessItinerary(itinerary, dto.deliverySchedule, moments);

      if (feasibility.verdict === "impossible") {
        throw new RescheduleNotPossible(feasibility.message ?? "This itinerary cannot be driven in time today.");
      }

      // Asked before anything is written, as a new booking asks: times with
      // nothing to spare, or times nobody could check. It used to save first
      // and say so afterwards, when all the coordinator could do was read it.
      //
      // "Could not be checked" is worded for a reschedule. The new-booking
      // wording talked about the tracking map, which on a booking already made
      // says nothing new; what matters now is that today is unconfirmed.
      const unplaced = itinerary.filter((stop) => !stop.at).map((stop) => stop.label);
      const question =
        feasibility.verdict === "tight"
          ? feasibility.message
          : feasibility.verdict === "unknown" && feasibility.message
            ? `Whether the crew can make these times today could not be checked: ${
                unplaced.length > 0
                  ? `${unplaced.join(" and ")} ${unplaced.length === 1 ? "is" : "are"} not placed on the map.`
                  : "the driving distance could not be worked out just now."
              }`
            : null;
      if (question && !dto.acknowledgeTightSchedule) throw new RescheduleNeedsConfirmation(question);
    }
  }

  let notes = order.notes ?? "";
  if (dto.deliverySchedule !== undefined) notes = setNote(notes, "Delivery Schedule", dto.deliverySchedule);
  if (dto.priorityLevel !== undefined) notes = setNote(notes, "Priority", dto.priorityLevel);
  if (dto.notes !== undefined) notes = setNotesBody(notes, dto.notes);

  // The date goes to the column as well as the note. The note is what six
  // screens still read; the column is what punctuality is decided on, and a
  // scheduling fact deciding somebody's performance should not live one stray
  // newline away from vanishing.
  const changes: Record<string, unknown> = {};
  if (notes !== order.notes) changes.notes = notes;
  if (dto.deliverySchedule !== undefined) changes.deliverySchedule = dto.deliverySchedule || null;

  // The stops move first. Were the order to move and a stop then fail, the
  // booking would say one day and its stops another; this way a failure
  // leaves the booking on its old day, and the edit can simply be tried again.
  for (const stop of movedStops) {
    if (stop.id === undefined || stop.id === null) continue;
    const { error: stopError } = await supabase.from(stop.table).update({ expectedDate: stop.date }).eq(stop.key, stop.id);
    if (stopError) throw new Error(`Failed to move this booking's stops: ${stopError.message}`);
  }

  if (Object.keys(changes).length > 0) {
    const { error: notesError } = await supabase.from("Order").update(changes).eq("orderID", orderID);
    if (notesError) throw new Error(`Failed to save this booking: ${notesError.message}`);
  }

  // The product is shown as one line, and several items are joined into it.
  // Writing that line back would have to guess which item each word came
  // from, so a booking with more than one is left to the booking itself.
  if (dto.product !== undefined && dto.product !== before.product) {
    if (items.length !== 1) {
      throw new Error(
        items.length === 0
          ? "This booking has no items to rename."
          : "This booking carries several items; they cannot be renamed as one line.",
      );
    }
    const { error: itemError } = await supabase
      .from("OrderDetails")
      .update({ productName: dto.product })
      .eq("itemID", items[0].itemID);
    if (itemError) throw new Error(`Failed to save the product: ${itemError.message}`);
  }

  const after = {
    deliverySchedule: dto.deliverySchedule ?? before.deliverySchedule,
    priorityLevel: dto.priorityLevel ?? before.priorityLevel,
    product: dto.product ?? before.product,
    notes: dto.notes ?? before.notes,
  };

  const changed = (Object.keys(after) as (keyof typeof after)[]).filter((field) => after[field] !== before[field]);

  return {
    orderCode: (order.orderCode as string) ?? null,
    dispatchID: (live?.dispatchID as string) ?? null,
    before,
    after,
    changed,
    /** The day moved, which is the one change a crew already on it must hear about. */
    rescheduled: changed.includes("deliverySchedule"),
  };
}

/** Refused because the itinerary promises the truck will be in two places. */
export class BookingNotPossible extends Error {}

/**
 * Held back because the itinerary can be driven only with nothing to spare.
 * Not a refusal: the coordinator decides, and sends it again acknowledged.
 */
export class BookingNeedsConfirmation extends Error {}

/**
 * The drive through an itinerary, and what that says about its times.
 *
 * Routed once, here, at the only moment the whole itinerary is in hand. It is
 * never routed again for this: a Directions request per check per booking is
 * the bill this system has already learned not to pay.
 */
async function assessItinerary(
  stops: { label: string; time?: string | null; at?: Coordinates }[],
  scheduledFor: string,
  // When each stop is due, from its own date and time. Given, the drive is
  // measured against real gaps - a run of several days is several days - and
  // nothing is read as overnight. Left out, the old clock reading applies.
  moments: (number | null)[] | null = null,
): Promise<Feasibility> {
  const points = stops.map((stop) => stop.at).filter((at): at is Coordinates => Boolean(at));

  // Every stop has to be placed, or the drive between them is a guess with a
  // hole in it. Better to say nothing than to refuse on a partial route.
  const placed = points.length === stops.length && points.length >= 2;

  // One request, from the yard through the whole itinerary. The first leg is
  // the drive out to the first stop, which is the one that decides whether the
  // crew can be there at the hour it was promised for; the rest is the route
  // they drive once they have started.
  const route = placed ? await getRouteGeometry([BASE_LOCATION, ...points]) : null;
  const legs = route?.legMinutes ?? [];
  const fromBase = legs.length > 0 ? legs[0] : null;
  const throughStops = legs.length > 1 ? legs.slice(1).reduce((a, b) => a + b, 0) : null;

  const firstTime = stops[0]?.time;

  const verdict = assessFeasibility({
    times: stops.map((stop) => stop.time),
    travelMinutes: throughStops,
    labels: stops.map((stop) => stop.label),
    fromBaseMinutes: fromBase,
    legMinutes: legs.length === stops.length ? legs.slice(1) : null,
    minutesUntilFirstStop: firstTime ? minutesUntil(scheduledFor, firstTime) : null,
    departureBufferMin: DEPARTURE_BUFFER_MIN,
    moments: moments && moments.every((moment) => moment !== null) ? (moments as number[]) : null,
  });

  // A booking the check could not run on is accepted - refusing a real delivery
  // because a map service did not answer would be worse - but it no longer goes
  // through in silence. Silence is indistinguishable from "we checked and it is
  // fine", and the booking most likely to skip the check is the one with an
  // address nobody could find, which is also the one most likely to be wrong.
  if (verdict.verdict === "unknown") {
    const unplaced = stops.filter((stop) => !stop.at).map((stop) => stop.label);

    if (unplaced.length > 0) {
      return {
        ...verdict,
        message:
          `The times were not checked: ${unplaced.join(" and ")} could not be found on the map, ` +
          `so there is no drive to measure. The stop will not appear on the tracking map either.`,
      };
    }

    if (!route) {
      return {
        ...verdict,
        message:
          "The times were not checked: the driving distance could not be worked out just now. " +
          "Worth confirming the crew can make the first stop.",
      };
    }
  }

  return verdict;
}

export async function createBooking(dto: CreateOrderDto) {
  // 0. Can this itinerary be driven in the window it promises?
  //
  // Checked before anything is written, so a booking that cannot be kept is
  // refused rather than created and rolled back. The addresses have to be
  // resolved to do it, so they are resolved once here and the inserts below
  // reuse what this found - they each used to geocode again, separately.
  const pickups = (dto.pickups ?? []).filter((pickup) => pickup.warehouseName?.trim());

  // When each stop is due. The schema has already refused a schedule that
  // breaks the rules; this resolves the dates to store and the moments to
  // measure the drive by. Nothing is guessed: a stop's day is the one sent.
  const schedule = checkStopSchedule(
    [
      ...pickups.map((pickup) => ({ date: pickup.expectedDate, time: pickup.expectedTime })),
      ...dto.stops.map((stop) => ({ date: stop.expectedDate, time: stop.expectedTime })),
    ],
    { bookingDate: dto.deliverySchedule },
  );
  // Checked again for the minute between the schema and here: a first stop
  // that has just gone, on a booking made at the last moment.
  if (schedule.issues.length > 0) throw new BookingNotPossible(schedule.issues[0].message);
  const pickupDate = (index: number) => schedule.dates[index] ?? dto.deliverySchedule;
  const stopDate = (index: number) => schedule.dates[pickups.length + index] ?? dto.deliverySchedule;

  const [stopCoordinates, pickupCoordinates] = await Promise.all([
    geocodeAddresses(dto.stops.map((stop) => stop.deliveryAddress || "").filter(Boolean)),
    geocodeAddresses(pickups.map((pickup) => pickup.pickupAddress || "").filter(Boolean)),
  ]);

  const feasibility = await assessItinerary([
    ...pickups.map((pickup) => ({
      label: pickup.warehouseName.trim(),
      time: pickup.expectedTime,
      at: pickup.pickupAddress?.trim()
        ? pickupCoordinates.get(pickup.pickupAddress.trim())
        : undefined,
    })),
    ...dto.stops.map((stop) => ({
      label: stop.branchName,
      time: stop.expectedTime,
      at: stop.deliveryAddress?.trim()
        ? stopCoordinates.get(stop.deliveryAddress.trim())
        : undefined,
    })),
  ], dto.deliverySchedule, schedule.moments);

  if (feasibility.verdict === "impossible") {
    throw new BookingNotPossible(feasibility.message ?? "This itinerary cannot be driven in time.");
  }

  // Drivable, but the crew may well arrive late. That used to be said only
  // after the booking was made, when the times could no longer be changed
  // without editing it. Now nothing is written until the coordinator has
  // seen it and chosen to keep the times.
  if (feasibility.verdict === "tight" && !dto.acknowledgeTightSchedule) {
    throw new BookingNeedsConfirmation(
      feasibility.message ?? "These times leave the crew nothing to spare. They may arrive late.",
    );
  }

  // Not checked at all: an address nobody could find on the map, or a map
  // service that did not answer. This used to be saved and mentioned in a
  // toast afterwards - the weaker treatment for the riskier booking, since an
  // address no map can find is also the one most likely to be wrong. It is
  // asked about first now, as moving a booking to today asks. A single stop
  // has no drive between stops to check, so there is nothing to ask about.
  const stopCount = pickups.length + dto.stops.length;
  if (feasibility.verdict === "unknown" && feasibility.message && stopCount >= 2 && !dto.acknowledgeTightSchedule) {
    throw new BookingNeedsConfirmation(feasibility.message);
  }

  // 1. Generate Unique Identifiers
  const orderCode = generateOrderCode();
  const orderLinkToken = crypto.randomUUID(); 

  // 2. Insert the Main Order
  const { data: orderData, error: orderError } = await supabase
    .from("Order")
    .insert([
      {
        clientID: dto.clientID || null, // Allows NULL for walk-in / On-Call
        orderCode,
        orderLinkToken,
        notes: dto.notes || "",
        // Lifted out of the blob the booking form builds, so the column is
        // populated from the first save rather than only when somebody edits.
        deliverySchedule: dto.deliverySchedule,
        isActive: true,
      },
    ])
    .select()
    .single();

  if (orderError || !orderData) {
    console.error("Order Insert Error:", orderError);
    throw new Error(orderError?.message || "Failed to create main order");
  }

  const newOrderID = orderData.orderID;

  // 3. Insert the Cargo (OrderDetails)
  if (dto.items && dto.items.length > 0) {
    const formattedItems = dto.items.map((item) => ({
      orderID: newOrderID,
      productName: item.productName || "Unknown Cargo",
      productType: item.productType || "General",
      quantity: item.quantity,
      weightPerItem: item.weightPerItem || 0,
    }));

    const { error: itemsError } = await supabase
      .from("OrderDetails")
      .insert(formattedItems);

    if (itemsError) {
      console.error("OrderDetails Insert Error:", itemsError);
      await rollbackOrder(newOrderID);
      throw new Error("Failed to insert order items");
    }
  }

  // 4. Insert the Itinerary (BranchStops)
  if (dto.stops && dto.stops.length > 0) {
    // Resolved above, where the itinerary was checked. Stops without a usable
    // address keep the 0/0 placeholder and simply are not plotted.
    const coordinatesByAddress = stopCoordinates;

    const formattedStops = dto.stops.map((stop, index) => {
      const coordinates = stop.deliveryAddress
        ? coordinatesByAddress.get(stop.deliveryAddress.trim())
        : undefined;

      return {
        orderID: newOrderID,
        branchName: stop.branchName || "Unknown Stop",
        // Kept so a stop that failed to geocode can be retried later, and so
        // the crew app has an address to show rather than just a branch name.
        deliveryAddress: stop.deliveryAddress?.trim() || null,
        contactPerson: stop.contactPerson || "",
        contactNum: stop.contactNum || "",
        notes: "",
        deliveryLat: coordinates?.latitude ?? 0,
        deliverLong: coordinates?.longitude ?? 0,
        expectedTime: stop.expectedTime || "12:00:00",
        expectedDate: stopDate(index),
        quantity: stop.quantity ?? null,
        sequence: index + 1,
        stopStatus: STOP_STATUS.pending,
      };
    });

    const { error: stopsError } = await supabase
      .from("BranchStops")
      .insert(formattedStops);

    if (stopsError) {
      console.error("BranchStops Insert Error:", stopsError);
      await rollbackOrder(newOrderID);
      throw new Error("Failed to insert delivery itinerary");
    }
  }

  // 5. Insert the collection points (PickupStops)
  if (pickups.length > 0) {
    const formattedPickups = pickups.map((pickup, index) => {
      const address = pickup.pickupAddress?.trim() || "";
      const coordinates = address ? pickupCoordinates.get(address) : undefined;

      return {
        orderID: newOrderID,
        warehouseID: pickup.warehouseID || null,
        warehouseName: pickup.warehouseName.trim(),
        pickupAddress: address || null,
        contactPerson: pickup.contactPerson || null,
        contactNum: pickup.contactNum || null,
        expectedTime: normalizeTime(pickup.expectedTime),
        expectedDate: pickupDate(index),
        quantity: pickup.quantity ?? null,
        pickupLat: coordinates?.latitude ?? null,
        pickupLong: coordinates?.longitude ?? null,
        sequence: index + 1,
        stopStatus: STOP_STATUS.pending,
      };
    });

    const { error: pickupError } = await supabase
      .from("PickupStops")
      .insert(formattedPickups);

    if (pickupError) {
      console.error("PickupStops Insert Error:", pickupError);
      await rollbackOrder(newOrderID);
      throw new Error("Failed to insert the pickup schedule");
    }
  }

  // Return exactly what the UI needs for the Success Modal
  return {
    message: "Order created successfully!",
    orderID: newOrderID,
    orderCode: orderCode,
    trackingToken: orderLinkToken,
    // Anything worth saying was asked before the save and accepted, so it is
    // not said again; what is left is a note nobody was asked about.
    warning: dto.acknowledgeTightSchedule ? null : feasibility.message,
  };
}