// Reports every stored coordinate that no map can use. Read-only: it never
// writes, so it is safe to run against the live database at any time.
//
// A point is flagged when it is
//   missing   - NULL
//   zero      - the 0/0 placeholder bookings fall back to when geocoding fails
//   invalid   - not a number, or outside -90..90 / -180..180
//   swapped   - latitude and longitude the wrong way round (14, 121 stored as 121, 14)
//   abroad    - a real place, but not in the Philippines
//
// It also lists coordinates shared by suspiciously many rows. A single point
// repeated a hundred times is usually one bad geocoder match copied everywhere
// (the Skyway Bangkal ramp in Makati, for one), not a hundred real visits.
//
//   npx tsx scripts/auditLocations.ts
//   npx tsx scripts/auditLocations.ts --rows     # also print every flagged row

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const SHOW_ROWS = process.argv.includes("--rows");

// Generous box around the archipelago, Tawi-Tawi to the Batanes.
const PH = { minLat: 4.2, maxLat: 21.5, minLng: 116.0, maxLng: 127.0 };

// Rows sharing one exact point beyond this many are worth a look.
const CLUSTER_THRESHOLD = 20;

interface Source {
  table: string;
  id: string;
  lat: string;
  lng: string;
  /** Column that says where the point should be, when the table has one. */
  label?: string;
  /** NULL is normal here: the point is optional. */
  nullable?: boolean;
}

const SOURCES: Source[] = [
  { table: "BranchStops", id: "branchID", lat: "deliveryLat", lng: "deliverLong", label: "deliveryAddress" },
  { table: "PickupStops", id: "pickupID", lat: "pickupLat", lng: "pickupLong", label: "pickupAddress" },
  { table: "DeliveryTracking", id: "trackingID", lat: "currentLat", lng: "currentLong" },
  { table: "FleetLocations", id: "dispatch_id", lat: "latitude", lng: "longitude" },
  { table: "FleetLocationHistory", id: "historyID", lat: "latitude", lng: "longitude" },
  { table: "FoulTripIncident", id: "incidentID", lat: "latitude", lng: "longitude", nullable: true },
  { table: "WeatherHistory", id: "weatherID", lat: "latitude", lng: "longitude", label: "locationCode" },
];

type Problem = "missing" | "zero" | "invalid" | "swapped" | "abroad";

const inPH = (lat: number, lng: number) =>
  lat >= PH.minLat && lat <= PH.maxLat && lng >= PH.minLng && lng <= PH.maxLng;

function classify(rawLat: unknown, rawLng: unknown): Problem | null {
  if (rawLat === null || rawLat === undefined || rawLng === null || rawLng === undefined) return "missing";

  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "invalid";
  if (lat === 0 && lng === 0) return "zero";
  if (inPH(lng, lat)) return "swapped";
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return "invalid";
  if (!inPH(lat, lng)) return "abroad";
  return null;
}

async function main() {
  // Imported after env loading: it reads process.env at module scope.
  const { supabase } = await import("@/app/lib/supabase");

  // A plain select stops at a thousand rows; read in pages.
  async function readAll(source: Source): Promise<Record<string, unknown>[]> {
    const columns = [source.id, source.lat, source.lng, source.label].filter(Boolean).join(", ");
    const PAGE = 1000;
    const rows: Record<string, unknown>[] = [];

    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(source.table)
        .select(columns)
        .order(source.id, { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) throw new Error(`${source.table}: ${error.message}`);
      if (!data || data.length === 0) break;

      rows.push(...(data as unknown as Record<string, unknown>[]));
      if (data.length < PAGE) break;
    }

    return rows;
  }

  let totalFlagged = 0;

  for (const source of SOURCES) {
    let rows: Record<string, unknown>[];
    try {
      rows = await readAll(source);
    } catch (error) {
      console.log(`\n${source.table}: could not read (${(error as Error).message})`);
      continue;
    }

    const counts: Record<Problem, number> = { missing: 0, zero: 0, invalid: 0, swapped: 0, abroad: 0 };
    const flagged: string[] = [];
    const byPoint = new Map<string, { count: number; labels: Set<string> }>();

    for (const row of rows) {
      const problem = classify(row[source.lat], row[source.lng]);
      const label = source.label ? String(row[source.label] ?? "(no address)") : "";

      if (problem && !(problem === "missing" && source.nullable)) {
        counts[problem] += 1;
        flagged.push(`    ${problem.padEnd(8)} ${source.id}=${row[source.id]}  ${row[source.lat]}, ${row[source.lng]}  ${label}`);
      }

      if (!problem) {
        const key = `${Number(row[source.lat]).toFixed(5)}, ${Number(row[source.lng]).toFixed(5)}`;
        const entry = byPoint.get(key) ?? { count: 0, labels: new Set<string>() };
        entry.count += 1;
        if (label) entry.labels.add(label);
        byPoint.set(key, entry);
      }
    }

    const bad = Object.values(counts).reduce((a, b) => a + b, 0);
    totalFlagged += bad;

    const breakdown = (Object.entries(counts) as [Problem, number][])
      .filter(([, n]) => n > 0)
      .map(([p, n]) => `${n} ${p}`)
      .join(", ");
    console.log(`\n${source.table}: ${rows.length} row(s), ${bad} unusable${breakdown ? ` (${breakdown})` : ""}`);

    if (SHOW_ROWS) flagged.forEach((line) => console.log(line));

    // The movement tables are full of repeats by nature: a parked truck
    // reports the same spot all night. Only the booked locations are checked.
    if (source.label) {
      const clusters = [...byPoint.entries()]
        .filter(([, e]) => e.count >= CLUSTER_THRESHOLD)
        .sort((a, b) => b[1].count - a[1].count);
      for (const [point, entry] of clusters) {
        const sample = [...entry.labels].slice(0, 4).join(" | ");
        console.log(`    cluster  ${entry.count} rows at ${point}  (${entry.labels.size} distinct addresses: ${sample})`);
      }
    }
  }

  console.log(`\n${totalFlagged} unusable coordinate(s) in all.`);
  if (!SHOW_ROWS && totalFlagged > 0) console.log("Re-run with --rows to list each one.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
