import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { checkForStalledTrips, type StalledTrip } from "@/services/fleet/stallService";

// Looks for trucks that have gone quiet on the road.
//
// Two methods, because the two callers want different things.
//
//   GET  reads. The fleet board polls it every thirty seconds from every open
//        tab so it can colour a quiet trip amber. It sends nothing to anybody.
//   POST tells people. The schedule calls it with CRON_SECRET.
//
// They were one GET that did both, which meant a page load sent push
// notifications as a side effect, and when an alert arrived depended on whether
// somebody happened to have the board open. Dedupe kept it from sending twice,
// but a read that notifies is a surprise, and a link prefetcher could have
// fired it.
//
// Vercel's own cron runs once a day on this plan, which is no use for a
// fifteen-minute check, so the schedule lives in a GitHub Actions workflow.
export const dynamic = "force-dynamic";

function fromTheSchedule(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function summarise(trips: StalledTrip[]) {
  return {
    checked: trips.length,
    raised: trips.filter((trip) => trip.raised).length,
    trips: trips.map((trip) => ({
      dispatchID: trip.dispatchID,
      orderCode: trip.orderCode,
      truck: trip.truck,
      silentFor: trip.verdict.silentFor,
      threshold: trip.verdict.threshold,
      reason: trip.verdict.reason,
      checkIn: trip.checkIn,
      raised: trip.raised,
    })),
  };
}

/** What the board draws. Reads only. */
export async function GET(request: Request) {
  const { response } = await authorize(request);
  if (response) return response;

  try {
    const trips = await checkForStalledTrips(new Date(), { notify: false });
    return NextResponse.json({ data: summarise(trips) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stall check failed:", error);
    return NextResponse.json({ message: "Could not check the trips on the road" }, { status: 500 });
  }
}

/** The scheduled run, which is the only thing that notifies anybody. */
export async function POST(request: Request) {
  // The schedule with the shared secret, or a signed-in member of staff.
  if (!fromTheSchedule(request)) {
    const { response } = await authorize(request);
    if (response) return response;
  }

  try {
    const trips = await checkForStalledTrips(new Date(), { notify: true });
    return NextResponse.json({ data: summarise(trips) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stall check failed:", error);
    return NextResponse.json({ message: "Could not check the trips on the road" }, { status: 500 });
  }
}
