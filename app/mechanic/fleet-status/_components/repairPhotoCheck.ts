// Looking at a maintenance photo on the mechanic's own device.
//
// MobileNet runs in the browser (WebGL where there is one, plain JavaScript
// otherwise), from weights served by this site - public/models/mobilenet_v2 -
// so nothing about the photo goes anywhere to be judged, and the app's WebView
// does not depend on a Google CDN being reachable. app/lib/repairPhoto.ts
// decides from its guesses.
//
// The model and TensorFlow are about 14 MB and load the first time a log form
// opens, then stay for the session. If they cannot load, the photo is not
// refused: it goes through as unchecked and the log is marked for review.

import { Capacitor } from "@capacitor/core";
import { compressImageToDataUrl } from "@/app/lib/imageCompression";
import { differenceHash, grayscale } from "@/app/lib/imageHash";
import {
  evaluateRepairPhoto,
  MODEL_NAME,
  uncheckedReport,
  type Prediction,
  type RepairPhotoReport,
  type RepairPhotoVerdict,
} from "@/app/lib/repairPhoto";

const MODEL_URL = "/models/mobilenet_v2/model.json";

interface Classifier {
  classify(image: HTMLCanvasElement, topk?: number): Promise<Prediction[]>;
}

let loading: Promise<Classifier> | null = null;

/** The model, loaded once. A failed load is forgotten so the next photo tries again. */
export function loadRepairPhotoModel(): Promise<Classifier> {
  if (!loading) {
    loading = (async () => {
      const tf = await import("@tensorflow/tfjs-core");
      await import("@tensorflow/tfjs-backend-cpu");
      await import("@tensorflow/tfjs-backend-webgl");
      if (!(await tf.setBackend("webgl").catch(() => false))) await tf.setBackend("cpu");
      await tf.ready();
      const mobilenet = await import("@tensorflow-models/mobilenet");
      // The hub version's own input range; the hosted copy is that model.
      return (await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: MODEL_URL, inputRange: [0, 1] })) as unknown as Classifier;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

/** In the app the photo comes straight from the camera; on a PC, from a file. */
export function captureMethod(): RepairPhotoReport["method"] {
  return Capacitor.isNativePlatform() ? "camera" : "file";
}

export interface CheckedRepairPhoto {
  /** The photo as it is stored: a small JPEG data URL. */
  dataUrl: string;
  report: RepairPhotoReport;
  /** Null when the model could not run. */
  verdict: RepairPhotoVerdict | null;
}

/** Wide enough for the model's 224 px input and the fingerprint. */
const ANALYSIS_WIDTH = 448;

/** The model reads a canvas; it resizes to its own 224 px itself. */
function toCanvas(bitmap: ImageBitmap): HTMLCanvasElement {
  const scale = Math.min(1, ANALYSIS_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function checkRepairPhoto(file: File): Promise<CheckedRepairPhoto> {
  const capturedAt = new Date().toISOString();
  const method = captureMethod();

  const bitmap = await createImageBitmap(file);
  try {
    const [{ image }, dataUrl] = await Promise.all([grayscale(bitmap, ANALYSIS_WIDTH), compressImageToDataUrl(file)]);
    const dHash = differenceHash(image);

    let predictions: Prediction[];
    try {
      const model = await loadRepairPhotoModel();
      predictions = await model.classify(toCanvas(bitmap), 5);
    } catch (error) {
      // Handled: the photo goes through for review. A warning, not an error.
      console.warn("[Repair photo] The model could not run:", error);
      return { dataUrl, report: uncheckedReport(method, capturedAt, dHash), verdict: null };
    }

    const verdict = evaluateRepairPhoto(predictions);
    return {
      dataUrl,
      verdict,
      report: {
        method,
        capturedAt,
        model: MODEL_NAME,
        checked: true,
        verdict: verdict.verdict,
        score: verdict.score,
        topLabels: verdict.topLabels,
        dHash,
      },
    };
  } finally {
    bitmap.close();
  }
}
