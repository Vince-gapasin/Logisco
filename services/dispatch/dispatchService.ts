import { supabase } from "@/app/lib/supabase";
import type { AssignDispatchDto } from "@/types/dispatch";

export async function assignDispatch(orderID: string, dto: AssignDispatchDto) {
  if (!dto.truckID) throw new Error("No truck selected.");
  if (!dto.driverID) throw new Error("No driver selected.");

  // 1. Validate Truck
  // We now know for a fact the column is called "truckID"
  const { data: truck, error: truckErr } = await supabase
    .from("Truck")
    .select("*") 
    .eq("truckID", dto.truckID)
    .single();
    
  if (truckErr) throw new Error(`Supabase Truck Error: ${truckErr.message}`);
  if (!truck) throw new Error(`Truck not found for ID: ${dto.truckID}`);
  
  if (truck.isActive === false && truck.status !== 'Active') {
      throw new Error("Selected truck is inactive or retired.");
  }
  
  if (truck.truckStatus === "Maintenance" || truck.truckStatus === "Under Maintenance") {
      throw new Error("Selected truck is currently under maintenance and cannot be dispatched.");
  }

  // 2. Validate Driver
  // Applying the same logic here, the column is "employeeID"
  const { data: driver, error: driverErr } = await supabase
    .from("Employee")
    .select("*") 
    .eq("employeeID", dto.driverID)
    .single();
    
  if (driverErr) throw new Error(`Supabase Driver Error: ${driverErr.message}`);
  if (!driver) throw new Error(`Driver not found for ID: ${dto.driverID}`);
  
  if ((driver.isActive === false && driver.status !== 'Active') || driver.role !== "Driver") {
    throw new Error("Selected employee is not an active driver.");
  }

  // 3. INSERT the Dispatch Record
  const { data: dispatch, error: assignErr } = await supabase
    .from("DispatchOrder")
    .insert({
      orderID: orderID,
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
  const { data: busyDispatches, error: dispatchErr } = await supabase
    .from("DispatchOrder")
    .select("truckID, driverID"); 

  if (dispatchErr) throw new Error(`Supabase Error: ${dispatchErr.message}`);

  const busyTrucks = new Set<string>();
  const busyEmployees = new Set<string>();

  if (busyDispatches) {
    busyDispatches.forEach((d: any) => {
      if (d.truckID) busyTrucks.add(d.truckID);
      if (d.driverID) busyEmployees.add(d.driverID);
    });
  }

  const { data: allTrucks } = await supabase.from("Truck").select("*");
  const { data: allEmployees } = await supabase.from("Employee").select("*");

  // ==========================================
  // BULLETPROOF FILTERS
  // ==========================================
  
  const availableTrucks = (allTrucks || []).filter((t: any) => {
    const isBaseActive = t.status === "Active" || t.isActive;
    const currentStatus = (t.truckStatus || "").toLowerCase();
    
    // 🚨 Safely block any truck mentioning maintenance or delivery
    const isMaintenance = currentStatus.includes("maintenance");
    const isOnDelivery = currentStatus.includes("delivery");
    
    const isAssigned = busyTrucks.has(t.truckID) || busyTrucks.has(t.id);

    return isBaseActive && !isMaintenance && !isOnDelivery && !isAssigned;
  });
  
  const availableDrivers = (allEmployees || []).filter((e: any) => {
    const currentAvailability = (e.availability || "").toLowerCase();
    
    // 🚨 Block drivers on delivery
    const isDelivering = currentAvailability.includes("delivery");
    const isAssigned = busyEmployees.has(e.employeeID) || busyEmployees.has(e.id);
    
    return e.role === "Driver" && (e.status === "Active" || e.isActive) && !isDelivering && !isAssigned;
  });
  
  const availableHelpers = (allEmployees || []).filter((e: any) => {
    const currentAvailability = (e.availability || "").toLowerCase();
    
    // 🚨 Block helpers on delivery
    const isDelivering = currentAvailability.includes("delivery");
    
    return e.role === "Helper" && (e.status === "Active" || e.isActive) && !isDelivering;
  });

  return {
    trucks: availableTrucks,
    drivers: availableDrivers,
    helpers: availableHelpers,
  };
}