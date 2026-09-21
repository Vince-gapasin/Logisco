// Foul trips: recording one, and doing something about it.
//
// A foul trip used to be a status and a line of text. The admin "recovery"
// screen offered reschedule, re-assign, sub-contract and inspection, but made
// no server call for any of them: it showed a success message and changed
// nothing. Every foul trip on record was still open. This is the part that
// actually recovers a trip.
//
// The failed dispatch keeps its "Foul Trip" status as the historical fact.
// The incident row carries the lifecycle - open, mechanic on the way,
// resolved or closed - and records what was done, by whom and when.

import { supabase } from "@/app/lib/supabase";
import {
  ACTIVE_DELIVERY_STATUSES,
  AVAILABILITY,
  DELIVERY_STATUS,
  EMPLOYEE_ROLE,
  HELPER_STATUS,
  STOP_STATUS,
  TRUCK_STATUS,
  isStopDelivered,
} from "@/app/lib/enums";
import {
  assignDispatch,
  completeDispatch,
  releaseDispatchResources,
} from "@/services/dispatch/dispatchService";
import { cancelBooking } from "@/services/booking/bookingService";
import { signPodUrls } from "@/services/storage/podService";

export const INCIDENT_STATUS = {
  open: "open",
  mechanicAssigned: "mechanic_assigned",
  resolved: "resolved",
  closed: "closed",
} as const;

export type IncidentStatus = (typeof INCIDENT_STATUS)[keyof typeof INCIDENT_STATUS];

export const RESOLUTION = {
  reassigned: "reassigned",
  rescheduled: "rescheduled",
  subcontracted: "subcontracted",
  repairedOnSite: "repaired_on_site",
  cancelled: "cancelled",
  closed: "closed",
  historical: "historical",
} as const;

// Still waiting on someone: these are what the foul-trip screen lists.
export const OPEN_STATUSES: IncidentStatus[] = [INCIDENT_STATUS.open, INCIDENT_STATUS.mechanicAssigned];

export interface Actor {
  employeeID: string;
  employeeName?: string | null;
}

export class FoulTripError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface IncidentRow {
  incidentID: string;
  dispatchID: string;
  orderID: string;
  truckID: string | null;
  reportedBy: string | null;
  reportedAt: string;
  issueType: string;
  details: string | null;
  photoPath: string | null;
  latitude: number | null;
  longitude: number | null;
  dispatchStatusBefore: string | null;
  cargoLoaded: boolean;
  status: IncidentStatus;
  severity: "minor" | "major" | null;
  mechanicID: string | null;
  mechanicAssignedAt: string | null;
  mechanicOutcome: "fixed" | "not_fixable" | null;
  mechanicNotes: string | null;
  mechanicRespondedAt: string | null;
  resolution: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  newDispatchID: string | null;
}

// ------------------------------------------------------------------ reading

const INCIDENT_COLUMNS = `
  *,
  Order ( orderCode, Client ( company ) ),
  Truck ( plateNumber, model, truckType ),
  Trip:DispatchOrder!FoulTripIncident_dispatchID_fkey ( driverID, DispatchHelper ( helperID, status ) ),
  Reporter:Employee!reportedBy ( employeeName, contact ),
  Mechanic:Employee!mechanicID ( employeeName ),
  Resolver:Employee!resolvedBy ( employeeName ),
  NewDispatch:DispatchOrder!newDispatchID ( dispatchID, status, truckID, dispatchNote )
`;

type Embed<T> = T | T[] | null;
const first = <T,>(value: Embed<T> | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export interface IncidentView extends IncidentRow {
  orderCode: string | null;
  clientName: string | null;
  truckPlate: string | null;
  truckType: string | null;
  // The failed trip's crew, so a recovery can suggest them again.
  originalDriverID: string | null;
  originalHelperIDs: string[];
  reporterName: string | null;
  reporterContact: string | null;
  mechanicName: string | null;
  resolverName: string | null;
  photoUrl: string | null;
  newDispatch: { dispatchID: string; status: string | null; isSubcontract: boolean } | null;
}

async function toViews(rows: Record<string, unknown>[]): Promise<IncidentView[]> {
  const signed = await signPodUrls(rows.map((row) => row.photoPath as string | null));

  return rows.map((row) => {
    const order = first(row.Order as Embed<{ orderCode: string; Client: Embed<{ company: string }> }>);
    const newDispatch = first(row.NewDispatch as Embed<{ dispatchID: string; status: string | null; truckID: string | null }>);
    const incident = row as unknown as IncidentRow;
    const trip = first(
      row.Trip as Embed<{ driverID: string | null; DispatchHelper: { helperID: string | null; status: string | null }[] | null }>,
    );
    return {
      ...incident,
      orderCode: order?.orderCode ?? null,
      clientName: first(order?.Client)?.company ?? null,
      truckPlate: first(row.Truck as Embed<{ plateNumber: string }>)?.plateNumber ?? null,
      truckType: first(row.Truck as Embed<{ truckType: string | null }>)?.truckType ?? null,
      originalDriverID: trip?.driverID ?? null,
      originalHelperIDs: (trip?.DispatchHelper ?? [])
        .filter((h) => h.helperID && h.status !== HELPER_STATUS.declined)
        .map((h) => h.helperID as string),
      reporterName: first(row.Reporter as Embed<{ employeeName: string }>)?.employeeName ?? null,
      reporterContact: first(row.Reporter as Embed<{ contact: string }>)?.contact ?? null,
      mechanicName: first(row.Mechanic as Embed<{ employeeName: string }>)?.employeeName ?? null,
      resolverName: first(row.Resolver as Embed<{ employeeName: string }>)?.employeeName ?? null,
      photoUrl: incident.photoPath ? (signed.get(incident.photoPath) ?? null) : null,
      newDispatch: newDispatch
        ? { dispatchID: newDispatch.dispatchID, status: newDispatch.status, isSubcontract: !newDispatch.truckID }
        : null,
    };
  });
}

export async function listIncidents(scope: "open" | "recent"): Promise<IncidentView[]> {
  let query = supabase.from("FoulTripIncident").select(INCIDENT_COLUMNS);

  if (scope === "open") {
    query = query.in("status", OPEN_STATUSES).order("reportedAt", { ascending: false });
  } else {
    // Resolved in the last 30 days. Historical closures from the migration
    // are not news and are left out.
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    query = query
      .in("status", [INCIDENT_STATUS.resolved, INCIDENT_STATUS.closed])
      .neq("resolution", RESOLUTION.historical)
      .gte("resolvedAt", since)
      .order("resolvedAt", { ascending: false })
      .limit(50);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load foul trips: ${error.message}`);
  return toViews((data ?? []) as Record<string, unknown>[]);
}

export async function listMechanicJobs(mechanicID: string): Promise<IncidentView[]> {
  const { data, error } = await supabase
    .from("FoulTripIncident")
    .select(INCIDENT_COLUMNS)
    .eq("mechanicID", mechanicID)
    .or(`status.eq.${INCIDENT_STATUS.mechanicAssigned},mechanicRespondedAt.gte."${new Date(Date.now() - 14 * 864e5).toISOString()}"`)
    .order("mechanicAssignedAt", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load roadside jobs: ${error.message}`);
  return toViews((data ?? []) as Record<string, unknown>[]);
}

async function loadIncident(incidentID: string): Promise<IncidentRow> {
  const { data, error } = await supabase
    .from("FoulTripIncident")
    .select("*")
    .eq("incidentID", incidentID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new FoulTripError("Foul trip not found.", 404);
  return data as IncidentRow;
}

function requireOpen(incident: IncidentRow) {
  if (!OPEN_STATUSES.includes(incident.status)) {
    throw new FoulTripError("This foul trip has already been resolved.", 409);
  }
}

// ---------------------------------------------------------------- summary

// PostgREST caps a response at 1,000 rows. The trip history is already past
// that, and a failure rate computed from the first thousand trips would be
// quietly wrong.
async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) return rows;
  }
}

export interface FoulTripSummary {
  open: number;
  mechanicAssigned: number;
  resolvedLast30Days: number;
  medianHoursToResolve: number | null;
  reasons: { issueType: string; count: number }[];
  trucksAboveFleetRate: { plateNumber: string; foulTrips: number; trips: number; rate: number }[];
  fleetRate: number;
}

export async function getSummary(): Promise<FoulTripSummary> {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  type IncidentLite = {
    status: string; issueType: string; reportedAt: string; resolvedAt: string | null; resolution: string | null;
  };
  type TripLite = { status: string; Truck: Embed<{ plateNumber: string }> };

  const [rows, trips] = await Promise.all([
    selectAll<IncidentLite>((a, b) =>
      supabase.from("FoulTripIncident").select("status, issueType, reportedAt, resolvedAt, resolution").range(a, b),
    ),
    selectAll<TripLite>((a, b) =>
      supabase.from("DispatchOrder").select("status, Truck ( plateNumber )").not("truckID", "is", null).range(a, b),
    ),
  ]);
  const live = rows.filter((r) => r.resolution !== RESOLUTION.historical);

  const hours = live
    .filter((r) => r.resolvedAt)
    .map((r) => (Date.parse(r.resolvedAt!) - Date.parse(r.reportedAt)) / 36e5)
    .sort((a, b) => a - b);

  const reasonCounts = new Map<string, number>();
  for (const r of live) reasonCounts.set(r.issueType, (reasonCounts.get(r.issueType) ?? 0) + 1);

  // Failure rate per truck across all its trips. Trucks with only a handful
  // of trips are left out: two failures in five trips is noise, not a pattern.
  const perTruck = new Map<string, { trips: number; foul: number }>();
  for (const t of trips) {
    const plate = first(t.Truck)?.plateNumber;
    if (!plate) continue;
    const entry = perTruck.get(plate) ?? { trips: 0, foul: 0 };
    entry.trips++;
    if (t.status === DELIVERY_STATUS.foulTrip) entry.foul++;
    perTruck.set(plate, entry);
  }
  const totals = [...perTruck.values()].reduce((a, b) => ({ trips: a.trips + b.trips, foul: a.foul + b.foul }), { trips: 0, foul: 0 });
  const fleetRate = totals.trips ? totals.foul / totals.trips : 0;

  return {
    open: rows.filter((r) => r.status === INCIDENT_STATUS.open).length,
    mechanicAssigned: rows.filter((r) => r.status === INCIDENT_STATUS.mechanicAssigned).length,
    resolvedLast30Days: live.filter((r) => r.resolvedAt && r.resolvedAt >= since).length,
    medianHoursToResolve: hours.length ? hours[Math.floor(hours.length / 2)] : null,
    reasons: [...reasonCounts.entries()]
      .map(([issueType, count]) => ({ issueType, count }))
      .sort((a, b) => b.count - a.count),
    trucksAboveFleetRate: [...perTruck.entries()]
      .filter(([, t]) => t.trips >= 20 && t.foul / t.trips >= fleetRate * 1.5)
      .map(([plateNumber, t]) => ({ plateNumber, foulTrips: t.foul, trips: t.trips, rate: t.foul / t.trips }))
      .sort((a, b) => b.rate - a.rate),
    fleetRate,
  };
}

// --------------------------------------------------------------- recording

export interface NewIncident {
  dispatchID: string;
  orderID: string;
  truckID: string | null;
  reportedBy: string;
  issueType: string;
  details: string | null;
  photoPath: string | null;
  latitude: number | null;
  longitude: number | null;
  dispatchStatusBefore: string;
  cargoLoaded: boolean;
}

// Always a new row. A trip repaired on site carries on under the same
// dispatch, so it can break down again; upserting on dispatchID used to
// overwrite the resolved incident, and the second breakdown never showed.
export async function recordIncident(incident: NewIncident): Promise<IncidentRow> {
  const { data, error } = await supabase
    .from("FoulTripIncident")
    .insert(incident)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to record the foul trip: ${error.message}`);
  return data as IncidentRow;
}

// ------------------------------------------------------ carrying on a trip

// The new crew takes only the stops not yet delivered. The failed trip keeps
// the ones it did deliver, so both trips' histories stay true.
async function handOverRemainingStops(incident: IncidentRow, newDispatchID: string) {
  const { data: stops, error } = await supabase
    .from("BranchStops")
    .select("branchID, stopStatus, dispatchID")
    .eq("orderID", incident.orderID);
  if (error) throw new Error(`Failed to read the itinerary: ${error.message}`);

  const remaining = (stops ?? [])
    .filter((s) => !isStopDelivered(s.stopStatus))
    .filter((s) => s.dispatchID === incident.dispatchID || s.dispatchID === null)
    .map((s) => s.branchID);

  if (remaining.length) {
    const { error: moveError } = await supabase
      .from("BranchStops")
      .update({ dispatchID: newDispatchID, stopStatus: STOP_STATUS.pending, arrivedAt: null })
      .in("branchID", remaining);
    if (moveError) throw new Error(`Failed to hand over the stops: ${moveError.message}`);
  }

  // If the cargo was already on the broken-down truck, the new crew collects
  // it from there, not from the warehouse. Otherwise the original pickups
  // still apply and the crew app shows them as before.
  if (incident.cargoLoaded) {
    const [{ data: dispatch }, { data: truck }] = await Promise.all([
      supabase
        .from("DispatchOrder")
        .select("Driver:Employee!driverID ( employeeName, contact )")
        .eq("dispatchID", incident.dispatchID)
        .maybeSingle(),
      incident.truckID
        ? supabase.from("Truck").select("plateNumber").eq("truckID", incident.truckID).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const driver = first((dispatch as { Driver?: Embed<{ employeeName: string; contact: string }> } | null)?.Driver);
    const plate = (truck as { plateNumber?: string } | null)?.plateNumber;

    const { error: pickupError } = await supabase.from("PickupStops").insert({
      orderID: incident.orderID,
      dispatchID: newDispatchID,
      warehouseName: `Transfer from ${plate ?? "the broken-down truck"}`,
      pickupAddress:
        incident.latitude != null && incident.longitude != null
          ? `Breakdown site (${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)})`
          : "Breakdown site - call the original driver for the location",
      contactPerson: driver?.employeeName ?? null,
      contactNum: driver?.contact ?? null,
      pickupLat: incident.latitude,
      pickupLong: incident.longitude,
      sequence: 1,
      stopStatus: STOP_STATUS.pending,
    });
    if (pickupError) throw new Error(`Failed to add the transfer pickup: ${pickupError.message}`);
  }
}

// Undo a half-made recovery trip so the booking is left as it was.
async function discardDispatch(dispatchID: string) {
  await releaseDispatchResources(dispatchID).catch(() => undefined);
  await supabase.from("PickupStops").delete().eq("dispatchID", dispatchID);
  await supabase.from("BranchStops").update({ dispatchID: null }).eq("dispatchID", dispatchID);
  await supabase.from("DispatchHelper").delete().eq("dispatchID", dispatchID);
  await supabase.from("DispatchOrder").delete().eq("dispatchID", dispatchID);
}

async function resolve(
  incident: IncidentRow,
  actor: Actor,
  fields: { resolution: string; resolutionNotes?: string | null; newDispatchID?: string | null; status?: IncidentStatus },
) {
  const { error } = await supabase
    .from("FoulTripIncident")
    .update({
      status: fields.status ?? INCIDENT_STATUS.resolved,
      resolution: fields.resolution,
      resolutionNotes: fields.resolutionNotes ?? null,
      newDispatchID: fields.newDispatchID ?? null,
      resolvedAt: new Date().toISOString(),
      resolvedBy: actor.employeeID,
    })
    .eq("incidentID", incident.incidentID)
    .in("status", OPEN_STATUSES);
  if (error) throw new Error(`Failed to record the resolution: ${error.message}`);
}

// Rewrites "Delivery Schedule: ..." in the booking notes, which is where the
// booking screens read the date from.
async function setDeliverySchedule(orderID: string, date: string, time?: string | null) {
  const { data: order, error } = await supabase.from("Order").select("notes").eq("orderID", orderID).maybeSingle();
  if (error || !order) throw new Error("Failed to read the booking to reschedule it.");
  const value = time ? `${date} ${time}` : date;
  const notes: string = order.notes ?? "";
  const next = /Delivery Schedule:[^\n]*/.test(notes)
    ? notes.replace(/Delivery Schedule:[^\n]*/, `Delivery Schedule: ${value}`)
    : `${notes}${notes ? "\n" : ""}Delivery Schedule: ${value}`;
  const { error: saveError } = await supabase.from("Order").update({ notes: next }).eq("orderID", orderID);
  if (saveError) throw new Error(`Failed to save the new schedule: ${saveError.message}`);
}

// ---------------------------------------------------------------- recovery

export interface CrewChoice {
  truckID: string;
  driverID: string;
  helper1ID?: string;
  helper2ID?: string;
}

/** A new truck and crew now, or - with a date - on a later day. */
export async function reassign(
  incidentID: string,
  crew: CrewChoice,
  actor: Actor,
  reschedule?: { date: string; time?: string | null } | null,
) {
  const incident = await loadIncident(incidentID);
  requireOpen(incident);

  // assignDispatch checks the truck and crew are free and locks them.
  const dispatch = await assignDispatch(incident.orderID, { ...crew, totalCargoWeight: 0 });

  try {
    await handOverRemainingStops(incident, dispatch.dispatchID);
    if (reschedule?.date) await setDeliverySchedule(incident.orderID, reschedule.date, reschedule.time);
    await resolve(incident, actor, {
      resolution: reschedule?.date ? RESOLUTION.rescheduled : RESOLUTION.reassigned,
      resolutionNotes: reschedule?.date
        ? `Rescheduled to ${reschedule.date}${reschedule.time ? ` ${reschedule.time}` : ""}.`
        : null,
      newDispatchID: dispatch.dispatchID,
    });
  } catch (error) {
    await discardDispatch(dispatch.dispatchID);
    throw error;
  }

  return { incidentID, newDispatchID: dispatch.dispatchID as string };
}

export interface SubcontractChoice {
  subConID: string;
  driverName: string;
  plateNumber: string;
  contactNumber?: string | null;
}

/**
 * A partner's truck takes the load. Same shape as the sub-contractor trips
 * already on record: no company truck or driver, the coordinator recorded,
 * and the partner's details in the trip note.
 */
export async function subcontract(incidentID: string, choice: SubcontractChoice, actor: Actor) {
  const incident = await loadIncident(incidentID);
  requireOpen(incident);

  const { data: partner, error } = await supabase
    .from("SubContractor")
    .select("subConID, companyName, isActive")
    .eq("subConID", choice.subConID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!partner || partner.isActive === false) throw new FoulTripError("That sub-contractor is not active.");

  const note = [
    `Subcontractor: ${partner.companyName}`,
    `External Driver: ${choice.driverName}`,
    `Temporary Plate: ${choice.plateNumber}`,
    choice.contactNumber ? `Driver Contact: ${choice.contactNumber}` : null,
    `Recovery for foul trip reported ${new Date(incident.reportedAt).toLocaleString("en-PH")}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: dispatch, error: insertError } = await supabase
    .from("DispatchOrder")
    .insert({
      orderID: incident.orderID,
      truckID: null,
      driverID: null,
      coorID: actor.employeeID,
      status: DELIVERY_STATUS.inTransit,
      dispatchNote: note,
    })
    .select("dispatchID")
    .single();
  if (insertError) throw new Error(`Failed to create the sub-contractor trip: ${insertError.message}`);

  try {
    await handOverRemainingStops(incident, dispatch.dispatchID);
    await resolve(incident, actor, {
      resolution: RESOLUTION.subcontracted,
      resolutionNotes: `${partner.companyName} - ${choice.driverName}, ${choice.plateNumber}.`,
      newDispatchID: dispatch.dispatchID,
    });
  } catch (error) {
    await discardDispatch(dispatch.dispatchID);
    throw error;
  }

  return { incidentID, newDispatchID: dispatch.dispatchID as string };
}

/**
 * A sub-contractor has no one in the crew app to finish the trip, and no
 * screen ever called the office "complete" endpoint - so without this the
 * trip would sit in transit forever.
 */
export async function completeSubcontractedTrip(incidentID: string) {
  const incident = await loadIncident(incidentID);
  if (incident.resolution !== RESOLUTION.subcontracted || !incident.newDispatchID) {
    throw new FoulTripError("This foul trip was not handed to a sub-contractor.");
  }

  const { data: trip } = await supabase
    .from("DispatchOrder")
    .select("status")
    .eq("dispatchID", incident.newDispatchID)
    .maybeSingle();
  if (trip?.status === DELIVERY_STATUS.completed) {
    throw new FoulTripError("That trip is already marked delivered.", 409);
  }

  const now = new Date().toISOString();
  await supabase
    .from("BranchStops")
    .update({ stopStatus: STOP_STATUS.delivered, completedAt: now })
    .eq("dispatchID", incident.newDispatchID)
    .neq("stopStatus", STOP_STATUS.delivered);
  await supabase
    .from("PickupStops")
    .update({ stopStatus: STOP_STATUS.delivered, completedAt: now })
    .eq("dispatchID", incident.newDispatchID);

  await completeDispatch(incident.newDispatchID);
  return { incidentID, dispatchID: incident.newDispatchID };
}

/** Send a mechanic to the truck. How serious it is decides what they bring. */
export async function sendMechanic(
  incidentID: string,
  choice: { mechanicID: string; severity: "minor" | "major"; notes?: string | null },
) {
  const incident = await loadIncident(incidentID);
  if (incident.status !== INCIDENT_STATUS.open) {
    throw new FoulTripError(
      incident.status === INCIDENT_STATUS.mechanicAssigned
        ? "A mechanic is already on the way to this truck."
        : "This foul trip has already been resolved.",
      409,
    );
  }
  if (!incident.truckID) {
    throw new FoulTripError("This trip was a sub-contractor's; there is no company truck to repair.");
  }

  const { data: mechanic } = await supabase
    .from("Employee")
    .select("employeeID, role, isActive")
    .eq("employeeID", choice.mechanicID)
    .maybeSingle();
  if (!mechanic || mechanic.isActive === false || mechanic.role?.trim() !== EMPLOYEE_ROLE.mechanic) {
    throw new FoulTripError("Choose an active mechanic.");
  }

  const { error } = await supabase
    .from("FoulTripIncident")
    .update({
      status: INCIDENT_STATUS.mechanicAssigned,
      mechanicID: choice.mechanicID,
      severity: choice.severity,
      mechanicAssignedAt: new Date().toISOString(),
      mechanicOutcome: null,
      mechanicRespondedAt: null,
      mechanicNotes: choice.notes?.trim() ? `Dispatch: ${choice.notes.trim()}` : null,
    })
    .eq("incidentID", incidentID)
    .eq("status", INCIDENT_STATUS.open);
  if (error) throw new Error(`Failed to send the mechanic: ${error.message}`);

  return { incidentID };
}

/**
 * The mechanic's verdict from the site.
 *
 * Fixed: the same trip carries on - the dispatch goes back to the status it
 * had, the truck and crew are locked to it again, and the crew continues from
 * the stop they had reached. If the crew has been given another trip in the
 * meantime it cannot resume; the truck is freed and dispatch re-assigns.
 *
 * Not fixable: back to dispatch, who re-assigns or sub-contracts. The truck
 * stays on maintenance.
 */
export async function mechanicReport(
  incidentID: string,
  mechanicID: string,
  report: { outcome: "fixed" | "not_fixable"; notes?: string | null },
) {
  const incident = await loadIncident(incidentID);
  if (incident.status !== INCIDENT_STATUS.mechanicAssigned || incident.mechanicID !== mechanicID) {
    throw new FoulTripError("This roadside job is not assigned to you.", 403);
  }

  const now = new Date().toISOString();
  const noteLine = report.notes?.trim() ? `Mechanic: ${report.notes.trim()}` : null;
  const mechanicNotes = [incident.mechanicNotes, noteLine].filter(Boolean).join("\n") || null;

  if (report.outcome === "not_fixable") {
    const { error } = await supabase
      .from("FoulTripIncident")
      .update({ status: INCIDENT_STATUS.open, mechanicOutcome: "not_fixable", mechanicRespondedAt: now, mechanicNotes })
      .eq("incidentID", incidentID);
    if (error) throw new Error(error.message);
    return { incidentID, resumed: false, reason: "not_fixable" as const };
  }

  // Can the same trip carry on?
  const { data: dispatch, error: dispatchError } = await supabase
    .from("DispatchOrder")
    .select("dispatchID, status, truckID, driverID, dispatchNote, DispatchHelper ( helperID, status )")
    .eq("dispatchID", incident.dispatchID)
    .maybeSingle();
  if (dispatchError || !dispatch) throw new Error("Failed to load the trip.");

  const crew = [
    dispatch.driverID,
    ...((dispatch.DispatchHelper ?? []) as { helperID: string | null; status: string | null }[])
      .filter((h) => h.status !== HELPER_STATUS.declined)
      .map((h) => h.helperID),
  ].filter((id): id is string => Boolean(id));

  const ownerFilters = [
    dispatch.truckID ? `truckID.eq.${dispatch.truckID}` : null,
    dispatch.driverID ? `driverID.eq.${dispatch.driverID}` : null,
  ].filter(Boolean);
  const busy = ownerFilters.length
    ? await supabase
        .from("DispatchOrder")
        .select("dispatchID")
        .in("status", ACTIVE_DELIVERY_STATUSES)
        .neq("dispatchID", dispatch.dispatchID)
        .or(ownerFilters.join(","))
    : { data: [] as unknown[] };
  const busyHelpers = crew.length > 1
    ? await supabase
        .from("DispatchHelper")
        .select("dispatchID, DispatchOrder!inner ( status )")
        .in("helperID", crew.slice(1))
        .neq("dispatchID", dispatch.dispatchID)
        .in("DispatchOrder.status", ACTIVE_DELIVERY_STATUSES)
    : { data: [] as unknown[] };

  const crewElsewhere = (busy.data?.length ?? 0) > 0 || ((busyHelpers.data as unknown[] | null)?.length ?? 0) > 0;

  if (dispatch.status !== DELIVERY_STATUS.foulTrip || crewElsewhere) {
    if (dispatch.truckID) {
      await supabase.from("Truck").update({ truckStatus: TRUCK_STATUS.available }).eq("truckID", dispatch.truckID);
    }
    const { error } = await supabase
      .from("FoulTripIncident")
      .update({
        status: INCIDENT_STATUS.open,
        mechanicOutcome: "fixed",
        mechanicRespondedAt: now,
        mechanicNotes: [mechanicNotes, "Truck repaired, but its crew has since been given another trip - re-assign."]
          .filter(Boolean)
          .join("\n"),
      })
      .eq("incidentID", incidentID);
    if (error) throw new Error(error.message);
    return { incidentID, resumed: false, reason: "crew_reassigned" as const };
  }

  const resumeTo =
    incident.dispatchStatusBefore && (ACTIVE_DELIVERY_STATUSES as string[]).includes(incident.dispatchStatusBefore)
      ? incident.dispatchStatusBefore
      : DELIVERY_STATUS.inTransit;

  const { data: resumed, error: resumeError } = await supabase
    .from("DispatchOrder")
    .update({
      status: resumeTo,
      dispatchNote: `${dispatch.dispatchNote ?? ""}\nRepaired on site - trip resumed.`,
    })
    .eq("dispatchID", dispatch.dispatchID)
    .eq("status", DELIVERY_STATUS.foulTrip)
    .select("dispatchID")
    .maybeSingle();
  if (resumeError) throw new Error(`Failed to resume the trip: ${resumeError.message}`);
  if (!resumed) throw new FoulTripError("The trip changed while you were reporting. Refresh and try again.", 409);

  if (dispatch.truckID) {
    await supabase.from("Truck").update({ truckStatus: TRUCK_STATUS.onDelivery }).eq("truckID", dispatch.truckID);
  }
  if (crew.length) {
    await supabase.from("Employee").update({ availability: AVAILABILITY.onDelivery }).in("employeeID", crew);
  }

  const { error } = await supabase
    .from("FoulTripIncident")
    .update({
      status: INCIDENT_STATUS.resolved,
      resolution: RESOLUTION.repairedOnSite,
      mechanicOutcome: "fixed",
      mechanicRespondedAt: now,
      mechanicNotes,
      resolvedAt: now,
      resolvedBy: mechanicID,
    })
    .eq("incidentID", incidentID);
  if (error) throw new Error(error.message);

  return { incidentID, resumed: true, reason: null };
}

/** Cancel the booking outright. Uses the booking cancellation that exists. */
export async function cancel(incidentID: string, reason: string, actor: Actor) {
  const incident = await loadIncident(incidentID);
  requireOpen(incident);
  await cancelBooking(incident.orderID, reason);
  await resolve(incident, actor, { resolution: RESOLUTION.cancelled, resolutionNotes: reason });
  return { incidentID };
}

/** Handled outside the system - a note is required so the record says how. */
export async function close(incidentID: string, notes: string, actor: Actor) {
  const incident = await loadIncident(incidentID);
  requireOpen(incident);
  await resolve(incident, actor, {
    status: INCIDENT_STATUS.closed,
    resolution: RESOLUTION.closed,
    resolutionNotes: notes,
  });
  return { incidentID };
}
