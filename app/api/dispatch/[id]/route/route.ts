import { NextResponse } from "next/server";
import { authorize, CREW_ROLES, FLEET_ROLES, requireRole } from "@/app/lib/auth";
import { getCrewAssignment, isUuid } from "@/services/dispatch/dispatchService";
import { getDispatchRoute } from "@/services/fleet/routePlanService";

// The road a trip still has to drive, for the map to draw.
//
// Answering with null is normal, not an error: a trip whose stops were never
// geocoded, or one with nothing left to visit, has no route to show, and the
// map falls back to its pins and the trail already driven.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ message: "Invalid trip ID" }, { status: 400 });
  }

  try {
    // The fleet map sees every trip; a crew member sees only their own. The
    // route ends at customers' addresses, which are not anybody else's.
    if (requireRole(auth.employee.role, FLEET_ROLES)) {
      const isCrew = !requireRole(auth.employee.role, CREW_ROLES);
      if (!isCrew || !(await getCrewAssignment(id, auth.employee.employeeID))) {
        return NextResponse.json({ message: "This trip is not yours" }, { status: 403 });
      }
    }

    const route = await getDispatchRoute(id);
    return NextResponse.json({ data: route }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET dispatch route error:", error);
    return NextResponse.json({ message: "Failed to work out the route" }, { status: 500 });
  }
}
