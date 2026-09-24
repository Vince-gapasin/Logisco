import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { cancelBooking, getBookingById } from "@/services/booking/bookingService";
import { isUuid } from "@/services/dispatch/dispatchService";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { bookingCrew, notify, OFFICE } from "@/services/notifications/notify";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request, [...OFFICE_ROLES]);
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ message: "Invalid booking ID" }, { status: 400 });
  }

  try {
    const booking = await getBookingById(id);
    if (!booking) {
      return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    }
    return NextResponse.json({ data: booking });
  } catch (error) {
    console.error("GET booking error:", error);
    return NextResponse.json({ message: "Failed to fetch booking" }, { status: 500 });
  }
}

// Cancel a booking: PATCH { action: "cancel", reason? }
export async function PATCH(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, [...OFFICE_ROLES]);
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ message: "Invalid booking ID" }, { status: 400 });
  }

  let body: { action?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "cancel") {
    return NextResponse.json({ message: 'Unsupported action. Use { "action": "cancel" }.' }, { status: 400 });
  }

  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : `Booking cancelled by ${auth.employee.employeeName}`;

  try {
    // Read before cancelling: afterwards the trips are gone.
    const affected = await bookingCrew(id);
    const result = await cancelBooking(id, reason);

    await recordAudit({
      table: "Order",
      recordID: id,
      action: "CANCEL",
      actor: auditActor(auth),
      after: { reason, cancelledDispatches: result.cancelledDispatches },
    });

    await notify({
      event: "BOOKING_CANCELLED",
      title: "Booking cancelled",
      body: `${affected.orderCode ?? "A booking"} was cancelled. ${reason}`,
      severity: "action",
      roles: OFFICE,
      employeeIDs: affected.crew,
      entity: { table: "Order", id },
      link: "/admindashboard/feeds/foul-trip",
      actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
    });

    return NextResponse.json({ message: "Booking cancelled successfully.", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel booking";

    if (message === "Booking not found") {
      return NextResponse.json({ message }, { status: 404 });
    }
    // Already completed, or already on the road.
    if (message.includes("cannot be cancelled") || message.includes("already on the road")) {
      return NextResponse.json({ message }, { status: 409 });
    }

    console.error("PATCH booking error:", error);
    return NextResponse.json({ message: "Failed to cancel booking" }, { status: 500 });
  }
}
