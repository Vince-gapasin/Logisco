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
import { getRouteGeometry, type PlannedRoute } from "@/services/geo/routingService";
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
}

export interface DispatchRoute extends PlannedRoute {
  /** The points the route was drawn through, in order, for labelling legs. */
  waypoints: RouteWaypoint[];
}

// A planned route only moves when the stops change or the truck does. Holding
// it briefly keeps a polled tracking page from asking Mapbox the same question
// every few seconds, per viewer.
const CACHE_TTL_MS = 3 * 60 * 1000;

// Far enough that the road ahead is genuinely different, rather than the truck
// having crept forward at a red light.
const RECOMPUTE_DISTANCE_M = 250;

interface CacheEntry {
  route: DispatchRoute;
  storedAt: number;
  from: Coordinates | null;
}

const cache = new Map<string, CacheEntry>();

/** Rough metres between two positions. Good enough to decide "has it moved?". */
function metresBetween(a: Coordinates, b: Coordinates): number {
  const latMetres = (a.latitude - b.latitude) * 111_320;
  const lonMetres = (a.longitude - b.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(latMetres * latMetres + lonMetres * lonMetres);
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
      .select("branchName, deliveryLat, deliverLong, sequence, stopStatus")
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
    const stale =
      Boolean(from) !== Boolean(cached.from) ||
      (from && cached.from && metresBetween(from, cached.from) > RECOMPUTE_DISTANCE_M);
    if (!stale) return cached.route;
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
