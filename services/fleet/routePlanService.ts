// The road a truck is going to drive, as opposed to the one it has driven.
//
// The map already draws where a truck has been, from the GPS fixes the crew
// app posts. This is the other half: the route ahead of it, through the stops
// still to be made, along real roads rather than straight lines between pins.
//
// Best-effort like everything else that talks to Mapbox. Without a token, or
// when Directions is unreachable, this returns null and the map falls back to
// what it drew before.

import { supabase } from "@/app/lib/supabase";
import { isStopDelivered } from "@/app/lib/enums";
import { getRouteGeometry, type PlannedRoute, type RoutePath } from "@/services/geo/routingService";
import type { Coordinates } from "@/services/geo/geocodingService";

interface PickupRow {
  warehouseName: string | null;
  pickupLat: number | null;
  pickupLong: number | null;
  sequence: number | null;
  stopStatus: string | null;
}

export interface RouteWaypoint extends Coordinates {
  label: string;
  kind: "truck" | "pickup" | "delivery";
  /** Which delivery stop this is, so a screen can say when the truck reaches it. */
  branchID?: number;
}

export interface DispatchRoute extends PlannedRoute {
  /** The points the route was drawn through, in order, for labelling legs. */
  waypoints: RouteWaypoint[];
}

// A backstop, not the mechanism. What actually keeps a route current is the
// truck leaving it, and a stop being finished clearing it outright - this is
// only here so that nothing can go stale indefinitely if both of those miss.
const CACHE_TTL_MS = 15 * 60 * 1000;

// How far off the drawn route the truck has to be before the route is wrong.
// Wide enough to absorb GPS scatter and a dual carriageway drawn as one line;
// narrow enough that a wrong turn shows within a block or two.
const OFF_ROUTE_M = 150;

interface CacheEntry {
  route: DispatchRoute;
  storedAt: number;
  from: Coordinates | null;
}

const cache = new Map<string, CacheEntry>();

const METRES_PER_DEGREE = 111_320;

/**
 * Metres from a point to the nearest part of a line.
 *
 * Over a few kilometres at these latitudes, treating degrees as a flat grid is
 * accurate to well within the tolerance this is compared against, and it
 * avoids doing trigonometry a thousand times per request.
 *
 * Returns Infinity for a line with nothing in it: no line to be near.
 */
export function metresFromPath(point: Coordinates, path: RoutePath): number {
  if (path.length === 0) return Infinity;

  const scale = Math.cos((point.latitude * Math.PI) / 180) * METRES_PER_DEGREE;
  const px = point.longitude * scale;
  const py = point.latitude * METRES_PER_DEGREE;

  let closest = Infinity;

  for (let i = 0; i < path.length; i++) {
    const ax = path[i][0] * scale;
    const ay = path[i][1] * METRES_PER_DEGREE;

    // The last point is a point, not the start of a segment.
    if (i === path.length - 1) {
      closest = Math.min(closest, Math.hypot(px - ax, py - ay));
      break;
    }

    const bx = path[i + 1][0] * scale;
    const by = path[i + 1][1] * METRES_PER_DEGREE;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;

    // How far along this segment the nearest point lies, clamped to its ends
    // so that a truck past the end of a segment measures to the end, not to
    // an imaginary continuation of it.
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));

    closest = Math.min(closest, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
    if (closest === 0) break;
  }

  return closest;
}

function usable(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value !== 0;
}

/**
 * Where this trip still has to go: its uncollected pickups, then its
 * undelivered stops, in the order the itinerary gives them.
 *
 * A stop with no coordinates is skipped rather than guessed at - 0,0 is the
 * placeholder written when an address could not be geocoded, and routing
 * through the Atlantic is worse than routing without it.
 */
export async function getRemainingWaypoints(dispatchID: string): Promise<RouteWaypoint[]> {
  // Deliveries are linked to the trip carrying them. Pickups are linked to the
  // booking instead - only a handful of rows have ever had a dispatchID - so
  // they are read through the order, which is the link that is actually there.
  const { data: trip } = await supabase
    .from("DispatchOrder")
    .select("orderID")
    .eq("dispatchID", dispatchID)
    .maybeSingle();

  const [{ data: pickups }, { data: stops }] = await Promise.all([
    trip?.orderID
      ? supabase
          .from("PickupStops")
          .select("warehouseName, pickupLat, pickupLong, sequence, stopStatus")
          .eq("orderID", trip.orderID)
          .order("sequence", { ascending: true })
      : Promise.resolve({ data: [] as PickupRow[] }),
    supabase
      .from("BranchStops")
      .select("branchID, branchName, deliveryLat, deliverLong, sequence, stopStatus")
      .eq("dispatchID", dispatchID)
      .order("sequence", { ascending: true }),
  ]);

  const waypoints: RouteWaypoint[] = [];

  for (const pickup of pickups ?? []) {
    if (isStopDelivered(pickup.stopStatus)) continue;
    // A pickup that was never geocoded sits at 0,0. Routing through the
    // Atlantic is worse than routing without it.
    if (!usable(pickup.pickupLat) || !usable(pickup.pickupLong)) continue;
    waypoints.push({
      latitude: pickup.pickupLat,
      longitude: pickup.pickupLong,
      label: pickup.warehouseName || "Pickup",
      kind: "pickup",
    });
  }

  for (const stop of stops ?? []) {
    if (isStopDelivered(stop.stopStatus)) continue;
    if (!usable(stop.deliveryLat) || !usable(stop.deliverLong)) continue;
    waypoints.push({
      latitude: stop.deliveryLat,
      longitude: stop.deliverLong,
      label: stop.branchName || "Stop",
      kind: "delivery",
      branchID: stop.branchID ?? undefined,
    });
  }

  return waypoints;
}

/** The truck's last known position, or null when it has not reported one. */
export async function getTruckPosition(dispatchID: string): Promise<Coordinates | null> {
  const { data } = await supabase
    .from("FleetLocations")
    .select("latitude, longitude")
    .eq("dispatch_id", dispatchID)
    .maybeSingle();

  if (!data || !usable(data.latitude) || !usable(data.longitude)) return null;
  return { latitude: data.latitude, longitude: data.longitude };
}

/**
 * The route this trip still has to drive. Starts wherever the truck is, when
 * it has said; otherwise from its first remaining stop, which is the right
 * answer before anyone has set off.
 */
export async function getDispatchRoute(dispatchID: string): Promise<DispatchRoute | null> {
  const from = await getTruckPosition(dispatchID);

  const cached = cache.get(dispatchID);
  if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) {
    // A truck driving along the route it was given needs no new route, however
    // far along it has got. This used to ask how far the truck had moved since
    // the route was drawn, which a truck obeying the route does constantly:
    // 250 m is twenty-two seconds at 40 km/h, so the line was redrawn - to
    // something all but identical - on nearly every poll of every viewer.
    const offRoute = from ? metresFromPath(from, cached.route.path) > OFF_ROUTE_M : false;
    const startedReporting = Boolean(from) !== Boolean(cached.from);

    if (!offRoute && !startedReporting) return cached.route;
  }

  const remaining = await getRemainingWaypoints(dispatchID);
  const waypoints: RouteWaypoint[] = from
    ? [{ ...from, label: "Truck", kind: "truck" }, ...remaining]
    : remaining;

  // One point is a destination, not a route.
  if (waypoints.length < 2) return null;

  const planned = await getRouteGeometry(waypoints);
  if (!planned) return null;

  const route: DispatchRoute = { ...planned, waypoints };
  cache.set(dispatchID, { route, storedAt: Date.now(), from });
  return route;
}

/** Forgets a trip's route, for when its stops change under it. */
export function forgetDispatchRoute(dispatchID: string): void {
  cache.delete(dispatchID);
}
