import { supabase } from "@/app/lib/supabase";
import { TRUCK_STATUS } from "@/app/lib/enums";
import type { Truck, CreateTruckDto, UpdateTruckDto } from "@/types/truck";

const TABLE = "Truck";

// ==========================================
// HELPER: GENERATE TRUCK CODE
// ==========================================
const generateTruckCode = (plateNumber: string): string => {
  const cleanPlate = plateNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `TRK-${cleanPlate}`;
};

/** Flattens the joined fuel onto the truck, since an embed arrives as an object or an array. */
function withFuelType(row: Record<string, unknown>): Truck {
  const joined = row.FuelType as { name: string; unit: string } | { name: string; unit: string }[] | null;
  const fuelType = Array.isArray(joined) ? (joined[0] ?? null) : (joined ?? null);

  const truck = { ...row };
  delete truck.FuelType;

  return { ...(truck as unknown as Truck), fuelType };
}

// ==========================================
// GET ALL ACTIVE TRUCKS
// ==========================================
export async function getTrucks(): Promise<Truck[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*, FuelType ( name, unit )")
    .eq("isActive", true)
    .order("plateNumber", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(withFuelType);
}

// ==========================================
// GET SINGLE TRUCK
// ==========================================
export async function getTruckById(id: string): Promise<Truck | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*, FuelType ( name, unit )")
    .eq("truckID", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? withFuelType(data) : null;
}

// ==========================================
// CREATE TRUCK
// ==========================================
export async function createTruck(truck: CreateTruckDto): Promise<Truck> {
  const truckCode = truck.subconID 
    ? `SUB-${generateTruckCode(truck.plateNumber)}` // Optional: differentiate subcon trucks
    : generateTruckCode(truck.plateNumber);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...truck,
      truckCode,
      isActive: true,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Truck;
}

// ==========================================
// UPDATE TRUCK
// ==========================================
export async function updateTruck(
  id: string,
  truck: UpdateTruckDto
): Promise<Truck | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(truck)
    .eq("truckID", id)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Truck | null;
}

// ==========================================
// SOFT DELETE TRUCK
// ==========================================
export async function deleteTruck(id: string): Promise<Truck | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      isActive: false,
      truckStatus: TRUCK_STATUS.outOfService,
    })
    .eq("truckID", id)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Truck | null;
}
// ==========================================
// FLEET-STATUS PAYLOAD MAPPING
// ==========================================
// The fleet-status UIs send { truckModel, status, capacity: "10 tons" };
// older callers send DB column names { model, truckStatus }. Accept both
// and only pass known columns through (no mass-assignment).

const TRUCK_STATUSES = Object.values(TRUCK_STATUS);

export function toTruckPayload(body: Record<string, unknown>): UpdateTruckDto & { truckCode?: string } {
  const payload: UpdateTruckDto & { truckCode?: string } = {};

  if (typeof body.truckCode === "string" && body.truckCode.trim()) payload.truckCode = body.truckCode.trim();
  if (typeof body.plateNumber === "string") payload.plateNumber = body.plateNumber.trim();
  if (typeof body.truckType === "string") payload.truckType = body.truckType as UpdateTruckDto["truckType"];

  const model = body.truckModel ?? body.model;
  if (typeof model === "string") payload.model = model;

  if (body.capacity !== undefined && body.capacity !== null && body.capacity !== "") {
    const capacity = parseFloat(String(body.capacity).replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(capacity)) payload.capacity = capacity;
  }

  if (body.lastChecked !== undefined) {
    payload.lastChecked = body.lastChecked ? String(body.lastChecked) : null;
  }

  // Accepts the id, or an empty string from a "not recorded" option, which
  // clears it rather than being ignored.
  if (body.fuelTypeID !== undefined) {
    payload.fuelTypeID = typeof body.fuelTypeID === "string" && body.fuelTypeID ? body.fuelTypeID : null;
  }

  const status = body.status ?? body.truckStatus;
  if (typeof status === "string" && status) payload.truckStatus = status as UpdateTruckDto["truckStatus"];

  return payload;
}

export function validateTruckPayload(payload: UpdateTruckDto, isCreate: boolean): string | null {
  if (isCreate) {
    if (!payload.plateNumber) return "Plate number is required";
    if (!payload.truckType) return "Truck type is required";
    if (payload.capacity === undefined) return "Capacity is required";
  }
  if (payload.capacity !== undefined && payload.capacity < 0) return "Capacity cannot be negative";
  if (payload.truckStatus && !TRUCK_STATUSES.includes(payload.truckStatus)) return "Invalid truck status";
  return null;
}

/**
 * The fleet, or with `archived` the trucks that were retired from it.
 *
 * Retiring is a soft delete - trucks are referenced by dispatches and
 * maintenance logs - so the archive is where a retired truck can still be
 * found, and restored from.
 */
export async function getFleet({ archived = false }: { archived?: boolean } = {}): Promise<Truck[]> {
  const { data, error } = await supabase
    .from(TABLE)
    // The fuel's name comes along, so a list does not have to resolve 36 ids.
    .select("*, FuelType ( name, unit )")
    .eq("isActive", !archived)
    .order("lastChecked", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []).map(withFuelType);
}

/**
 * Brings a retired truck back into the fleet.
 *
 * It comes back Out of Service, the status retiring left it in, rather than
 * straight to Available: whoever restores it decides when it can be booked,
 * through the same status change and maintenance log as any grounded truck.
 */
export async function restoreTruck(id: string): Promise<Truck | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ isActive: true, truckStatus: TRUCK_STATUS.outOfService })
    .eq("truckID", id)
    .eq("isActive", false)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Truck | null;
}

export async function createFleetTruck(payload: UpdateTruckDto & { truckCode?: string }): Promise<Truck> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...payload,
      truckCode: payload.truckCode || generateTruckCode(payload.plateNumber ?? ""),
      truckStatus: payload.truckStatus ?? TRUCK_STATUS.available,
      isActive: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Truck;
}

// ==========================================
// ANNOUNCING THAT A TRUCK IS OFF THE ROAD
// ==========================================

/**
 * Tells the office and the mechanics when a truck is grounded, or comes back.
 *
 * It used to live inline in the admin's truck PATCH, which meant the same fact -
 * this truck is On Maintenance - reached mechanics when somebody typed it into a
 * form and reached nobody when a truck actually broke down on the road. The
 * breakdown path grounds the truck through setTruckStatus, which was a bare
 * UPDATE. So the quieter event was announced and the real one was silent.
 *
 * Here so both paths call the same thing, and so anything added later that
 * grounds a truck is announced without having to remember to.
 *
 * ONLY GROUNDED, AND ONLY ON A CHANGE
 *
 * Trucks move between Available and On Delivery all day. Telling every mechanic
 * about that is how an alert becomes something people turn off. What they need
 * to know is that a truck has left the road, or come back to it.
 */
export async function announceTruckStatus(
  truckID: string,
  from: string | null | undefined,
  to: string,
  actor?: { employeeID: string; name: string } | null,
  /** What put it there, when something other than a person did: "Foul trip: Broken Truck". */
  cause?: string | null,
  /**
   * Whether grounding opens a maintenance log. False when the caller has just
   * written one itself - the mechanic's own inspection form, saved as part of
   * the same status change - so the truck does not get a second, empty log
   * that says nobody has looked at it.
   */
  { openLog = true }: { openLog?: boolean } = {},
): Promise<void> {
  if (!truckID || from === to) return;

  const grounded = (status: string | null | undefined) =>
    status === TRUCK_STATUS.onMaintenance || status === TRUCK_STATUS.outOfService;

  const wasGrounded = grounded(from);
  const isGrounded = grounded(to);
  if (wasGrounded === isGrounded) return;

  const { data: truck } = await supabase
    .from(TABLE)
    .select("plateNumber")
    .eq("truckID", truckID)
    .maybeSingle();

  const plate = (truck?.plateNumber as string) ?? "A truck";

  // Imported here rather than at the top: the notification layer is the outer
  // edge of this service, and a top-level import would have this module loaded
  // by everything that reads a truck.
  const { notify, OFFICE, MECHANICS } = await import("@/services/notifications/notify");

  await notify({
    event: "TRUCK_STATUS_CHANGED",
    title: isGrounded ? `Truck ${to.toLowerCase()}` : "Truck back in service",
    body: isGrounded
      ? `${plate} is now ${to.toLowerCase()} and cannot be booked until it is back.`
      : `${plate} is off maintenance and can be booked again.`,
    severity: isGrounded ? "action" : "info",
    roles: [...OFFICE, ...MECHANICS],
    entity: { table: "Truck", id: truckID },
    link: "/mechanic/fleet-status",
    actor: actor ?? undefined,
  });

  // And a maintenance log is opened for it.
  //
  // This was an audit row to begin with, which was the wrong place to put it.
  // The audit trail is written for everything and read for almost nothing - no
  // screen in this app shows a truck's audit history - so a grounding recorded
  // there was filed where nobody looks. The maintenance log is the record the
  // mechanics already keep, that the office can now see on the truck, and that a
  // person can add to.
  //
  // So the grounding opens one rather than describing itself into a table of its
  // own: what the truck was doing, what stopped it, and who said so. No mechanic
  // on it yet, because nobody has been sent - which is exactly what an open job
  // looks like, and the mechanic fills in the rest through the form they already
  // use.
  //
  // Only on the way down. Coming back off maintenance is the closing of a repair
  // somebody was already logging, not the start of a new one.
  if (!isGrounded || !openLog) return;

  // Not fatal, for the same reason the notification is not: a delivery must not
  // fail to release its truck because a log could not be opened.
  try {
    const { createHistoryLog } = await import("@/services/history-logs/historyLogsService");
    await createHistoryLog({
      truckID,
      date: new Date().toISOString().slice(0, 10),
      statusBefore: from ?? null,
      statusAfter: to,
      // Preliminary is the phase written before anybody has looked at the truck,
      // which is what this is.
      driversReport: cause ?? `Set to ${to.toLowerCase()}`,
      preliminaryRemarks: actor
        ? `Reported by ${actor.name}. Awaiting a mechanic.`
        : "Awaiting a mechanic.",
    });
  } catch (error) {
    console.error("[Truck] Could not open a maintenance log:", error);
  }
}
