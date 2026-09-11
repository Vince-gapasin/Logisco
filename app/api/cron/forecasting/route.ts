import { NextResponse } from "next/server";

import {
  createMonthlyForecastSnapshot,
  evaluateCompletedForecastSnapshots,
} from "@/services/forecasting/forecastSnapshotService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return {
      authorized: false,
      status: 503,
      message: "CRON_SECRET is not configured.",
    };
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized cron request.",
    };
  }

  return { authorized: true, status: 200, message: "Authorized." };
}

async function runForecastingJob(request: Request) {
  const access = isAuthorized(request);
  if (!access.authorized) {
    return NextResponse.json(
      { message: access.message },
      { status: access.status },
    );
  }

  try {
    // Finalize the previous month's original predictions first.
    const evaluation = await evaluateCompletedForecastSnapshots();

    // Then preserve the newly generated MLR predictions for this month.
    const snapshot = await createMonthlyForecastSnapshot();

    return NextResponse.json(
      {
        message: "Monthly forecasting job completed successfully.",
        data: {
          evaluation,
          snapshot,
          completedAt: new Date().toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Monthly forecasting cron error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Monthly forecasting job failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runForecastingJob(request);
}

export async function POST(request: Request) {
  return runForecastingJob(request);
}
