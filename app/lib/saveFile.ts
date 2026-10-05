// Handing a file the page built - a report, a CSV - to the person who asked for it.
//
// In a browser that is a click on a link to the file. Inside the Android app
// the same click does nothing at all: the WebView the site runs in has no
// download manager behind a link to a file that exists only in the page, so
// Export looked broken on every phone. There the file goes to the app's own
// Downloads plugin (android/.../DownloadsPlugin.java), which saves it to the
// phone's Downloads and opens it.

import { Capacitor, registerPlugin } from "@capacitor/core";

interface DownloadsPlugin {
  save(options: { data: string; filename: string; mimeType: string }): Promise<{
    inDownloads: boolean;
    opened: boolean;
  }>;
}

const Downloads = registerPlugin<DownloadsPlugin>("Downloads");

/** A failure worth telling the person about in its own words. */
export class SaveFileError extends Error {
  name = "SaveFileError";
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** What happened to the file, so the caller can say so. */
export type SaveResult = "downloaded" | "saved-to-downloads" | "saved-in-app";

export async function saveFile(blob: Blob, filename: string): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("Downloads")) {
      // An app installed before the plugin existed. The site has moved on and
      // the app on the phone has not; nothing on this side can save the file.
      throw new SaveFileError("Downloading needs the latest version of the app. Update it and try again.");
    }

    try {
      const result = await Downloads.save({
        data: await toBase64(blob),
        filename,
        mimeType: blob.type.split(";")[0] || "application/octet-stream",
      });
      return result.inDownloads ? "saved-to-downloads" : "saved-in-app";
    } catch (error) {
      console.error("Saving on the phone failed:", error);
      throw new SaveFileError("The file could not be saved on this phone. Try again.");
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Not revoked at once: some browsers start reading the file after click()
  // returns, and a revoked link downloads nothing.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}

/** What to tell the person once the file is saved, if anything. */
export function savedMessage(result: SaveResult, filename: string): string | null {
  if (result === "saved-to-downloads") return `Saved ${filename} to Downloads.`;
  if (result === "saved-in-app") return `Saved ${filename}.`;
  return null;
}
