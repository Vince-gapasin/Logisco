/**
 * Checks how reliable the delivery forecast is at monthly, weekly and daily
 * level, using your real data. Read-only: nothing is saved to the database.
 *
 * Run from the project root:
 *   npx tsx --env-file=.env scripts/evaluateForecastAccuracy.ts
 *
 * Writes scripts/forecast-accuracy-report.json as well.
 *
 * "Best possible" error: deliveries arrive randomly, so even a perfect
 * forecast of the average is off by some amount. For counts like these the
 * unavoidable average error is about sqrt(2 x average / pi). If the model's
 * error is close to that, more modelling won't help - only more volume will.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { generateForecast } from "../services/forecasting/forecastingService";

type Pair = { period: string; expected: number; actual: number };

function summarize(pairs: Pair[]) {
  const n = pairs.length;
  const meanActual = pairs.reduce((sum, pair) => sum + pair.actual, 0) / n;
  const errors = pairs.map((pair) => pair.actual - pair.expected);
  const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / n;
  const bias = errors.reduce((sum, error) => sum + error, 0) / n;
  const bestPossibleMae = Math.sqrt((2 * meanActual) / Math.PI);
  const totalSquares = pairs.reduce((sum, pair) => sum + (pair.actual - meanActual) ** 2, 0);
  const residualSquares = errors.reduce((sum, error) => sum + error ** 2, 0);
  return {
    periods: n,
    averageActual: round(meanActual),
    mae: round(mae),
    maePercentOfAverage: round((mae / meanActual) * 100),
    bias: round(bias), // + means the forecast is too low on average
    bestPossibleMae: round(bestPossibleMae),
    bestPossiblePercent: round((bestPossibleMae / meanActual) * 100),
    rSquared: totalSquares === 0 ? null : round(1 - residualSquares / totalSquares, 3),
    withinTenPercent: round(
      (pairs.filter((pair) => Math.abs(pair.actual - pair.expected) <= 0.1 * Math.max(pair.actual, 1)).length / n) * 100,
    ),
  };
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function line(label: string, s: ReturnType<typeof summarize>) {
  return (
    `${label.padEnd(26)} periods ${String(s.periods).padStart(3)} | avg actual ${String(s.averageActual).padStart(6)} | ` +
    `avg error ±${String(s.mae).padStart(5)} (${String(s.maePercentOfAverage).padStart(5)}%) | ` +
    `best possible ±${s.bestPossibleMae} (${s.bestPossiblePercent}%) | bias ${s.bias >= 0 ? "+" : ""}${s.bias}`
  );
}

async function main() {
  const forecast = await generateForecast();
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  // ---- Model selection (12 completed months held out) ----
  const selection = forecast.modelSelection;
  console.log(`\nSelected model: ${selection.selectedLabel}${selection.ridgePenalty ? ` (penalty ${selection.ridgePenalty})` : ""}`);
  console.log(`Trained on ${forecast.trainingMonths} completed months; tested on the last ${selection.validationMonths}.`);
  console.log("\nTop candidates on the 12 held-out months (lower error is better):");
  for (const candidate of selection.candidates.slice(0, 8)) {
    console.log(
      `  ${candidate.label.padEnd(58)} ${candidate.ridgePenalty !== null ? `p=${String(candidate.ridgePenalty).padEnd(5)}` : "       "} ` +
        `avg error ±${candidate.mae}  RMSE ${candidate.rmse}  R² ${candidate.rSquared ?? "—"}`,
    );
  }

  // ---- Monthly history: last 12 completed months, honest out-of-sample baselines ----
  const months = forecast.monthly
    .filter((month) => month.periodStart.slice(0, 7) < currentMonth)
    .map((month) => ({ period: month.periodStart.slice(0, 7), actual: month.actualVolume }));
  const actualByMonth = new Map(months.map((month) => [month.period, month.actual]));
  const lastYear = months.slice(-12);

  const shift = (period: string, delta: number) => {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    return date.toISOString().slice(0, 7);
  };

  const seasonalNaive: Pair[] = lastYear.map((month) => ({
    period: month.period,
    actual: month.actual,
    expected: actualByMonth.get(shift(month.period, -12)) ?? 0,
  }));
  const movingAverage: Pair[] = lastYear.map((month) => ({
    period: month.period,
    actual: month.actual,
    expected:
      [1, 2, 3].reduce((sum, offset) => sum + (actualByMonth.get(shift(month.period, -offset)) ?? 0), 0) / 3,
  }));
  const displayed: Pair[] = forecast.monthly
    .filter((month) => lastYear.some((last) => last.period === month.periodStart.slice(0, 7)))
    .map((month) => ({
      period: month.periodStart.slice(0, 7),
      actual: month.actualVolume,
      expected: month.expectedVolume,
    }));

  console.log("\n=== MONTHLY (last 12 completed months) ===");
  console.log(line("Shown on the page", summarize(displayed)));
  console.log(line("Seasonal naive (test)", summarize(seasonalNaive)));
  console.log(line("3-month average (test)", summarize(movingAverage)));
  console.log("\nMonth     forecast  actual  error");
  for (const pair of displayed) {
    console.log(
      `${pair.period}  ${String(pair.expected).padStart(8)}  ${String(pair.actual).padStart(6)}  ${(pair.actual - pair.expected >= 0 ? "+" : "") + (pair.actual - pair.expected)}`,
    );
  }

  // ---- Weekly: the page splits each month's forecast across its weeks ----
  const completedWeeks = forecast.weekly.filter(
    (week) => week.actualVolume !== null && week.periodEnd < today,
  );
  const fullWeeks = completedWeeks.filter((week) => week.weekOfMonth <= 4).slice(-52);
  const weeklyPairs: Pair[] = fullWeeks.map((week) => ({
    period: week.periodStart,
    expected: week.expectedVolume,
    actual: week.actualVolume ?? 0,
  }));

  // ---- Daily ----
  const completedDays = forecast.daily.filter((day) => day.actualVolume !== null).slice(-120);
  const dailyPairs: Pair[] = completedDays.map((day) => ({
    period: day.periodStart,
    expected: day.expectedVolume,
    actual: day.actualVolume ?? 0,
  }));

  console.log("\n=== WEEKLY (last 52 full 7-day weeks) ===");
  console.log(line("Shown on the page", summarize(weeklyPairs)));
  console.log("\n=== DAILY (last 120 days) ===");
  console.log(line("Shown on the page", summarize(dailyPairs)));
  console.log(
    `Days with zero deliveries: ${round((dailyPairs.filter((pair) => pair.actual === 0).length / dailyPairs.length) * 100)}%`,
  );

  // ---- Volume per year ----
  console.log("\n=== VOLUME ===");
  const byYear = new Map<string, number[]>();
  for (const month of months) {
    const year = month.period.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), month.actual]);
  }
  for (const [year, values] of byYear) {
    const total = values.reduce((sum, value) => sum + value, 0);
    console.log(
      `${year}: ${values.length} months, ${total} deliveries, avg ${round(total / values.length)} / month, ` +
        `min ${Math.min(...values)}, max ${Math.max(...values)}`,
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    selection,
    trainingMonths: forecast.trainingMonths,
    monthly: {
      displayed: summarize(displayed),
      seasonalNaive: summarize(seasonalNaive),
      movingAverage: summarize(movingAverage),
      rows: displayed,
    },
    weekly: { displayed: summarize(weeklyPairs), rows: weeklyPairs },
    daily: { displayed: summarize(dailyPairs) },
    months,
  };
  const file = path.join(process.cwd(), "scripts", "forecast-accuracy-report.json");
  await writeFile(file, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nFull report: ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
