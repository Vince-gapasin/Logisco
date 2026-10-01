import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { synchronizeLatestFuelPrice } from "@/services/externalFactors/fuelPriceService";

export const runtime = "nodejs";

/**
 * The weekly schedule, with the same shared secret the stall check uses.
 *
 * This endpoint existed but nothing ever called it: vercel.json schedules only
 * the monthly forecasting job, so DOE prices were updated by hand or not at all
 * and the newest row was 27 days old. A price that stale is quietly wrong in
 * every fuel cost computed from it.
 */
function fromTheSchedule(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  try {
    if (!fromTheSchedule(request)) {
      const auth = await requireAuth(request);

      if ("error" in auth) {
        return NextResponse.json(
          { message: auth.error },
          { status: auth.status },
        );
      }
    }

    const result = await synchronizeLatestFuelPrice();

    return NextResponse.json(
      {
        message: result.alreadySynchronized
          ? "Latest DOE fuel price was already synchronized."
          : "Latest DOE fuel price synchronized successfully.",
        data: result.records,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Fuel synchronization error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to synchronize fuel price.",
      },
      { status: 500 },
    );
  }
}