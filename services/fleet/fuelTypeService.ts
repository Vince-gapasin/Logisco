// The fuels a truck can burn.
//
// A small table with a specific job: to be the one place a fuel's name is
// spelled, so that a truck and a price can be certain they mean the same thing.
// Text columns on both sides would join "diesel" to "Diesel" never, and nobody
// would notice until a cost came out as zero.
//
// It is editable on purpose. This fleet is entirely diesel and a fixed list in
// the schema would have covered it, but the next company to use this system will
// arrive with something else - and they cannot ship a migration.

import { supabase } from "@/app/lib/supabase";

export class FuelTypeError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "FuelTypeError";
  }
}

/** What a fuel's price is quoted in. Mirrors the table's CHECK. */
export const FUEL_UNITS = ["litre", "kWh", "kg"] as const;
export type FuelUnit = (typeof FUEL_UNITS)[number];

export function isFuelUnit(value: unknown): value is FuelUnit {
  return typeof value === "string" && (FUEL_UNITS as readonly string[]).includes(value);
}

export interface FuelType {
  fuelTypeID: string;
  name: string;
  unit: FuelUnit;
  isActive: boolean;
  sortOrder: number;
  /** How many trucks currently burn it, so the screen can warn before retiring one. */
  trucks?: number;
}

const COLUMNS = "fuelTypeID, name, unit, isActive, sortOrder";

/**
 * The list, in the order a form should offer it.
 *
 * Retired fuels are included only when asked for: a truck that still points at
 * one must keep displaying its name, but nobody should be able to pick it for a
 * new truck.
 */
export async function listFuelTypes(options: { includeRetired?: boolean } = {}): Promise<FuelType[]> {
  let query = supabase.from("FuelType").select(COLUMNS).order("sortOrder").order("name");
  if (!options.includeRetired) query = query.eq("isActive", true);

  const { data, error } = await query;
  if (error) throw new FuelTypeError(`Could not read the fuel types: ${error.message}`, 500);

  return (data ?? []) as FuelType[];
}

/** The same, with a count of the trucks on each - for the screen that manages them. */
export async function listFuelTypesWithUsage(): Promise<FuelType[]> {
  const types = await listFuelTypes({ includeRetired: true });

  const { data, error } = await supabase.from("Truck").select("fuelTypeID").not("fuelTypeID", "is", null);
  if (error) throw new FuelTypeError(`Could not count the trucks: ${error.message}`, 500);

  const trucks = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.fuelTypeID as string;
    trucks.set(id, (trucks.get(id) ?? 0) + 1);
  }

  return types.map((type) => ({ ...type, trucks: trucks.get(type.fuelTypeID) ?? 0 }));
}

function cleanName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (name.length === 0) throw new FuelTypeError("Give the fuel a name.");
  if (name.length > 60) throw new FuelTypeError("That name is too long.");
  return name;
}

export async function createFuelType(input: {
  name: unknown;
  unit?: unknown;
  sortOrder?: unknown;
}): Promise<FuelType> {
  const name = cleanName(input.name);
  const unit = input.unit === undefined || input.unit === null || input.unit === "" ? "litre" : input.unit;

  if (!isFuelUnit(unit)) {
    throw new FuelTypeError(`A fuel is priced per ${FUEL_UNITS.join(", per ")}.`);
  }

  const { data, error } = await supabase
    .from("FuelType")
    .insert({
      name,
      unit,
      sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 100,
    })
    .select(COLUMNS)
    .single();

  // 23505: the unique name. Said plainly, because "duplicate key value violates
  // unique constraint" is not a sentence for somebody adding a fuel.
  if (error) {
    if (error.code === "23505") throw new FuelTypeError(`There is already a fuel called "${name}".`, 409);
    throw new FuelTypeError(`Could not add the fuel: ${error.message}`, 500);
  }

  return data as FuelType;
}

export async function updateFuelType(
  fuelTypeID: string,
  input: { name?: unknown; unit?: unknown; isActive?: unknown; sortOrder?: unknown },
): Promise<FuelType> {
  const changes: Record<string, unknown> = {};

  if (input.name !== undefined) changes.name = cleanName(input.name);
  if (input.unit !== undefined) {
    if (!isFuelUnit(input.unit)) throw new FuelTypeError(`A fuel is priced per ${FUEL_UNITS.join(", per ")}.`);
    changes.unit = input.unit;
  }
  if (input.isActive !== undefined) changes.isActive = Boolean(input.isActive);
  if (input.sortOrder !== undefined && Number.isFinite(Number(input.sortOrder))) {
    changes.sortOrder = Number(input.sortOrder);
  }

  if (Object.keys(changes).length === 0) throw new FuelTypeError("Nothing to change.");

  const { data, error } = await supabase
    .from("FuelType")
    .update(changes)
    .eq("fuelTypeID", fuelTypeID)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") throw new FuelTypeError("There is already a fuel with that name.", 409);
    throw new FuelTypeError(`Could not save the fuel: ${error.message}`, 500);
  }
  if (!data) throw new FuelTypeError("Fuel type not found.", 404);

  return data as FuelType;
}

/**
 * Retires a fuel, or removes it if nothing has ever used it.
 *
 * Deleting one that trucks or prices point at would either fail on the foreign
 * key or, worse, blank the fuel on a fleet of trucks. Retiring keeps every
 * existing record readable and only stops the fuel being offered again.
 */
export async function retireFuelType(fuelTypeID: string): Promise<{ deleted: boolean }> {
  const { count: truckCount, error: truckError } = await supabase
    .from("Truck")
    .select("*", { count: "exact", head: true })
    .eq("fuelTypeID", fuelTypeID);

  if (truckError) throw new FuelTypeError(`Could not check the trucks: ${truckError.message}`, 500);

  const { count: priceCount, error: priceError } = await supabase
    .from("FuelPriceHistory")
    .select("*", { count: "exact", head: true })
    .eq("fuelTypeID", fuelTypeID);

  if (priceError) throw new FuelTypeError(`Could not check the prices: ${priceError.message}`, 500);

  if ((truckCount ?? 0) === 0 && (priceCount ?? 0) === 0) {
    const { error } = await supabase.from("FuelType").delete().eq("fuelTypeID", fuelTypeID);
    if (error) throw new FuelTypeError(`Could not remove the fuel: ${error.message}`, 500);
    return { deleted: true };
  }

  await updateFuelType(fuelTypeID, { isActive: false });
  return { deleted: false };
}
