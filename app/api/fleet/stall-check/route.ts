import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { checkForStalledTrips } from "@/services/fleet/stallService";

// Looks for trucks that have gone quiet on the road.
//
// Reached two ways, because neither alone is enough. The fleet board calls it
// while somebody is watching, which makes an alert immediate. A schedule calls
// it the rest of the time, because a truck that stops at two in the morning
// with nobody watching is the one worth hearing about.
//
// Vercel's own cron runs once a day on this plan, which is no use for a
// fifteen-minute check, so the schedule lives in a GitHub Actions workflow
// that calls this with CRON_SECRET.
export const dynamic = "force-dynamic";

function fromTheSchedule(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  // A signed-in member of staff, or the schedule with the shared secret.
  if (!fromTheSchedule(request)) {
    const { response } = await authorize(request);
    if (response) return response;
  }

  try {
    const trips = await checkForStalledTrips();

    return NextResponse.json(
      {
        data: {
          checked: trips.length,
          raised: trips.filter((trip) => trip.raised).length,
          trips: trips.map((trip) => ({
            dispatchID: trip.dispatchID,
            orderCode: trip.orderCode,
            truck: trip.truck,
            silentFor: trip.verdict.silentFor,
            threshold: trip.verdict.threshold,
            reason: trip.verdict.reason,
            raised: trip.raised,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Stall check failed:", error);
    return NextResponse.json({ message: "Could not check the trips on the road" }, { status: 500 });
  }
}
