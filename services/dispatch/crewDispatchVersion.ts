import { supabase } from "@/app/lib/supabase";
import { DELIVERY_STATUS, HELPER_STATUS } from "@/app/lib/enums";
import { fingerprint } from "@/app/lib/fingerprint";

/**
 * The PostgREST filter behind ?recentDays=N: trips with no finish time, or one
 * inside the window. Null when the request did not ask for a window.
 *
 * Shared by the crew's trip list and its fingerprint, so the fingerprint
 * covers exactly the trips the list returns - a trip the list leaves out
 * changing must not make the phone fetch the list again, and one it shows
 * must.
 */
export function recentTripsFilter(requestUrl: string, now = Date.now()): string | null {
  const recentDays = Number(new URL(requestUrl).searchParams.get("recentDays"));
  if (!Number.isInteger(recentDays) || recentDays <= 0) return null;
  const finishedSince = new Date(now - Math.min(recentDays, 365) * 86_400_000).toISOString();
  return `completedAt.is.null,completedAt.gte."${finishedSince}"`;
}

// What the crew dashboard shows of a trip, and what decides it: its progress,
// its truck and crew (and who of them has accepted, which is what holds the
// Start button), its proof and note, the stop statuses, and the order's notes,
// which carry the schedule and the priority. Names and addresses are not here;
// the full refresh a minute later picks those up.
const VERSION_SELECT = `
  dispatchID,
  status,
  current_step,
  pickupCompletedAt,
  pod_url,
  dispatchNote,
  truckID,
  driverID,
  DispatchHelper ( helperID, status ),
  Order ( notes,
    BranchStops ( branchID, stopStatus, dispatchID ),
    PickupStops ( pickupID, stopStatus, dispatchID ) )
`;

// As in the trip list: the ids go in the request URL.
const HELPER_ID_BATCH = 100;

type Keyed = Record<string, unknown>;

function rows(value: unknown): Keyed[] {
  if (Array.isArray(value)) return value.filter(Boolean) as Keyed[];
  return value ? [value as Keyed] : [];
}

const byKey = (key: string) => (a: Keyed, b: Keyed) => String(a[key]).localeCompare(String(b[key]));

/**
 * A short fingerprint of the crew member's trip list, so the open dashboard
 * can ask "has anything changed?" every few seconds - a helper finishing a
 * stop, dispatch reassigning a truck - and fetch the list, with its stops and
 * signed photos, only when something has.
 *
 * The same trips the list reads: driving them, or helping on them and not
 * having declined, inside the same window.
 */
export async function getCrewDispatchVersion(
  employeeID: string,
  recentOnly: string | null,
): Promise<string> {
  let driverQuery = supabase
    .from("DispatchOrder")
    .select(VERSION_SELECT)
    .eq("driverID", employeeID)
    .neq("status", DELIVERY_STATUS.rejected);
  if (recentOnly) driverQuery = driverQuery.or(recentOnly);

  const [driving, helping] = await Promise.all([
    driverQuery,
    supabase
      .from("DispatchHelper")
      .select("dispatchID, status")
      .eq("helperID", employeeID)
      .neq("status", HELPER_STATUS.declined),
  ]);

  if (driving.error) throw new Error(`Crew version driver query failed: ${driving.error.message}`);
  if (helping.error) throw new Error(`Crew version helper query failed: ${helping.error.message}`);

  const assignments = rows(helping.data);
  const ids = assignments.map((assignment) => String(assignment.dispatchID));
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += HELPER_ID_BATCH) {
    batches.push(ids.slice(start, start + HELPER_ID_BATCH));
  }

  const answers = await Promise.all(
    batches.map((batch) => {
      let query = supabase
        .from("DispatchOrder")
        .select(VERSION_SELECT)
        .in("dispatchID", batch)
        .neq("status", DELIVERY_STATUS.rejected);
      if (recentOnly) query = query.or(recentOnly);
      return query;
    }),
  );

  const failed = answers.find((answer) => answer.error)?.error;
  if (failed) throw new Error(`Crew version helper trips query failed: ${failed.message}`);

  // In a fixed order throughout: the same trips in another order are not a
  // change, and must not make every phone fetch its list again.
  const trips = [...rows(driving.data), ...answers.flatMap((answer) => rows(answer.data))]
    .map((trip) => {
      const order = rows(trip.Order)[0] ?? {};
      return {
        ...trip,
        DispatchHelper: rows(trip.DispatchHelper).sort(byKey("helperID")),
        Order: {
          notes: order.notes ?? null,
          BranchStops: rows(order.BranchStops).sort(byKey("branchID")),
          PickupStops: rows(order.PickupStops).sort(byKey("pickupID")),
        },
      };
    })
    .sort(byKey("dispatchID"));

  return fingerprint([trips, [...assignments].sort(byKey("dispatchID"))]);
}
