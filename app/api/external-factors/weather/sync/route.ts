import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

type OpenMeteoResponse = {
  daily?: {
    time: string[];
    temperature_2m_mean: Array<number | null>;
    precipitation_sum: Array<number | null>;
    wind_speed_10m_max: Array<number | null>;
    weather_code: Array<number | null>;
  };
  reason?: string;
};

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
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

    const locationCode =
      process.env.WEATHER_LOCATION_CODE || "METRO_MANILA";

    const latitude = Number(
      process.env.WEATHER_LATITUDE || "14.5995",
    );

    const longitude = Number(
      process.env.WEATHER_LONGITUDE || "120.9842",
    );

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { message: "Invalid weather coordinates." },
        { status: 400 },
      );
    }

    /*
     * Historical weather may not contain the most recent few days.
     * Ending five days ago prevents incomplete archive responses.
     */
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() - 5);

    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      start_date: "2022-01-01",
      end_date: formatDate(endDate),
      daily: [
        "temperature_2m_mean",
        "precipitation_sum",
        "wind_speed_10m_max",
        "weather_code",
      ].join(","),
      timezone: "Asia/Manila",
    });

    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Open-Meteo request failed: ${response.status} ${errorText}`,
      );
    }

    const weather = (await response.json()) as OpenMeteoResponse;

    if (!weather.daily?.time?.length) {
      throw new Error(
        weather.reason || "Open-Meteo returned no daily weather records.",
      );
    }

    const records = weather.daily.time.map((recordDate, index) => ({
      recordDate,
      locationCode,
      latitude,
      longitude,
      temperatureC:
        weather.daily?.temperature_2m_mean[index] ?? null,
      rainfallMm:
        weather.daily?.precipitation_sum[index] ?? 0,
      windSpeedKmh:
        weather.daily?.wind_speed_10m_max[index] ?? null,
      weatherCode:
        weather.daily?.weather_code[index] ?? null,
      source: "Open-Meteo",
      retrievedAt: new Date().toISOString(),
    }));

    const batchSize = 250;
    let importedRecords = 0;

    for (let start = 0; start < records.length; start += batchSize) {
      const batch = records.slice(start, start + batchSize);

      const { error } = await supabase
        .from("WeatherHistory")
        .upsert(batch, {
          onConflict: "recordDate,locationCode",
        });

      if (error) {
        throw new Error(
          `Failed to save weather records: ${error.message}`,
        );
      }

      importedRecords += batch.length;
    }

    return NextResponse.json(
      {
        message: "Historical weather synchronized successfully.",
        locationCode,
        startDate: "2022-01-01",
        endDate: formatDate(endDate),
        importedRecords,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Weather synchronization error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to synchronize weather.",
      },
      { status: 500 },
    );
  }
}