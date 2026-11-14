"use client";

import { apiFetch } from "@/app/lib/apiClient";

// Maintenance photos are stored as base64 data URLs, so the log list returns
// only presence flags. These helpers pull the image data for the logs a user
// is actually looking at and merge it into the records already in state.

/** One photo as the server sends it. */
export interface LoadedLogPhoto {
  id: string;
  url: string;
  check: {
    status: string;
    method: string | null;
    topLabels: string[];
    score: number | null;
    notes: string[];
  } | null;
}

/** By log id, then phase, each phase's photos in order. */
export type PhotosByLog = Record<string, Record<string, LoadedLogPhoto[]>>;

// Where each phase's photos land on a log record: the list, and its first
// photo in the single field the screens read before there could be several.
const PHASE_FIELDS: Record<string, { url: string; list: string }> = {
  Preliminary: { url: "preliminaryPhotoUrl", list: "preliminaryPhotos" },
  Progress: { url: "progressPhotoUrl", list: "progressPhotos" },
  Final: { url: "photoUrl", list: "finalPhotos" },
};

export async function fetchLogPhotos(logIDs: (string | number)[]): Promise<PhotosByLog> {
  const ids = [...new Set(logIDs.map(String).filter(Boolean))];
  if (ids.length === 0) return {};

  const result = await apiFetch<{ data: PhotosByLog }>(
    `/api/historyLogsM/photos?logIDs=${encodeURIComponent(ids.join(","))}`,
  );

  return result.data ?? {};
}

// Returns a new list with photo fields filled in for the logs that were loaded.
export function mergeLogPhotos<T extends { id: string | number }>(
  logs: T[],
  photos: PhotosByLog,
): T[] {
  if (Object.keys(photos).length === 0) return logs;

  return logs.map((log) => {
    const forLog = photos[String(log.id)];
    if (!forLog) return log;

    const merged: Record<string, unknown> = { ...log };
    for (const [phase, field] of Object.entries(PHASE_FIELDS)) {
      const list = forLog[phase] ?? [];
      merged[field.list] = list;
      if (list[0]) merged[field.url] = list[0].url;
    }

    return merged as T;
  });
}

// True when a log says it has a photo that has not been loaded yet.
export function needsPhotos(log: {
  hasPreliminaryPhoto?: boolean;
  hasProgressPhoto?: boolean;
  hasFinalPhoto?: boolean;
  preliminaryPhotos?: unknown[];
  progressPhotos?: unknown[];
  finalPhotos?: unknown[];
}): boolean {
  return Boolean(
    (log.hasPreliminaryPhoto && !log.preliminaryPhotos) ||
      (log.hasProgressPhoto && !log.progressPhotos) ||
      (log.hasFinalPhoto && !log.finalPhotos),
  );
}
