import { NextResponse } from "next/server";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import { getLiveFleet } from "@/services/fleet/fleetTrackingService";

export async function GET(request: Request) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  try {
    const data = await getLiveFleet();
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET fleet locations error:", error);
    return NextResponse.json({ message: "Failed to fetch live fleet" }, { status: 500 });
  }
}
