import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

// Stops are read through the Order: older dispatches were created before
// BranchStops.dispatchID was being set, so the order link is the reliable one.
const DISPATCH_SELECT = `
  dispatchID,
  dispatchCode,
  status,
  current_step,
  dispatchNote,
  Order ( orderCode, clientID, notes, Client(company, contactName, contact, emailAdd, businessAdd),
    BranchStops ( branchID, branchName, contactPerson, contactNum, notes, expectedTime, stopStatus, dispatchID, deliveryLat, deliverLong ) ),
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
      .neq("status", "Rejected");

    if (driverErr) throw new Error(`Driver dispatch query failed: ${driverErr.message}`);

    // 2. Dispatches where the user is a HELPER
    const { data: helperAssignments, error: helperErr } = await supabase
      .from("DispatchHelper")
      .select("dispatchID, status")
      .eq("helperID", employee.employeeID)
      .neq("status", "Declined");

    if (helperErr) throw new Error(`Helper assignment query failed: ${helperErr.message}`);

    let helperDispatches: any[] = [];
    if (helperAssignments && helperAssignments.length > 0) {
      const { data: hData, error: hDataErr } = await supabase
        .from("DispatchOrder")
        .select(DISPATCH_SELECT)
        .in("dispatchID", helperAssignments.map((h) => h.dispatchID))
        .neq("status", "Rejected");

      if (hDataErr) throw new Error(`Helper dispatch query failed: ${hDataErr.message}`);

      helperDispatches = (hData || []).map((dispatch) => ({
        ...dispatch,
        _helperStatus: helperAssignments.find((h) => h.dispatchID === dispatch.dispatchID)?.status,
      }));
    }

    const allRawDispatches: any[] = [...(driverDispatches || []), ...helperDispatches];

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
        (a, b) => a.branchID - b.branchID,
      );

      let displayStatus: string;
      if (dispatch._helperStatus) {
        // A helper who accepted follows the trip's progress; before that the
        // trip is still awaiting their confirmation.
        displayStatus =
          dispatch._helperStatus === "Accepted"
            ? (["Pending", "Assigned"].includes(dispatch.status) ? "Accepted" : dispatch.status)
            : "Awaiting Confirmation";
      } else {
        displayStatus = dispatch.status === "Pending" ? "Awaiting Confirmation" : dispatch.status;
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
        pickupTime: "TBD",
        deliveryTime: "TBD",
        pickupAddress: "Warehouse / Depot",
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
        confirmBy: "End of Day",
        multipleDeliveries: stops.map((stop) => ({
          branchID: stop.branchID,
          branch: stop.branchName,
          address: "Address on file",
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
