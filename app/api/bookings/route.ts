import { NextResponse } from "next/server";
import { OFFICE_ROLES, requireAuth, requireRole, UserRole } from "@/app/lib/auth";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { getBookings, createBooking } from "@/services/booking/bookingService";
import { createOrderSchema } from "@/app/schemas/booking/booking.schema";

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

    const bookings = await getBookings({
      stage,
      view,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
    });

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
        },
        { status: 400 }
      );
    }

    const newBookingResponse = await createBooking(validation.data);

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

    return NextResponse.json(newBookingResponse, { status: 201 });
  } catch (error: unknown) {
    console.error("POST booking error:", error);
    if (typeof error === "object" && error !== null && "message" in error) {
      return NextResponse.json({ message: String(error.message) }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create booking" }, { status: 500 });
  }
}