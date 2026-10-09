import { supabase } from "@/app/lib/supabase";
import { ACTIVE_DELIVERY_STATUSES, TRUCK_STATUS } from "@/app/lib/enums";
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

/** The booking a truck is on, as the fleet screens show it. */
export interface TruckTrip {
  dispatchID: string;
  status: string;
  orderID: string | null;
  orderCode: string | null;
  clientName: string | null;
  deliverySchedule: string | null;
  /** The run's last day, when it runs past its first: a trip of several days. */
  deliveryEnd?: string | null;
  driverName: string | null;
}

/**
 * The trip holding this truck, if one is: assigned, accepted or on the road.
 *
 * "On Delivery" is the truck's side of a trip and is set by dispatch, not by
 * hand. So the fleet screens show which booking it is rather than offering it
 * as a choice, and a status change while a trip holds the truck is refused -
 * see tripHoldingTruck in the route.
 */
const TRIP_COLUMNS =
  "dispatchID, truckID, status, Order ( orderID, orderCode, notes, Client ( company ), PickupStops ( expectedDate ), BranchStops ( expectedDate ) ), Driver:Employee!driverID ( employeeName )";

function toTruckTrip(row: Record<string, unknown>): TruckTrip {
  const one = <T,>(value: T | T[] | null | undefined): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  const order = one(
    row.Order as unknown as {
      orderID: string;
      orderCode: string;
      notes: string | null;
      Client: unknown;
      PickupStops?: { expectedDate: string | null }[] | null;
      BranchStops?: { expectedDate: string | null }[] | null;
    } | null,
  );
  const client = one(order?.Client as { company: string | null } | null);
  const driver = one(row.Driver as unknown as { employeeName: string | null } | null);
  const deliverySchedule = /Delivery Schedule:\s*([^\n]+)/.exec(order?.notes ?? "")?.[1]?.trim() ?? null;
  // The latest day any stop is due. A truck on a week-long run is held all
  // week, and the fleet lists said only the day it left.
  const lastDay = [...(order?.PickupStops ?? []), ...(order?.BranchStops ?? [])]
    .map((stop) => (stop.expectedDate ?? "").slice(0, 10))
    .filter(Boolean)
    .sort()
    .pop();

  return {
    dispatchID: row.dispatchID as string,
    status: row.status as string,
    orderID: order?.orderID ?? null,
    orderCode: order?.orderCode ?? null,
    clientName: client?.company ?? null,
    deliverySchedule,
    deliveryEnd: lastDay && deliverySchedule && lastDay > deliverySchedule ? lastDay : null,
    driverName: driver?.employeeName ?? null,
  };
}

export async function getCurrentTrip(truckID: string): Promise<TruckTrip | null> {
  const { data, error } = await supabase
    .from("DispatchOrder")
    .select(TRIP_COLUMNS)
    .eq("truckID", truckID)
    .in("status", ACTIVE_DELIVERY_STATUSES)
    .order("dispatchID", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toTruckTrip(data as Record<string, unknown>) : null;
}

/**
 * The trip holding each truck, for a whole list at once - so the fleet list can
 * tell a truck that is booked and waiting from one out on the road, and say
 * which booking it is, without asking once per truck.
 */
export async function getCurrentTrips(truckIDs: string[]): Promise<Map<string, TruckTrip>> {
  const trips = new Map<string, TruckTrip>();
  if (truckIDs.length === 0) return trips;

  const { data, error } = await supabase
    .from("DispatchOrder")
    .select(TRIP_COLUMNS)
    .in("truckID", truckIDs)
    .in("status", ACTIVE_DELIVERY_STATUSES);

  if (error) throw error;
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const truckID = row.truckID as string;
    if (!trips.has(truckID)) trips.set(truckID, toTruckTrip(row));
  }
  return trips;
}

/** One change to a truck's record, as its history shows it. */
export interface TruckChange {
  id: string;
  at: string;
  /** Added, Edited, Disabled, Restored. */
  action: string;
  byName: string;
  byRole: string;
  changes: { field: string; from: string | null; to: string | null }[];
  reason: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  plateNumber: "Plate number",
  truckCode: "Truck code",
  truckType: "Type",
  model: "Model",
  capacity: "Capacity",
  lastChecked: "Last checked",
  fuelTypeID: "Fuel type",
  truckStatus: "Status",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Added",
  UPDATE: "Edited",
  RETIRE: "Disabled",
  RESTORE: "Restored",
  DELETE: "Deleted",
};

const shown = (value: unknown): string | null =>
  value === null || value === undefined || value === "" ? null : String(value);

/**
 * Who changed this truck's record, what they changed and when - newest first.
 *
 * Every add, edit, archive, restore and status change through the fleet screens
 * is audited with the person who made it. Nothing showed it, so a truck edited
 * by a coordinator or a mechanic could not be traced back to them. Changes the
 * trips make to a truck's status are not here: they are the trip's, and the
 * booking's history has them.
 */
export async function getTruckChanges(truckID: string): Promise<TruckChange[]> {
  const { data, error } = await supabase
    .from("AuditTrail")
    .select("auditID, action, oldData, newData, timestamp")
    .eq("tableName", "Truck")
    .eq("recordID", truckID)
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error) throw error;

  // Fuel is stored as an id; the history says which fuel.
  const fuelIDs = new Set<string>();
  for (const row of data ?? []) {
    for (const side of [row.oldData, row.newData] as (Record<string, unknown> | null)[]) {
      if (typeof side?.fuelTypeID === "string") fuelIDs.add(side.fuelTypeID);
    }
  }
  const fuelNames = new Map<string, string>();
  if (fuelIDs.size > 0) {
    const { data: fuels } = await supabase.from("FuelType").select("fuelTypeID, name").in("fuelTypeID", [...fuelIDs]);
    for (const fuel of fuels ?? []) fuelNames.set(fuel.fuelTypeID as string, fuel.name as string);
  }
  const named = (field: string, value: unknown) =>
    field === "fuelTypeID" && typeof value === "string" ? (fuelNames.get(value) ?? value) : value;

  return (data ?? []).map((row) => {
    const after = { ...((row.newData as Record<string, unknown> | null) ?? {}) };
    const before = (row.oldData as Record<string, unknown> | null) ?? {};
    const by = (after.by ?? {}) as { name?: string | null; role?: string | null };
    const reason = shown(after.reason);
    delete after.by;
    delete after.reason;

    const changes = Object.entries(after)
      .filter(([field]) => field in FIELD_LABELS)
      .map(([field, to]) => ({
        field: FIELD_LABELS[field],
        from: shown(named(field, before[field])),
        to: shown(named(field, to)),
      }))
      // An edit sends the whole form; only what actually moved is a change.
      // Entries recorded before the earlier values were kept have no "from",
      // and are shown as set.
      .filter((change) => row.action !== "UPDATE" || change.from !== change.to);

    return {
      id: row.auditID as string,
      at: row.timestamp as string,
      action: ACTION_LABELS[row.action as string] ?? (row.action as string),
      byName: by.name ?? "Unknown",
      byRole: by.role ?? "",
      changes,
      reason,
    };
  });
}

/**
 * Removes a disabled truck for good.
 *
 * Only from the Archive: a truck still in the fleet is refused here, not just
 * hidden on the screen, so it has to be disabled first - which itself refuses a
 * truck out on a delivery. Its trips, breakdowns and maintenance logs stay:
 * their foreign keys let go of it, and a trigger on Truck copies its plate,
 * model and type onto them first (migrations 20261005020000-040000).
 *
 * Returns the truck as it was, or null when there is no disabled truck by that id.
 */
export async function purgeTruck(id: string): Promise<Truck | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("truckID", id)
    .eq("isActive", false)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Truck | null;
}

/**
 * Brings a disabled truck back into the fleet, Available.
 *
 * It used to come back Out of Service, the status disabling left it in. But
 * Out of Service means a truck with an outside repair company, which a truck
 * coming back from being disabled is not - so it returns ready to book.
 */
export async function restoreTruck(id: string): Promise<Truck | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ isActive: true, truckStatus: TRUCK_STATUS.available })
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
