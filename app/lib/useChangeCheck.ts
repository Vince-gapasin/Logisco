"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePolling } from "@/app/lib/usePolling";

// How often an open screen asks whether anything has changed. The question is
// small - a fingerprint, not the data - so it can be asked often; the data is
// only fetched again when the answer is yes.
export const CHANGE_CHECK_MS = 5_000;
// Fetched in full at least this often anyway: for whatever a fingerprint does
// not cover, and for times a screen works out from the clock.
export const FULL_REFRESH_MS = 60_000;

interface ChangeCheckOptions {
  /**
   * Asks the server for its fingerprint. Null means it could not say - a link
   * that has gone, say - and the full load is left to find out why. Throwing
   * counts as the check failing.
   */
  version: () => Promise<string | null>;
  /**
   * Loads the screen in full. If the load carries its own fingerprint it
   * returns it; otherwise the one asked for just before is kept.
   */
  reload: () => Promise<string | void>;
  /** Pause without unmounting, e.g. once a delivery is complete. */
  enabled?: boolean;
  /** The full load returns its own fingerprint, so a refresh need not ask first. */
  selfVersioned?: boolean;
  /** A check found nothing new. */
  onUnchanged?: () => void;
  /** A check could not reach the server. */
  onFailed?: () => void;
}

/**
 * Keeps a screen current by asking "has anything changed?" every few seconds,
 * and loading in full only when it has - plus once a minute regardless. Only
 * while the tab is visible; at once on coming back to it, or back online.
 *
 * Returns refresh(), which loads in full now. Load through it, not around it:
 * it records the fingerprint the load answers to, and a load the hook did not
 * see would only be repeated by the next check.
 */
export function useChangeCheck({
  version,
  reload,
  enabled = true,
  selfVersioned = false,
  onUnchanged,
  onFailed,
}: ChangeCheckOptions): { refresh: () => Promise<void> } {
  // Read through refs, so a screen passing new functions each render does not
  // restart the timer.
  const callbacks = useRef({ version, reload, onUnchanged, onFailed });
  useEffect(() => {
    callbacks.current = { version, reload, onUnchanged, onFailed };
  }, [version, reload, onUnchanged, onFailed]);

  const seen = useRef<string | null>(null);
  const fullAt = useRef(0);
  // Loads and checks in flight. A check waiting on a slow connection is not
  // joined by another, and none is started while a load is still out.
  const busy = useRef(0);

  // Asked before loading, not after: what is on screen is then at least as new
  // as the fingerprint it is compared against, so no change can slip between.
  const loadAnswering = useCallback(async (known: string | null) => {
    const own = await callbacks.current.reload();
    seen.current = typeof own === "string" ? own : known;
    fullAt.current = Date.now();
  }, []);

  const loadInFull = useCallback(async () => {
    const known = selfVersioned ? null : await callbacks.current.version().catch(() => null);
    await loadAnswering(known);
  }, [selfVersioned, loadAnswering]);

  const refresh = useCallback(async () => {
    busy.current += 1;
    try {
      await loadInFull();
    } catch {
      callbacks.current.onFailed?.();
    } finally {
      busy.current -= 1;
    }
  }, [loadInFull]);

  const check = useCallback(async () => {
    if (busy.current > 0) return;
    busy.current += 1;
    try {
      if (Date.now() - fullAt.current >= FULL_REFRESH_MS) {
        await loadInFull();
        return;
      }
      const current = await callbacks.current.version();
      if (current === null || current !== seen.current) await loadAnswering(current);
      else callbacks.current.onUnchanged?.();
    } catch {
      callbacks.current.onFailed?.();
    } finally {
      busy.current -= 1;
    }
  }, [loadInFull, loadAnswering]);

  usePolling(() => void check(), CHANGE_CHECK_MS, { enabled, immediate: false });

  // A phone that loses signal and gets it back checks at once, rather than
  // waiting out the interval.
  useEffect(() => {
    if (!enabled) return;
    const onOnline = () => void check();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [enabled, check]);

  return { refresh };
}
