import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { getCrewAssignment, isUuid } from "@/services/dispatch/dispatchService";

// Location pings are only accepted while the trip is on the road; this also
// stops a watcher that outlives its trip from recreating the map pin.
const TRACKABLE_STATUSES = ["Accepted", "In Transit"];

// FleetLocationHistory is optional: until its migration is applied the trail
// is skipped rather than failing the ping. Missing table is detected once.
let trailTableAvailable = true;

async function recordTrailPoint(point: {
  dispatch_id: string;
  driver_id: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
}) {
  if (!trailTableAvailable) return;

  const { error } = await supabase.from("FleetLocationHistory").insert(point);
  if (!error) return;

  // 42P01 / PGRST205: the table does not exist yet.
  if (error.code === "42P01" || error.code === "PGRST205") {
    trailTableAvailable = false;
    console.warn(
      "[Location API] FleetLocationHistory not found - GPS trail disabled. Apply the fleet_location_history migration to enable it.",
    );
    return;
  }

  console.error("[Location API] Failed to record trail point:", error.message);
}

function toFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const dispatchID = body.dispatch_id;
  const latitude = toFiniteNumber(body.latitude);
  const longitude = toFiniteNumber(body.longitude);

  if (!isUuid(dispatchID) || latitude === null || longitude === null) {
    return NextResponse.json({ message: "Missing required coordinate data" }, { status: 400 });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ message: "Coordinates out of range" }, { status: 400 });
  }

  try {
    const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
    if (!assignment) {
      return NextResponse.json({ message: "You are not assigned to this dispatch." }, { status: 403 });
    }

    if (!TRACKABLE_STATUSES.includes(assignment.dispatch.status)) {
      return NextResponse.json(
        { message: `Tracking is closed for this dispatch (${assignment.dispatch.status}).`, stopTracking: true },
        { status: 409 },
      );
    }

    // Upsert the latest coordinate (one row per active dispatch). The driver
    // is identified from the session, not from the request body.
    const { error: upsertErr } = await supabase.from("FleetLocations").upsert(
      {
        dispatch_id: dispatchID,
        driver_id: assignment.dispatch.driverID ?? auth.employee.employeeID,
        latitude,
        longitude,
        speed: toFiniteNumber(body.speed),
        heading: toFiniteNumber(body.heading),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dispatch_id" },
    );

    if (upsertErr) throw new Error(upsertErr.message);

    // Keep the breadcrumb trail alongside the latest position.
    await recordTrailPoint({
      dispatch_id: dispatchID,
      driver_id: assignment.dispatch.driverID ?? auth.employee.employeeID,
      latitude,
      longitude,
      speed: toFiniteNumber(body.speed),
      heading: toFiniteNumber(body.heading),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Location API Error]:", error);
    return NextResponse.json({ message: "Failed to update location" }, { status: 500 });
  }
}
