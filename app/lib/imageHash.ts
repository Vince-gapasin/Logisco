// Fingerprinting a picture so the same one is recognised when it comes back.
//
// Shared by the proof-of-delivery scan and the mechanic's repair photos: both
// refuse a picture that was already used, and both need it to survive being
// re-saved or photographed again from the screen it was shown on.

/** A greyscale copy of a picture: one byte of brightness per pixel. */
export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * A 64-bit difference hash: the picture shrunk to 9x8 and each pixel compared
 * with its neighbour. The same page photographed twice, or one photo re-saved,
 * lands within a few bits; two different pages do not.
 */
export function differenceHash(image: GrayImage): string {
  const cols = 9;
  const rows = 8;
  const cell: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * image.width) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * image.width) / cols));
      const y0 = Math.floor((r * image.height) / rows);
      const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * image.height) / rows));
      let sum = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sum += image.data[y * image.width + x];
      cell.push(sum / ((x1 - x0) * (y1 - y0)));
    }
  }

  let bits = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) bits += cell[r * cols + c] > cell[r * cols + c + 1] ? "1" : "0";
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/**
 * A picture read into greyscale in the browser, at most `maxWidth` wide. The
 * scale is what the original was multiplied by, for anything measured in it.
 */
export async function grayscale(source: Blob | ImageBitmap, maxWidth: number): Promise<{ image: GrayImage; scale: number }> {
  const bitmap = source instanceof Blob ? await createImageBitmap(source) : source;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This device could not read the picture.");
  context.drawImage(bitmap, 0, 0, width, height);
  if (source instanceof Blob) bitmap.close();

  const rgba = context.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  return { image: { width, height, data }, scale };
}
