import { supabase } from "@/app/lib/supabase";
import { announceTruckStatus } from "@/services/truck/truckService";
import {
  ACTIVE_DELIVERY_STATUSES,
  AWAITING_CREW_STATUSES,
  DELIVERY_STATUS,
  EMPLOYEE_ROLE,
  HELPER_STATUS,
  isAssignable,
  TERMINAL_DELIVERY_STATUSES,
  TRUCK_STATUS,
} from "@/app/lib/enums";
import type { AssignDispatchDto } from "@/types/dispatch";
import { assignableCrew, whyNotAssignable } from "@/app/lib/crewEligibility";

// Re-exported under the existing names; defined once in app/lib/enums.ts.
// The active list now also covers Start Delivery, In Warehouse and Arrived,
// which previously left a truck free to be double-booked mid-trip.
export const ACTIVE_DISPATCH_STATUSES: string[] = ACTIVE_DELIVERY_STATUSES;
export const TERMINAL_DISPATCH_STATUSES: string[] = TERMINAL_DELIVERY_STATUSES;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// Only the columns the dispatch screens need - Employee rows also hold
// licence, medical and emergency-contact data that must not reach the browser.
const EMPLOYEE_PUBLIC_COLUMNS = "employeeID, employeeCode, employeeName, role, availability, isActive, contact";

async function findActiveDispatchFor(
  column: "truckID" | "driverID",
  id: string,
  excludeDispatchID?: string,
) {
  let query = supabase
    .from("DispatchOrder")
    .select("dispatchID")
    .eq(column, id)
    .in("status", ACTIVE_DISPATCH_STATUSES);

  // When re-assigning, the dispatch being edited must not block itself.
  if (excludeDispatchID) query = query.neq("dispatchID", excludeDispatchID);

  const { data, error } = await query.limit(1);

  if (error) throw new Error(`Supabase Dispatch Error: ${error.message}`);
  return data?.[0] ?? null;
}

export interface StatusActor {
  actor?: { employeeID: string; name: string } | null;
  /** Why, when it was not a person choosing: "Foul trip: Broken Truck". */
  cause?: string | null;
}

async function setTruckStatus(truckID: string, truckStatus: string, by: StatusActor = {}) {
  // Read first, so the announcement below knows whether this is a change worth
  // making and what it is changing from.
  const { data: before } = await supabase
    .from("Truck")
    .select("truckStatus")
    .eq("truckID", truckID)
    .maybeSingle();

  const { error } = await supabase
    .from("Truck")
    .update({ truckStatus })
    .eq("truckID", truckID);

  if (error) throw new Error(`Failed to update truck status: ${error.message}`);

  // This was a bare update, which is how a truck breaking down on the road
  // grounded it without telling a single mechanic - while an admin typing the
  // same status into the truck form notified all of them. announceTruckStatus
  // ignores the Available/On Delivery churn and speaks only when a truck leaves
  // the road or comes back to it.
  //
  // Never fatal: a delivery must not fail to release its truck because a
  // notification could not be sent.
  try {
    await announceTruckStatus(
      truckID,
      before?.truckStatus as string | undefined,
      truckStatus,
      by.actor,
      by.cause,
    );
  } catch (error) {
    console.error("[Dispatch] Could not announce the truck status:", error);
  }
}

export async function assignDispatch(orderID: string, dto: AssignDispatchDto) {
  if (!dto.truckID) throw new Error("No truck selected.");
  if (!dto.driverID) throw new Error("No driver selected.");

  // 1. Validate Truck
  const { data: truck, error: truckErr } = await supabase
    .from("Truck")
    .select("truckID, isActive, truckStatus")
    .eq("truckID", dto.truckID)
    .maybeSingle();

  if (truckErr) throw new Error(`Supabase Truck Error: ${truckErr.message}`);
  if (!truck) throw new Error(`Truck not found for ID: ${dto.truckID}`);

  if (truck.isActive === false) {
    throw new Error("Selected truck is inactive or retired.");
  }

  if (
    truck.truckStatus === TRUCK_STATUS.onMaintenance ||
    truck.truckStatus === TRUCK_STATUS.outOfService
  ) {
    throw new Error("Selected truck is under maintenance or out of service and cannot be dispatched.");
  }

  if (await findActiveDispatchFor("truckID", dto.truckID)) {
    throw new Error("Selected truck is already assigned to an active dispatch.");
  }

  // 2. Validate Driver
  const helperIDs = [...new Set([dto.helper1ID, dto.helper2ID].filter((id): id is string => Boolean(id)))];

  // The whole crew in one read. The helpers used to be checked for nothing at
  // all - any id that arrived became a helper - and the driver for everything
  // except whether they could sign in.
  const { data: crew, error: crewErr } = await supabase
    .from("Employee")
    .select("employeeID, employeeName, role, isActive, activation_completed_at")
    .in("employeeID", [dto.driverID, ...helperIDs]);

  if (crewErr) throw new Error(`Supabase Employee Error: ${crewErr.message}`);

  const byID = new Map((crew ?? []).map((person) => [person.employeeID, person]));

  const driverProblem = whyNotAssignable(byID.get(dto.driverID), EMPLOYEE_ROLE.driver);
  if (driverProblem) throw new Error(driverProblem);

  for (const helperID of helperIDs) {
    const helperProblem = whyNotAssignable(byID.get(helperID), EMPLOYEE_ROLE.helper);
    if (helperProblem) throw new Error(helperProblem);
  }

  if (await findActiveDispatchFor("driverID", dto.driverID)) {
    throw new Error("Selected driver is already assigned to an active dispatch.");
  }

  // 3. INSERT the Dispatch Record
  const { data: dispatch, error: assignErr } = await supabase
    .from("DispatchOrder")
    .insert({
      orderID: orderID,
      truckID: dto.truckID,
      driverID: dto.driverID,
      status: DELIVERY_STATUS.assigned,
    })
    .select()
    .single();

  if (assignErr) {
    throw new Error(`Failed to assign dispatch order: ${assignErr.message}`);
  }

  try {
    // Save assigned helpers
    if (helperIDs.length > 0) {
      const { error: helperError } = await supabase
        .from("DispatchHelper")
        .insert(helperIDs.map((helperID) => ({ dispatchID: dispatch.dispatchID, helperID })));

      if (helperError) {
        throw new Error(`Failed to assign dispatch helpers: ${helperError.message}`);
      }
    }

    // Link the order's itinerary to this dispatch so the crew sees its stops.
    const { error: stopsError } = await supabase
      .from("BranchStops")
      .update({ dispatchID: dispatch.dispatchID })
      .eq("orderID", orderID)
      .is("dispatchID", null);

    if (stopsError) {
      throw new Error(`Failed to link delivery stops: ${stopsError.message}`);
    }
  } catch (error) {
    // Undo the dispatch so the order returns to the unassigned queue.
    await supabase.from("DispatchHelper").delete().eq("dispatchID", dispatch.dispatchID);
    await supabase.from("DispatchOrder").delete().eq("dispatchID", dispatch.dispatchID);
    throw error;
  }

  // 4. Lock the truck. Crew availability is calculated from the dispatch
  // status and schedule whenever employees are fetched.
  await setTruckStatus(dto.truckID, TRUCK_STATUS.onDelivery);

  return dispatch;
}

// ==========================================
// RE-ASSIGN DISPATCH
// ==========================================
// Swaps the truck and/or crew of a dispatch that has not departed yet - used
// when someone declines or is unavailable. Crew confirmations reset, because
// the new crew has not agreed to the trip.
export async function reassignDispatch(dispatchID: string, dto: AssignDispatchDto) {
  if (!dto.truckID) throw new Error("No truck selected.");
  if (!dto.driverID) throw new Error("No driver selected.");

  const { data: dispatch, error: dispatchErr } = await supabase
    .from("DispatchOrder")
    .select("dispatchID, status, truckID, driverID, DispatchHelper ( dhID, helperID )")
    .eq("dispatchID", dispatchID)
    .maybeSingle();

  if (dispatchErr) throw new Error(`Supabase Dispatch Error: ${dispatchErr.message}`);
  if (!dispatch) throw new Error("Dispatch not found.");

  const REASSIGNABLE = [
    DELIVERY_STATUS.pending,
    DELIVERY_STATUS.assigned,
    DELIVERY_STATUS.accepted,
  ] as string[];
  if (!REASSIGNABLE.includes(dispatch.status)) {
    throw new Error(`A dispatch that is ${dispatch.status} can no longer be re-assigned.`);
  }

  // 1. Validate the incoming truck and driver
  const { data: truck, error: truckErr } = await supabase
    .from("Truck")
    .select("truckID, isActive, truckStatus")
    .eq("truckID", dto.truckID)
    .maybeSingle();

  if (truckErr) throw new Error(`Supabase Truck Error: ${truckErr.message}`);
  if (!truck) throw new Error("Truck not found.");
  if (truck.isActive === false) throw new Error("Selected truck is inactive or retired.");
  if (
    truck.truckStatus === TRUCK_STATUS.onMaintenance ||
    truck.truckStatus === TRUCK_STATUS.outOfService
  ) {
    throw new Error("Selected truck is under maintenance or out of service and cannot be dispatched.");
  }
  if (await findActiveDispatchFor("truckID", dto.truckID, dispatchID)) {
    throw new Error("Selected truck is already assigned to another active dispatch.");
  }

  const { data: driver, error: driverErr } = await supabase
    .from("Employee")
    .select("employeeID, role, isActive")
    .eq("employeeID", dto.driverID)
    .maybeSingle();

  if (driverErr) throw new Error(`Supabase Driver Error: ${driverErr.message}`);
  if (!driver) throw new Error("Driver not found.");
  if (driver.isActive === false || driver.role?.trim() !== EMPLOYEE_ROLE.driver) {
    throw new Error("Selected employee is not an active driver.");
  }
  if (await findActiveDispatchFor("driverID", dto.driverID, dispatchID)) {
    throw new Error("Selected driver is already assigned to another active dispatch.");
  }

  const newHelperIDs = [...new Set([dto.helper1ID, dto.helper2ID].filter((id): id is string => Boolean(id)))];
  // 2. Apply the new assignment, resetting crew confirmation
  const { error: updateErr } = await supabase
    .from("DispatchOrder")
    .update({
      truckID: dto.truckID,
      driverID: dto.driverID,
      status: DELIVERY_STATUS.assigned,
      rejectionreason: null,
    })
    .eq("dispatchID", dispatchID);

  if (updateErr) throw new Error(`Failed to re-assign dispatch: ${updateErr.message}`);

  const { error: deleteErr } = await supabase
    .from("DispatchHelper")
    .delete()
    .eq("dispatchID", dispatchID);

  if (deleteErr) throw new Error(`Failed to clear previous helpers: ${deleteErr.message}`);

  if (newHelperIDs.length > 0) {
    const { error: helperErr } = await supabase
      .from("DispatchHelper")
      .insert(newHelperIDs.map((helperID) => ({ dispatchID, helperID })));

    if (helperErr) throw new Error(`Failed to assign dispatch helpers: ${helperErr.message}`);
  }

  // 3. Update the assigned truck. Crew availability is derived from the
  // resulting dispatch assignment instead of being manually persisted.
  if (dispatch.truckID && dispatch.truckID !== dto.truckID) {
    await setTruckStatus(dispatch.truckID, TRUCK_STATUS.available);
  }
  await setTruckStatus(dto.truckID, TRUCK_STATUS.onDelivery);

  return { dispatchID };
}

// ==========================================
// RELEASE RESOURCES
// ==========================================
// Returns the truck and crew of a finished dispatch to the pool.
// Used by completion, emergencies (foul trips) and driver rejection.
export async function releaseDispatchResources(
  dispatchID: string,
  truckStatus: string = TRUCK_STATUS.available,
  // Who freed it and why. Only the paths that ground a truck need to say; the
  // rest are returning it to the pool, which nobody is notified about.
  by: StatusActor = {},
) {
  const { data: dispatchRecord, error } = await supabase
    .from("DispatchOrder")
    .select("truckID")
    .eq("dispatchID", dispatchID)
    .maybeSingle();

  if (error) throw new Error(`Supabase Dispatch Error: ${error.message}`);
  if (!dispatchRecord) throw new Error("Dispatch Order not found.");

  if (dispatchRecord.truckID) {
    await setTruckStatus(dispatchRecord.truckID, truckStatus, by);
  }

  // Remove the live map pin for this trip.
  await supabase.from("FleetLocations").delete().eq("dispatch_id", dispatchID);
}

// ==========================================
// CREW ACCESS
// ==========================================
// Resolves whether an employee is the driver or an assigned helper of a
// dispatch. Returns null when they are not, so callers can answer 403.
export async function getCrewAssignment(dispatchID: string, employeeID: string) {
  const { data, error } = await supabase
    .from("DispatchOrder")
    .select(
      "dispatchID, orderID, status, current_step, pickupCompletedAt, dispatchNote, pod_url, truckID, driverID, DispatchHelper(dhID, helperID, status)",
    )
    .eq("dispatchID", dispatchID)
    .maybeSingle();

  if (error) throw new Error(`Supabase Dispatch Error: ${error.message}`);
  if (!data) return null;

  const helper = (data.DispatchHelper ?? []).find(
    (row: { helperID: string | null }) => row.helperID === employeeID,
  ) as { dhID: string; helperID: string; status: string | null } | undefined;

  const isDriver = data.driverID === employeeID;
  if (!isDriver && !helper) return null;

  return { dispatch: data, isDriver, helper: helper ?? null };
}

// ==========================================
// COMPLETE DISPATCH (FREE RESOURCES)
// ==========================================
export async function completeDispatch(dispatchID: string) {
  const { data: updated, error: dispatchError } = await supabase
    .from("DispatchOrder")
    .update({
      status: DELIVERY_STATUS.completed,
      completedAt: new Date().toISOString(),
    })
    .eq("dispatchID", dispatchID)
    .select("dispatchID")
    .maybeSingle();

  if (dispatchError) {
    throw new Error("Failed to complete dispatch order.");
  }
  if (!updated) {
    throw new Error("Dispatch Order not found.");
  }

  await releaseDispatchResources(dispatchID);

  return {
    message:
      "Delivery completed! Truck, driver, and helpers are now available.",
  };
}

export async function getAvailableResources(targetDate: string) {
  // targetDate is retained for future date-based scheduling.
  void targetDate;

  // Only active dispatches should block resources.
  const { data: busyDispatches, error: dispatchErr } = await supabase
    .from("DispatchOrder")
    .select("dispatchID, truckID, driverID")
    .in("status", ACTIVE_DISPATCH_STATUSES);

  if (dispatchErr) {
    throw new Error(`Supabase Error: ${dispatchErr.message}`);
  }

  const busyTrucks = new Set<string>();
  const busyEmployees = new Set<string>();
  const activeDispatchIDs: string[] = [];

  for (const dispatch of busyDispatches ?? []) {
    if (dispatch.dispatchID) activeDispatchIDs.push(dispatch.dispatchID);
    if (dispatch.truckID) busyTrucks.add(dispatch.truckID);
    if (dispatch.driverID) busyEmployees.add(dispatch.driverID);
  }

  // Include helpers linked to active dispatches.
  if (activeDispatchIDs.length > 0) {
    const { data: busyHelpers, error: helperError } = await supabase
      .from("DispatchHelper")
      .select("helperID")
      .in("dispatchID", activeDispatchIDs)
      .or("status.is.null,status.neq.Declined");

    if (helperError) {
      throw new Error(`Supabase Helper Error: ${helperError.message}`);
    }

    for (const helper of busyHelpers ?? []) {
      if (helper.helperID) busyEmployees.add(helper.helperID);
    }
  }

  const { data: allTrucks, error: trucksError } = await supabase
    .from("Truck")
    .select("*")
    .eq("isActive", true);

  if (trucksError) {
    throw new Error(`Supabase Truck Error: ${trucksError.message}`);
  }

  const { data: allEmployees, error: employeesError } = await supabase
    .from("Employee")
    // activation_completed_at comes too: somebody who has never set up their
    // login cannot see a delivery, let alone accept one, and the list used to
    // offer them anyway.
    .select(`${EMPLOYEE_PUBLIC_COLUMNS}, activation_completed_at`)
    .eq("isActive", true)
    .in("role", [EMPLOYEE_ROLE.driver, EMPLOYEE_ROLE.helper]);

  if (employeesError) {
    throw new Error(`Supabase Employee Error: ${employeesError.message}`);
  }

  const availableTrucks = (allTrucks ?? []).filter((truck) => {
    const isAvailable = String(truck.truckStatus ?? "").toLowerCase() === "available";
    return isAvailable && !busyTrucks.has(truck.truckID);
  });

  // Free means: not on a trip already, and not on leave. Being booked or on
  // the road is the first check; the second is what an admin set.
  const isFree = (employee: { employeeID: string; availability?: string | null }) =>
    !busyEmployees.has(employee.employeeID) && isAssignable(employee.availability ?? undefined);

  // Free to take a trip, and able to be told about one. Filtered through the
  // same rule the assignment enforces, so the form cannot offer somebody the
  // save will then refuse.
  const availableDrivers = assignableCrew(allEmployees ?? [], EMPLOYEE_ROLE.driver).filter(isFree);
  const availableHelpers = assignableCrew(allEmployees ?? [], EMPLOYEE_ROLE.helper).filter(isFree);

  return {
    trucks: availableTrucks,
    drivers: availableDrivers,
    helpers: availableHelpers,
  };
}

// ==========================================
// WHO HAS AGREED TO GO
// ==========================================

/**
 * Whether everybody assigned to a trip has said yes.
 *
 * The office assigns a crew; the crew agree to it; only then does the truck
 * move. Only the first half of that was enforced. The driver accepting set the
 * dispatch to Accepted, which is what the start button looked at - so a helper
 * who had never answered was no obstacle at all, and a two-person job could
 * leave with one person on it. The office found out at the warehouse.
 *
 * Declined is kept separate from pending on purpose. Waiting for somebody to
 * answer is a matter of minutes and the crew can see it resolve; somebody having
 * said no is a gap only the office can fill, and telling the driver to keep
 * waiting for a person who has already refused is how a delivery loses an hour
 * to nobody doing anything.
 */
export interface CrewReadiness {
  ready: boolean;
  /** Whether the driver themselves has accepted the dispatch. */
  driverAccepted: boolean;
  /** Who has not answered yet, by name. */
  waitingOn: string[];
  /** Who said no, and whose place nobody has taken yet. */
  declined: string[];
}

const A_CREW_MEMBER = "A crew member";

type NamedEmployee = { employeeName?: string | null } | { employeeName?: string | null }[] | null;

function nameOf(embedded: NamedEmployee): string {
  const row = Array.isArray(embedded) ? embedded[0] : embedded;
  return row?.employeeName?.trim() || A_CREW_MEMBER;
}

const READINESS_SELECT = `
  dispatchID,
  status,
  DispatchHelper ( status, Helper:Employee!helperID ( employeeName ) )
`;

/** One query for a screenful of trips, rather than one query per row. */
export async function crewReadinessFor(
  dispatchIDs: (string | null | undefined)[],
): Promise<Map<string, CrewReadiness>> {
  const ids = [...new Set(dispatchIDs.filter((id): id is string => isUuid(id)))];
  const readiness = new Map<string, CrewReadiness>();
  if (ids.length === 0) return readiness;

  const { data, error } = await supabase
    .from("DispatchOrder")
    .select(READINESS_SELECT)
    .in("dispatchID", ids);

  // Never fatal: a screen that cannot say who is still to accept is worse than
  // one that says nothing about it, and the gate on the server side is what
  // actually holds the truck.
  if (error) {
    console.error("[Crew] Could not read who has accepted:", error.message);
    return readiness;
  }

  for (const trip of data ?? []) {
    const helpers = (trip.DispatchHelper ?? []) as {
      status: string | null;
      Helper?: NamedEmployee;
    }[];

    const waitingOn = helpers
      .filter((helper) => (helper.status ?? HELPER_STATUS.pending) === HELPER_STATUS.pending)
      .map((helper) => nameOf(helper.Helper ?? null));
    const declined = helpers
      .filter((helper) => helper.status === HELPER_STATUS.declined)
      .map((helper) => nameOf(helper.Helper ?? null));

    // The driver's own yes is the dispatch status: Assigned and Pending both
    // mean they have not given it.
    const driverAccepted = !AWAITING_CREW_STATUSES.includes(trip.status ?? "");

    readiness.set(trip.dispatchID as string, {
      ready: driverAccepted && waitingOn.length === 0 && declined.length === 0,
      driverAccepted,
      waitingOn,
      declined,
    });
  }

  return readiness;
}

/**
 * Why this trip cannot start yet, in the words the crew member holding the
 * phone needs - which is not the same sentence for the person who has not
 * accepted as for the person waiting on them.
 */
export function crewNotReadyReason(
  readiness: CrewReadiness,
  asking: { isDriver: boolean },
): string | null {
  if (readiness.ready) return null;

  if (readiness.declined.length > 0) {
    return (
      `${readiness.declined.join(" and ")} declined this delivery. ` +
      `The office has been told and has to send a replacement before it can start.`
    );
  }

  if (!readiness.driverAccepted) {
    return asking.isDriver
      ? "Accept this delivery before starting it."
      : "The driver has not accepted this delivery yet. It cannot start until they do.";
  }

  return (
    `${readiness.waitingOn.join(" and ")} ${readiness.waitingOn.length === 1 ? "has" : "have"} not accepted ` +
    `this delivery yet. Everybody assigned has to accept before the truck leaves.`
  );
}
