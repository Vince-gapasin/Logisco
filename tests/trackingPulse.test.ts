import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The clock the crew prompt reads to decide whether to ask "Are you alright?".
//
// It used to be module scope alone, so the answer was forgotten whenever Android
// killed the app - which it does most readily when the phone has been sitting
// still, which is the exact situation this measures. These cover the part that
// fixes: that a timestamp survives a restart, and that a stale one does not come
// back to haunt the next shift.

const KEY = "logisco.tracking.lastPing";
const MOVE_KEY = "logisco.tracking.lastMove";

// Every clock is about a trip now. One delivery's last movement used to answer
// for the next one, because both were kept for eighteen hours with nothing
// saying which trip they belonged to - so a crew who had just accepted a booking
// were asked, immediately, why they had not moved.
const TRIP = "trip-1";
const OTHER_TRIP = "trip-2";

/** How a clock is written down, now that it carries its trip. */
const stored = (trip: string, at: number) => JSON.stringify({ trip, at });

/** Just enough localStorage for the module, in a test environment with no DOM. */
function fakeWindow(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    _store: store,
  };
}

/** A fresh copy of the module, as though the app had just started. */
async function restart() {
  vi.resetModules();
  return import("@/app/lib/trackingPulse");
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  vi.useRealTimers();
});

describe("within one session", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = fakeWindow();
  });

  it("has nothing to say before a position has got through", async () => {
    const pulse = await restart();
    expect(pulse.minutesSincePing(TRIP)).toBeNull();
  });

  it("counts whole minutes since the last position", async () => {
    const pulse = await restart();
    const at = Date.UTC(2026, 8, 29, 8, 0, 0);
    pulse.markPing(TRIP, at);

    expect(pulse.minutesSincePing(TRIP, at)).toBe(0);
    expect(pulse.minutesSincePing(TRIP, at + 59_000)).toBe(0);
    expect(pulse.minutesSincePing(TRIP, at + 60_000)).toBe(1);
    expect(pulse.minutesSincePing(TRIP, at + 16 * 60_000)).toBe(16);
  });

  it("never reports a negative silence when the clock disagrees", async () => {
    const pulse = await restart();
    const at = Date.UTC(2026, 8, 29, 8, 0, 0);
    pulse.markPing(TRIP, at);
    expect(pulse.minutesSincePing(TRIP, at - 5 * 60_000)).toBe(0);
  });
});

describe("across a restart", () => {
  it("recovers the last position, so the prompt still knows to ask", async () => {
    const win = fakeWindow();
    (globalThis as { window?: unknown }).window = win;

    const before = await restart();
    const at = Date.now() - 20 * 60_000;
    before.markPing(TRIP, at);
    expect(before.minutesSincePing(TRIP)).toBe(20);

    // Android reclaims the app; the crew reopen it. Memory is gone, storage is
    // not - and twenty minutes of silence is past the first rung, so the prompt
    // has something to ask about.
    const after = await restart();
    expect(after.minutesSincePing(TRIP)).toBe(20);
  });

  it("ignores a timestamp old enough to belong to another shift", async () => {
    const stale = Date.now() - 19 * 60 * 60 * 1000;
    (globalThis as { window?: unknown }).window = fakeWindow({ [KEY]: stored(TRIP, stale) });

    const pulse = await restart();
    // Not "1,140 minutes of silence" on a trip that has not started: yesterday's
    // ping says nothing about today, and restoring it would open the prompt the
    // moment the app launched.
    expect(pulse.minutesSincePing(TRIP)).toBeNull();
  });

  it("ignores anything stored that is not a timestamp", async () => {
    (globalThis as { window?: unknown }).window = fakeWindow({ [KEY]: "not a number" });
    const pulse = await restart();
    expect(pulse.minutesSincePing(TRIP)).toBeNull();
  });

  it("forgets on request, in memory and in storage", async () => {
    const win = fakeWindow();
    (globalThis as { window?: unknown }).window = win;

    const pulse = await restart();
    pulse.markPing(TRIP, Date.now() - 5 * 60_000);
    pulse.forgetPings();

    expect(pulse.minutesSincePing(TRIP)).toBeNull();
    expect(win._store.has(KEY)).toBe(false);
  });
});

describe("when storage will not cooperate", () => {
  it("keeps working from memory if writing throws", async () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("private window");
        },
        removeItem: () => {},
      },
    };

    const pulse = await restart();
    const at = Date.now() - 7 * 60_000;
    expect(() => pulse.markPing(TRIP, at)).not.toThrow();
    expect(pulse.minutesSincePing(TRIP)).toBe(7);
  });

  it("keeps working if reading throws", async () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("site data blocked");
        },
        setItem: () => {},
        removeItem: () => {},
      },
    };

    const pulse = await restart();
    expect(pulse.minutesSincePing(TRIP)).toBeNull();
    pulse.markPing(TRIP, Date.now() - 3 * 60_000);
    expect(pulse.minutesSincePing(TRIP)).toBe(3);
  });
});

describe("with no window at all", () => {
  it("behaves as it always did on the server", async () => {
    const pulse = await restart();
    expect(pulse.minutesSincePing(TRIP)).toBeNull();
    pulse.markPing(TRIP, Date.now() - 2 * 60_000);
    expect(pulse.minutesSincePing(TRIP)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// The movement clock
// ---------------------------------------------------------------------------
// The one the check-in prompt reads. It exists because the contact clock could
// not answer the question: the heartbeat posts every three minutes whether or
// not the truck has moved, so contact never lapses on a working app and the
// prompt - which waited on it - could not appear at all.

describe("how long the truck has been standing still", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = fakeWindow();
  });

  it("says nothing before the first position of a trip has landed", async () => {
    const pulse = await restart();
    // Not "still for 0 minutes": that is a claim, and there is nothing to claim
    // from yet.
    expect(pulse.minutesSinceMove(TRIP)).toBeNull();
  });

  it("counts from the time the server gave, not the time of the call", async () => {
    const pulse = await restart();
    const movedAt = Date.now() - 22 * 60_000;
    pulse.markMovement(TRIP, movedAt);
    expect(pulse.minutesSinceMove(TRIP)).toBe(22);
  });

  it("does not move when a heartbeat repeats the same position", async () => {
    const pulse = await restart();
    const movedAt = Date.now() - 40 * 60_000;

    // Four heartbeats, each handing back the same unchanged movedAt, which is
    // what the server does for a parked truck.
    pulse.markMovement(TRIP, movedAt);
    pulse.markPing(TRIP);
    pulse.markMovement(TRIP, movedAt);
    pulse.markPing(TRIP);

    // Contact is fresh; the truck has still been still for forty minutes. The
    // two clocks disagreeing is the whole point.
    expect(pulse.minutesSincePing(TRIP)).toBe(0);
    expect(pulse.minutesSinceMove(TRIP)).toBe(40);
  });

  it("restarts the count when the truck actually moves", async () => {
    const pulse = await restart();
    pulse.markMovement(TRIP, Date.now() - 40 * 60_000);
    pulse.markMovement(TRIP, Date.now() - 1 * 60_000);
    expect(pulse.minutesSinceMove(TRIP)).toBe(1);
  });

  it("survives the app being killed and reopened", async () => {
    (globalThis as { window?: unknown }).window = fakeWindow();
    const before = await restart();
    before.markMovement(TRIP, Date.now() - 25 * 60_000);

    const after = await restart();
    expect(after.minutesSinceMove(TRIP)).toBe(25);
  });

  it("refuses a timestamp that is not one", async () => {
    const pulse = await restart();
    pulse.markMovement(TRIP, Number.NaN);
    expect(pulse.minutesSinceMove(TRIP)).toBeNull();
    pulse.markMovement(TRIP, 0);
    expect(pulse.minutesSinceMove(TRIP)).toBeNull();
  });

  it("forgets both clocks on request", async () => {
    const pulse = await restart();
    pulse.markPing(TRIP);
    pulse.markMovement(TRIP, Date.now() - 5 * 60_000);
    pulse.forgetPings();
    expect(pulse.minutesSincePing(TRIP)).toBeNull();
    expect(pulse.minutesSinceMove(TRIP)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// One trip's clock is not another's
// ---------------------------------------------------------------------------
// The bug this fixes: both clocks were kept for eighteen hours with nothing
// recording which delivery they were about. So the morning trip's last movement
// was still on the clock when the afternoon's began, and the new trip opened
// with hours of standing still already against it - the crew accepted a booking
// made fifteen minutes earlier and were asked at once why they had not moved.

describe("which trip a clock is about", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = fakeWindow();
  });

  it("says nothing about a trip that has not reported, whatever the last one did", async () => {
    const pulse = await restart();
    pulse.markMovement(TRIP, Date.now() - 3 * 60 * 60_000);

    // Three hours of standing still on the finished trip. On the new one there
    // is no answer yet, and no answer is not "still for three hours".
    expect(pulse.minutesSinceMove(TRIP)).toBe(180);
    expect(pulse.minutesSinceMove(OTHER_TRIP)).toBeNull();
  });

  it("keeps the contact clock apart the same way", async () => {
    const pulse = await restart();
    pulse.markPing(TRIP, Date.now() - 40 * 60_000);
    expect(pulse.minutesSincePing(OTHER_TRIP)).toBeNull();
  });

  it("hands the clock over as soon as the new trip reports", async () => {
    const pulse = await restart();
    pulse.markMovement(TRIP, Date.now() - 3 * 60 * 60_000);
    pulse.markMovement(OTHER_TRIP, Date.now() - 2 * 60_000);

    expect(pulse.minutesSinceMove(OTHER_TRIP)).toBe(2);
    // And the trip it left behind no longer has one, which is correct: there is
    // one truck and one phone, and it is on the new delivery now.
    expect(pulse.minutesSinceMove(TRIP)).toBeNull();
  });

  it("does the same across a restart", async () => {
    (globalThis as { window?: unknown }).window = fakeWindow();
    const before = await restart();
    before.markMovement(TRIP, Date.now() - 90 * 60_000);

    const after = await restart();
    expect(after.minutesSinceMove(TRIP)).toBe(90);
    expect(after.minutesSinceMove(OTHER_TRIP)).toBeNull();
  });

  it("discards a clock written before they carried a trip", async () => {
    // Whatever is in a crew phone right now is a bare number. It cannot be
    // attributed to anything, which is the whole bug, so it reads as nothing
    // and the next position replaces it.
    (globalThis as { window?: unknown }).window = fakeWindow({
      [MOVE_KEY]: String(Date.now() - 45 * 60_000),
      [KEY]: String(Date.now() - 45 * 60_000),
    });

    const pulse = await restart();
    expect(pulse.minutesSinceMove(TRIP)).toBeNull();
    expect(pulse.minutesSincePing(TRIP)).toBeNull();
  });
});
