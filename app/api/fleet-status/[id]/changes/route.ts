import { NextResponse } from "next/server";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import { getTruckChanges } from "@/services/truck/truckService";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/fleet-status/:id/changes - who changed this truck's record, and what.
export async function GET(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  try {
    const { id } = await params;
    const data = await getTruckChanges(id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET truck changes error:", error);
    return NextResponse.json({ message: "Failed to load the truck's history" }, { status: 500 });
  }
}
