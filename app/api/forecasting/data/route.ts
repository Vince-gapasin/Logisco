import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
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