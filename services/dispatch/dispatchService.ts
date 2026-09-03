import { supabase } from "@/app/lib/supabase";
import type { AssignDispatchDto } from "@/types/dispatch";

// ==========================================
// ASSIGN DISPATCH (LOCK RESOURCES)
// ==========================================
export async function assignDispatch(dispatchID: string, dto: AssignDispatchDto) {
  // 1. Validate Truck Status & Capacity
  const { data: truck, error: truckErr } = await supabase
    .from("Truck")
    .select("capacity, truckStatus, isActive")
    .eq("truckID", dto.truckID)
    .single();

  if (truckErr || !truck) throw new Error("Truck not found.");
  if (!truck.isActive || truck.truckStatus !== "Available") {
    throw new Error("Selected truck is inactive or currently unavailable.");
  }
  if (dto.totalCargoWeight > truck.capacity) {
    throw new Error(`Cargo weight (${dto.totalCargoWeight}kg) exceeds truck capacity (${truck.capacity}kg).`);
  }

  // 2. Validate Driver Status & Availability
  const { data: driver, error: driverErr } = await supabase
    .from("Employee")
    .select("availability, isActive, role")
    .eq("employeeID", dto.driverID)
    .single();

  if (driverErr || !driver) throw new Error("Driver not found.");
  if (!driver.isActive || driver.role !== "Driver") {
    throw new Error("Selected employee is not an active driver.");
  }
  if (driver.availability !== "Available") {
    throw new Error("Driver is currently on another delivery or unavailable.");
  }

  // 3. Execute Assignment & Lock Resources
  const { data: dispatch, error: assignErr } = await supabase
    .from("DispatchOrder")
    .update({ 
      truckID: dto.truckID, 
      driverID: dto.driverID, 
      status: "Assigned" 
    })
    .eq("dispatchID", dispatchID)
    .select()
    .single();

  if (assignErr) throw new Error("Failed to assign dispatch order.");

  await supabase.from("Truck").update({ truckStatus: "On Delivery" }).eq("truckID", dto.truckID);
  await supabase.from("Employee").update({ availability: "On Delivery" }).eq("employeeID", dto.driverID);

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