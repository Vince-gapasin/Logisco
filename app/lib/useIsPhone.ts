"use client";

import { useSyncExternalStore } from "react";

// Whether the screen is phone-width: below Tailwind's sm breakpoint, the same
// line the stylesheet draws. For the few things CSS cannot switch on its own,
// such as a placeholder too long for a phone's search box.
//
// False during server rendering and the first paint, so the wider version is
// what shows until the browser has been read.
const PHONE = "(max-width: 639px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);
}
