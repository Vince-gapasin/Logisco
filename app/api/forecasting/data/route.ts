import { NextResponse } from "next/server";
import { OFFICE_ROLES, requireAuth, requireRole } from "@/app/lib/auth";
import { generateForecast } from "@/services/forecasting/forecastingService";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status }
      );
    }

    // The office's figures, like the snapshots and the dataset beside it. Any
    // signed-in employee could read them, drivers and helpers included.
    const roleError = requireRole(auth.employee.role, OFFICE_ROLES);
    if (roleError) {
      return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    }

    const forecast = await generateForecast();

    return NextResponse.json(forecast, { status: 200 });
  } catch (error) {
    console.error("GET forecasting error:", error);

    return NextResponse.json(
      {
        message: "Failed to generate forecasting data.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}