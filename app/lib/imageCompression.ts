// Browser-side photo downscaling. Phone cameras produce 3-6 MB images, but
// Vercel rejects request bodies over 4.5 MB and the photos only need to be
// legible as proof, so they are resized to a bounded JPEG before upload.

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.8;

async function drawScaled(file: File, maxDimension: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported in this browser.");

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export async function compressImage(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_QUALITY,
): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");

  const canvas = await drawScaled(file, maxDimension);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Could not process that image.");

  // Keep the original if it was already smaller than the re-encoded version.
  if (blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

export async function compressImageToDataUrl(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_QUALITY,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");

  const canvas = await drawScaled(file, maxDimension);
  return canvas.toDataURL("image/jpeg", quality);
}
