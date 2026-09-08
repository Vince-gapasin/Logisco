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

  if (truck.isActive === false && truck.status !== "Active") {
    throw new Error("Selected truck is inactive or retired.");
  }

  if (
    truck.truckStatus === "Maintenance" ||
    truck.truckStatus === "Under Maintenance"
  ) {
    throw new Error(
      "Selected truck is currently under maintenance and cannot be dispatched."
    );
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

  if (
    (driver.isActive === false && driver.status !== "Active") ||
    driver.role !== "Driver"
  ) {
    throw new Error("Selected employee is not an active driver.");
  }

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
    throw new Error(
      `Failed to assign dispatch order: ${assignErr.message}`
    );
  }

    // Save assigned helpers
  const helperIDs = [dto.helper1ID, dto.helper2ID].filter(
    (id): id is string => Boolean(id)
  );

  if (helperIDs.length > 0) {
    const helperRecords = helperIDs.map((helperID) => ({
      dispatchID: dispatch.dispatchID,
      helperID,
    }));

    const { error: helperError } = await supabase
      .from("DispatchHelper")
      .insert(helperRecords);

    if (helperError) {
      throw new Error(
        `Failed to assign dispatch helpers: ${helperError.message}`
      );
    }
  }

  // 4. Lock Resources ("On Delivery")
  await supabase
    .from("Truck")
    .update({ truckStatus: "On Delivery" })
    .eq("truckID", dto.truckID);

  await supabase
    .from("Employee")
    .update({ availability: "On Delivery" })
    .eq("employeeID", dto.driverID);

  if (dto.helper1ID) {
    await supabase
      .from("Employee")
      .update({ availability: "On Delivery" })
      .eq("employeeID", dto.helper1ID);
  }

  if (dto.helper2ID) {
    await supabase
      .from("Employee")
      .update({ availability: "On Delivery" })
      .eq("employeeID", dto.helper2ID);
  }

  return dispatch;
}

// ==========================================
// COMPLETE DISPATCH (FREE RESOURCES)
// ==========================================
export async function completeDispatch(dispatchID: string) {
  // 1. Fetch dispatch, driver, truck, and helpers
  const { data: dispatchRecord, error: fetchError } = await supabase
    .from("DispatchOrder")
    .select(`
      truckID,
      driverID,
      DispatchHelper (
        helperID
      )
    `)
    .eq("dispatchID", dispatchID)
    .single();

  if (fetchError || !dispatchRecord) {
    throw new Error("Dispatch Order not found.");
  }

  // 2. Complete the dispatch
  const { error: dispatchError } = await supabase
    .from("DispatchOrder")
    .update({ status: "Completed" })
    .eq("dispatchID", dispatchID);

  if (dispatchError) {
    throw new Error("Failed to complete dispatch order.");
  }

  // 3. Release the truck
  if (dispatchRecord.truckID) {
    await supabase
      .from("Truck")
      .update({ truckStatus: "Available" })
      .eq("truckID", dispatchRecord.truckID);
  }

  // 4. Release the driver
  if (dispatchRecord.driverID) {
    await supabase
      .from("Employee")
      .update({ availability: "Available" })
      .eq("employeeID", dispatchRecord.driverID);
  }

  // 5. Release assigned helpers
  const assignedHelpers = dispatchRecord.DispatchHelper || [];

  for (const helper of assignedHelpers) {
    if (helper.helperID) {
      await supabase
        .from("Employee")
        .update({ availability: "Available" })
        .eq("employeeID", helper.helperID);
    }
  }

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
    .in("status", ["Assigned", "In Transit"]);

  if (dispatchErr) {
    throw new Error(`Supabase Error: ${dispatchErr.message}`);
  }

  const busyTrucks = new Set<string>();
  const busyEmployees = new Set<string>();
  const activeDispatchIDs: string[] = [];

  if (busyDispatches) {
    busyDispatches.forEach((dispatch: any) => {
      if (dispatch.dispatchID) {
        activeDispatchIDs.push(dispatch.dispatchID);
      }

      if (dispatch.truckID) {
        busyTrucks.add(dispatch.truckID);
      }

      if (dispatch.driverID) {
        busyEmployees.add(dispatch.driverID);
      }
    });
  }

  // Include helpers linked to active dispatches.
  if (activeDispatchIDs.length > 0) {
    const { data: busyHelpers, error: helperError } = await supabase
      .from("DispatchHelper")
      .select("helperID")
      .in("dispatchID", activeDispatchIDs);

    if (helperError) {
      throw new Error(`Supabase Helper Error: ${helperError.message}`);
    }

    if (busyHelpers) {
      busyHelpers.forEach((helper: any) => {
        if (helper.helperID) {
          busyEmployees.add(helper.helperID);
        }
      });
    }
  }

  const { data: allTrucks, error: trucksError } = await supabase
    .from("Truck")
    .select("*");

  if (trucksError) {
    throw new Error(`Supabase Truck Error: ${trucksError.message}`);
  }

  const { data: allEmployees, error: employeesError } = await supabase
    .from("Employee")
    .select("*");

  if (employeesError) {
    throw new Error(`Supabase Employee Error: ${employeesError.message}`);
  }

  const availableTrucks = (allTrucks || []).filter((truck: any) => {
    const isActive = truck.isActive === true;
    const isAvailable =
      (truck.truckStatus || "").toLowerCase() === "available";
    const isAssigned = busyTrucks.has(truck.truckID);

    return isActive && isAvailable && !isAssigned;
  });

  const availableDrivers = (allEmployees || []).filter((employee: any) => {
    const isActive = employee.isActive === true;
    const isAvailable =
      (employee.availability || "").toLowerCase() === "available";
    const isAssigned = busyEmployees.has(employee.employeeID);

    return (
      employee.role === "Driver" &&
      isActive &&
      isAvailable &&
      !isAssigned
    );
  });

  const availableHelpers = (allEmployees || []).filter((employee: any) => {
    const isActive = employee.isActive === true;
    const isAvailable =
      (employee.availability || "").toLowerCase() === "available";
    const isAssigned = busyEmployees.has(employee.employeeID);

    return (
      employee.role === "Helper" &&
      isActive &&
      isAvailable &&
      !isAssigned
    );
  });

  return {
    trucks: availableTrucks,
    drivers: availableDrivers,
    helpers: availableHelpers,
  };
}