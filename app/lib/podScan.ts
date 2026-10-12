// Checking a scanned proof of delivery, on the phone, without sending it
// anywhere.
//
// Every client prints their own POD, so nothing here knows where a form keeps
// its signature or its name. What it can know:
//
//   - that the scan is a document: the scanner found a page, and the text
//     reader found words on it;
//   - where the form asks for a signature: a label such as "Received by",
//     "Signature" or "Conforme" - and whether the space beside, above or below
//     it has ink in it that is not printed text or a printed line;
//   - whether the name the crew typed is written on it.
//
// None of this can tell who held the pen. What makes a photograph hard to fake
// is where and when it was taken and that it came straight off the scanner -
// which the server checks (see podScanServer.ts). This file is the part that
// tells the crew at the gate what to fix.
//
// Pure functions over plain data, so they run in the crew app and in tests.

import { differenceHash, hammingDistance, type GrayImage } from "@/app/lib/imageHash";

// The fingerprint helpers live in imageHash.ts, shared with the repair photos.
export { differenceHash, hammingDistance, type GrayImage };

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface OcrWord {
  text: string;
  box: Rect | null;
}

export interface OcrLine {
  text: string;
  box: Rect | null;
  /** The line's words, when the reader gave them. */
  words?: OcrWord[];
}


/** What the phone sends with the photo. */
export interface PodScanReport {
  /** "scanner": the live document scanner. "camera": an older app without it. */
  method: "scanner" | "camera";
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  /** Words the text reader found on the page. */
  textWords: number;
  /** true: ink where the form asks for a signature. false: that space is blank. null: no such space found. */
  signature: boolean | null;
  nameFound: boolean;
  /** 16 hex characters: a fingerprint of the picture that survives re-encoding. */
  dHash: string | null;
  /** Things the office should look at; the stop still closes. */
  flags: string[];
}

export interface ScanVerdict {
  /** Reasons the crew must rescan. Empty when the scan may be submitted. */
  blocking: string[];
  flags: string[];
  signature: boolean | null;
  nameFound: boolean;
  textWords: number;
}

export const NAME_NOT_FOUND = "The receiver's name typed by the crew was not found on the receipt.";

/** Fewer words than this and it is not a readable document. */
export const MIN_WORDS = 12;

// The words forms use to ask for a signature. Kept to the ones that mean it:
// "name" alone is on every form for the client's own name too.
const SIGNATURE_LABEL =
  /\b(signature|signed\s+by|sign\s+here|received\s+by|receiver|recipient|conforme|acknowledged(\s+by)?|consignee|lagda|pirma)\b/i;

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function countWords(text: string): number {
  return normalize(text).split(" ").filter((word) => word.length >= 2).length;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Whether the receiver's name is written on the page. At least half of the
 * name's parts must be there - "Juan Dela Cruz" needs two of three - and a part
 * of five letters or more may be one letter out, because handwriting is read
 * that way more often than not.
 */
export function nameAppearsIn(name: string, text: string): boolean {
  const parts = normalize(name).split(" ").filter((part) => part.length >= 3);
  if (parts.length === 0) return false;
  const words = normalize(text).split(" ");

  const matched = parts.filter((part) =>
    words.some((word) => word === part || (part.length >= 5 && editDistanceAtMostOne(word, part))),
  ).length;

  return matched >= Math.ceil(parts.length / 2);
}

const LABEL_WORDS = new Set([
  "signature", "signed", "sign", "here", "by", "received", "receiver", "recipient",
  "conforme", "acknowledged", "consignee", "lagda", "pirma",
]);

function union(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

/**
 * The label's own words, not the whole line. "Received by: Juan Cruz" is one
 * line to the reader, and its box covers the handwriting too - measuring ink
 * beside that box would start past the signature.
 */
function labelBox(line: OcrLine): Rect | null {
  const words = (line.words ?? []).filter((word) => word.box && LABEL_WORDS.has(normalize(word.text)));
  return union(words.map((word) => word.box as Rect)) ?? line.box;
}

export function findSignatureLabels(lines: OcrLine[]): Rect[] {
  return lines
    .filter((line) => SIGNATURE_LABEL.test(line.text))
    .map(labelBox)
    .filter((box): box is Rect => box !== null);
}

/**
 * The printed text near a signature, to be left out when looking for ink.
 *
 * Not everything the reader recognised: a signature is sometimes read as a
 * word, and leaving it out would call a signed form blank and stop the crew at
 * the gate. So only what is plainly print - the label itself, a line of three
 * words or more, a "Date:" style field - is removed. A stray printed word that
 * slips through can only make a form look signed, and the office and the client
 * still see the photograph.
 */
export function printedBoxes(lines: OcrLine[]): Rect[] {
  const boxes: Rect[] = [];
  for (const line of lines) {
    if (SIGNATURE_LABEL.test(line.text)) {
      // Only the label: the rest of its line may be the signature.
      const box = labelBox(line);
      if (box) boxes.push(box);
    } else if (line.box && (countWords(line.text) >= 3 || /:/.test(line.text))) {
      boxes.push(line.box);
    }
  }
  return boxes;
}

function clampRect(rect: Rect, width: number, height: number): Rect | null {
  const left = Math.max(0, Math.floor(rect.left));
  const top = Math.max(0, Math.floor(rect.top));
  const right = Math.min(width, Math.ceil(rect.right));
  const bottom = Math.min(height, Math.ceil(rect.bottom));
  return right - left >= 8 && bottom - top >= 8 ? { left, top, right, bottom } : null;
}

/**
 * Where the signature for a label would be. Forms do it three ways - beside
 * the label ("Received by: ____"), above it (a line with "Signature over
 * printed name" under it), and below it - so all three are looked at.
 */
export function signatureRegions(label: Rect, width: number, height: number): Rect[] {
  const lineHeight = Math.max(12, label.bottom - label.top);
  const reach = Math.max(width * 0.35, (label.right - label.left) * 1.5);
  const candidates: Rect[] = [
    // Beside it, on the same band.
    { left: label.right, top: label.top - lineHeight, right: label.right + reach, bottom: label.bottom + lineHeight },
    // Above it.
    { left: label.left - lineHeight, top: label.top - lineHeight * 4, right: label.right + lineHeight * 2, bottom: label.top },
    // Below it.
    { left: label.left - lineHeight, top: label.bottom, right: label.right + lineHeight * 2, bottom: label.bottom + lineHeight * 4 },
  ];
  return candidates.map((rect) => clampRect(rect, width, height)).filter((rect): rect is Rect => rect !== null);
}

function inside(x: number, y: number, rect: Rect): boolean {
  return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
}

/** Ink that is not a long printed rule (the "______" a form signs on). */
export const MIN_INK_RATIO = 0.004;
const MIN_INK_PIXELS = 60;

/**
 * The share of a region that is handwriting: dark pixels, less the printed
 * text the reader recognised and less any row that is mostly dark from end to
 * end, which is a printed line rather than a pen stroke.
 */
export function inkRatio(image: GrayImage, region: Rect, printed: Rect[]): { ratio: number; pixels: number } {
  const width = region.right - region.left;
  const height = region.bottom - region.top;
  if (width <= 0 || height <= 0) return { ratio: 0, pixels: 0 };

  // Dark relative to this page's paper, so a dim photograph is not all "ink".
  let sum = 0;
  for (let y = region.top; y < region.bottom; y++) {
    for (let x = region.left; x < region.right; x++) sum += image.data[y * image.width + x];
  }
  const paper = sum / (width * height);
  const threshold = Math.min(140, paper - 60);

  const overlapping = printed.filter(
    (box) => box.right > region.left && box.left < region.right && box.bottom > region.top && box.top < region.bottom,
  );

  let ink = 0;
  for (let y = region.top; y < region.bottom; y++) {
    let rowInk = 0;
    for (let x = region.left; x < region.right; x++) {
      if (image.data[y * image.width + x] < threshold && !overlapping.some((box) => inside(x, y, box))) rowInk++;
    }
    if (rowInk < width * 0.6) ink += rowInk;
  }

  return { ratio: ink / (width * height), pixels: ink };
}

/**
 * Whether the form has been signed. null when the form has no signature label
 * the reader could find - which is a question for the office, not a refusal.
 */
export function signatureInk(
  image: GrayImage,
  lines: OcrLine[],
  printed: Rect[],
): boolean | null {
  const labels = findSignatureLabels(lines);
  if (labels.length === 0) return null;

  return labels.some((label) =>
    signatureRegions(label, image.width, image.height).some((region) => {
      const { ratio, pixels } = inkRatio(image, region, printed);
      return ratio >= MIN_INK_RATIO && pixels >= MIN_INK_PIXELS;
    }),
  );
}

/** What the crew are told about a scan, and whether they may submit it. */
export function evaluateScan(input: {
  text: string;
  lines: OcrLine[];
  image: GrayImage | null;
  receiverName: string;
}): ScanVerdict {
  const textWords = countWords(input.text);
  const blocking: string[] = [];
  const flags: string[] = [];

  if (textWords < MIN_WORDS) {
    blocking.push("No receipt text could be read. Hold the phone steady over the whole receipt and scan again.");
    return { blocking, flags, signature: null, nameFound: false, textWords };
  }

  const signature = input.image ? signatureInk(input.image, input.lines, printedBoxes(input.lines)) : null;
  if (signature === false) {
    blocking.push("The signature space looks blank. Have the receiver sign the receipt, then scan again.");
  } else if (signature === null) {
    flags.push("The signature space on this form could not be found, so the signature was not checked.");
  }

  const nameFound = input.receiverName.trim() ? nameAppearsIn(input.receiverName, input.text) : false;
  if (!nameFound) {
    flags.push(NAME_NOT_FOUND);
  }

  return { blocking, flags, signature, nameFound, textWords };
}

/** Metres between two points on the ground. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
