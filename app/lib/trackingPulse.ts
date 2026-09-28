// Two clocks: when this device last reached the server, and when the truck it is
// in last actually moved.
//
// They used to be one, and that was wrong in a way that mattered. markPing fires
// on every successful post, and the heartbeat posts the same coordinates every
// three minutes whether or not the truck has moved - so on a working app the
// contact clock never passes a minute or two, and the check-in prompt, which
// waited for fifteen, could not appear at all. A driver parked at the depot with
// the app running was never asked anything.
//
// So contact and movement are counted separately now. Contact answers "is this
// phone still talking to us"; movement answers "is this truck going anywhere",
// which is the question the prompt is actually for.
//
// Movement is not worked out here. The app cannot tell a parked heartbeat from a
// driving one - both are a post that succeeded - so the server compares the
// coordinates and hands back the time it last saw a real change. This file only
// remembers what it was told.
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
const MOVE_STORAGE_KEY = "logisco.tracking.lastMove";

// How stale a recovered timestamp may be before it is treated as nothing.
//
// A ping from yesterday says nothing about the trip being driven today, and
// restoring it would open the prompt the moment the app launched. Comfortably
// longer than any single shift, short enough that a stale one cannot leak into
// the next.
const MAX_RECOVERED_AGE_MS = 18 * 60 * 60 * 1000;

let lastPingAt: number | null = null;
let lastMoveAt: number | null = null;
let recovered = false;
let recoveredMove = false;

function readStored(key = STORAGE_KEY): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
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

/**
 * When the server last saw this truck in a different place.
 *
 * Given the server's own timestamp rather than the time of the call, so the two
 * never drift and a restart recovers the real figure from the next post.
 */
export function markMovement(at: number): void {
  if (!Number.isFinite(at) || at <= 0) return;
  lastMoveAt = at;
  recoveredMove = true;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOVE_STORAGE_KEY, String(at));
  } catch {
    // Memory still has it for this session.
  }
}

/**
 * Whole minutes since the truck last moved, or null if that is not known yet.
 *
 * Null rather than zero on a trip whose first position has not landed: "has not
 * moved for 0 minutes" and "we have no idea" are different answers, and only one
 * of them is a reason to ask the driver anything.
 */
export function minutesSinceMove(now = Date.now()): number | null {
  if (lastMoveAt === null && !recoveredMove) {
    recoveredMove = true;
    lastMoveAt = readStored(MOVE_STORAGE_KEY);
  }
  if (lastMoveAt === null) return null;
  return Math.max(0, Math.floor((now - lastMoveAt) / 60_000));
}

/** Only for tests: forgets both clocks. */
export function forgetPings(): void {
  lastPingAt = null;
  lastMoveAt = null;
  recovered = false;
  recoveredMove = false;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(MOVE_STORAGE_KEY);
  } catch {
    // Nothing to undo.
  }
}
