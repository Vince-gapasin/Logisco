import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { cancelBooking, getBookingById, updateBooking } from "@/services/booking/bookingService";
import { updateOrderSchema } from "@/app/schemas/booking/booking.schema";
import { isUuid } from "@/services/dispatch/dispatchService";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { bookingCrew, crewOf, notify, OFFICE } from "@/services/notifications/notify";

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

/**
 * Changes what the booking says: its schedule, priority, product or notes.
 * A crew already holding it is told when the day moves - that is the one
 * change that alters what they have to do, and when.
 */
async function updateBookingDetails(
  orderID: string,
  body: Record<string, unknown>,
  auth: { employee: { employeeID: string; employeeName: string; role: string } },
) {
  const validation = updateOrderSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: validation.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await updateBooking(orderID, validation.data);

    if (result.changed.length === 0) {
      return NextResponse.json({ message: "Nothing changed.", data: result });
    }

    await recordAudit({
      table: "Order",
      recordID: orderID,
      action: "UPDATE",
      actor: auditActor(auth),
      before: result.before,
      after: result.after,
    });

    if (result.rescheduled) {
      const crew = await crewOf(result.dispatchID);
      await notify({
        event: "BOOKING_RESCHEDULED",
        title: "Delivery moved to another day",
        body: `${result.orderCode ?? "A booking"} is now for ${result.after.deliverySchedule || "a new date"} (was ${result.before.deliverySchedule || "unscheduled"}).`,
        severity: "action",
        roles: OFFICE,
        employeeIDs: crew,
        entity: { table: "Order", id: orderID },
        link: crew.length > 0 ? "/crew/dashboard" : "/admindashboard/feeds/pending",
        actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
      });
    }

    return NextResponse.json({ message: "Booking updated.", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update booking";

    if (message === "Booking not found") return NextResponse.json({ message }, { status: 404 });
    if (
      message.includes("no longer be edited") ||
      message.includes("already on the road") ||
      message.includes("cannot be renamed") ||
      message.includes("no items")
    ) {
      return NextResponse.json({ message }, { status: 409 });
    }

    console.error("PATCH booking update error:", error);
    return NextResponse.json({ message: "Failed to update booking" }, { status: 500 });
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "update") {
    return updateBookingDetails(id, body, auth);
  }

  if (body.action !== "cancel") {
    return NextResponse.json(
      { message: 'Unsupported action. Use { "action": "cancel" } or { "action": "update" }.' },
      { status: 400 },
    );
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
