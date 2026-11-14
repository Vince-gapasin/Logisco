"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLogPhotos, mergeLogPhotos, type LoadedLogPhoto } from "@/app/lib/logPhotos";

type PhotosByPhase = Record<string, LoadedLogPhoto[]>;
type LogLike = { id: string | number; truckID?: string | number; hasPreliminaryPhoto?: boolean; hasProgressPhoto?: boolean; hasFinalPhoto?: boolean };

/**
 * The maintenance logs with their photographs filled in, for the truck on screen.
 *
 * The log list carries no image data - a photo is a base64 string in the
 * database - only whether a phase has one. Photos used to be fetched only once
 * a history record was opened, never for the truck screen itself, and every
 * save reloaded the list without them while a "requested already" mark kept
 * them from being fetched again. So adding a maintenance update made the
 * inspection photo vanish, and each new update's photo looked like it had
 * replaced the one before.
 *
 * Kept here instead: photos land in a cache that outlives a reload of the list,
 * are fetched for whichever truck is being looked at, and a log just saved is
 * forgotten, so its photos - the new ones with their ids - are fetched again.
 */
export function useLogPhotos<T extends LogLike>(logs: T[], truckID: string | number | null | undefined) {
  const [cache, setCache] = useState<Record<string, PhotosByPhase>>({});
  // Asked for and not yet answered, so one truck's logs are fetched once.
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (truckID === null || truckID === undefined || truckID === "") return;

    const missing = logs
      .filter((log) => String(log.truckID) === String(truckID))
      .filter((log) => log.hasPreliminaryPhoto || log.hasProgressPhoto || log.hasFinalPhoto)
      .map((log) => String(log.id))
      .filter((id) => !(id in cache) && !inFlight.current.has(id));
    if (missing.length === 0) return;

    missing.forEach((id) => inFlight.current.add(id));
    let active = true;

    fetchLogPhotos(missing)
      .then((photos) => {
        if (!active) return;
        // An empty answer is remembered too, so a log flagged as having a photo
        // whose row turns out to be empty is not asked about on every render.
        setCache((previous) => {
          const next = { ...previous };
          for (const id of missing) next[id] = photos[id] ?? {};
          return next;
        });
      })
      .catch((error) => console.error("Failed to load photos:", error))
      .finally(() => missing.forEach((id) => inFlight.current.delete(id)));

    return () => {
      active = false;
    };
  }, [logs, truckID, cache]);

  const withPhotos = useMemo(() => mergeLogPhotos(logs, cache), [logs, cache]);

  /** A log just saved: its photos are fetched again with the list. */
  const forget = useCallback((logID: string | number) => {
    setCache((previous) => {
      if (!(String(logID) in previous)) return previous;
      const next = { ...previous };
      delete next[String(logID)];
      return next;
    });
  }, []);

  return { logs: withPhotos, forget };
}
