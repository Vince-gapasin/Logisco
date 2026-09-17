import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { DELIVERY_STATUS, HELPER_STATUS } from "@/app/lib/enums";
import { signPodUrls } from "@/services/storage/podService";

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
    BranchStops ( branchID, branchName, deliveryAddress, contactPerson, contactNum, notes, expectedTime, sequence, stopStatus, arrivedAt, completedAt, dispatchID, deliveryLat, deliverLong ),
    PickupStops ( pickupID, warehouseName, pickupAddress, contactPerson, contactNum, expectedTime, sequence, stopStatus, arrivedAt, completedAt, dispatchID, pickupLat, pickupLong ) ),
  Truck ( plateNumber, model )
`;

// The booking form stores the schedule inside Order.notes as free text.
function readScheduledDate(notes: string | null): string {
  const match = /Delivery Schedule:\s*(.+)/i.exec(notes || "");
  const value = match ? match[1].split("\n")[0].trim() : "";
  return value && !Number.isNaN(Date.parse(value)) ? value : "";
}

// Earliest to latest stop time, e.g. "8:00 AM - 3:00 PM".
function buildTimeWindow(stops: { expectedTime?: string | null }[]): string {
  const times = stops
    .map((stop) => stop.expectedTime)
    .filter((time): time is string => Boolean(time))
    .sort();

  if (times.length === 0) return "";

  const label = (time: string) => {
    const [hourPart, minutePart] = time.split(":");
    const hour = Number(hourPart);
    if (Number.isNaN(hour)) return time;
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 === 0 ? 12 : hour % 12}:${minutePart ?? "00"} ${suffix}`;
  };

  return times.length === 1
    ? label(times[0])
    : `${label(times[0])} - ${label(times[times.length - 1])}`;
}

export async function GET(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  const employee = auth.employee;

  try {
    // 1. Dispatches where the user is the DRIVER
    const { data: driverDispatches, error: driverErr } = await supabase
      .from("DispatchOrder")
      .select(DISPATCH_SELECT)
      .eq("driverID", employee.employeeID)
      .neq("status", DELIVERY_STATUS.rejected);

    if (driverErr) throw new Error(`Driver dispatch query failed: ${driverErr.message}`);

    // 2. Dispatches where the user is a HELPER
    const { data: helperAssignments, error: helperErr } = await supabase
      .from("DispatchHelper")
      .select("dispatchID, status")
      .eq("helperID", employee.employeeID)
      .neq("status", HELPER_STATUS.declined);

    if (helperErr) throw new Error(`Helper assignment query failed: ${helperErr.message}`);

    let helperDispatches: any[] = [];
    if (helperAssignments && helperAssignments.length > 0) {
      const { data: hData, error: hDataErr } = await supabase
        .from("DispatchOrder")
        .select(DISPATCH_SELECT)
        .in("dispatchID", helperAssignments.map((h) => h.dispatchID))
        .neq("status", DELIVERY_STATUS.rejected);

      if (hDataErr) throw new Error(`Helper dispatch query failed: ${hDataErr.message}`);

      helperDispatches = (hData || []).map((dispatch) => ({
        ...dispatch,
        _helperStatus: helperAssignments.find((h) => h.dispatchID === dispatch.dispatchID)?.status,
      }));
    }

    const allRawDispatches: any[] = [...(driverDispatches || []), ...helperDispatches];

    // The crew screens render the proof of delivery but the column was never
    // selected, so the photo was always blank. It is a storage path now, and
    // the crew is handed a signed URL that expires.
    const signedProofs = await signPodUrls(
      allRawDispatches.map((dispatch) => dispatch.pod_url),
    );

    // 3. Map Database Schema to Frontend "DeliveryRecord" Format
    const formattedData = allRawDispatches.map((dispatch) => {
      const order = Array.isArray(dispatch.Order) ? dispatch.Order[0] : (dispatch.Order || {});
      const client = Array.isArray(order.Client) ? order.Client[0] : (order.Client || {});
      const truck = Array.isArray(dispatch.Truck) ? dispatch.Truck[0] : (dispatch.Truck || {});
      const orderStops: any[] = Array.isArray(order.BranchStops) ? order.BranchStops : [];

      // Prefer stops explicitly linked to this dispatch (an order can be split
      // across trucks); fall back to every stop on the order.
      const linkedStops = orderStops.filter((stop) => stop.dispatchID === dispatch.dispatchID);
      const stops = (linkedStops.length > 0 ? linkedStops : orderStops).sort(
        (a, b) => (a.sequence ?? a.branchID) - (b.sequence ?? b.branchID),
      );

      const orderPickups: any[] = Array.isArray(order.PickupStops) ? order.PickupStops : [];
      const linkedPickups = orderPickups.filter((p) => p.dispatchID === dispatch.dispatchID);
      const pickups = (linkedPickups.length > 0 ? linkedPickups : orderPickups).sort(
        (a, b) => (a.sequence ?? a.pickupID) - (b.sequence ?? b.pickupID),
      );

      let displayStatus: string;
      if (dispatch._helperStatus) {
        // A helper who accepted follows the trip's progress; before that the
        // trip is still awaiting their confirmation.
        displayStatus =
          dispatch._helperStatus === HELPER_STATUS.accepted
            ? ([DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned].includes(dispatch.status)
                ? DELIVERY_STATUS.accepted
                : dispatch.status)
            : "Awaiting Confirmation";
      } else {
        displayStatus =
          dispatch.status === DELIVERY_STATUS.pending
            ? "Awaiting Confirmation"
            : dispatch.status;
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
        scheduledDate: readScheduledDate(order.notes),
        timeWindow: buildTimeWindow(stops),
        pickupTime: pickups[0]?.expectedTime ? String(pickups[0].expectedTime).slice(0, 5) : "TBD",
        deliveryTime: "TBD",
        // Was the literal string "Warehouse / Depot" until pickups became
        // rows: the driver was told to collect the cargo from nowhere.
        pickupAddress:
          pickups[0]?.pickupAddress || pickups[0]?.warehouseName || "No pickup point on file",
        deliveryAddress: client.businessAdd || "Various Locations",
        contactPerson: client.contactName || "N/A",
        contactNumber: client.contact || "N/A",
        driver: dispatch._helperStatus ? "Assigned Driver" : employee.employeeName,
        helper: dispatch._helperStatus ? employee.employeeName : "Assigned Helpers",
        assignedVehicle: truck.plateNumber || "TBD",
        product: "Assorted Goods",
        quantity: "See Manifest",
        priorityLevel: "Standard",
        notes: dispatch.dispatchNote || order.notes || "No notes provided.",
        dispatchNote: dispatch.dispatchNote || "",
        pod_url: dispatch.pod_url ? (signedProofs.get(dispatch.pod_url) ?? null) : null,
        confirmBy: "End of Day",
        pickupCompletedAt: dispatch.pickupCompletedAt ?? null,
        multiplePickups: pickups.map((pickup) => ({
          pickupID: pickup.pickupID,
          warehouse: pickup.warehouseName,
          address: pickup.pickupAddress || pickup.warehouseName || "No address on file",
          contactPerson: pickup.contactPerson || "N/A",
          contactNumber: pickup.contactNum || "N/A",
          pickupTime: pickup.expectedTime ? String(pickup.expectedTime).slice(0, 5) : "",
          quantity: "See Manifest",
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
          deliveryTime: stop.expectedTime,
          quantity: "TBD",
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
