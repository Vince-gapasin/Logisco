import { supabase } from "@/app/lib/supabase";

// Dispatches that are on the road and should appear on the live board.
const LIVE_STATUSES = ["Accepted", "In Transit"];

export interface LiveFleetRecord {
  dispatchID: string;
  orderId: string;
  truck: string;
  client: string;
  status: string;
  trackingToken: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  lastUpdated: string | null;
}

type RelatedRow<T> = T | T[] | null;

function first<T>(value: RelatedRow<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

// Joins active dispatches with the latest GPS fix posted by the crew app.
export async function getLiveFleet(): Promise<LiveFleetRecord[]> {
  const { data: dispatches, error } = await supabase
    .from("DispatchOrder")
    .select("dispatchID, dispatchCode, status, Order(orderCode, orderLinkToken, Client(company)), Truck(plateNumber)")
    .in("status", LIVE_STATUSES);

  if (error) throw new Error(`Supabase Dispatch Error: ${error.message}`);
  if (!dispatches || dispatches.length === 0) return [];

  const { data: locations, error: locationError } = await supabase
    .from("FleetLocations")
    .select("dispatch_id, latitude, longitude, speed, updated_at")
    .in("dispatch_id", dispatches.map((d) => d.dispatchID));

  if (locationError) throw new Error(`Supabase Location Error: ${locationError.message}`);

  const locationByDispatch = new Map((locations ?? []).map((l) => [l.dispatch_id, l]));

  return dispatches
    .map((dispatch) => {
      const order = first(
        dispatch.Order as RelatedRow<{
          orderCode: string | null;
          orderLinkToken: string | null;
          Client: RelatedRow<{ company: string | null }>;
        }>,
      );
      const client = first(order?.Client ?? null);
      const truck = first(dispatch.Truck as RelatedRow<{ plateNumber: string | null }>);
      const location = locationByDispatch.get(dispatch.dispatchID);

      return {
        dispatchID: dispatch.dispatchID,
        orderId: order?.orderCode || dispatch.dispatchCode || "N/A",
        truck: truck?.plateNumber || "Unassigned",
        client: client?.company || "Walk-in / On-Call",
        status: dispatch.status,
        trackingToken: order?.orderLinkToken ?? null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        speed: location?.speed ?? null,
        lastUpdated: location?.updated_at ?? null,
      };
    })
    .sort((a, b) => (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""));
}

export interface TrailPoint {
  latitude: number;
  longitude: number;
  recordedAt: string;
}

// The route a truck has actually driven, oldest point first. Returns an empty
// trail when the optional FleetLocationHistory table has not been created yet.
export async function getDispatchTrail(dispatchID: string, limit = 300): Promise<TrailPoint[]> {
  const { data, error } = await supabase
    .from("FleetLocationHistory")
    .select("latitude, longitude, recorded_at")
    .eq("dispatch_id", dispatchID)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("Failed to load GPS trail:", error.message);
    }
    return [];
  }

  return (data ?? [])
    .map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt: point.recorded_at,
    }))
    .reverse();
}
