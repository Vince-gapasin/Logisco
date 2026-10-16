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
//   - whether the name the crew typed is written there, by the signature or
//     in a "Name" field - not merely somewhere on the page.
//
// None of this can tell who held the pen. What makes a photograph hard to fake
// is where and when it was taken and that it came straight off the scanner -
// which the server checks (see services/storage/podScanCheck.ts). This file is the part that
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
  /** The numbers printed or written on the page: DR number, dates, quantities. */
  docNumbers: string[];
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

export const NAME_NOT_FOUND =
  "The receiver's name you typed is not written on the receipt. Have the receiver print their name by the signature, or check the spelling.";

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

// Where a form asks for the receiver's name, besides the signature labels.
const NAME_LABEL = /\b(name|pangalan)\b/i;

function union(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
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
 * Whether the reader's text is a word, as print is, rather than what it makes
 * of a scribble. A signature read as text comes out as "Jlw" or "~-" - no
 * vowel, or symbols - and that is ink to keep, not print to remove.
 */
function readsAsWord(text: string): boolean {
  const clean = normalize(text).replace(/ /g, "");
  if (/^\d{2,}$/.test(clean)) return true;
  return clean.length >= 2 && /[aeiouy]/.test(clean);
}

/**
 * Every recognised word on the page, padded a little: print is left out when
 * looking for a signature. The reader's boxes are tight, and the edges of
 * letters left behind would otherwise add up to "ink".
 */
export function printedBoxes(lines: OcrLine[]): Rect[] {
  const boxes: Rect[] = [];
  for (const line of lines) {
    const words = line.words?.length ? line.words : [{ text: line.text, box: line.box }];
    for (const word of words) {
      if (!word.box || !readsAsWord(word.text)) continue;
      const pad = Math.max(2, (word.box.bottom - word.box.top) * 0.15);
      boxes.push({
        left: word.box.left - pad,
        top: word.box.top - pad,
        right: word.box.right + pad,
        bottom: word.box.bottom + pad,
      });
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
 * `spread` widens them, for the name, which is often written further off.
 */
export function signatureRegions(label: Rect, width: number, height: number, spread = 1): Rect[] {
  const lineHeight = Math.max(12, label.bottom - label.top);
  const reach = Math.max(width * 0.35 * spread, (label.right - label.left) * 1.5);
  const tall = 4 * spread;
  const candidates: Rect[] = [
    // Beside it, on the same band.
    { left: label.right, top: label.top - lineHeight * spread, right: label.right + reach, bottom: label.bottom + lineHeight * spread },
    // Above it.
    { left: label.left - lineHeight, top: label.top - lineHeight * tall, right: label.right + lineHeight * 2 * spread, bottom: label.top },
    // Below it.
    { left: label.left - lineHeight, top: label.bottom, right: label.right + lineHeight * 2 * spread, bottom: label.bottom + lineHeight * tall },
  ];
  return candidates.map((rect) => clampRect(rect, width, height)).filter((rect): rect is Rect => rect !== null);
}

/** At least this much handwriting, in pixels of the analysis copy. */
const MIN_INK_PIXELS = 80;
/** Specks smaller than this are dust, compression and paper grain. */
const MIN_STROKE_PIXELS = 12;

/**
 * Whether a mark is a straight rule: the "______" a form is signed on, or a
 * table border. Not "flat" - a page photographed at a slant tilts its lines -
 * but straight: along its length, the middle of the mark stays on one line.
 * A pen stroke wanders off it.
 */
function isStraightRule(xs: number[], ys: number[]): boolean {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] < minX) minX = xs[i];
    if (xs[i] > maxX) maxX = xs[i];
    if (ys[i] < minY) minY = ys[i];
    if (ys[i] > maxY) maxY = ys[i];
  }
  const spanX = maxX - minX + 1;
  const spanY = maxY - minY + 1;
  // Measured along its long side.
  const horizontal = spanX >= spanY;
  const along = horizontal ? xs : ys;
  const across = horizontal ? ys : xs;
  const start = horizontal ? minX : minY;
  const length = horizontal ? spanX : spanY;
  if (length < 3 * Math.min(spanX, spanY)) return false;

  // The centre of the mark at each step along it.
  const total = new Float64Array(length);
  const count = new Uint32Array(length);
  for (let i = 0; i < along.length; i++) {
    total[along[i] - start] += across[i];
    count[along[i] - start]++;
  }
  let n = 0, sumT = 0, sumC = 0, sumTT = 0, sumTC = 0;
  for (let t = 0; t < length; t++) {
    if (!count[t]) continue;
    const c = total[t] / count[t];
    n++;
    sumT += t;
    sumC += c;
    sumTT += t * t;
    sumTC += t * c;
  }
  const denominator = n * sumTT - sumT * sumT;
  const slope = denominator === 0 ? 0 : (n * sumTC - sumT * sumC) / denominator;
  const intercept = (sumC - slope * sumT) / n;

  let worst = 0;
  for (let t = 0; t < length; t++) {
    if (!count[t]) continue;
    worst = Math.max(worst, Math.abs(total[t] / count[t] - (intercept + slope * t)));
  }
  return worst <= 2;
}

/**
 * Pen strokes in a region: dark pixels that are not recognised print, grouped
 * into the marks they make. Straight rules are left out (isStraightRule), and
 * so are specks. What is left, and rises at least half a line of text, is
 * handwriting.
 */
export function strokesIn(
  image: GrayImage,
  region: Rect,
  printed: Rect[],
  lineHeight: number,
): { pixels: number; tallest: number } {
  const width = region.right - region.left;
  const height = region.bottom - region.top;
  if (width <= 0 || height <= 0) return { pixels: 0, tallest: 0 };

  // Dark relative to this page's paper, so a dim photograph is not all "ink".
  let sum = 0;
  for (let y = region.top; y < region.bottom; y++) {
    for (let x = region.left; x < region.right; x++) sum += image.data[y * image.width + x];
  }
  const threshold = Math.min(140, sum / (width * height) - 60);

  const nearby = printed.filter((box) => intersects(box, region));
  const dark = new Uint8Array(width * height);
  for (let y = region.top; y < region.bottom; y++) {
    for (let x = region.left; x < region.right; x++) {
      if (image.data[y * image.width + x] >= threshold) continue;
      if (nearby.some((box) => x >= box.left && x < box.right && y >= box.top && y < box.bottom)) continue;
      dark[(y - region.top) * width + (x - region.left)] = 1;
    }
  }

  const rises = lineHeight * 0.5;
  let pixels = 0;
  let tallest = 0;
  const stack: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];

  for (let start = 0; start < dark.length; start++) {
    if (dark[start] !== 1) continue;
    dark[start] = 2;
    stack.push(start);
    let count = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    xs.length = 0;
    ys.length = 0;

    while (stack.length) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index - x) / width;
      count++;
      xs.push(x);
      ys.push(y);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (dark[next] === 1) {
            dark[next] = 2;
            stack.push(next);
          }
        }
      }
    }

    const markWidth = maxX - minX + 1;
    const markHeight = maxY - minY + 1;
    if (count < MIN_STROKE_PIXELS) continue;
    if (isStraightRule(xs, ys)) continue;
    pixels += count;
    if (markHeight >= rises && markWidth >= rises) tallest = Math.max(tallest, markHeight);
  }

  return { pixels, tallest };
}

/**
 * Whether the form has been signed. null when the form has no signature label
 * the reader could find.
 */
export function signatureInk(image: GrayImage, lines: OcrLine[], printed: Rect[]): boolean | null {
  const labels = findSignatureLabels(lines);
  if (labels.length === 0) return null;

  return labels.some((label) => {
    const lineHeight = Math.max(12, label.bottom - label.top);
    return signatureRegions(label, image.width, image.height).some((region) => {
      const { pixels, tallest } = strokesIn(image, region, printed, lineHeight);
      return pixels >= MIN_INK_PIXELS && tallest > 0;
    });
  });
}

/**
 * Whether the receiver's name is written where the form asks for it: near a
 * signature label, or near a "Name" field. Anywhere on the page was too easy -
 * the branch's own name, printed in the header, passed for the receiver's.
 */
export function nameOnReceipt(name: string, lines: OcrLine[], width: number, height: number): boolean {
  const anchors = [
    ...findSignatureLabels(lines),
    ...lines.filter((line) => line.box && NAME_LABEL.test(line.text)).map((line) => line.box as Rect),
  ];
  if (anchors.length === 0) return false;

  const areas = anchors.flatMap((anchor) => signatureRegions(anchor, width, height, 1.7));
  const nearby: string[] = [];
  for (const line of lines) {
    const words = line.words?.length ? line.words : [{ text: line.text, box: line.box }];
    for (const word of words) {
      if (word.box && areas.some((area) => intersects(word.box as Rect, area))) nearby.push(word.text);
    }
  }
  return nameAppearsIn(name, nearby.join(" "));
}

/** What a scan shows, before any name is typed. Worked out once per scan. */
export interface ScanFacts {
  textWords: number;
  signature: boolean | null;
}

export function scanFacts(input: { text: string; lines: OcrLine[]; image: GrayImage | null }): ScanFacts {
  const textWords = countWords(input.text);
  if (textWords < MIN_WORDS || !input.image) return { textWords, signature: null };
  return { textWords, signature: signatureInk(input.image, input.lines, printedBoxes(input.lines)) };
}

export const NO_TEXT = "No receipt text could be read. Hold the phone steady over the whole receipt and scan again.";
export const NO_SIGNATURE_SPACE =
  "Could not find where this receipt is signed. Make sure the whole receipt, with the signature area, is in the scan.";
export const BLANK_SIGNATURE = "The signature space looks blank. Have the receiver sign the receipt, then scan again.";
export const NO_NAME_TYPED = "Type the receiver's name above.";

/**
 * What the crew are told, and whether they may submit. Every check blocks:
 * a receipt that cannot be shown to be signed, with the receiver's name on it,
 * is not proof. When a client's form defeats the check, the office closes the
 * stop by hand - which is recorded as theirs.
 */
export function scanVerdict(facts: ScanFacts, receiverName: string, nameFound: boolean): ScanVerdict {
  const blocking: string[] = [];
  if (facts.textWords < MIN_WORDS) {
    blocking.push(NO_TEXT);
  } else {
    if (facts.signature === null) blocking.push(NO_SIGNATURE_SPACE);
    else if (facts.signature === false) blocking.push(BLANK_SIGNATURE);

    if (!receiverName.trim()) blocking.push(NO_NAME_TYPED);
    else if (!nameFound) blocking.push(NAME_NOT_FOUND);
  }
  return { blocking, flags: [], signature: facts.signature, nameFound, textWords: facts.textWords };
}

/** The whole check in one call, for one scan and one name. */
export function evaluateScan(input: {
  text: string;
  lines: OcrLine[];
  image: GrayImage | null;
  receiverName: string;
}): ScanVerdict {
  const facts = scanFacts(input);
  const nameFound =
    input.image !== null && input.receiverName.trim() !== ""
      ? nameOnReceipt(input.receiverName, input.lines, input.image.width, input.image.height)
      : false;
  return scanVerdict(facts, input.receiverName, nameFound);
}

/** At most this many numbers are kept from one page. */
export const MAX_DOC_NUMBERS = 40;

/**
 * The numbers on a page - its DR or POD number, dates, quantities - as the
 * reader made them out. Three characters or more, so a bare "10" or "pcs"
 * does not count.
 *
 * Why: two receipts on the same client's form look alike to the picture's
 * fingerprint, which sees layout, not writing. What tells one receipt from
 * another is its numbers, so a page counts as one already used only when the
 * picture and the numbers both match.
 */
export function documentNumbers(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && /\d/.test(token));
  return [...new Set(tokens)].sort().slice(0, MAX_DOC_NUMBERS);
}

/** How much two pages' numbers overlap, 0 to 1. Pages with too few to tell score 0. */
export function numbersOverlap(a: string[], b: string[]): number {
  if (a.length < 2 || b.length < 2) return 0;
  const other = new Set(b);
  const shared = a.filter((token) => other.has(token)).length;
  return shared / new Set([...a, ...b]).size;
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
