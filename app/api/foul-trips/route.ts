import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { getSummary, listIncidents } from "@/services/foulTrip/foulTripService";

// GET /api/foul-trips - open incidents, the last 30 days' resolutions, and a
// summary for the foul-trip screen.
export async function GET(request: Request) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  try {
    const [open, recent, summary] = await Promise.all([
      listIncidents("open"),
      listIncidents("recent"),
      getSummary(),
    ]);
    return NextResponse.json({ open, recent, summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Foul trips] load failed:", error);
    return NextResponse.json({ message: "Failed to load foul trips" }, { status: 500 });
  }
}
