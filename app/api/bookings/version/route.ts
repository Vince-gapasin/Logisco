import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { getDashboardVersion } from "@/services/booking/bookingService";

// The open dashboard asks this every few seconds: a fingerprint of the board,
// so it only fetches the bookings again when something on it has changed.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  try {
    const version = await getDashboardVersion();
    return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET dashboard version error:", error);
    return NextResponse.json({ message: "Failed to check for updates" }, { status: 500 });
  }
}
