// When this device last got a position through to the server.
//
// The crew app reports on movement and at no other time, so the app itself is
// the only thing that knows the difference between "we have stopped" and "we
// have lost the server". The stall check, watching from the outside, cannot tell
// those apart - which is why it asks rather than assumes.
//
// Held in module scope rather than in React state because the tracking watchers
// live outside React, and because it must survive the crew navigating between
// screens without restarting the clock.

let lastPingAt: number | null = null;

/** Called on every position the server accepted. */
export function markPing(at = Date.now()): void {
  lastPingAt = at;
}

/** Whole minutes since the last accepted position, or null if there has been none. */
export function minutesSincePing(now = Date.now()): number | null {
  if (lastPingAt === null) return null;
  return Math.max(0, Math.floor((now - lastPingAt) / 60_000));
}

/** Only for tests: forgets the last ping. */
export function forgetPings(): void {
  lastPingAt = null;
}
