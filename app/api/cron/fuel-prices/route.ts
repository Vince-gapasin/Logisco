import { NextResponse } from "next/server";

import { syncRecentFuelPrices } from "@/services/externalFactors/fuelPriceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Downloads a few DOE PDFs one after another.
export const maxDuration = 60;

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" automatically.
function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return {
      authorized: false,
      status: 503,
      message: "CRON_SECRET is not configured.",
    };
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized cron request.",
    };
  }

  return { authorized: true, status: 200, message: "Authorized." };
}

/*
  Weekly DOE fuel price job. Re-checks the 4 newest DOE price sheets each run,
  so a week DOE posts late (or a failed run) is picked up the next time.
*/
async function runFuelPriceJob(request: Request) {
  const access = isAuthorized(request);
  if (!access.authorized) {
    return NextResponse.json(
      { message: access.message },
      { status: access.status },
    );
  }

  try {
    const result = await syncRecentFuelPrices(4);

    return NextResponse.json(
      {
        message: `DOE fuel prices synced up to the week of ${result.latestEffectiveDate}.`,
        data: result,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("DOE fuel price cron error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "DOE fuel price sync failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runFuelPriceJob(request);
}

export async function POST(request: Request) {
  return runFuelPriceJob(request);
}
