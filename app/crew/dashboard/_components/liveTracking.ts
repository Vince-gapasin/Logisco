import { registerPlugin, Capacitor } from '@capacitor/core';
import { getAccessToken } from "@/app/lib/apiClient";
import { markPing, markMovement } from "@/app/lib/trackingPulse";

// Background Geolocation Setup
// The Capacitor community plugin, as much of it as this screen uses.
interface BackgroundLocation {
  latitude: number;
  longitude: number;
  speed?: number | null;
  bearing?: number | null;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: Record<string, unknown>,
    callback: (location: BackgroundLocation | null, error: unknown) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
let activeTrackingId: string | null = null;

// The tracking watchers live outside React; this lets the open screen show the
// driver's own position without waiting for a round trip through the server.
export type PositionFix = { latitude: number; longitude: number };
let onPositionUpdate: ((fix: PositionFix) => void) | null = null;

export function setPositionListener(listener: ((fix: PositionFix) => void) | null) {
  onPositionUpdate = listener;
}

export function isLiveTracking(): boolean {
  return activeTrackingId !== null;
}

// Which trip this phone is tracking, for the stall watch: it runs across the
// whole crew portal, not only on the trip's own screen, and needs to know what
// it is watching without the dashboard being open.
let trackedTrip: string | null = null;

export function trackedTripID(): string | null {
  return activeTrackingId !== null ? trackedTrip : null;
}

// Browser geolocation can fire several times a second; one fix every 10s is
// plenty for the fleet map and keeps mobile data use low.
const WEB_PING_INTERVAL_MS = 10_000;
let lastWebPingAt = 0;

// ---------------------------------------------------------------- heartbeat
//
// The watchers above only fire when the truck moves, so a stopped truck and a
// dead phone have always sent the same thing: nothing. This re-sends the last
// known position on a timer whether or not anything has changed, which lets the
// office tell the two apart - the server records the last contact and the last
// actual movement separately, and decides for itself which a ping was.
//
// Every three minutes. Often enough that ten minutes of silence means something,
// rare enough to be nothing on a data plan: one small request, twenty times an
// hour, only while a trip is open.
const HEARTBEAT_MS = 3 * 60_000;

let heartbeat: ReturnType<typeof setInterval> | null = null;
let lastFix: { latitude: number; longitude: number; speed?: number | null; heading?: number | null } | null = null;

function startHeartbeat(dispatchId: string | number) {
  stopHeartbeat();

  heartbeat = setInterval(() => {
    // Nothing to re-send until the first real fix has arrived.
    if (!lastFix) return;
    void postLocation(dispatchId, lastFix);
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeat !== null) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

// Sends one GPS fix. The token is read per ping so tracking survives token
// refreshes. Returns false once the server reports the trip is closed.
async function postLocation(
  dispatchId: string | number,
  fix: { latitude: number; longitude: number; speed?: number | null; heading?: number | null },
): Promise<boolean> {
  const token = getAccessToken();
  if (!token) return true;

  lastFix = fix;

  try {
    const response = await fetch("/api/crew/dispatches/location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ dispatch_id: dispatchId, ...fix }),
    });

    // The app is the only thing that knows it is still in touch with the
    // server. The check-in prompt reads this to decide whether the silence the
    // office is seeing is real.
    if (response.ok) {
      markPing(dispatchId);

      // And when the truck was last somewhere else. The server works that out by
      // comparing coordinates - the app cannot, because a parked heartbeat and a
      // driving one are both just a post that succeeded - and hands the answer
      // back. Without it the prompt waits on a clock the heartbeat keeps
      // resetting, and never asks anything.
      const body = (await response.json().catch(() => null)) as { movedAt?: string } | null;
      const movedAt = body?.movedAt ? Date.parse(body.movedAt) : NaN;
      if (Number.isFinite(movedAt)) markMovement(dispatchId, movedAt);
    }

    return response.status !== 409;
  } catch {
    // Offline: drop this fix, the next one will update the pin.
    return true;
  }
}

export async function stopLiveTracking() {
  stopHeartbeat();
  trackedTrip = null;

  if (activeTrackingId) {
    if (Capacitor.getPlatform() === 'web') {
      navigator.geolocation.clearWatch(parseInt(activeTrackingId));
    } else {
      await BackgroundGeolocation.removeWatcher({ id: activeTrackingId });
    }
    activeTrackingId = null;
    console.log("Live tracking stopped.");
  }
}

export const startLiveTracking = async (dispatchId: string | number) => {
  try {
    // Never run two watchers at once.
    await stopLiveTracking();
    trackedTrip = String(dispatchId);

    // === WEB BROWSER FALLBACK FOR TESTING ===
    if (Capacitor.getPlatform() === 'web') {
      console.log("Web platform detected. Using browser HTML5 GPS for testing.");

      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const now = Date.now();
          if (now - lastWebPingAt < WEB_PING_INTERVAL_MS) return;
          lastWebPingAt = now;

          onPositionUpdate?.({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });

          const stillOpen = await postLocation(dispatchId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed || 0,
            heading: position.coords.heading || 0,
          });
          if (!stillOpen) void stopLiveTracking();
        },
        (err) => console.warn("Web GPS Error:", err),
        { enableHighAccuracy: true }
      );

      activeTrackingId = watchId.toString();
      startHeartbeat(dispatchId);
      return;
    }

    // === NATIVE MOBILE TRACKING (ANDROID/IOS) ===
    activeTrackingId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Tracking active delivery route.",
        backgroundTitle: "Logisco Live GPS",
        requestPermissions: true,
        stale: false,
        distanceFilter: 15, // Pings every 15 meters of movement
      },
      async (location: BackgroundLocation | null, error: unknown) => {
        if (error || !location) return;

        onPositionUpdate?.({
          latitude: location.latitude,
          longitude: location.longitude,
        });

        const stillOpen = await postLocation(dispatchId, {
          latitude: location.latitude,
          longitude: location.longitude,
          speed: location.speed,
          heading: location.bearing,
        });
        if (!stillOpen) void stopLiveTracking();
      }
    );

    startHeartbeat(dispatchId);
  } catch (err) {
    console.warn("Tracking initialization failed:", err);
  }
};
