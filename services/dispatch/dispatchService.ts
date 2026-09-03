import { supabase } from "@/app/lib/supabase";
import type { AssignDispatchDto } from "@/types/dispatch";

export async function assignDispatch(orderID: string, dto: AssignDispatchDto) {
  // 1. Validate Truck
  const { data: truck, error: truckErr } = await supabase.from("Truck").select("capacity, truckStatus, isActive").eq("truckID", dto.truckID).single();
  if (truckErr || !truck) throw new Error("Truck not found.");
  if (!truck.isActive || truck.truckStatus !== "Available") throw new Error("Selected truck is inactive or currently unavailable.");

  // 2. Validate Driver
  const { data: driver, error: driverErr } = await supabase.from("Employee").select("availability, isActive, role").eq("employeeID", dto.driverID).single();
  if (driverErr || !driver) throw new Error("Driver not found.");
  if (!driver.isActive || driver.role !== "Driver") throw new Error("Selected employee is not an active driver.");
  if (driver.availability !== "Available") throw new Error("Driver is currently on another delivery.");

  // 3. INSERT the Dispatch Record (Without the helper columns)
  const { data: dispatch, error: assignErr } = await supabase
    .from("DispatchOrder")
    .insert({
      orderID: orderID, // Connects Dispatch to the Booking
      truckID: dto.truckID,
      driverID: dto.driverID,
      status: "Assigned"
    })
    .select()
    .single();

  if (assignErr) throw new Error(`Failed to assign dispatch order: ${assignErr.message}`);

  // 4. Lock Resources ("On Delivery")
  await supabase.from("Truck").update({ truckStatus: "On Delivery" }).eq("truckID", dto.truckID);
  await supabase.from("Employee").update({ availability: "On Delivery" }).eq("employeeID", dto.driverID);
  
  // We still lock the helpers here so they can't be double-booked!
  if (dto.helper1ID) {
    await supabase.from("Employee").update({ availability: "On Delivery" }).eq("employeeID", dto.helper1ID);
  }
  if (dto.helper2ID) {
    await supabase.from("Employee").update({ availability: "On Delivery" }).eq("employeeID", dto.helper2ID);
  }

  return dispatch;
}

// ==========================================
// COMPLETE DISPATCH (FREE RESOURCES)
// ==========================================
export async function completeDispatch(dispatchID: string) {
  // 1. Fetch Dispatch Record
  const { data: dispatchRecord, error: fetchError } = await supabase
    .from("DispatchOrder")
    .select("truckID, driverID")
    .eq("dispatchID", dispatchID)
    .single();

  if (fetchError || !dispatchRecord) throw new Error("Dispatch Order not found.");

  // 2. Complete the Order
  const { error: dispatchError } = await supabase
    .from("DispatchOrder")
    .update({ status: "Completed" })
    .eq("dispatchID", dispatchID);

  if (dispatchError) throw new Error("Failed to complete dispatch order.");

  // 3. Free up Resources
  if (dispatchRecord.truckID) {
    await supabase.from("Truck").update({ truckStatus: "Available" }).eq("truckID", dispatchRecord.truckID);
  }
  if (dispatchRecord.driverID) {
    await supabase.from("Employee").update({ availability: "Available" }).eq("employeeID", dispatchRecord.driverID);
  }

  return { message: "Delivery completed! Truck and Driver are now Available." };
}

export async function getAvailableResources(targetDate: string) {
  // 1. Fetch all Dispatch Orders that are scheduled for the target date
  // NOTE: This assumes you save the delivery date in the DispatchOrder or Order table!
  // If your DB doesn't have a specific date column yet, we check all active/pending dispatches.
  const { data: busyDispatches, error: dispatchErr } = await supabase
    .from("DispatchOrder")
    .select("truckID, driverID, helper1ID, helper2ID")
    .in("status", ["Assigned", "In-Transit", "Pending"]);
    // .eq("deliveryDate", targetDate) <-- Uncomment this if you add a deliveryDate column to your table!

  if (dispatchErr) throw new Error("Failed to fetch busy schedules");

  // 2. Extract all IDs that are busy on this date
  const busyTrucks = new Set<string>();
  const busyEmployees = new Set<string>();

  busyDispatches?.forEach((d) => {
    if (d.truckID) busyTrucks.add(d.truckID);
    if (d.driverID) busyEmployees.add(d.driverID);
    if (d.helper1ID) busyEmployees.add(d.helper1ID);
    if (d.helper2ID) busyEmployees.add(d.helper2ID);
  });

  // 3. Fetch ALL Active Trucks and filter out the busy ones
  const { data: allTrucks } = await supabase.from("Truck").select("*").eq("isActive", true);
  const availableTrucks = allTrucks?.filter((t) => !busyTrucks.has(t.truckID) && t.truckStatus !== "Out of Service") || [];

  // 4. Fetch ALL Active Employees and filter out the busy ones
  const { data: allEmployees } = await supabase.from("Employee").select("*").eq("isActive", true);
  const availableDrivers = allEmployees?.filter((e) => e.role === "Driver" && !busyEmployees.has(e.employeeID)) || [];
  const availableHelpers = allEmployees?.filter((e) => e.role === "Helper" && !busyEmployees.has(e.employeeID)) || [];

  return {
    trucks: availableTrucks,
    drivers: availableDrivers,
    helpers: availableHelpers,
  };
}