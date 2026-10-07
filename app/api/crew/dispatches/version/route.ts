import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { getCrewDispatchVersion, recentTripsFilter } from "@/services/dispatch/crewDispatchVersion";

// The open crew dashboard asks this every few seconds: a fingerprint of the
// person's trips, so it only fetches the list again when something on it has
// changed. Takes the same ?recentDays= as the list.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  try {
    const version = await getCrewDispatchVersion(auth.employee.employeeID, recentTripsFilter(request.url));
    return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Crew API] Failed to check for updates:", error);
    return NextResponse.json({ message: "Failed to check for updates" }, { status: 500 });
  }
}
