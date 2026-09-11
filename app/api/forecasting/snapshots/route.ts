import { NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/app/lib/auth";
import {
  createMonthlyForecastSnapshot,
  evaluateCompletedForecastSnapshots,
  getForecastSnapshotAccuracy,
  getForecastSnapshots,
} from "@/services/forecasting/forecastSnapshotService";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const [snapshots, accuracy] = await Promise.all([
      getForecastSnapshots(),
      getForecastSnapshotAccuracy(),
    ]);
    return NextResponse.json(
      { data: snapshots, accuracy },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET forecast snapshots error:", error);
    return NextResponse.json(
      { message: "Failed to retrieve forecast snapshots." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) {
      return NextResponse.json(
        { message: roleError.error },
        { status: roleError.status },
      );
    }

    const result = await evaluateCompletedForecastSnapshots();
    return NextResponse.json(
      {
        message:
          result.recordsEvaluated > 0
            ? "Completed forecast snapshots evaluated successfully."
            : "No completed forecast snapshots are ready for evaluation.",
        data: result,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH forecast snapshot evaluation error:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to evaluate forecast snapshots.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) {
      return NextResponse.json(
        { message: roleError.error },
        { status: roleError.status },
      );
    }

    const result = await createMonthlyForecastSnapshot();
    return NextResponse.json(
      {
        message:
          result.recordsSaved > 0
            ? "Monthly forecast snapshot created successfully."
            : "This month's forecast snapshot already exists.",
        data: result,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("POST forecast snapshot error:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to create forecast snapshot.",
      },
      { status: 500 },
    );
  }
}
