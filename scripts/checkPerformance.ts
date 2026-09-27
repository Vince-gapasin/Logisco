// Checks the performance rules against the live database, before anybody is
// shown a number worked out from them.
//
//   npx tsx --env-file=.env scripts/checkPerformance.ts
//
// Reads only. It exists because the risky parts of this feature are not the
// arithmetic - that is unit tested - but the assumptions underneath it: that
// BranchStops.expectedTime is a time of day, that POD rows join to stops by
// branchID, that the audit trail carries ASSIGN and CREW_ACCEPT. A punctuality
// figure that comes out at 100% or 0% for the whole fleet is not a good result,
// it is a broken comparison.

import { supabase } from "../app/lib/supabase";
import { selectAll } from "../app/lib/selectAll";
import { isStopDelivered } from "../app/lib/enums";
import { minutesLate, ON_TIME_GRACE_MIN, signalsNotWorthScoring } from "../app/lib/performance";
import { getEmployeePerformance } from "../services/employee/performanceService";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

async function countOf(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  console.log("Reading the whole stop history...\n");

  const stops = await selectAll<{
    branchID: number;
    expectedTime: string | null;
    completedAt: string | null;
    stopStatus: string | null;
  }>((from, to) =>
    supabase
      .from("BranchStops")
      .select("branchID, expectedTime, completedAt, stopStatus")
      .range(from, to),
  );

  const delivered = stops.filter((stop) => isStopDelivered(stop.stopStatus) && stop.completedAt);
  const lateness = delivered
    .map((stop) => minutesLate(stop.expectedTime, stop.completedAt))
    .filter((minutes): minutes is number => minutes !== null);

  const onTime = lateness.filter((minutes) => minutes <= ON_TIME_GRACE_MIN).length;

  console.log("STOPS");
  console.log(`  on record              ${stops.length}`);
  console.log(`  delivered with a time  ${delivered.length}`);
  console.log(`  comparable to a slot   ${lateness.length}`);
  console.log(`  on time (${ON_TIME_GRACE_MIN} min grace) ${onTime} (${Math.round((onTime / Math.max(1, lateness.length)) * 100)}%)`);
  console.log(`  median minutes late    ${median(lateness)}`);

  // The distribution is the real check. A sane fleet is spread across these;
  // everything in one bucket means the comparison is wrong, not that the
  // drivers are perfect.
  const buckets: [string, (m: number) => boolean][] = [
    ["more than 2h early", (m) => m < -120],
    ["30m to 2h early   ", (m) => m >= -120 && m < -30],
    ["within 30m early  ", (m) => m >= -30 && m <= 0],
    ["0 to 30m late     ", (m) => m > 0 && m <= 30],
    ["30m to 2h late    ", (m) => m > 30 && m <= 120],
    ["more than 2h late ", (m) => m > 120],
  ];

  console.log("\n  spread:");
  for (const [label, test] of buckets) {
    const hits = lateness.filter(test).length;
    const share = Math.round((hits / Math.max(1, lateness.length)) * 100);
    console.log(`    ${label}  ${String(hits).padStart(5)}  ${"#".repeat(Math.round(share / 2))} ${share}%`);
  }

  // ---- What the company records at all ----
  const [pods, dispatches, stopsDone] = await Promise.all([
    countOf("POD"),
    countOf("DispatchOrder"),
    Promise.resolve(delivered.length),
  ]);

  const audits = await selectAll<{ action: string; recordID: string }>((from, to) =>
    supabase.from("AuditTrail").select("action, recordID").range(from, to),
  );
  const assigned = new Set(audits.filter((row) => /^(ASSIGN|REASSIGN)$/.test(row.action)).map((r) => r.recordID));
  const accepted = new Set(audits.filter((row) => row.action === "CREW_ACCEPT").map((r) => r.recordID));

  // Proof joins to a stop by branchID; how many delivered stops actually have one.
  const proofRows = await selectAll<{ branchID: number | null }>((from, to) =>
    supabase.from("POD").select("branchID").range(from, to),
  );
  const stopsWithProof = new Set(
    proofRows.map((row) => row.branchID).filter((id): id is number => id !== null),
  );
  const deliveredIDs = new Set(delivered.map((stop) => stop.branchID));
  const provenStops = [...stopsWithProof].filter((id) => deliveredIDs.has(id)).length;

  console.log("\nWHAT THE COMPANY RECORDS");
  console.log(`  trips                        ${dispatches}`);
  console.log(`  audit entries                ${audits.length}`);
  console.log(`  trips with an ASSIGN entry   ${assigned.size}`);
  console.log(`  trips with a CREW_ACCEPT     ${accepted.size}`);
  console.log(`  POD rows                     ${pods}`);
  console.log(`  delivered stops with proof   ${provenStops} of ${stopsDone}`);

  const thin = signalsNotWorthScoring({
    stopsCompleted: stopsDone,
    proofsUploaded: provenStops,
    tripsHandedOver: assigned.size,
    answered: accepted.size,
    stopsJudged: lateness.length,
    stopsOnTime: onTime,
  });
  console.log(`\n  not worth scoring yet: ${thin.length > 0 ? thin.join(", ") : "nothing - all signals usable"}`);

  // ---- Do the new tables exist yet? ----
  console.log("\nNEW TABLES");
  for (const table of ["DeliveryFeedback", "StopDelayExcuse"]) {
    // Not a head-only count: with head: true a missing table comes back without
    // an error at all, which had this reporting both tables as present.
    const { error } = await supabase.from(table).select("*").limit(1);
    console.log(`  ${table.padEnd(18)} ${error ? "MISSING - apply the migration" : "present"}`);
  }

  // ---- The busiest drivers, so a real name can be sanity checked ----
  const trips = await selectAll<{ driverID: string | null; status: string }>((from, to) =>
    supabase.from("DispatchOrder").select("driverID, status").not("driverID", "is", null).range(from, to),
  );

  const perDriver = new Map<string, number>();
  for (const trip of trips) {
    if (trip.driverID) perDriver.set(trip.driverID, (perDriver.get(trip.driverID) ?? 0) + 1);
  }

  const busiest = [...perDriver.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const { data: names } = await supabase
    .from("Employee")
    .select("employeeID, employeeName, role")
    .in("employeeID", busiest.map(([id]) => id));

  console.log("\nBUSIEST DRIVERS (for spot checking a real record)");
  for (const [id, count] of busiest) {
    const who = (names ?? []).find((row) => row.employeeID === id);
    console.log(`  ${count.toString().padStart(4)} trips  ${who?.employeeName ?? "?"} (${who?.role ?? "?"})  ${id}`);
  }

  // ---- The real thing, end to end, on a real record ----
  const [busiestID] = busiest[0] ?? [];
  if (!busiestID) return;

  console.log("");
  console.log("THE SERVICE, ON A REAL RECORD");
  try {
    const record = await getEmployeePerformance(busiestID, { windowDays: null });
    const assessed = record.performance;

    console.log(`  ${record.employeeName} (${record.role}) - ${record.window.label}`);
    console.log(`  rating: ${assessed?.rating ?? "withheld"}`);
    if (assessed?.withheld) console.log(`  because: ${assessed.withheld}`);

    for (const component of assessed?.components ?? []) {
      const rate = component.rate === null ? "  n/a" : `${Math.round(component.rate * 100)}%`.padStart(5);
      const weight =
        !component.scored
          ? "not scored"
          : assessed?.rating === null
            ? "counted, but no rating given"
            : `${Math.round(component.weight * 100)}% of rating`;
      console.log(
        `    ${component.label.padEnd(26)} ${rate}  (${component.numerator}/${component.denominator})  ${weight}`,
      );
    }

    console.log(
      `  breakdowns ${record.reported.breakdowns.length}, declines ${record.reported.declines.length}, ` +
        `stall alerts ${record.reported.stallAlerts}, late stops ${record.reported.lateStops.length}, ` +
        `excused ${record.reported.excusedStops.length}`,
    );
    console.log(`  client answers ${assessed?.facts.feedbackResponses ?? 0}, comments ${record.comments.length}`);
  } catch (error) {
    console.log(`  FAILED: ${error instanceof Error ? error.message : error}`);
    console.log("  (expected until the migration in supabase/migrations is applied)");
  }

  // A helper is a different path through the service: their answer to a trip
  // lives on DispatchHelper, not on the dispatch.
  const helperRows = await selectAll<{ helperID: string | null }>((from, to) =>
    supabase.from("DispatchHelper").select("helperID").not("helperID", "is", null).range(from, to),
  );
  const perHelper = new Map<string, number>();
  for (const row of helperRows) {
    if (row.helperID) perHelper.set(row.helperID, (perHelper.get(row.helperID) ?? 0) + 1);
  }
  const [busiestHelper] = [...perHelper.entries()].sort((a, b) => b[1] - a[1]);

  if (!busiestHelper) return;

  console.log("");
  console.log("THE SERVICE, ON A HELPER");
  try {
    const record = await getEmployeePerformance(busiestHelper[0], { windowDays: null });
    console.log(`  ${record.employeeName} (${record.role}) - ${busiestHelper[1]} assignments`);
    console.log(`  rating: ${record.performance?.rating ?? "withheld"}`);
    for (const component of record.performance?.components ?? []) {
      const rate = component.rate === null ? " n/a" : `${Math.round(component.rate * 100)}%`;
      console.log(`    ${component.label.padEnd(26)} ${rate.padStart(5)}  (${component.numerator}/${component.denominator})${component.scored ? "" : "  not scored"}`);
    }
    console.log(`  declines ${record.reported.declines.length}, breakdowns ${record.reported.breakdowns.length}`);
  } catch (error) {
    console.log(`  FAILED: ${error instanceof Error ? error.message : error}`);
  }
}

main().catch((error) => {
  console.error("\nFailed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
