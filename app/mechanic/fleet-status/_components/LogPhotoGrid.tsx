import { PhotoCheckBadge } from "./PhotoCheckBadge";
import type { HistoryLogRecord, LogPhoto, PhotoCheckResult } from "./types";

/** A photo to show: its image and, when there was one, what the check found. */
export interface ShownPhoto {
  url: string;
  check?: PhotoCheckResult | null;
}

const PHASE_FIELDS = {
  Preliminary: { list: "preliminaryPhotos", url: "preliminaryPhotoUrl", check: "preliminaryPhotoCheck" },
  Progress: { list: "progressPhotos", url: "progressPhotoUrl", check: "progressPhotoCheck" },
  Final: { list: "finalPhotos", url: "photoUrl", check: "photoCheck" },
} as const;

/**
 * Every photo of one phase of a log, in order. Before the photos have loaded,
 * the first one may still be on the record from an earlier screen; that one is
 * shown alone.
 */
export function photosOfPhase(log: HistoryLogRecord, phase: keyof typeof PHASE_FIELDS): ShownPhoto[] {
  const fields = PHASE_FIELDS[phase];
  const list = log[fields.list] as LogPhoto[] | undefined;
  if (list && list.length > 0) return list.map((photo) => ({ url: photo.url, check: photo.check }));
  const url = log[fields.url];
  return url ? [{ url, check: log[fields.check] ?? null }] : [];
}

/** Maintenance photos as thumbnails that open large, each with its check. */
export function LogPhotoGrid({
  photos,
  alt,
  onOpen,
  showChecks = true,
}: {
  photos: ShownPhoto[];
  alt: string;
  onOpen: (url: string) => void;
  showChecks?: boolean;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {photos.map((photo, idx) => (
        <div key={`${idx}-${photo.url.slice(-24)}`}>
          <button
            type="button"
            onClick={() => onOpen(photo.url)}
            aria-label={photos.length > 1 ? `View photo ${idx + 1} of ${photos.length}` : "View the photo"}
            className="block relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photos.length > 1 ? `${alt} ${idx + 1}` : alt}
              className="w-full h-full object-cover hover:opacity-80 transition-opacity"
            />
          </button>
          {showChecks && <PhotoCheckBadge check={photo.check} />}
        </div>
      ))}
    </div>
  );
}
