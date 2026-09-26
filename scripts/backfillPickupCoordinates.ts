// Fills in coordinates for collection points booked before their addresses
// were resolved, or whose address the geocoder used to refuse.
//
// Without these a pickup cannot be drawn on any map, and the route a truck is
// given skips the collection entirely - it runs from wherever the truck is
// straight to the deliveries.
//
// Unlike delivery stops, a pickup carries its own address, so nothing has to
// be matched against another table. Addresses repeat heavily - a hundred and
// fifty pickups say "Makati City, Metro Manila" - so each distinct one is
// looked up once.
//
//   npx tsx --env-file=.env scripts/backfillPickupCoordinates.ts           # dry run
//   npx tsx --env-file=.env scripts/backfillPickupCoordinates.ts --apply   # writes

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply");

interface PickupRow {
  pickupID: number;
  warehouseName: string | null;
  pickupAddress: string | null;
  warehouseID: string | null;
}

async function main() {
  // Imported after env loading: these read process.env at module scope.
  const { supabase } = await import("@/app/lib/supabase");
  const { geocodeAddress } = await import("@/services/geo/geocodingService");

  // Read in pages. A plain select returns at most a thousand rows, which is
  // less than this table holds - the first run of this script quietly did a
  // third of the work and reported it as all of it.
  const PAGE = 1000;
  const pending: (PickupRow & { pickupLat: number | null; pickupLong: number | null })[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("PickupStops")
      .select("pickupID, warehouseName, pickupAddress, warehouseID, pickupLat, pickupLong")
      .or("pickupLat.is.null,pickupLat.eq.0")
      .order("pickupID", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Failed to read pickups: ${error.message}`);
    if (!data || data.length === 0) break;

    pending.push(...(data as typeof pending));
    if (data.length < PAGE) break;
  }

  console.log(`${pending.length} pickup(s) without coordinates`);
  if (pending.length === 0) return;

  // A warehouse on file knows where it is more precisely than a pickup row
  // that only names a city.
  const { data: warehouses } = await supabase.from("Warehouse").select("warehouseID, warehouseLoc");
  const warehouseAddress = new Map(
    (warehouses ?? []).filter((w) => w.warehouseLoc).map((w) => [w.warehouseID as string, w.warehouseLoc as string]),
  );

  const addressFor = (pickup: PickupRow): string =>
    (pickup.warehouseID ? warehouseAddress.get(pickup.warehouseID) : null) ?? pickup.pickupAddress ?? "";

  const distinct = [...new Set(pending.map(addressFor).map((a) => a.trim()).filter(Boolean))];
  console.log(`${distinct.length} distinct address(es) to look up\n`);

  const resolved = new Map<string, { latitude: number; longitude: number; matchedAddress?: string }>();
  for (const address of distinct) {
    const coordinates = await geocodeAddress(address);
    if (coordinates) {
      resolved.set(address, coordinates);
      console.log(`  resolved  ${address}`);
      console.log(`            -> ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}  ${coordinates.matchedAddress ?? ""}`);
    } else {
      console.log(`  REFUSED   ${address}  (left without coordinates rather than guessed at)`);
    }
  }

  let written = 0;
  let unresolved = 0;
  let noAddress = 0;

  for (const pickup of pending) {
    const address = addressFor(pickup).trim();
    if (!address) {
      noAddress += 1;
      continue;
    }

    const coordinates = resolved.get(address);
    if (!coordinates) {
      unresolved += 1;
      continue;
    }

    if (APPLY) {
      const { error: updateError } = await supabase
        .from("PickupStops")
        .update({ pickupLat: coordinates.latitude, pickupLong: coordinates.longitude })
        .eq("pickupID", pickup.pickupID);

      if (updateError) {
        console.error(`  failed to write ${pickup.warehouseName}: ${updateError.message}`);
        continue;
      }
    }

    written += 1;
  }

  console.log(
    `\n${APPLY ? "Updated" : "Would update"} ${written} pickup(s); ` +
      `${unresolved} whose address could not be resolved; ${noAddress} with no address at all.`,
  );
  if (!APPLY && written > 0) console.log("Re-run with --apply to write these coordinates.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
