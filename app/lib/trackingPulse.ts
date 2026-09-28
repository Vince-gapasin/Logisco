// When this device last got a position through to the server.
//
// The crew app reports on movement and at no other time, so the app itself is
// the only thing that knows the difference between "we have stopped" and "we
// have lost the server". The stall check, watching from the outside, cannot tell
// those apart - which is why it asks rather than assumes.
//
// WHY IT IS WRITTEN DOWN AND NOT ONLY HELD IN MEMORY
//
// This was module scope alone, which survives the crew moving between screens
// but not the app being killed and reopened - and Android kills a backgrounded
// WebView readily, most readily when the phone has been sitting still, which is
// exactly the situation this exists to detect. The driver stops, Android
// reclaims the app, the driver reopens it, the clock reads null, and the "Are
// you alright?" prompt never appears. The one moment it needed to ask was the
// one moment it had forgotten.
//
// So the timestamp goes to localStorage as well. Memory stays the fast path and
// the source of truth within a session; storage is only consulted to recover
// after a restart. Every access is wrapped, because storage throws in a private
// window and can come back empty with site data cleared - and a stall prompt is
// not worth crashing a delivery screen over.

const STORAGE_KEY = "logisco.tracking.lastPing";

// How stale a recovered timestamp may be before it is treated as nothing.
//
// A ping from yesterday says nothing about the trip being driven today, and
// restoring it would open the prompt the moment the app launched. Comfortably
// longer than any single shift, short enough that a stale one cannot leak into
// the next.
const MAX_RECOVERED_AGE_MS = 18 * 60 * 60 * 1000;

let lastPingAt: number | null = null;
let recovered = false;

function readStored(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const at = Number(raw);
    if (!Number.isFinite(at) || at <= 0) return null;
    if (Date.now() - at > MAX_RECOVERED_AGE_MS) return null;
    return at;
  } catch {
    return null;
  }
}

/**
 * The last ping, from memory or - once per session - from storage.
 *
 * Read lazily rather than at module load: this file is imported during server
 * rendering too, where there is no window, and reading on first use keeps the
 * two paths the same.
 */
function currentPing(): number | null {
  if (lastPingAt === null && !recovered) {
    recovered = true;
    lastPingAt = readStored();
  }
  return lastPingAt;
}

/** Called on every position the server accepted. */
export function markPing(at = Date.now()): void {
  lastPingAt = at;
  recovered = true;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Storage is a convenience here; memory still has the value for this
    // session and the prompt works exactly as it did before.
  }
}

/** Whole minutes since the last accepted position, or null if there has been none. */
export function minutesSincePing(now = Date.now()): number | null {
  const at = currentPing();
  if (at === null) return null;
  return Math.max(0, Math.floor((now - at) / 60_000));
}

/** Only for tests: forgets the last ping. */
export function forgetPings(): void {
  lastPingAt = null;
  recovered = false;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to undo.
  }
}
