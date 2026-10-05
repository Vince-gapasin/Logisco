// The truck a trip or breakdown was on, even after that truck was deleted.
//
// DispatchOrder and FoulTripIncident read their truck through the Truck embed.
// Deleting a truck clears their truckID, and a trigger copies its plate, model
// and type into formerTruck* on the row first - so a screen showing past work
// asks here instead of reading the embed alone.

export interface TruckLabel {
  plateNumber?: string | null;
  model?: string | null;
  truckType?: string | null;
}

export interface FormerTruck {
  formerTruckPlate?: string | null;
  formerTruckModel?: string | null;
  formerTruckType?: string | null;
}

/** For an explicit select list: the columns truckOf falls back to. */
export const FORMER_TRUCK_COLUMNS = "formerTruckPlate, formerTruckModel, formerTruckType";

/** The row's truck as it is, or as it was before it was deleted; null when it never had one. */
export function truckOf<T extends TruckLabel>(
  row: (FormerTruck & { Truck?: T | T[] | null }) | null | undefined,
): TruckLabel | null {
  if (!row) return null;
  const live = Array.isArray(row.Truck) ? (row.Truck[0] ?? null) : (row.Truck ?? null);
  if (live) return live;
  if (!row.formerTruckPlate) return null;
  return {
    plateNumber: row.formerTruckPlate,
    model: row.formerTruckModel ?? null,
    truckType: row.formerTruckType ?? null,
  };
}
