"use client";

import { apiFetch } from "@/app/lib/apiClient";

// Maintenance photos are stored as base64 data URLs, so the log list returns
// only presence flags. These helpers pull the image data for the logs a user
// is actually looking at and merge it into the records already in state.

type PhotosByLog = Record<string, Record<string, string>>;

const PHASE_FIELDS: Record<string, string> = {
  Preliminary: "preliminaryPhotoUrl",
  Progress: "progressPhotoUrl",
  Final: "photoUrl",
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
      if (forLog[phase]) merged[field] = forLog[phase];
    }

    return merged as T;
  });
}

// True when a log says it has a photo that has not been loaded yet.
export function needsPhotos(log: {
  hasPreliminaryPhoto?: boolean;
  hasProgressPhoto?: boolean;
  hasFinalPhoto?: boolean;
  preliminaryPhotoUrl?: string | null;
  progressPhotoUrl?: string | null;
  photoUrl?: string | null;
}): boolean {
  return Boolean(
    (log.hasPreliminaryPhoto && !log.preliminaryPhotoUrl) ||
      (log.hasProgressPhoto && !log.progressPhotoUrl) ||
      (log.hasFinalPhoto && !log.photoUrl),
  );
}
