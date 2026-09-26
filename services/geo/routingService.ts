// Driving along roads: how long it takes, and which roads.
//
// Falls back to null on any problem. Neither an ETA nor a drawn route is a
// reason for a tracking page to fail - the map still has its pins, and the
// trail of where the truck has actually been is read from our own database.

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

// ==========================================
// THE ROUTE ITSELF
// ==========================================
// The estimate above asks for `overview=false`, which tells Mapbox to leave
// the geometry out: it only ever needed a duration. Drawing the road a truck
// will follow needs that geometry, so this asks for it in full.

/** Longitude and latitude, in that order, as GeoJSON wants them. */
export type RoutePath = [number, number][];

export interface PlannedRoute {
  path: RoutePath;
  minutes: number;
  distanceKm: number;
  /** How long each leg takes, so a screen can say "22 min to the next stop". */
  legMinutes: number[];
}

// Mapbox takes at most 25 waypoints in one Directions request. No booking here
// comes close, but a trip that did would be cut rather than refused: a route
// drawn to the first 25 stops beats no route at all.
const MAX_WAYPOINTS = 25;

/**
 * The driving path through every point given, in order. At least two are
 * needed - where the truck is, and where it is going.
 */
export async function getRouteGeometry(waypoints: Coordinates[]): Promise<PlannedRoute | null> {
  if (!MAPBOX_TOKEN) return null;

  const points = waypoints
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    .slice(0, MAX_WAYPOINTS);
  if (points.length < 2) return null;

  const coordinates = points.map((point) => `${point.longitude},${point.latitude}`).join(";");
  const url = `${DIRECTIONS_URL}/${coordinates}?overview=full&geometries=geojson&access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) return null;

    const result = await response.json();
    const route = result?.routes?.[0];
    const path = route?.geometry?.coordinates as RoutePath | undefined;
    if (!Array.isArray(path) || path.length < 2) return null;

    return {
      path,
      minutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
      distanceKm: Math.round((route.distance ?? 0) / 100) / 10,
      legMinutes: (route.legs ?? []).map((leg: { duration?: number }) =>
        Math.max(1, Math.round((leg.duration ?? 0) / 60)),
      ),
    };
  } catch (error) {
    console.error("Route geometry failed:", error);
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
