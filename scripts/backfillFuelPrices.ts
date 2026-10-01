/**
 * Backfills DOE NCR fuel prices (all fuel types) from the weekly DOE price
 * sheets, which DOE keeps on its page back to 2017.
 *
 * Run from the project root:
 *
 *   1) Check first - reads every sheet, saves NOTHING:
 *      npx tsx --env-file=.env scripts/backfillFuelPrices.ts 2022-01-01 --dry-run
 *
 *   2) Save all fuel types except Diesel (keeps your existing Diesel rows):
 *      npx tsx --env-file=.env scripts/backfillFuelPrices.ts 2022-01-01 --skip-diesel
 *
 *   3) Or save every fuel type, Diesel included:
 *      npx tsx --env-file=.env scripts/backfillFuelPrices.ts 2022-01-01
 *
 * A report is written to scripts/fuel-backfill-report.json each run.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { supabase } from "../app/lib/supabase";
import { backfillFuelPricesSince } from "../services/externalFactors/fuelPriceService";

const ALL_TYPES = [
  "Gasoline RON 100",
  "Gasoline RON 97",
  "Gasoline RON 95",
  "Gasoline RON 91",
  "Diesel Plus",
  "Diesel",
  "Kerosene",
];

async function existingDieselPrices() {
  const rows: Array<{ effectiveDate: string; pricePerUnit: number | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("FuelPriceHistory")
      .select("effectiveDate, pricePerUnit")
      .eq("fuelType", "Diesel")
      .order("effectiveDate", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const fromDate = args.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? "2022-01-01";
  const dryRun = args.includes("--dry-run");
  const skipDiesel = args.includes("--skip-diesel");
  const fuelTypes = skipDiesel ? ALL_TYPES.filter((type) => type !== "Diesel") : undefined;

  console.log(
    `${dryRun ? "DRY RUN (nothing is saved)" : "SAVING"} - DOE sheets from ${fromDate}` +
      (skipDiesel ? " - all fuel types except Diesel" : " - all fuel types"),
  );

  const result = await backfillFuelPricesSince(fromDate, {
    dryRun,
    fuelTypes,
    onProgress: (done, total, week) => {
      const status = week.error
        ? `FAILED: ${week.error}`
        : `${(week.prices ?? []).length} types read` +
          (dryRun ? "" : `, ${week.savedFuelTypes.length} saved`) +
          (week.failedFuelTypes.length
            ? `, ${week.failedFuelTypes.length} failed (${week.failedFuelTypes
                .map((failure) => `${failure.fuelType}: ${failure.reason}`)
                .join("; ")})`
            : "");
      console.log(`[${String(done).padStart(3)}/${total}] ${week.effectiveDate ?? "?"}  ${status}`);
    },
  });

  // ---- Summary per fuel type ----
  const read = result.results.filter((week) => !week.error);
  console.log(`\nSheets found: ${result.sheetsFound}   read OK: ${result.sheetsRead}   failed: ${result.sheetsFound - result.sheetsRead}`);
  if (result.undatedLinks.length) {
    console.log(`Links with no recognizable date (skipped): ${result.undatedLinks.length}`);
  }

  console.log("\nFuel type          | weeks found | first      | last       | lowest  | highest");
  for (const type of ALL_TYPES) {
    const weeks = read
      .map((week) => ({
        date: week.effectiveDate!,
        price: week.prices?.find((price) => price.fuelType === type)?.pricePerUnit,
      }))
      .filter((week): week is { date: string; price: number } => week.price !== undefined);
    const prices = weeks.map((week) => week.price);
    console.log(
      `${type.padEnd(18)} | ${String(weeks.length).padStart(11)} | ${(weeks[0]?.date ?? "—").padEnd(10)} | ${(
        weeks.at(-1)?.date ?? "—"
      ).padEnd(10)} | ${(prices.length ? Math.min(...prices).toFixed(2) : "—").padStart(7)} | ${(
        prices.length ? Math.max(...prices).toFixed(2) : "—"
      ).padStart(7)}`,
    );
  }

  // ---- How DOE Diesel compares with the Diesel already in the database ----
  if (dryRun) {
    const existing = await existingDieselPrices();
    const differences: Array<{ date: string; doe: number; existing: number }> = [];
    for (const week of read) {
      const doe = week.prices?.find((price) => price.fuelType === "Diesel")?.pricePerUnit;
      const before = existing.filter((row) => row.effectiveDate.slice(0, 10) <= week.effectiveDate!).at(-1);
      if (doe !== undefined && before?.pricePerUnit != null) {
        differences.push({ date: week.effectiveDate!, doe, existing: before.pricePerUnit });
      }
    }
    if (differences.length) {
      const averageGap =
        differences.reduce((sum, row) => sum + Math.abs(row.doe - row.existing), 0) /
        differences.length;
      console.log(
        `\nDiesel: DOE vs your existing rows, average difference ₱${averageGap.toFixed(2)} over ${differences.length} weeks.`,
      );
      for (const row of differences.filter((_, index) => index % Math.ceil(differences.length / 6) === 0)) {
        console.log(`  ${row.date}  DOE ₱${row.doe.toFixed(2)}   existing ₱${row.existing.toFixed(2)}`);
      }
    }
  }

  const reportFile = path.join(process.cwd(), "scripts", "fuel-backfill-report.json");
  await writeFile(reportFile, JSON.stringify(result, null, 2), "utf8");
  console.log(`\nFull report: ${reportFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
