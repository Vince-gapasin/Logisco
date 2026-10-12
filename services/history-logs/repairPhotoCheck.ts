// What the server checks about a maintenance photo before a log is saved.
//
// The mechanic's device has already looked at the picture
// (app/lib/repairPhoto.ts) and refused it if it is not a truck or the work on
// one. The server cannot run that model, so it does not take the device's word
// for anything it can check itself: that the photo was not used on another
// log, and that a photo from the app's camera was taken just now. A report the
// device marked "refused" is never accepted - that is a request that went
// around the form.
//
// The same reasoning as the receipt scan (services/storage/podScanCheck.ts),
// without the location check: a truck is wherever it broke down.

import { hammingDistance } from "@/app/lib/imageHash";
import type { RepairPhotoReport } from "@/app/lib/repairPhoto";
import { SAME_PICTURE_BITS, sha256 } from "@/services/storage/podScanCheck";

/** How old a camera photo may be when the log is saved: a long report takes a while to type. */
export const MAX_PHOTO_AGE_MS = 60 * 60 * 1000;
/** Phones' clocks drift; this much is forgiven. */
const CLOCK_SLACK_MS = 5 * 60 * 1000;

/** The log's three phases, the fields each fills, and where its photo goes. */
export const PHOTO_PHASES = [
  { phase: "Preliminary", label: "inspection", text: ["driversReport", "preliminaryRemarks"], photo: "preliminaryPhotoUrl", report: "preliminaryPhotoReport" },
  { phase: "Progress", label: "maintenance update", text: ["additionalIssue", "progressRemarks"], photo: "progressPhotoUrl", report: "progressPhotoReport" },
  { phase: "Final", label: "final log", text: ["issue", "remarks"], photo: "photoUrl", report: "photoReport" },
] as const;

export type PhotoPhase = (typeof PHOTO_PHASES)[number];

/** What is stored beside a photo, for the office and for the next reuse check. */
export interface PhotoMeta {
  captureMethod: string | null;
  capturedAt: string | null;
  imageHash: string;
  imageDHash: string | null;
  checkStatus: "passed" | "unverified";
  checkLabels: { score: number; topLabels: string[]; notes: string[] } | null;
}

export interface PhotoCheck {
  /** Set when the log must not be saved: what the mechanic is told. */
  refusal: string | null;
  meta: PhotoMeta;
}

/** The report the device sent - as an object or a JSON string - or null when missing or malformed. */
export function parseRepairPhotoReport(raw: unknown): RepairPhotoReport | null {
  let value: Partial<RepairPhotoReport>;
  try {
    value = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<RepairPhotoReport>;
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  if (value.method !== "camera" && value.method !== "file") return null;
  const score = typeof value.score === "number" && Number.isFinite(value.score) ? Math.max(0, Math.min(1, value.score)) : 0;
  return {
    method: value.method,
    capturedAt: typeof value.capturedAt === "string" ? value.capturedAt : "",
    model: typeof value.model === "string" ? value.model.slice(0, 40) : "",
    checked: value.checked === true,
    verdict: value.verdict === "passed" || value.verdict === "refused" ? value.verdict : null,
    score,
    topLabels: Array.isArray(value.topLabels)
      ? value.topLabels.filter((l): l is string => typeof l === "string").map((l) => l.slice(0, 40)).slice(0, 5)
      : [],
    dHash: typeof value.dHash === "string" && /^[0-9a-f]{16}$/.test(value.dHash) ? value.dHash : null,
  };
}

/** The bytes inside a data URL, for the exact-file fingerprint. */
export function photoHash(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  const base64 = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  const bytes = Buffer.from(base64, "base64");
  return sha256(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}

export function checkRepairPhoto(input: {
  dataUrl: string;
  report: RepairPhotoReport | null;
  now: number;
  /** Whether this exact file is already on another log. */
  sameFileUsed: boolean;
  /** Fingerprints of photos already on other logs. */
  earlierHashes: string[];
}): PhotoCheck {
  const { report, now } = input;
  const notes: string[] = [];
  const meta: PhotoMeta = {
    captureMethod: report?.method ?? null,
    capturedAt: report && !Number.isNaN(Date.parse(report.capturedAt)) ? new Date(report.capturedAt).toISOString() : null,
    imageHash: photoHash(input.dataUrl),
    imageDHash: report?.dHash ?? null,
    checkStatus: "unverified",
    checkLabels: report ? { score: report.score, topLabels: report.topLabels, notes } : null,
  };
  const refuse = (refusal: string): PhotoCheck => ({ refusal, meta });

  if (input.sameFileUsed) return refuse("This photo is already on another maintenance log. Take a new photo of this repair.");
  if (report?.dHash && input.earlierHashes.some((hash) => hammingDistance(hash, report.dHash as string) <= SAME_PICTURE_BITS)) {
    return refuse("This photo was already used on another maintenance log. Take a new photo of this repair.");
  }

  if (!report) {
    // An open screen from before the check: kept, and the office told.
    notes.push("Not checked: the screen it was sent from had no photo check.");
    return { refusal: null, meta };
  }
  if (report.verdict === "refused") {
    return refuse("This photo was not accepted as a truck or a repair. Take a photo of the truck or the work on it.");
  }

  if (report.method === "camera") {
    const captured = Date.parse(report.capturedAt);
    if (Number.isNaN(captured)) {
      notes.push("The photo had no capture time.");
    } else if (now - captured > MAX_PHOTO_AGE_MS) {
      return refuse("This photo is too old. Take a new one of the repair now.");
    } else if (captured - now > CLOCK_SLACK_MS) {
      notes.push("The phone's clock is ahead; the capture time is not reliable.");
    }
  } else {
    notes.push("Chosen from a file on a computer, not taken with the app's camera.");
  }

  if (!report.checked) {
    notes.push("The photo checker could not run on the device.");
    return { refusal: null, meta };
  }

  meta.checkStatus = report.method === "camera" && notes.length === 0 ? "passed" : "unverified";
  return { refusal: null, meta };
}
