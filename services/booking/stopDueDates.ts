import { supabase } from "@/app/lib/supabase";
import { isRealDate } from "@/app/lib/bookingRules";
import { selectAllIn } from "@/app/lib/selectAll";
import { routeDueDates, type RouteStopRow } from "@/app/lib/stopSchedule";

// The day each delivery stop is due, for everything that judges a stop by when
// it was due: punctuality, stall alerts, assignment notice.
//
// They all used to date every stop with the order's deliverySchedule. On an
// overnight run that put a 03:00 drop at 03:00 on the first day - a full day
// before it was due - so a crew arriving on time read as a day late and a
// stall alert could fire on a truck that was early. On a run of several days
// it would have been worse by every day the run lasted.
//
// A stop booked since stops had dates carries its own. One booked before reads
// its day off its booking's route, the way it was made; those routes are read
// in one go, and only when such a stop is present, so a list of dated stops
// costs no query at all.

export interface StopNeedingDue {
  branchID: number;
  orderID: string | null;
  expectedDate?: string | null;
}

/**
 * branchID → the day it is due (YYYY-MM-DD). A stop is missing from the map
 * when nothing dates it: no date of its own, and no booking date to read one
 * from - exactly the stops that cannot be judged.
 */
export async function branchDueDates(
  stops: StopNeedingDue[],
  orderDateOf: (orderID: string) => string | null | undefined,
): Promise<Map<number, string>> {
  const due = new Map<number, string>();
  const undatedOrders = new Set<string>();

  for (const stop of stops) {
    const own = (stop.expectedDate ?? "").slice(0, 10);
    if (isRealDate(own)) due.set(stop.branchID, own);
    else if (stop.orderID && isRealDate(orderDateOf(stop.orderID) ?? "")) undatedOrders.add(stop.orderID);
  }
  if (undatedOrders.size === 0) return due;

  const orderIDs = [...undatedOrders];
  const [pickups, branches] = await Promise.all([
    selectAllIn<RouteStopRow & { orderID: string }, string>(orderIDs, (chunk, from, to) =>
      supabase.from("PickupStops").select("orderID, expectedTime, expectedDate, sequence").in("orderID", chunk).range(from, to),
    ),
    selectAllIn<RouteStopRow & { orderID: string; branchID: number }, string>(orderIDs, (chunk, from, to) =>
      supabase
        .from("BranchStops")
        .select("orderID, branchID, expectedTime, expectedDate, sequence")
        .in("orderID", chunk)
        .range(from, to),
    ),
  ]);

  for (const orderID of orderIDs) {
    const route = routeDueDates(
      orderDateOf(orderID) as string,
      pickups.filter((row) => row.orderID === orderID),
      branches.filter((row) => row.orderID === orderID),
    );
    for (const [branchID, date] of route) if (!due.has(branchID)) due.set(branchID, date);
  }
  return due;
}
