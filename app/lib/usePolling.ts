"use client";

import { useEffect, useRef } from "react";

interface PollingOptions {
  /** Pause without unmounting, e.g. once a delivery is complete. */
  enabled?: boolean;
  /** Run once straight away. Turn off when another effect loads first. */
  immediate?: boolean;
}

// Runs a callback on an interval, but only while the tab is visible. A
// background tab kept polling the fleet board, notifications and the customer
// tracking page indefinitely, which costs mobile data and server capacity for
// a screen nobody is looking at.
//
// When the tab becomes visible again the callback runs immediately, so the
// view is current rather than waiting out the remaining interval.
export function usePolling(
  callback: () => void,
  intervalMs: number,
  { enabled = true, immediate = true }: PollingOptions = {},
): void {
  // Updated in an effect, not during render: a ref must not be mutated while
  // rendering.
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(() => savedCallback.current(), intervalMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        savedCallback.current();
        start();
      } else {
        stop();
      }
    };

    if (immediate) savedCallback.current();
    if (document.visibilityState === "visible") start();

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs, enabled, immediate]);
}
