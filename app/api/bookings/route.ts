import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
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

    // Optional: You could restrict visibility here based on role, 
    // but typically Admins/Coordinators see all active bookings.
    const bookings = await getBookings();

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

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
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

    return NextResponse.json(newBookingResponse, { status: 201 });
  } catch (error: unknown) {
    console.error("POST booking error:", error);
    if (typeof error === "object" && error !== null && "message" in error) {
      return NextResponse.json({ message: String(error.message) }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create booking" }, { status: 500 });
  }
}