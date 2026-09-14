// Fills in coordinates for delivery stops booked before addresses were
// geocoded. Those rows hold the 0/0 placeholder, so they cannot be plotted on
// any map.
//
// BranchStops has no address column: the address lives on the client's Branch
// record, matched by client and branch name.
//
//   npx tsx scripts/backfillStopCoordinates.ts            # dry run, no writes
//   npx tsx scripts/backfillStopCoordinates.ts --apply    # writes coordinates

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply");

async function main() {
  // Imported after env loading: these read process.env at module scope.
  const { supabase } = await import("@/app/lib/supabase");
  const { geocodeAddress } = await import("@/services/geo/geocodingService");

  const { data: stops, error } = await supabase
    .from("BranchStops")
    .select(`branchID, branchName, deliveryLat, deliverLong, orderID, Order ( clientID )`)
    .or("deliveryLat.is.null,deliveryLat.eq.0");

  if (error) throw new Error(`Failed to read stops: ${error.message}`);

  const pending = stops ?? [];
  console.log(`${pending.length} stop(s) without coordinates`);
  if (pending.length === 0) return;

  const { data: branches, error: branchError } = await supabase
    .from("Branch")
    .select("clientID, branchName, deliveryAddress");

  if (branchError) throw new Error(`Failed to read branches: ${branchError.message}`);

  const addressByKey = new Map<string, string>();
  for (const branch of branches ?? []) {
    if (!branch.deliveryAddress) continue;
    addressByKey.set(`${branch.clientID}::${String(branch.branchName).toLowerCase()}`, branch.deliveryAddress);
  }

  let located = 0;
  let missingAddress = 0;
  let notGeocoded = 0;

  for (const stop of pending as any[]) {
    const order = Array.isArray(stop.Order) ? stop.Order[0] : stop.Order;
    const key = `${order?.clientID}::${String(stop.branchName).toLowerCase()}`;
    const address = addressByKey.get(key);

    if (!address) {
      missingAddress += 1;
      console.log(`  - ${stop.branchName}: no matching branch address`);
      continue;
    }

    const coordinates = await geocodeAddress(address);
    if (!coordinates) {
      notGeocoded += 1;
      console.log(`  - ${stop.branchName}: could not geocode "${address}"`);
      continue;
    }

    console.log(
      `  ${APPLY ? "updating" : "would update"} ${stop.branchName}
` +
        `      asked for : ${address}
` +
        `      matched   : ${coordinates.matchedAddress ?? "(no label returned)"}
` +
        `      coords    : ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
    );

    if (APPLY) {
      const { error: updateError } = await supabase
        .from("BranchStops")
        .update({ deliveryLat: coordinates.latitude, deliverLong: coordinates.longitude })
        .eq("branchID", stop.branchID);

      if (updateError) {
        console.error(`    failed: ${updateError.message}`);
        continue;
      }
    }

    located += 1;
  }

  console.log(
    `\n${APPLY ? "Updated" : "Would update"} ${located}; ` +
      `${missingAddress} without a branch address; ${notGeocoded} not geocodable.`,
  );
  if (!APPLY && located > 0) console.log("Re-run with --apply to write these coordinates.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
