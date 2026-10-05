// Puts every delivery and pickup stop where its own address says it is.
//
// The seeded stops were given one point per region rather than per town: 609
// delivery stops in Parañaque, Caloocan, Taguig and a dozen other cities all
// sit on a single spot in Manila, and Biñan, Calamba and Santa Rosa share one
// in the middle of Laguna. Others hold the 0/0 placeholder or nothing at all.
// scripts/auditLocations.ts reports all of this.
//
// Each distinct address is geocoded once. A stop is rewritten when its stored
// point is missing, 0/0, or further than MAX_DRIFT_KM from where its address
// geocodes to; stops already in the right place are left alone.
//
// When the geocoder refuses an address (it puts "JP Laurel Highway, Lipa City"
// in Santo Tomas, the next town along that highway, and rightly refuses), the
// street is dropped and the town is asked for instead. The centre of the right
// town beats no point at all.
//
//   npx tsx scripts/regeocodeStops.ts            # dry run, no writes
//   npx tsx scripts/regeocodeStops.ts --apply    # writes coordinates

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply");
const MAX_DRIFT_KM = 3;

// Addresses Mapbox gets wrong, pinned to the town centre by hand.
//   Lucena:   "Lucena City, Quezon" matches the town of Quezon, Quezon, 60 km
//             east, and passes the refusal check because "Quezon" is in the
//             address.
//   Davao, San Juan: refused outright (a street called Davao; a Manila Street
//             in Taytay), so they would otherwise keep their regional point.
const LUCENA = { latitude: 13.9414, longitude: 121.6234 };
const OVERRIDES: Record<string, { latitude: number; longitude: number }> = {
  "Lucena City, Quezon": LUCENA,
  "Diversion Road, Lucena City, Quezon": LUCENA,
  "Davao City, Davao del Sur": { latitude: 7.0731, longitude: 125.6128 },
  "San Juan City, Metro Manila": { latitude: 14.6019, longitude: 121.0355 },
};

interface Target {
  table: "BranchStops" | "PickupStops";
  id: string;
  lat: string;
  lng: string;
  address: string;
}

const TARGETS: Target[] = [
  { table: "BranchStops", id: "branchID", lat: "deliveryLat", lng: "deliverLong", address: "deliveryAddress" },
  { table: "PickupStops", id: "pickupID", lat: "pickupLat", lng: "pickupLong", address: "pickupAddress" },
];

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function main() {
  // Imported after env loading: these read process.env at module scope.
  const { supabase } = await import("@/app/lib/supabase");
  const { geocodeAddress } = await import("@/services/geo/geocodingService");

  type Point = { latitude: number; longitude: number; matchedAddress?: string; fallback?: string };
  const cache = new Map<string, Point | null>();

  async function locate(address: string): Promise<Point | null> {
    if (cache.has(address)) return cache.get(address)!;

    if (OVERRIDES[address]) {
      cache.set(address, { ...OVERRIDES[address], fallback: "pinned by hand" });
      return cache.get(address)!;
    }

    let point: Point | null = await geocodeAddress(address);
    if (!point) {
      const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 2) {
        const town = parts.slice(1).join(", ");
        const found = await geocodeAddress(town);
        if (found) point = { ...found, fallback: town };
      }
    }

    cache.set(address, point);
    return point;
  }

  for (const target of TARGETS) {
    // A plain select stops at a thousand rows; read in pages.
    const PAGE = 1000;
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(target.table)
        .select(`${target.id}, ${target.lat}, ${target.lng}, ${target.address}`)
        .order(target.id, { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) throw new Error(`Failed to read ${target.table}: ${error.message}`);
      if (!data || data.length === 0) break;
      rows.push(...(data as unknown as Record<string, unknown>[]));
      if (data.length < PAGE) break;
    }

    console.log(`\n${target.table}: ${rows.length} row(s)`);

    const distinct = [...new Set(rows.map((r) => String(r[target.address] ?? "").trim()).filter(Boolean))];
    for (const address of distinct) {
      const point = await locate(address);
      if (!point) console.log(`  REFUSED   ${address}`);
      else if (point.fallback) console.log(`  town only ${address}  ->  ${point.fallback}`);
    }

    let correct = 0;
    let noAddress = 0;
    let unresolved = 0;
    const moves: { id: unknown; point: Point }[] = [];
    const movedByAddress = new Map<string, number>();

    for (const row of rows) {
      const address = String(row[target.address] ?? "").trim();
      if (!address) {
        noAddress += 1;
        continue;
      }

      const point = cache.get(address);
      if (!point) {
        unresolved += 1;
        continue;
      }

      const lat = row[target.lat] === null ? NaN : Number(row[target.lat]);
      const lng = row[target.lng] === null ? NaN : Number(row[target.lng]);
      const usable = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

      if (usable && distanceKm(lat, lng, point.latitude, point.longitude) <= MAX_DRIFT_KM) {
        correct += 1;
        continue;
      }

      moves.push({ id: row[target.id], point });
      movedByAddress.set(address, (movedByAddress.get(address) ?? 0) + 1);
    }

    for (const [address, count] of [...movedByAddress.entries()].sort((a, b) => b[1] - a[1])) {
      const p = cache.get(address)!;
      console.log(`  ${String(count).padStart(4)} x ${address}  ->  ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`);
    }

    let written = 0;
    if (APPLY) {
      for (const move of moves) {
        const { error } = await supabase
          .from(target.table)
          .update({ [target.lat]: move.point.latitude, [target.lng]: move.point.longitude })
          .eq(target.id, move.id);

        if (error) console.error(`  failed ${target.id}=${move.id}: ${error.message}`);
        else written += 1;
      }
    }

    console.log(
      `  ${APPLY ? `Moved ${written}` : `Would move ${moves.length}`}; ${correct} already correct; ` +
        `${unresolved} unresolvable; ${noAddress} without an address.`,
    );
  }

  if (!APPLY) console.log("\nRe-run with --apply to write these coordinates.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
