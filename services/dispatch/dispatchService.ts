import { supabase } from "@/app/lib/supabase";
import type { AssignDispatchDto } from "@/types/dispatch";

// Dispatch statuses that hold a truck and crew until the trip ends.
export const ACTIVE_DISPATCH_STATUSES = ["Pending", "Assigned", "Accepted", "In Transit"];

// Statuses after which a dispatch can no longer be changed by the crew.
export const TERMINAL_DISPATCH_STATUSES = [
  "Completed",
  "Delivered",
  "Returned",
  "Cancelled",
  "Foul Trip",
  "Rejected",
];

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

async function setAvailability(employeeIDs: string[], availability: string) {
  if (employeeIDs.length === 0) return;

  const { error } = await supabase
    .from("Employee")
    .update({ availability })
    .in("employeeID", employeeIDs);

  if (error) throw new Error(`Failed to update crew availability: ${error.message}`);
}

async function setTruckStatus(truckID: string, truckStatus: string) {
  const { error } = await supabase
    .from("Truck")
    .update({ truckStatus })
    .eq("truckID", truckID);

  if (error) throw new Error(`Failed to update truck status: ${error.message}`);
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

  if (truck.truckStatus === "On Maintenance" || truck.truckStatus === "Out of Service") {
    throw new Error("Selected truck is under maintenance or out of service and cannot be dispatched.");
  }

  if (await findActiveDispatchFor("truckID", dto.truckID)) {
    throw new Error("Selected truck is already assigned to an active dispatch.");
  }

  // 2. Validate Driver
  const { data: driver, error: driverErr } = await supabase
    .from("Employee")
    .select("employeeID, role, isActive")
    .eq("employeeID", dto.driverID)
    .maybeSingle();

  if (driverErr) throw new Error(`Supabase Driver Error: ${driverErr.message}`);
  if (!driver) throw new Error(`Driver not found for ID: ${dto.driverID}`);

  if (driver.isActive === false || driver.role?.trim() !== "Driver") {
    throw new Error("Selected employee is not an active driver.");
  }

  if (await findActiveDispatchFor("driverID", dto.driverID)) {
    throw new Error("Selected driver is already assigned to an active dispatch.");
  }

  const helperIDs = [...new Set([dto.helper1ID, dto.helper2ID].filter((id): id is string => Boolean(id)))];

  // 3. INSERT the Dispatch Record
  const { data: dispatch, error: assignErr } = await supabase
    .from("DispatchOrder")
    .insert({
      orderID: orderID,
      truckID: dto.truckID,
      driverID: dto.driverID,
      status: "Assigned",
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

  // 4. Lock Resources ("On Delivery")
  await setTruckStatus(dto.truckID, "On Delivery");
  await setAvailability([dto.driverID, ...helperIDs], "On Delivery");

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

  if (!["Pending", "Assigned", "Accepted"].includes(dispatch.status)) {
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
  if (truck.truckStatus === "On Maintenance" || truck.truckStatus === "Out of Service") {
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
  if (driver.isActive === false || driver.role?.trim() !== "Driver") {
    throw new Error("Selected employee is not an active driver.");
  }
  if (await findActiveDispatchFor("driverID", dto.driverID, dispatchID)) {
    throw new Error("Selected driver is already assigned to another active dispatch.");
  }

  const newHelperIDs = [...new Set([dto.helper1ID, dto.helper2ID].filter((id): id is string => Boolean(id)))];
  const oldHelperIDs = ((dispatch.DispatchHelper as any[]) ?? [])
    .map((helper) => helper.helperID)
    .filter(Boolean) as string[];

  // 2. Apply the new assignment, resetting crew confirmation
  const { error: updateErr } = await supabase
    .from("DispatchOrder")
    .update({
      truckID: dto.truckID,
      driverID: dto.driverID,
      status: "Assigned",
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

  // 3. Free whoever was dropped, lock whoever was added
  if (dispatch.truckID && dispatch.truckID !== dto.truckID) {
    await setTruckStatus(dispatch.truckID, "Available");
  }
  await setTruckStatus(dto.truckID, "On Delivery");

  const released = [dispatch.driverID, ...oldHelperIDs].filter(
    (id): id is string => Boolean(id) && id !== dto.driverID && !newHelperIDs.includes(id),
  );
  await setAvailability(released, "Available");
  await setAvailability([dto.driverID, ...newHelperIDs], "On Delivery");

  return { dispatchID };
}

// ==========================================
// RELEASE RESOURCES
// ==========================================
// Returns the truck and crew of a finished dispatch to the pool.
// Used by completion, emergencies (foul trips) and driver rejection.
export async function releaseDispatchResources(dispatchID: string, truckStatus = "Available") {
  const { data: dispatchRecord, error } = await supabase
    .from("DispatchOrder")
    .select("truckID, driverID, DispatchHelper(helperID)")
    .eq("dispatchID", dispatchID)
    .maybeSingle();

  if (error) throw new Error(`Supabase Dispatch Error: ${error.message}`);
  if (!dispatchRecord) throw new Error("Dispatch Order not found.");

  if (dispatchRecord.truckID) {
    await setTruckStatus(dispatchRecord.truckID, truckStatus);
  }

  const crewIDs = [
    dispatchRecord.driverID,
    ...(dispatchRecord.DispatchHelper ?? []).map((helper: { helperID: string | null }) => helper.helperID),
  ].filter((id): id is string => Boolean(id));

  await setAvailability(crewIDs, "Available");

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
    .select("dispatchID, orderID, status, current_step, dispatchNote, truckID, driverID, DispatchHelper(dhID, helperID, status)")
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
      status: "Completed",
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
    .select(EMPLOYEE_PUBLIC_COLUMNS)
    .eq("isActive", true)
    .in("role", ["Driver", "Helper"]);

  if (employeesError) {
    throw new Error(`Supabase Employee Error: ${employeesError.message}`);
  }

  const availableTrucks = (allTrucks || []).filter((truck: any) => {
    const isAvailable = (truck.truckStatus || "").toLowerCase() === "available";
    return isAvailable && !busyTrucks.has(truck.truckID);
  });

  const isFree = (employee: any) =>
    (employee.availability || "").toLowerCase() === "available" &&
    !busyEmployees.has(employee.employeeID);

  const availableDrivers = (allEmployees || []).filter(
    (employee: any) => employee.role === "Driver" && isFree(employee),
  );

  const availableHelpers = (allEmployees || []).filter(
    (employee: any) => employee.role === "Helper" && isFree(employee),
  );

  return {
    trucks: availableTrucks,
    drivers: availableDrivers,
    helpers: availableHelpers,
  };
}
