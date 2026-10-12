// Whether a maintenance photo shows mechanic work, decided on the device.
//
// A maintenance log used to take any picture at all - a selfie, a screenshot,
// a photo from last month - and nobody could tell until the office opened it.
// The mechanic's phone or PC now runs a small image model (MobileNet, in
// repairPhotoCheck.ts) over the picture before the log is saved, and this file
// decides from what the model saw whether it is a truck, a part of one, or the
// tools working on it.
//
// MobileNet knows the 1,000 ImageNet classes, not "worn brake pad", so what it
// says about a close-up is a near neighbour: an engine bay comes back as a
// grille or a radiator, a hub as a car wheel or a disk brake. The list below
// is those neighbours. The server cannot re-run the model, so - like the
// receipt scan - what it checks is that the picture is new and not reused
// (services/history-logs/repairPhotoCheck.ts); this is the part that tells the
// mechanic, at the truck, to take another.
//
// Pure functions over plain data, so they run in the browser and in tests.

/** One of the model's guesses: an ImageNet class and how sure it is. */
export interface Prediction {
  className: string;
  probability: number;
}

/** What the device sends with each photo. */
export interface RepairPhotoReport {
  /** "camera": taken just now in the app. "file": chosen from a PC. */
  method: "camera" | "file";
  capturedAt: string;
  model: string;
  /** false when the model could not run; the server then saves it for review. */
  checked: boolean;
  /** The model's verdict. A "refused" report is never accepted. */
  verdict: "passed" | "refused" | null;
  /** How much of the model's belief went to mechanic classes, 0 to 1. */
  score: number;
  /** The model's top guesses, short names, for the office. */
  topLabels: string[];
  /** 16 hex characters: a fingerprint that survives re-saving. */
  dHash: string | null;
}

export interface RepairPhotoVerdict {
  verdict: "passed" | "refused";
  score: number;
  topLabels: string[];
  /** What the mechanic is told when it is refused. */
  reason: string | null;
}

export const MODEL_NAME = "mobilenet_v2_100_224";

/**
 * ImageNet classes that mean a vehicle, a part of one, or the work on it, by
 * the first name MobileNet gives each (its labels list synonyms after a comma).
 */
export const MECHANIC_LABELS: ReadonlySet<string> = new Set([
  // Trucks and the vehicles a truck is most often mistaken for.
  "pickup",
  "trailer truck",
  "tow truck",
  "moving van",
  "garbage truck",
  "fire engine",
  "police van",
  "minivan",
  "minibus",
  "jeep",
  "ambulance",
  "school bus",
  "trolleybus",
  "recreational vehicle",
  "beach wagon",
  "cab",
  "limousine",
  "convertible",
  "sports car",
  "racer",
  "Model T",
  "half track",
  "tractor",
  "forklift",
  "snowplow",
  "plow",
  "harvester",
  "tank",
  // Parts of one, as a close-up comes back.
  "car wheel",
  "disk brake",
  "grille",
  "radiator",
  "car mirror",
  "seat belt",
  "odometer",
  "oil filter",
  "gas pump",
  "chain",
  // The tools. (Not "spotlight": a logo on a dark ground came back as one.)
  "screwdriver",
  "screw",
  "hammer",
  "power drill",
  "carpenter's kit",
  "chain saw",
  "hook",
]);

/**
 * How much of the model's top guesses must be mechanic classes: high enough
 * that a screenshot, a document or a person is refused, low enough that a
 * greasy close-up whose best guess is a grille still passes.
 *
 * Calibrated on 37 pictures that are not mechanic work - the 28 photos already
 * on the logs (all screenshots and test pictures), two receipts, and plain
 * walls, noise, text and logos: every one scores under 0.07. Real repair
 * photos have still to be run through it.
 */
export const MIN_MECHANIC_SCORE = 0.2;

/** "pickup, pickup truck" -> "pickup". */
export function shortLabel(className: string): string {
  return className.split(",")[0].trim();
}

export function evaluateRepairPhoto(predictions: Prediction[]): RepairPhotoVerdict {
  const top = [...predictions].sort((a, b) => b.probability - a.probability).slice(0, 5);
  const score = top
    .filter((p) => MECHANIC_LABELS.has(shortLabel(p.className)))
    .reduce((sum, p) => sum + p.probability, 0);
  const topLabels = top.map((p) => shortLabel(p.className));
  const rounded = Math.round(score * 1000) / 1000;

  if (score >= MIN_MECHANIC_SCORE) {
    return { verdict: "passed", score: rounded, topLabels, reason: null };
  }
  const looksLike = topLabels.slice(0, 2).join(", ");
  return {
    verdict: "refused",
    score: rounded,
    topLabels,
    reason: `This doesn't look like a truck or a repair${looksLike ? ` (it looks like: ${looksLike})` : ""}. Take a photo of the truck or the work on it.`,
  };
}

/** The report for a photo the model could not look at; the server saves it for review. */
export function uncheckedReport(method: RepairPhotoReport["method"], capturedAt: string, dHash: string | null): RepairPhotoReport {
  return { method, capturedAt, model: MODEL_NAME, checked: false, verdict: null, score: 0, topLabels: [], dHash };
}
