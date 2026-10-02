import { supabase } from "@/app/lib/supabase";

export interface ForecastSourceData {
  dispatches: {
    dispatchID: string;
    completedAt: string;
  }[];

  stops: {
    completedAt: string;
  }[];

  weather: {
    recordDate: string;
    temperatureC: number | null;
    rainfallMm: number | null;
    windSpeedKmh: number | null;
  }[];

  fuel: {
effectiveDate: string;
  pricePerUnit: number | null;
  weeklyAdjustment: number | null;
  fuelType: string;
  region: string | null;
  }[];
}

export interface DailyForecastData {
  periodStart: string;
  actualVolume: number;
}

export interface WeeklyForecastData {
  periodStart: string;
  expectedVolume: number | null;
  actualVolume: number | null;
  variance: number | null;
  variancePercentage: number | null;
}

export function buildDailyDispatchVolume(
  dispatches: ForecastSourceData["dispatches"]
): DailyForecastData[] {
  const counts = new Map<string, number>();

  for (const dispatch of dispatches) {
    const date = new Date(dispatch.completedAt).toISOString().slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  const dates = [...counts.keys()].sort();
  if (dates.length === 0) return [];

  const result: DailyForecastData[] = [];
  const current = new Date(`${dates[0]}T00:00:00.000Z`);
  const last = new Date(`${dates[dates.length - 1]}T00:00:00.000Z`);

  while (current <= last) {
    const periodStart = current.toISOString().slice(0, 10);

    result.push({
      periodStart,
      actualVolume: counts.get(periodStart) ?? 0,
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

export function attachFuelPricesToDaily(
  daily: DailyForecastData[],
  fuel: ForecastSourceData["fuel"]
) {
  const prices = [...fuel].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate)
  );

  const latestByTypeAndRegion = new Map<string, (typeof fuel)[number]>();
  let nextPrice = 0;

  return daily.map((day) => {
    while (
      nextPrice < prices.length &&
      prices[nextPrice].effectiveDate <= day.periodStart
    ) {
      const price = prices[nextPrice];
      const key = JSON.stringify([price.fuelType, price.region]);
      latestByTypeAndRegion.set(key, price);
      nextPrice++;
    }

    return {
      ...day,
      fuelPrices: Array.from(latestByTypeAndRegion.values()).map((price) => ({
        fuelType: price.fuelType,
        region: price.region,
        effectiveDate: price.effectiveDate,
        pricePerUnit: price.pricePerUnit,
        weeklyAdjustment: price.weeklyAdjustment,
      })),
    };
  });
}

export function attachWeatherToDaily<T extends { periodStart: string }>(
  daily: T[],
  weatherRecords: ForecastSourceData["weather"]
) {
  const weatherByDate = new Map<
    string,
    ForecastSourceData["weather"][number]
  >();

  for (const record of weatherRecords) {
    const date = record.recordDate.slice(0, 10);

    if (weatherByDate.has(date)) {
      throw new Error(`Multiple weather records found for ${date}`);
    }

    weatherByDate.set(date, record);
  }

  return daily.map((day) => {
    const record = weatherByDate.get(day.periodStart);

    return {
      ...day,
      weather: record
        ? {
            temperatureC: record.temperatureC,
            rainfallMm: record.rainfallMm,
            windSpeedKmh: record.windSpeedKmh,
          }
        : null,
    };
  });
}

export function buildMonthlyDispatchVolume(
  daily: Array<{ periodStart: string; actualVolume: number }>
): Array<{ periodStart: string; actualVolume: number }> {
  const volumes = new Map<string, number>();

  for (const day of daily) {
    const month = `${day.periodStart.slice(0, 7)}-01`;
    volumes.set(month, (volumes.get(month) ?? 0) + day.actualVolume);
  }

  return [...volumes]
    .map(([periodStart, actualVolume]) => ({ periodStart, actualVolume }))
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

export interface YearlyForecastData {
  year: number;
  expectedVolume: number;
  actualVolume: number;
  variance: number;
  variancePercentage: number | null;
}


export interface MonthlyForecastData {
  periodStart: string;
  year: number;
  month: number;
  monthName: string;
  expectedVolume: number;
  actualVolume: number;
  variance: number;
  variancePercentage: number | null;
}


export interface WeeklyForecastData {
  periodStart: string;
  expectedVolume: number | null;
  actualVolume: number | null;
  variance: number | null;
  variancePercentage: number | null;
}

export function buildWeeklyDispatchVolume(
  daily: Array<{
    periodStart: string;
    actualVolume: number;
  }>
): WeeklyForecastData[] {

  const weeks = new Map<
    string,
    number
  >();


  for (const day of daily) {

    const date =
      new Date(
        `${day.periodStart}T00:00:00Z`
      );


    const dayNumber =
      date.getUTCDay();


    const diff =
      dayNumber === 0
        ? -6
        : 1 - dayNumber;


    date.setUTCDate(
      date.getUTCDate() + diff
    );


    const weekStart =
      date.toISOString()
        .slice(0,10);


    weeks.set(
      weekStart,
      (weeks.get(weekStart) ?? 0)
      +
      day.actualVolume
    );

  }


  return Array.from(
    weeks.entries()
  )
  .map(
    ([
      periodStart,
      actualVolume
    ]) => ({
      periodStart,
      expectedVolume: null,
      actualVolume,
      variance: null,
      variancePercentage:null,
    })
  )
  .sort(
    (a,b)=>
      a.periodStart.localeCompare(
        b.periodStart
      )
  );

}


export async function getForecastSourceData(): Promise<ForecastSourceData> {
  const [
    dispatchResult,
    stopsResult,
    weatherResult,
    fuelResult,
  ] = await Promise.all([
    supabase
        .from("DispatchOrder")
        .select("dispatchID, completedAt")
        .not("completedAt", "is", null)
        .range(0, 9999),

    supabase
        .from("BranchStops")
        .select("completedAt")
        .not("completedAt", "is", null)
        .range(0, 9999),

    supabase
        .from("WeatherHistory")
        .select(
            "recordDate, temperatureC, rainfallMm, windSpeedKmh"
        )
        .range(0, 9999),

    supabase
      .from("FuelPriceHistory")
      .select(
        "effectiveDate, pricePerUnit, weeklyAdjustment, fuelType, region"
      ),
  ]);

  if (dispatchResult.error) throw dispatchResult.error;
  if (stopsResult.error) throw stopsResult.error;
  if (weatherResult.error) throw weatherResult.error;
  if (fuelResult.error) throw fuelResult.error;
  
  return {
    dispatches: dispatchResult.data ?? [],
    stops: stopsResult.data ?? [],
    weather: weatherResult.data ?? [],
    fuel: fuelResult.data ?? [],
  };
}