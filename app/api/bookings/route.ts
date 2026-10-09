import { NextResponse } from "next/server";
import { OFFICE_ROLES, requireAuth, requireRole, UserRole } from "@/app/lib/auth";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { notify, OFFICE } from "@/services/notifications/notify";
import { sendBookingTrackingLink } from "@/services/email/bookingEmail";
import { getBookings, createBooking, isBookingStage } from "@/services/booking/bookingService";
import { createOrderSchema } from "@/app/schemas/booking/booking.schema";
import { BookingNeedsConfirmation, BookingNotPossible } from "@/services/booking/bookingService";

// ============================================
// GET ALL BOOKINGS
// ============================================
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const roleError = requireRole(auth.employee.role, OFFICE_ROLES);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });

    // A stage lets the database filter, instead of every screen downloading
    // every order and filtering in the browser.
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage") ?? undefined;
    const limitParam = Number(searchParams.get("limit"));
    // ?view=summary drops the nested stops, pickups, items and truck detail
    // that a list of bookings does not render.
    const view = searchParams.get("view") === "summary" ? "summary" : undefined;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

    // ?stages=a,b,c reads several stages in one request, so a screen that
    // shows them side by side pays for the sign-in check once, not per stage.
    // A stage that fails is left out rather than failing the rest. Unknown
    // names are dropped: getBookings reads a missing stage as every order.
    const stagesParam = searchParams.get("stages");
    if (stagesParam) {
      const stages = [...new Set(stagesParam.split(","))].filter(isBookingStage);
      const results = await Promise.allSettled(
        stages.map((name) => getBookings({ stage: name, view, limit })),
      );
      const bookings = results.flatMap((result, index) => {
        if (result.status === "fulfilled") return result.value;
        console.error(`GET bookings stage ${stages[index]} error:`, result.reason);
        return [];
      });
      return NextResponse.json(bookings, { status: 200 });
    }

    const bookings = await getBookings({ stage, view, limit });

    // Returning the array directly, which matches your old Express layout 
    // where `res.data` in the frontend receives the array of orders.
    return NextResponse.json(bookings, { status: 200 });
  } catch (error) {
    console.error("GET bookings error:", error);
    return NextResponse.json(
      { message: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

// ============================================
// CREATE NEW BOOKING
// ============================================
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const userRole = auth.employee.role.trim() as UserRole;
    const roleError = requireRole(userRole, OFFICE_ROLES);
    if (roleError) {
      return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: validation.error.flatten().fieldErrors,
          // Each issue with its full path - stops.1.expectedDate, not just
          // "stops" - so the form can mark the cell it is about.
          issues: validation.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
        { status: 400 }
      );
    }

    let newBookingResponse;
    try {
      newBookingResponse = await createBooking(validation.data);
    } catch (error) {
      // An itinerary that cannot be driven is the coordinator's to fix, not a
      // fault. It is told apart from a real failure so it does not read as one.
      if (error instanceof BookingNotPossible) {
        return NextResponse.json({ message: error.message }, { status: 422 });
      }
      // Nothing was saved. The form asks whether to keep these times.
      if (error instanceof BookingNeedsConfirmation) {
        return NextResponse.json(
          { message: error.message, needsConfirmation: "tightSchedule" },
          { status: 409 },
        );
      }
      throw error;
    }

    await recordAudit({
      table: "Order",
      recordID: newBookingResponse.orderID,
      action: "CREATE",
      actor: auditActor(auth),
      after: {
        orderCode: newBookingResponse.orderCode,
        clientID: validation.data.clientID ?? null,
        stops: validation.data.stops.length,
        pickups: validation.data.pickups?.length ?? 0,
        items: validation.data.items.length,
      },
    });

    // The client gets the link to follow it. Best-effort: a booking that was
    // made is made, whether or not the mail left.
    const mailed = await sendBookingTrackingLink(newBookingResponse.orderID);
    if (!mailed.sent) {
      console.warn(`[Bookings] Tracking link not emailed for ${newBookingResponse.orderCode}: ${mailed.reason}`);
    }

    await notify({
      event: "BOOKING_CREATED",
      title: "New booking",
      body: `${newBookingResponse.orderCode} was booked: ${validation.data.stops.length} stop(s). It needs a truck and crew.`,
      severity: "action",
      roles: OFFICE,
      entity: { table: "Order", id: newBookingResponse.orderID },
      link: "/admindashboard/calendar/unassigned-bookings",
      actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
    });

    return NextResponse.json(newBookingResponse, { status: 201 });
  } catch (error: unknown) {
    console.error("POST booking error:", error);
    if (typeof error === "object" && error !== null && "message" in error) {
      return NextResponse.json({ message: String(error.message) }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create booking" }, { status: 500 });
  }
}