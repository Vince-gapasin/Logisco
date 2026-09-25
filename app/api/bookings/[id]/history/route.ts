import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { isUuid } from "@/services/dispatch/dispatchService";
import { getBookingHistory } from "@/services/booking/bookingHistoryService";

// What happened to this booking, newest first, from the audit trail.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: "Invalid booking ID" }, { status: 400 });

  try {
    return NextResponse.json({ data: await getBookingHistory(id) });
  } catch (error) {
    console.error("GET booking history error:", error);
    return NextResponse.json({ message: "Failed to load the booking history" }, { status: 500 });
  }
}
