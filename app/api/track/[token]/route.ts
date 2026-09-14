import { NextResponse } from "next/server";
import { getTrackingByToken, isTrackingToken } from "@/services/tracking/publicTrackingService";

// Public on purpose: the customer tracking link is a capability URL and its
// holder is not a logged-in user. The token is a random UUID (see
// bookingService.createBooking) and the payload is limited to delivery status.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { token } = await params;

  if (!isTrackingToken(token)) {
    return NextResponse.json({ message: "Invalid tracking link" }, { status: 400 });
  }

  try {
    const tracking = await getTrackingByToken(token);

    if (!("isExpired" in tracking) && !tracking.found) {
      return NextResponse.json({ message: "Tracking link not found" }, { status: 404 });
    }

    return NextResponse.json(tracking, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET tracking error:", error);
    return NextResponse.json({ message: "Failed to load tracking details" }, { status: 500 });
  }
}
