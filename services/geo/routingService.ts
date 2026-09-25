// Driving time between two points, used for the live ETA shown to customers.
// Falls back to null on any problem: an ETA is a nice-to-have, never a reason
// for the tracking page to fail.

import type { Coordinates } from "@/services/geo/geocodingService";
import { formatTime } from "@/app/lib/datetime";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN;
const DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";
const REQUEST_TIMEOUT_MS = 5000;

export interface TravelEstimate {
  minutes: number;
  distanceKm: number;
}

export async function getTravelEstimate(
  from: Coordinates,
  to: Coordinates,
): Promise<TravelEstimate | null> {
  if (!MAPBOX_TOKEN) return null;

  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `${DIRECTIONS_URL}/${coordinates}?overview=false&access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) return null;

    const result = await response.json();
    const route = result?.routes?.[0];
    if (!route || !Number.isFinite(route.duration)) return null;

    return {
      minutes: Math.max(1, Math.round(route.duration / 60)),
      distanceKm: Math.round((route.distance ?? 0) / 100) / 10,
    };
  } catch (error) {
    console.error("Travel estimate failed:", error);
    return null;
  }
}

// "in 25 min" -> a wall-clock arrival label such as "3:45 PM".
export function toArrivalLabel(minutes: number, now = new Date()): string {
  const arrival = new Date(now.getTime() + minutes * 60_000);
  // Through the shared formatter: this is worked out on a server in UTC and
  // read by a crew member and a client, both of them in Manila.
  return formatTime(arrival.toISOString());
}
