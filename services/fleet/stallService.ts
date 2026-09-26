// Watching for a truck that has gone quiet on the road.
//
// Reads the trips that are out, works out how long each has been silent, and
// says something once per trip per threshold. Safe to call as often as you
// like: whether anything is said is decided by the notification's dedupe key,
// not by how often this runs.

import { supabase } from "@/app/lib/supabase";
import { DELIVERY_STATUS } from "@/app/lib/enums";
import {
  assessStall,
  stallAlert,
  stallDedupeKey,
  type StallThreshold,
  type StallVerdict,
} from "@/app/lib/stallRules";
import { crewOf, notify, OFFICE, tripLabel } from "@/services/notifications/notify";
import { getRemainingWaypoints } from "@/services/fleet/routePlanService";

const METRES_PER_DEGREE = 111_320;

function metresBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const north = (a.latitude - b.latitude) * METRES_PER_DEGREE;
  const east = (a.longitude - b.longitude) * METRES_PER_DEGREE * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(north, east);
}

export interface StalledTrip {
  dispatchID: string;
  orderCode: string | null;
  truck: string | null;
  verdict: StallVerdict;
  /** Whether anything was said about it this time round. */
  raised: boolean;
}

interface LiveTrip {
  dispatchID: string;
  status: string;
  orderCode: string | null;
  truck: string | null;
  lastReportedAt: string | null;
  position: { latitude: number; longitude: number } | null;
}

/** The trips that are out on the road, with wherever they last reported from. */
async function tripsOnTheRoad(): Promise<LiveTrip[]> {
  const { data: dispatches, error } = await supabase
    .from("DispatchOrder")
    .select("dispatchID, status, Order ( orderCode ), Truck ( plateNumber )")
    .eq("status", DELIVERY_STATUS.inTransit);

  if (error) throw new Error(`Could not read the trips on the road: ${error.message}`);
  if (!dispatches || dispatches.length === 0) return [];

  const { data: locations } = await supabase
    .from("FleetLocations")
    .select("dispatch_id, latitude, longitude, updated_at")
    .in("dispatch_id", dispatches.map((trip) => trip.dispatchID));

  const positionOf = new Map((locations ?? []).map((row) => [row.dispatch_id, row]));

  return dispatches.map((trip) => {
    const order = Array.isArray(trip.Order) ? trip.Order[0] : trip.Order;
    const truck = Array.isArray(trip.Truck) ? trip.Truck[0] : trip.Truck;
    const seen = positionOf.get(trip.dispatchID);

    return {
      dispatchID: trip.dispatchID as string,
      status: trip.status as string,
      orderCode: (order as { orderCode?: string } | null)?.orderCode ?? null,
      truck: (truck as { plateNumber?: string } | null)?.plateNumber ?? null,
      lastReportedAt: (seen?.updated_at as string) ?? null,
      position:
        seen && Number(seen.latitude) && Number(seen.longitude)
          ? { latitude: seen.latitude as number, longitude: seen.longitude as number }
          : null,
    };
  });
}

/**
 * How far this truck is from the nearest stop it still has to make.
 *
 * Null when either end is unknown, which the rules treat as "cannot vouch for
 * it" rather than "it is fine" - a stop with no coordinates should not be able
 * to silence an alarm.
 */
async function metresToNearestStop(trip: LiveTrip): Promise<number | null> {
  if (!trip.position) return null;

  const remaining = await getRemainingWaypoints(trip.dispatchID);
  if (remaining.length === 0) return null;

  return Math.min(...remaining.map((stop) => metresBetween(trip.position!, stop)));
}

/**
 * Looks at every trip on the road and says something about the quiet ones.
 *
 * Returns what it found either way, so a screen can colour a trip amber at
 * fifteen minutes without anybody being notified about it.
 */
export async function checkForStalledTrips(now = new Date()): Promise<StalledTrip[]> {
  const trips = await tripsOnTheRoad();
  const found: StalledTrip[] = [];

  for (const trip of trips) {
    const verdict = assessStall({
      lastReportedAt: trip.lastReportedAt,
      status: trip.status,
      metresToNearestStop: await metresToNearestStop(trip),
      now,
    });

    if (!verdict.stalled || !verdict.threshold || !trip.lastReportedAt) {
      if (verdict.silentFor > 0) {
        found.push({ ...trip, verdict, raised: false });
      }
      continue;
    }

    const raised = await raiseStall(trip, verdict.threshold, verdict.silentFor, trip.lastReportedAt);
    found.push({ ...trip, verdict, raised });
  }

  return found;
}

async function raiseStall(
  trip: LiveTrip,
  threshold: StallThreshold,
  silentFor: number,
  lastReportedAt: string,
): Promise<boolean> {
  const label = (await tripLabel(trip.dispatchID)) ?? trip.orderCode ?? trip.truck ?? "A delivery";
  const alert = stallAlert(threshold, label, silentFor);

  // Fifteen minutes is for the board, not for anybody's phone.
  if (!alert.notifyOffice && !alert.askCrew) return false;

  const told = await notify({
    event: "TRUCK_STALLED",
    title: alert.title,
    body: alert.body,
    severity: alert.severity,
    roles: alert.notifyOffice ? OFFICE : [],
    // The crew are asked whether all is well; they can clear it by moving.
    employeeIDs: alert.askCrew ? await crewOf(trip.dispatchID) : [],
    dedupeKey: stallDedupeKey(trip.dispatchID, threshold, lastReportedAt),
    entity: { table: "DispatchOrder", id: trip.dispatchID },
    link: "/admindashboard/fleet-tracking",
  });

  return told > 0;
}
