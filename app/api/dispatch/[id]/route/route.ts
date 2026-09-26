import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { isUuid } from "@/services/dispatch/dispatchService";
import { getDispatchRoute } from "@/services/fleet/routePlanService";

// The road a trip still has to drive, for the map to draw.
//
// Answering with null is normal, not an error: a trip whose stops were never
// geocoded, or one with nothing left to visit, has no route to show, and the
// map falls back to its pins and the trail already driven.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request);
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ message: "Invalid trip ID" }, { status: 400 });
  }

  try {
    const route = await getDispatchRoute(id);
    return NextResponse.json({ data: route }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET dispatch route error:", error);
    return NextResponse.json({ message: "Failed to work out the route" }, { status: 500 });
  }
}
