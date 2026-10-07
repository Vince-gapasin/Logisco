import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import type {
  BranchStopsRow,
  ClientRow,
  DispatchOrderRow,
  OrderRow,
  PickupStopsRow,
  TruckRow,
} from "@/types/database";
import { AWAITING_CREW_STATUSES, DELIVERY_STATUS, HELPER_STATUS } from "@/app/lib/enums";
import { signPodUrls } from "@/services/storage/podService";
import { formatTime } from "@/app/lib/datetime";
import { FORMER_TRUCK_COLUMNS, truckOf } from "@/app/lib/formerTruck";
import { describeItems, quantityOf, readPriority, totalQuantity } from "@/app/lib/crewTrip";
import { crewNotReadyReason, crewReadinessFor } from "@/services/dispatch/dispatchService";
import { recentTripsFilter } from "@/services/dispatch/crewDispatchVersion";

// Stops are read through the Order: older dispatches were created before
// BranchStops.dispatchID was being set, so the order link is the reliable one.
const DISPATCH_SELECT = `
  dispatchID,
  dispatchCode,
  status,
  current_step,
  pickupCompletedAt,
  pod_url,
  dispatchNote,
  Order ( orderCode, clientID, notes, Client(company, contactName, contact, emailAdd, businessAdd),
    OrderDetails ( productName, quantity ),
    BranchStops ( branchID, branchName, deliveryAddress, contactPerson, contactNum, notes, expectedTime, quantity, sequence, stopStatus, arrivedAt, completedAt, dispatchID, deliveryLat, deliverLong ),
    PickupStops ( pickupID, warehouseName, pickupAddress, contactPerson, contactNum, expectedTime, quantity, sequence, stopStatus, arrivedAt, completedAt, dispatchID, pickupLat, pickupLong ) ),
  ${FORMER_TRUCK_COLUMNS},
  Truck ( plateNumber, model ),
  Driver:Employee!driverID ( employeeName ),
  DispatchHelper ( status, Helper:Employee!helperID ( employeeName ) )
`;

// Before the truck has left, which is the only point at which the whole crew
// having accepted is a precondition rather than a formality.
const STARTING_OUT: string[] = [
  DELIVERY_STATUS.pending,
  DELIVERY_STATUS.assigned,
  DELIVERY_STATUS.accepted,
];

// The booking form stores the schedule inside Order.notes as free text.
function readScheduledDate(notes: string | null): string {
  const match = /Delivery Schedule:\s*(.+)/i.exec(notes || "");
  const value = match ? match[1].split("\n")[0].trim() : "";
  return value && !Number.isNaN(Date.parse(value)) ? value : "";
}

// Earliest to latest stop time, e.g. "8:00 AM - 3:00 PM".
//
// Sorted as stored, shown through the shared formatter: 24-hour strings are
// what sort correctly ("08:00" before "14:30"), and twelve-hour ones are what
// a driver reads. This had its own copy of the conversion, which is how three
// other places on these screens came to be showing the raw column instead.
function buildTimeWindow(stops: { expectedTime?: string | null }[]): string {
  const times = stops
    .map((stop) => stop.expectedTime)
    .filter((time): time is string => Boolean(time))
    .sort();

  if (times.length === 0) return "";

  return times.length === 1
    ? formatTime(times[0])
    : `${formatTime(times[0])} - ${formatTime(times[times.length - 1])}`;
}

// The trips this route reads, with the order and stops embedded. Columns come
// from types/database.ts; the relations arrive as the select asked for them.
type CrewStop = Partial<BranchStopsRow> & { POD?: unknown };
type CrewPickup = Partial<PickupStopsRow>;

interface CrewOrder extends Partial<OrderRow> {
  Client?: Partial<ClientRow> | Partial<ClientRow>[] | null;
  OrderDetails?: { productName?: string | null; quantity?: number | null }[] | null;
  BranchStops?: CrewStop[] | null;
  PickupStops?: CrewPickup[] | null;
}

interface CrewDispatch extends Partial<DispatchOrderRow> {
  Order?: CrewOrder | CrewOrder[] | null;
  Truck?: Partial<TruckRow> | Partial<TruckRow>[] | null;
  Driver?: { employeeName?: string | null } | { employeeName?: string | null }[] | null;
  DispatchHelper?: { status?: string | null; Helper?: { employeeName?: string | null } | { employeeName?: string | null }[] | null }[] | null;
  /** Set here, not in the database: this trip reached the crew as a helper's. */
  _helperStatus?: string | null;
}

// About 3.7 KB of ids per request, well inside the URL limit.
const HELPER_ID_BATCH = 100;

export async function GET(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  const employee = auth.employee;

  // The dashboard asks for ?recentDays=30 and polls it every thirty seconds; it
  // was being sent every trip the person had ever finished, each with its stops
  // and signed photos. Delivery History and the calendar still ask for all.
  // Only trips with a finish time older than the window are left out: a foul
  // trip or a cancellation has none, and those stay as they always were.
  const recentOnly = recentTripsFilter(request.url);

  try {
    // 1. Dispatches where the user is the DRIVER
    let driverQuery = supabase
      .from("DispatchOrder")
      .select(DISPATCH_SELECT)
      .eq("driverID", employee.employeeID)
      .neq("status", DELIVERY_STATUS.rejected);
    if (recentOnly) driverQuery = driverQuery.or(recentOnly);
    const { data: driverDispatches, error: driverErr } = await driverQuery;

    if (driverErr) throw new Error(`Driver dispatch query failed: ${driverErr.message}`);

    // 2. Dispatches where the user is a HELPER
    const { data: helperAssignments, error: helperErr } = await supabase
      .from("DispatchHelper")
      .select("dispatchID, status")
      .eq("helperID", employee.employeeID)
      .neq("status", HELPER_STATUS.declined);

    if (helperErr) throw new Error(`Helper assignment query failed: ${helperErr.message}`);

    let helperDispatches: CrewDispatch[] = [];
    if (helperAssignments && helperAssignments.length > 0) {
      // In batches: the ids go in the request URL, and a helper's whole
      // history in one URL outgrows what the server will accept.
      const ids = helperAssignments.map((h) => h.dispatchID);
      const batches: string[][] = [];
      for (let start = 0; start < ids.length; start += HELPER_ID_BATCH) {
        batches.push(ids.slice(start, start + HELPER_ID_BATCH));
      }

      const answers = await Promise.all(
        batches.map((batch) => {
          let query = supabase
            .from("DispatchOrder")
            .select(DISPATCH_SELECT)
            .in("dispatchID", batch)
            .neq("status", DELIVERY_STATUS.rejected);
          if (recentOnly) query = query.or(recentOnly);
          return query;
        }),
      );

      const failed = answers.find((answer) => answer.error)?.error;
      if (failed) throw new Error(`Helper dispatch query failed: ${failed.message}`);
      const hData = answers.flatMap((answer) => answer.data ?? []);

      helperDispatches = hData.map((dispatch) => ({
        ...dispatch,
        _helperStatus: helperAssignments.find((h) => h.dispatchID === dispatch.dispatchID)?.status,
      }));
    }

    const allRawDispatches = [...((driverDispatches ?? []) as CrewDispatch[]), ...helperDispatches];

    // The crew screens render the proof of delivery but the column was never
    // selected, so the photo was always blank. It is a storage path now, and
    // the crew is handed a signed URL that expires.
    const signedProofs = await signPodUrls(
      allRawDispatches.map((dispatch) => dispatch.pod_url),
    );

    // Who else is on each trip and whether they have accepted. The screen used
    // to know only about the person holding the phone, so it offered a Start
    // Delivery button that the server would then refuse - and the driver had no
    // way of seeing that the hold-up was a helper who had not answered.
    const readiness = await crewReadinessFor(
      allRawDispatches.map((dispatch) => dispatch.dispatchID),
    );

    // Why this trip cannot start yet, in one sentence, worded for whoever is
    // holding the phone - the person who has not accepted needs telling
    // something different from the person waiting on them. Computed here rather
    // than in the browser so the screen and the gate that actually holds the
    // truck cannot come to disagree about it.
    const startBlockedReason = (dispatch: CrewDispatch): string | null => {
      if (!STARTING_OUT.includes(dispatch.status ?? "")) return null;
      const state = readiness.get(dispatch.dispatchID as string);
      return state ? crewNotReadyReason(state, { isDriver: !dispatch._helperStatus }) : null;
    };

    // 3. Map Database Schema to Frontend "DeliveryRecord" Format
    const formattedData = allRawDispatches.map((dispatch) => {
      const order = Array.isArray(dispatch.Order) ? dispatch.Order[0] : (dispatch.Order || {});
      const client = Array.isArray(order.Client) ? order.Client[0] : (order.Client || {});
      const truck = truckOf(dispatch) ?? {};
      const items = Array.isArray(order.OrderDetails) ? order.OrderDetails : [];
      const driverRow = Array.isArray(dispatch.Driver) ? dispatch.Driver[0] : dispatch.Driver;
      // Everyone else on the trip by name. The driver was told "Assigned
      // Helpers" and a helper "Assigned Driver", so nobody knew who they were
      // riding with.
      const helperNames = (dispatch.DispatchHelper ?? [])
        .filter((row) => row.status !== HELPER_STATUS.declined)
        .map((row) => (Array.isArray(row.Helper) ? row.Helper[0] : row.Helper)?.employeeName)
        .filter((name): name is string => Boolean(name));
      const orderStops: CrewStop[] = Array.isArray(order.BranchStops) ? order.BranchStops : [];

      // Prefer stops explicitly linked to this dispatch (an order can be split
      // across trucks); fall back to every stop on the order.
      const linkedStops = orderStops.filter((stop) => stop.dispatchID === dispatch.dispatchID);
      const stops = (linkedStops.length > 0 ? linkedStops : orderStops).sort(
        (a, b) => (a.sequence ?? a.branchID ?? 0) - (b.sequence ?? b.branchID ?? 0),
      );

      const orderPickups: CrewPickup[] = Array.isArray(order.PickupStops) ? order.PickupStops : [];
      const linkedPickups = orderPickups.filter((p) => p.dispatchID === dispatch.dispatchID);
      const pickups = (linkedPickups.length > 0 ? linkedPickups : orderPickups).sort(
        (a, b) => (a.sequence ?? a.pickupID ?? 0) - (b.sequence ?? b.pickupID ?? 0),
      );

      let displayStatus: string;
      if (dispatch._helperStatus) {
        // A helper who accepted follows the trip's progress; before that the
        // trip is still awaiting their confirmation.
        displayStatus =
          dispatch._helperStatus === HELPER_STATUS.accepted
            ? (AWAITING_CREW_STATUSES.includes(dispatch.status ?? "")
                ? DELIVERY_STATUS.accepted
                : (dispatch.status ?? ""))
            : "Awaiting Confirmation";
      } else {
        displayStatus =
          dispatch.status === DELIVERY_STATUS.pending
            ? "Awaiting Confirmation"
            : (dispatch.status ?? "");
      }

      return {
        id: dispatch.dispatchID,
        bookingId: order.orderCode || dispatch.dispatchCode || "N/A",
        clientName: client.company || "Unknown Client",
        clientEmail: client.emailAdd || "No email",
        address: client.businessAdd || "No Address Provided",
        dateTime: "See Stops",
        status: displayStatus,
        current_step: dispatch.current_step ?? 0,
        scheduledDate: readScheduledDate(order.notes ?? null),
        timeWindow: buildTimeWindow(stops),
        // Not sliced to "08:00". The crew read these; the database sorts by them.
        pickupTime: formatTime(pickups[0]?.expectedTime) || "TBD",
        deliveryTime: "TBD",
        // Was the literal string "Warehouse / Depot" until pickups became
        // rows: the driver was told to collect the cargo from nowhere.
        pickupAddress:
          pickups[0]?.pickupAddress || pickups[0]?.warehouseName || "No pickup point on file",
        deliveryAddress: client.businessAdd || "Various Locations",
        contactPerson: client.contactName || "N/A",
        contactNumber: client.contact || "N/A",
        driver: driverRow?.employeeName || "No driver yet",
        helper: helperNames.length > 0 ? helperNames.join(", ") : "No helper",
        assignedVehicle: truck.plateNumber || "No truck yet",
        // The cargo as booked. These were fixed strings - "Assorted Goods",
        // "See Manifest", "Standard" - on every trip.
        product: describeItems(items) || "Not recorded on the booking",
        quantity: totalQuantity(items),
        priorityLevel: readPriority(order.notes ?? null) || "Not set",
        notes: dispatch.dispatchNote || order.notes || "No notes provided.",
        dispatchNote: dispatch.dispatchNote || "",
        pod_url: dispatch.pod_url ? (signedProofs.get(dispatch.pod_url) ?? null) : null,
        startBlockedReason: startBlockedReason(dispatch),
        pickupCompletedAt: dispatch.pickupCompletedAt ?? null,
        multiplePickups: pickups.map((pickup) => ({
          pickupID: pickup.pickupID,
          warehouse: pickup.warehouseName,
          address: pickup.pickupAddress || pickup.warehouseName || "No address on file",
          contactPerson: pickup.contactPerson || "N/A",
          contactNumber: pickup.contactNum || "N/A",
          pickupTime: formatTime(pickup.expectedTime),
          quantity: quantityOf(pickup.quantity),
          status: pickup.stopStatus,
          latitude: Number(pickup.pickupLat) || null,
          longitude: Number(pickup.pickupLong) || null,
        })),
        multipleDeliveries: stops.map((stop) => ({
          branchID: stop.branchID,
          branch: stop.branchName,
          // "Address on file" was shown to the driver in place of the address.
          address: stop.deliveryAddress || stop.branchName || "No address on file",
          contactPerson: stop.contactPerson,
          contactNumber: stop.contactNum,
          deliveryTime: formatTime(stop.expectedTime),
          quantity: quantityOf(stop.quantity),
          status: stop.stopStatus,
          // 0/0 is the placeholder for a stop that was never geocoded.
          latitude: Number(stop.deliveryLat) || null,
          longitude: Number(stop.deliverLong) || null,
        })),
      };
    });

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("[Crew API] Failed to fetch dispatches:", error);
    return NextResponse.json({ message: "Failed to fetch dispatches" }, { status: 500 });
  }
}
