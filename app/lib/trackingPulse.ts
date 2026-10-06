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
//
// WHY EACH CLOCK REMEMBERS WHICH TRIP IT IS ABOUT
//
// It did not, and both were kept for eighteen hours. So the last movement of the
// morning delivery was still on the clock when the afternoon one began, and the
// new trip opened with hours of standing still already against it: the crew
// accepted a booking made fifteen minutes earlier and were asked, immediately,
// why they had not moved.
//
// Eighteen hours was chosen to stop yesterday leaking into today, which it does.
// It cannot stop the last trip leaking into this one, because both happen in the
// same shift - only knowing which trip a timestamp belongs to can do that. A
// clock from another trip now reads as nothing, which is the truth: this trip
// has not reported yet.

const STORAGE_KEY = "logisco.tracking.lastPing";
const MOVE_STORAGE_KEY = "logisco.tracking.lastMove";

// How stale a recovered timestamp may be before it is treated as nothing.
//
// A ping from yesterday says nothing about the trip being driven today, and
// restoring it would open the prompt the moment the app launched. The trip a
// timestamp belongs to is what actually keeps one delivery out of the next;
// this is the backstop for a trip left open across a night.
const MAX_RECOVERED_AGE_MS = 18 * 60 * 60 * 1000;

/** A clock, and the trip it is about. Neither is any use without the other. */
interface Pulse {
  trip: string;
  at: number;
}

let ping: Pulse | null = null;
let move: Pulse | null = null;
let recovered = false;
let recoveredMove = false;

function readStored(key: string): Pulse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    // A value written before these carried a trip is unattributable, and an
    // unattributable clock is the bug this fixes. It reads as nothing, and the
    // next position overwrites it.
    const parsed = JSON.parse(raw) as { trip?: unknown; at?: unknown };
    const at = Number(parsed?.at);
    const trip = typeof parsed?.trip === "string" ? parsed.trip : "";
    if (!trip || !Number.isFinite(at) || at <= 0) return null;
    if (Date.now() - at > MAX_RECOVERED_AGE_MS) return null;
    return { trip, at };
  } catch {
    return null;
  }
}

function write(key: string, pulse: Pulse): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(pulse));
  } catch {
    // Storage is a convenience here; memory still has the value for this
    // session and the prompt works exactly as it did before.
  }
}

/** The clock, but only if it is about the trip being asked about. */
function forTrip(pulse: Pulse | null, trip: string): number | null {
  return pulse && pulse.trip === trip ? pulse.at : null;
}

function since(at: number | null, now: number): number | null {
  if (at === null) return null;
  return Math.max(0, Math.floor((now - at) / 60_000));
}

/**
 * The last ping, from memory or - once per session - from storage.
 *
 * Read lazily rather than at module load: this file is imported during server
 * rendering too, where there is no window, and reading on first use keeps the
 * two paths the same.
 */
function currentPing(): Pulse | null {
  if (ping === null && !recovered) {
    recovered = true;
    ping = readStored(STORAGE_KEY);
  }
  return ping;
}

/** Called on every position the server accepted, for the trip it was about. */
export function markPing(trip: string | number, at = Date.now()): void {
  ping = { trip: String(trip), at };
  recovered = true;
  write(STORAGE_KEY, ping);
}

/**
 * Whole minutes since this trip's last accepted position, or null if there has
 * been none - including when the clock on file belongs to a different trip.
 */
export function minutesSincePing(trip: string | number, now = Date.now()): number | null {
  return since(forTrip(currentPing(), String(trip)), now);
}

/**
 * When the server last saw this truck in a different place.
 *
 * Given the server's own timestamp rather than the time of the call, so the two
 * never drift and a restart recovers the real figure from the next post.
 */
export function markMovement(trip: string | number, at: number): void {
  if (!Number.isFinite(at) || at <= 0) return;
  move = { trip: String(trip), at };
  recoveredMove = true;
  write(MOVE_STORAGE_KEY, move);
}

/**
 * Whole minutes since the truck last moved, or null if that is not known yet.
 *
 * Null rather than zero on a trip whose first position has not landed: "has not
 * moved for 0 minutes" and "we have no idea" are different answers, and only one
 * of them is a reason to ask the driver anything. The same goes for a clock left
 * behind by an earlier trip, which is not an answer about this one.
 */
export function minutesSinceMove(trip: string | number, now = Date.now()): number | null {
  return since(lastMovedAt(trip), now);
}

/**
 * When this trip's truck last moved, or null if that is not known.
 *
 * The moment itself rather than minutes since it, for whoever needs to tell one
 * stretch of standing still from the next: two stops can both be twenty minutes
 * long, and only the timestamp says they are different stops.
 */
export function lastMovedAt(trip: string | number): number | null {
  if (move === null && !recoveredMove) {
    recoveredMove = true;
    move = readStored(MOVE_STORAGE_KEY);
  }
  return forTrip(move, String(trip));
}

/** Only for tests: forgets both clocks. */
export function forgetPings(): void {
  ping = null;
  move = null;
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
