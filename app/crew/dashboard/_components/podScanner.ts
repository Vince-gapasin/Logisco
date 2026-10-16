// Scanning a proof of delivery on the crew's phone.
//
// Google's document scanner opens the camera with the page outlined live,
// captures it when it is steady, and hands back a flattened page. The gallery
// is switched off: what reaches the server is a page photographed just now, not
// one picked from the phone. The text reader then reads the page, and
// app/lib/podScan.ts decides whether it is a signed receipt.
//
// Everything here runs on the phone. Nothing is sent anywhere until the crew
// submit the stop.
//
// The Android app loads the live site, so a phone with an older APK has no
// scanner plugin. scannerAvailable() says so, and the screen falls back to the
// plain camera; the server records that proof as "Needs review".

import { Capacitor } from "@capacitor/core";
import { DocumentScanner } from "@capacitor-mlkit/document-scanner";
import { TextRecognition } from "@capacitor-mlkit/text-recognition";
import { compressImage } from "@/app/lib/imageCompression";
import { grayscale } from "@/app/lib/imageHash";
import {
  differenceHash,
  documentNumbers,
  nameOnReceipt,
  scanFacts,
  scanVerdict,
  type OcrLine,
  type PodScanReport,
  type Rect,
  type ScanFacts,
  type ScanVerdict,
} from "@/app/lib/podScan";

/** Wide enough to see a pen stroke, small enough to look at every pixel quickly. */
const ANALYSIS_WIDTH = 1200;

export interface ScannedPod {
  file: File;
  previewUrl: string;
  verdict: ScanVerdict;
  report: PodScanReport;
  /** What the page showed, kept to check a name typed or corrected afterwards. */
  facts: ScanFacts;
  lines: OcrLine[];
  width: number;
  height: number;
}

/**
 * The same scan against the name as it is now. The crew may scan first and
 * type the name after, or correct it; the name check follows the field.
 */
export function withReceiverName(scan: ScannedPod, receiverName: string): ScannedPod {
  const nameFound = receiverName.trim() ? nameOnReceipt(receiverName, scan.lines, scan.width, scan.height) : false;
  const verdict = scanVerdict(scan.facts, receiverName, nameFound);
  return {
    ...scan,
    verdict,
    report: { ...scan.report, nameFound, signature: verdict.signature, flags: verdict.flags },
  };
}

export function scannerAvailable(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("DocumentScanner") &&
    Capacitor.isPluginAvailable("TextRecognition")
  );
}

/** Where the phone is now, or nulls. Never throws: a missing fix is the server's to judge. */
export function currentPosition(): Promise<{ latitude: number | null; longitude: number | null; accuracy: number | null }> {
  const none = { latitude: null, longitude: null, accuracy: null };
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(none);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => resolve(none),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

/**
 * Google downloads the scanner the first time it is used. On a phone that has
 * never had it, that happens here, once.
 */
async function ensureScannerModule(): Promise<void> {
  const { available } = await DocumentScanner.isGoogleDocumentScannerModuleAvailable();
  if (available) return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    void DocumentScanner.addListener("googleDocumentScannerModuleInstallProgress", (event) => {
      // 4 completed, 3 cancelled, 5 failed.
      if (settled) return;
      if (event.state === 4) {
        settled = true;
        resolve();
      } else if (event.state === 3 || event.state === 5) {
        settled = true;
        reject(new Error("The scanner could not be installed. Check the internet connection and try again."));
      }
    });
    DocumentScanner.installGoogleDocumentScannerModule().catch((error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  }).finally(() => {
    void DocumentScanner.removeAllListeners();
  });
}

function toRect(box: { left: number; top: number; right: number; bottom: number } | undefined, scale: number): Rect | null {
  if (!box) return null;
  return { left: box.left * scale, top: box.top * scale, right: box.right * scale, bottom: box.bottom * scale };
}

/**
 * Scan the receipt and check it. Null when the crew backed out of the scanner.
 */
export async function scanPod(receiverName: string): Promise<ScannedPod | null> {
  await ensureScannerModule();

  // Asked for alongside the scan, so the fix is from the moment of capture.
  const position = currentPosition();

  let uri: string | undefined;
  try {
    const result = await DocumentScanner.scanDocument({
      galleryImportAllowed: false,
      pageLimit: 1,
      resultFormats: "JPEG",
      scannerMode: "FULL",
    });
    uri = result.scannedImages?.[0];
  } catch (error) {
    // Closing the scanner is not an error worth a toast.
    if (/cancel/i.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
  if (!uri) return null;
  const capturedAt = new Date().toISOString();

  const [response, ocr] = await Promise.all([
    fetch(Capacitor.convertFileSrc(uri)),
    TextRecognition.processImage({ path: uri }),
  ]);
  const blob = await response.blob();
  const { image, scale } = await grayscale(blob, ANALYSIS_WIDTH);

  // The reader measures in the full-size page; the analysis copy is smaller.
  const lines: OcrLine[] = ocr.blocks.flatMap((block) =>
    block.lines.map((line) => ({
      text: line.text,
      box: toRect(line.boundingBox, scale),
      words: line.elements.map((element) => ({ text: element.text, box: toRect(element.boundingBox, scale) })),
    })),
  );

  const facts = scanFacts({ text: ocr.text, lines, image });
  const fix = await position;

  const original = new File([blob], `pod-scan-${Date.now()}.jpg`, { type: "image/jpeg" });
  const file = await compressImage(original).catch(() => original);

  const scanned: ScannedPod = {
    file,
    previewUrl: URL.createObjectURL(file),
    verdict: scanVerdict(facts, "", false),
    report: {
      method: "scanner",
      capturedAt,
      ...fix,
      textWords: facts.textWords,
      signature: facts.signature,
      nameFound: false,
      dHash: differenceHash(image),
      docNumbers: documentNumbers(ocr.text),
      flags: [],
    },
    facts,
    lines,
    width: image.width,
    height: image.height,
  };
  return withReceiverName(scanned, receiverName);
}

/** The report for a photo from the plain camera, on an app without the scanner. */
export async function cameraReport(): Promise<PodScanReport> {
  return {
    method: "camera",
    capturedAt: new Date().toISOString(),
    ...(await currentPosition()),
    textWords: 0,
    signature: null,
    nameFound: false,
    dHash: null,
    docNumbers: [],
    flags: [],
  };
}
