import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import {
  getForecastSourceData,
  buildDailyDispatchVolume,
  attachFuelPricesToDaily,
  attachWeatherToDaily,
} from "@/services/forecasting/forecastDataService";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status }
      );
    }

    const roleError = requireRole(
      auth.employee.role,
      ["Admin", "Coordinator"]
    );
    if (roleError) {
      return NextResponse.json(
        { message: roleError.error },
        { status: roleError.status }
      );
    }

    const date = new URL(request.url).searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { message: "Provide a date in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const source = await getForecastSourceData();
    const daily = buildDailyDispatchVolume(source.dispatches);
    const withFuel = attachFuelPricesToDaily(daily, source.fuel);
    const dataset = attachWeatherToDaily(withFuel, source.weather);
    const record = dataset.find((row) => row.periodStart === date);

    if (!record) {
      return NextResponse.json(
        { message: "No dataset record for this date." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data: record },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET forecast dataset error:", error);
    return NextResponse.json(
      { message: "Failed to retrieve forecast dataset." },
      { status: 500 }
    );
  }
}