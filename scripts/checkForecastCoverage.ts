/**
 * Checks whether the forecasting data (deliveries, weather, fuel) covers
 * every day of the 5-year forecasting window (Jan 2022 → yesterday).
 *
 * Run from the project root:
 *   npx tsx --env-file=.env scripts/checkForecastCoverage.ts
 *
 * Read-only: it only SELECTs from Supabase.
 */
import { supabase } from "../app/lib/supabase";

const START_DATE = "2022-01-01";
const PAGE_SIZE = 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Supabase occasionally answers "JWT issued at future" (PGRST303) when its
// servers' clocks briefly disagree. Waiting a moment and retrying fixes it.
async function withRetry<T extends { error: { code?: string } | null }>(
  run: () => PromiseLike<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const result = await run();
    if (result.error?.code === "PGRST303" && attempt < 5) {
      console.log(`  (Supabase clock hiccup, retrying in ${attempt * 2}s…)`);
      await wait(attempt * 2000);
      continue;
    }
    return result;
  }
}

function toDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function eachDay(start: string, end: string) {
  const days: string[] = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

// Reads every row, 1000 at a time, so nothing is cut off by Supabase's
// per-request row limit.
async function fetchAll<T>(
  table: string,
  columns: string,
  orderColumn: string,
  notNullColumn?: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await withRetry(() => {
      let query = supabase
        .from(table)
        .select(columns)
        .order(orderColumn, { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (notNullColumn) query = query.not(notNullColumn, "is", null);
      return query;
    });
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// Mirrors the exact queries in services/forecasting/forecastDataService.ts
// to see how many rows the forecast actually receives.
async function rowsTheForecastReceives() {
  const dispatches = await withRetry(() =>
    supabase
      .from("DispatchOrder")
      .select("dispatchID, completedAt")
      .not("completedAt", "is", null)
      .range(0, 9999),
  );
  const weather = await withRetry(() =>
    supabase
      .from("WeatherHistory")
      .select("recordDate, temperatureC, rainfallMm, windSpeedKmh")
      .range(0, 9999),
  );
  const fuel = await withRetry(() =>
    supabase
      .from("FuelPriceHistory")
      .select("effectiveDate, pricePerUnit, weeklyAdjustment, fuelType, region"),
  );
  for (const result of [dispatches, weather, fuel]) {
    if (result.error) throw result.error;
  }
  return {
    dispatches: dispatches.data?.length ?? 0,
    weather: weather.data?.length ?? 0,
    fuel: fuel.data?.length ?? 0,
  };
}

function summarizeGaps(missing: string[]) {
  if (missing.length === 0) return "none";
  const ranges: string[] = [];
  let rangeStart = missing[0];
  let previous = missing[0];
  for (const day of missing.slice(1)) {
    const expectedNext = new Date(`${previous}T00:00:00Z`);
    expectedNext.setUTCDate(expectedNext.getUTCDate() + 1);
    if (day !== expectedNext.toISOString().slice(0, 10)) {
      ranges.push(rangeStart === previous ? rangeStart : `${rangeStart} → ${previous}`);
      rangeStart = day;
    }
    previous = day;
  }
  ranges.push(rangeStart === previous ? rangeStart : `${rangeStart} → ${previous}`);
  const shown = ranges.slice(0, 8).join(", ");
  return ranges.length > 8 ? `${shown}, … (+${ranges.length - 8} more ranges)` : shown;
}

async function main() {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const endDate = yesterday.toISOString().slice(0, 10);
  const allDays = eachDay(START_DATE, endDate);
  const years = [...new Set(allDays.map((day) => day.slice(0, 4)))];

  console.log("Reading deliveries, weather and fuel prices from Supabase…");
  const dispatches = await fetchAll<{ completedAt: string }>(
    "DispatchOrder",
    "completedAt",
    "completedAt",
    "completedAt",
  );
  const weather = await fetchAll<{ recordDate: string }>(
    "WeatherHistory",
    "recordDate",
    "recordDate",
  );
  const fuel = await fetchAll<{ effectiveDate: string; fuelType: string }>(
    "FuelPriceHistory",
    "effectiveDate, fuelType",
    "effectiveDate",
  );
  const received = await rowsTheForecastReceives();

  // ---- Deliveries ----
  const deliveriesPerDay = new Map<string, number>();
  for (const row of dispatches) {
    const day = toDate(row.completedAt);
    deliveriesPerDay.set(day, (deliveriesPerDay.get(day) ?? 0) + 1);
  }

  console.log(`\n=== Window: ${START_DATE} → ${endDate} (${allDays.length} days) ===`);

  console.log("\n--- Deliveries (DispatchOrder with completedAt) ---");
  console.log(`Rows in database:          ${dispatches.length}`);
  console.log(`Rows the forecast receives: ${received.dispatches}`);
  if (received.dispatches < dispatches.length) {
    console.log(
      `  ⚠ The forecast query is missing ${dispatches.length - received.dispatches} deliveries (Supabase row limit).`,
    );
  }
  if (dispatches.length > 0) {
    console.log(
      `First: ${toDate(dispatches[0].completedAt)}   Last: ${toDate(
        dispatches[dispatches.length - 1].completedAt,
      )}`,
    );
  }

  console.log("\nYear | days | days w/ deliveries | days w/ none | deliveries | avg/day | months w/ none");
  for (const year of years) {
    const days = allDays.filter((day) => day.startsWith(year));
    const withDeliveries = days.filter((day) => deliveriesPerDay.has(day));
    const total = days.reduce((sum, day) => sum + (deliveriesPerDay.get(day) ?? 0), 0);
    const months = [...new Set(days.map((day) => day.slice(0, 7)))];
    const emptyMonths = months.filter(
      (month) => !days.some((day) => day.startsWith(month) && deliveriesPerDay.has(day)),
    );
    console.log(
      `${year} | ${String(days.length).padStart(4)} | ${String(withDeliveries.length).padStart(18)} | ${String(
        days.length - withDeliveries.length,
      ).padStart(12)} | ${String(total).padStart(10)} | ${(total / days.length).toFixed(2).padStart(7)} | ${
        emptyMonths.length ? emptyMonths.join(", ") : "none"
      }`,
    );
  }
  const daysWithout = allDays.filter((day) => !deliveriesPerDay.has(day));
  console.log(`Days with zero deliveries: ${summarizeGaps(daysWithout)}`);

  // ---- Weather ----
  const weatherDays = new Map<string, number>();
  for (const row of weather) {
    const day = row.recordDate.slice(0, 10);
    weatherDays.set(day, (weatherDays.get(day) ?? 0) + 1);
  }
  const duplicateWeather = [...weatherDays].filter(([, count]) => count > 1).map(([day]) => day);
  const missingWeather = allDays.filter((day) => !weatherDays.has(day));

  console.log("\n--- Weather (WeatherHistory) ---");
  console.log(`Rows in database:          ${weather.length}`);
  console.log(`Rows the forecast receives: ${received.weather}`);
  if (received.weather < weather.length) {
    console.log(
      `  ⚠ The forecast query is missing ${weather.length - received.weather} weather days (Supabase row limit).`,
    );
  }
  console.log(`Missing days: ${missingWeather.length} → ${summarizeGaps(missingWeather)}`);
  console.log(
    `Duplicate days: ${duplicateWeather.length}${
      duplicateWeather.length ? ` (the forecast throws an error on these) → ${duplicateWeather.slice(0, 8).join(", ")}` : ""
    }`,
  );

  // ---- Fuel ----
  console.log("\n--- Fuel (FuelPriceHistory) ---");
  console.log(`Rows in database:          ${fuel.length}`);
  console.log(`Rows the forecast receives: ${received.fuel}`);
  if (received.fuel < fuel.length) {
    console.log(
      `  ⚠ The forecast query is missing ${fuel.length - received.fuel} fuel prices (Supabase row limit).`,
    );
  }
  if (fuel.length > 0) {
    console.log(`First: ${fuel[0].effectiveDate.slice(0, 10)}   Last: ${fuel[fuel.length - 1].effectiveDate.slice(0, 10)}`);
    if (fuel[0].effectiveDate.slice(0, 10) > START_DATE) {
      console.log(`  ⚠ No fuel price before ${fuel[0].effectiveDate.slice(0, 10)}; earlier days have no diesel price.`);
    }

    // Every fuel type DOE publishes for NCR.
    const expectedTypes = [
      "Gasoline RON 100",
      "Gasoline RON 97",
      "Gasoline RON 95",
      "Gasoline RON 91",
      "Diesel Plus",
      "Diesel",
      "Kerosene",
    ];
    const byType = new Map<string, string[]>();
    for (const row of fuel) {
      const dates = byType.get(row.fuelType) ?? [];
      dates.push(row.effectiveDate.slice(0, 10));
      byType.set(row.fuelType, dates);
    }
    const allWeeks = [...new Set(fuel.map((row) => row.effectiveDate.slice(0, 10)))];

    console.log(`\nWeeks with any fuel price: ${allWeeks.length}`);
    console.log("Fuel type          | weeks | first      | last       | weeks missing");
    for (const type of [...new Set([...expectedTypes, ...byType.keys()])]) {
      const dates = [...new Set(byType.get(type) ?? [])].sort();
      const note = expectedTypes.includes(type) ? "" : "  (not a DOE name the sync uses)";
      console.log(
        `${type.padEnd(18)} | ${String(dates.length).padStart(5)} | ${(dates[0] ?? "—").padEnd(10)} | ${(
          dates.at(-1) ?? "—"
        ).padEnd(10)} | ${allWeeks.length - dates.length}${note}`,
      );
    }
  }
  console.log("");
}

main().catch((error) => {
  console.error(error);
  // exitCode (not process.exit) avoids a Node crash on Windows.
  process.exitCode = 1;
});
