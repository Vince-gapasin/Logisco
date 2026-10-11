// What the server checks about a proof-of-delivery scan before a stop closes.
//
// The phone has already looked at the paper (app/lib/podScan.ts). What the
// phone cannot be trusted to judge on its own is whether the photograph is
// real: taken here, now, and not used before. Those are checked here, against
// the stop's own address and the crew's own arrival, and against every proof
// already on file.
//
// A crew member can still sign a receipt themselves. They cannot do it from
// the truck, the depot, or yesterday, and they cannot reuse a photograph - so
// faking one means standing at the client's address with the client's form,
// and the client then sees the result on their tracking page.

import { createHash } from "node:crypto";
import { distanceMeters, hammingDistance, MIN_WORDS, type PodScanReport } from "@/app/lib/podScan";

/** How far from the stop's pin a scan may be taken. Pins are rarely on the door. */
export const MAX_DISTANCE_M = 200;
/** A GPS fix vaguer than this cannot place the phone at the stop either way. */
const MAX_TRUSTED_ACCURACY_M = 150;
/** How old a scan may be when it reaches us: long enough for a slow network. */
export const MAX_SCAN_AGE_MS = 20 * 60 * 1000;
/** Phones' clocks drift; this much is forgiven. */
const CLOCK_SLACK_MS = 5 * 60 * 1000;
/** Two scans of one page land within this many bits of each other. */
export const SAME_PICTURE_BITS = 6;

export interface StopPlace {
  latitude: number | null;
  longitude: number | null;
  arrivedAt: string | null;
}

export interface ScanCheck {
  /** Set when the stop must not close: what the crew are told. */
  refusal: string | null;
  /** For the office: the stop closes, but somebody should look. */
  flags: string[];
}

export function sha256(bytes: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

/** The report the phone sent, or null when it is missing or malformed. */
export function parseScanReport(raw: string | null): PodScanReport | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PodScanReport>;
    if (value.method !== "scanner" && value.method !== "camera") return null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      method: value.method,
      capturedAt: typeof value.capturedAt === "string" ? value.capturedAt : "",
      latitude: num(value.latitude),
      longitude: num(value.longitude),
      accuracy: num(value.accuracy),
      textWords: num(value.textWords) ?? 0,
      signature: typeof value.signature === "boolean" ? value.signature : null,
      nameFound: value.nameFound === true,
      dHash: typeof value.dHash === "string" && /^[0-9a-f]{16}$/.test(value.dHash) ? value.dHash : null,
      flags: Array.isArray(value.flags) ? value.flags.filter((f): f is string => typeof f === "string").slice(0, 5) : [],
    };
  } catch {
    return null;
  }
}

/** A stop pin of 0,0 is the placeholder for "never geocoded". */
function hasPlace(place: StopPlace): place is StopPlace & { latitude: number; longitude: number } {
  return Boolean(place.latitude) && Boolean(place.longitude);
}

export function checkPodScan(input: {
  report: PodScanReport | null;
  place: StopPlace;
  now: number;
  /** Hamming-near fingerprints already used on other proofs. */
  earlierHashes: string[];
  /** Whether this exact file is already on another proof. */
  sameFileUsed: boolean;
}): ScanCheck {
  const { report, place, now } = input;
  const flags: string[] = [];

  if (input.sameFileUsed) {
    return { refusal: "This photo was already used as proof for another stop. Scan this stop's receipt.", flags };
  }

  // An app from before the scanner. The photo is kept and the office told;
  // refusing it would strand every crew member who has not updated yet.
  if (!report || report.method !== "scanner") {
    flags.push("Not taken with the document scanner (the crew app needs updating).");
    return { refusal: null, flags };
  }

  // The phone refuses these itself; a request that skipped it is refused here.
  if (report.textWords < MIN_WORDS) {
    return { refusal: "No receipt text could be read. Scan the whole receipt again.", flags };
  }
  if (report.signature === false) {
    return { refusal: "The signature space looks blank. Have the receiver sign, then scan again.", flags };
  }

  if (report.dHash && input.earlierHashes.some((hash) => hammingDistance(hash, report.dHash as string) <= SAME_PICTURE_BITS)) {
    return { refusal: "This receipt was already scanned for another stop. Scan this stop's own receipt.", flags };
  }

  // When. The phone's clock, forgiven a little drift.
  const captured = Date.parse(report.capturedAt);
  if (Number.isNaN(captured)) {
    flags.push("The scan had no capture time.");
  } else {
    if (now - captured > MAX_SCAN_AGE_MS) {
      return { refusal: "This scan is too old. Scan the receipt again now.", flags };
    }
    const arrived = place.arrivedAt ? Date.parse(place.arrivedAt) : NaN;
    if (!Number.isNaN(arrived) && captured < arrived - CLOCK_SLACK_MS) {
      return { refusal: "This receipt was scanned before you arrived at this stop. Scan it again here.", flags };
    }
  }

  // Where.
  if (!hasPlace(place)) {
    flags.push("The stop has no map location, so where the scan was taken was not checked.");
  } else if (report.latitude === null || report.longitude === null) {
    flags.push("The phone gave no location for the scan.");
  } else {
    const distance = distanceMeters(
      { latitude: report.latitude, longitude: report.longitude },
      { latitude: place.latitude, longitude: place.longitude },
    );
    const accuracy = report.accuracy ?? 0;
    if (distance - Math.min(accuracy, MAX_TRUSTED_ACCURACY_M) > MAX_DISTANCE_M) {
      return {
        refusal: `This receipt was scanned about ${Math.round(distance)} m from the stop. Scan it at the delivery address.`,
        flags,
      };
    }
    if (accuracy > MAX_TRUSTED_ACCURACY_M) {
      flags.push(`The phone's location was imprecise (±${Math.round(accuracy)} m).`);
    }
  }

  return { refusal: null, flags: [...report.flags, ...flags] };
}
