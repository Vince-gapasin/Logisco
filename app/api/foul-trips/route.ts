import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { getSummary, listIncidents, listIssues } from "@/services/foulTrip/foulTripService";

// GET /api/foul-trips - open incidents, the last 30 days' resolutions, a
// summary, and the issues reported on deliveries that carried on.
export async function GET(request: Request) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  try {
    const [open, recent, summary, issues] = await Promise.all([
      listIncidents("open"),
      listIncidents("recent"),
      getSummary(),
      listIssues("open"),
    ]);
    return NextResponse.json({ open, recent, summary, issues }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Foul trips] load failed:", error);
    return NextResponse.json({ message: "Failed to load foul trips" }, { status: 500 });
  }
}
