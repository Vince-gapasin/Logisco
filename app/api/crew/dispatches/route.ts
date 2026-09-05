import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;
    const adminClient = createClient(supabaseUrl, supabaseSecretKey);

    // 1. Identify User
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ message: "Invalid session" }, { status: 401 });

    // 2. Find Employee ID
    const { data: employee, error: empErr } = await adminClient
      .from("Employee")
      .select("employeeID, employeeName")
      .eq("auth_id", user.id)
      .single();

    if (empErr || !employee) {
      console.error("Employee Lookup Error:", empErr);
      return NextResponse.json({ message: "Employee profile not found for this user." }, { status: 404 });
    }

    const empId = employee.employeeID;
    console.log(`[Crew API] Fetching dispatches for Employee: ${employee.employeeName} (${empId})`);

    // 3. Fetch Dispatches where the user is the DRIVER
    const { data: driverDispatches, error: driverErr } = await adminClient
      .from("DispatchOrder")
      .select(`
        dispatchID,
        dispatchCode,
        status,
        dispatchNote,
        Order ( orderCode, clientID, notes, Client(company, contactName, contact, emailAdd, businessAdd) ),
        Truck ( plateNumber, model ),
        BranchStops ( branchName, contactPerson, contactNum, notes, expectedTime, stopStatus )
      `)
      .eq("driverID", empId)
      .neq("status", "Rejected");

    if (driverErr) {
      console.error("[Crew API] Driver Fetch Error:", driverErr.message);
      throw new Error(`Database relation error (Driver): ${driverErr.message}`);
    }

    // 4. Fetch Dispatches where the user is a HELPER
    const { data: helperAssignments, error: helperErr } = await adminClient
      .from("DispatchHelper")
      .select("dispatchID, status")
      .eq("helperID", empId)
      .neq("status", "Declined");

    if (helperErr) {
      console.error("[Crew API] Helper Assignment Fetch Error:", helperErr.message);
      throw new Error(`Database relation error (Helper): ${helperErr.message}`);
    }

    let helperDispatches: any[] = [];
    if (helperAssignments && helperAssignments.length > 0) {
      const dispatchIds = helperAssignments.map(h => h.dispatchID);
      const { data: hData, error: hDataErr } = await adminClient
        .from("DispatchOrder")
        .select(`
          dispatchID,
          dispatchCode,
          status,
          dispatchNote,
          Order ( orderCode, clientID, notes, Client(company, contactName, contact, emailAdd, businessAdd) ),
          Truck ( plateNumber, model ),
          BranchStops ( branchName, contactPerson, contactNum, notes, expectedTime, stopStatus )
        `)
        .in("dispatchID", dispatchIds)
        .neq("status", "Rejected");
        
      if (hDataErr) {
        console.error("[Crew API] Helper Dispatches Fetch Error:", hDataErr.message);
        throw new Error(`Database relation error (Helper Data): ${hDataErr.message}`);
      }

      helperDispatches = (hData || []).map(dispatch => {
        const assignment = helperAssignments.find(h => h.dispatchID === dispatch.dispatchID);
        return {
          ...dispatch,
          _helperStatus: assignment?.status 
        };
      });
    }

    // Combine both lists
    const allRawDispatches = [...(driverDispatches || []), ...helperDispatches];
    console.log(`[Crew API] Found ${allRawDispatches.length} active dispatches for user.`);

    // 5. Map Database Schema to Frontend "DeliveryRecord" Format
    const formattedData = allRawDispatches.map(dispatch => {
      // Use fallback empty objects/arrays so the map doesn't crash if a relation is missing
      const order = Array.isArray(dispatch.Order) ? dispatch.Order[0] : (dispatch.Order || {});
      const client = Array.isArray(order.Client) ? order.Client[0] : (order.Client || {});
      const truck = Array.isArray(dispatch.Truck) ? dispatch.Truck[0] : (dispatch.Truck || {});
      const stops = Array.isArray(dispatch.BranchStops) ? dispatch.BranchStops : [];
      
      let displayStatus = "Awaiting Confirmation";
      if (dispatch._helperStatus) {
         displayStatus = dispatch._helperStatus === "Accepted" ? "Accepted" : "Awaiting Confirmation";
      } else {
         displayStatus = dispatch.status === "Pending" ? "Awaiting Confirmation" : dispatch.status;
      }

      return {
        id: dispatch.dispatchID,
        bookingId: order.orderCode || dispatch.dispatchCode || "N/A",
        clientName: client.company || "Unknown Client",
        clientEmail: client.emailAdd || "No email",
        address: client.businessAdd || "No Address Provided",
        dateTime: "See Stops", 
        status: displayStatus,
        scheduledDate: "TBD",
        pickupTime: "TBD",
        deliveryTime: "TBD",
        pickupAddress: "Warehouse / Depot",
        deliveryAddress: client.businessAdd || "Various Locations",
        contactPerson: client.contactName || "N/A",
        contactNumber: client.contact || "N/A",
        driver: dispatch._helperStatus ? "Assigned Driver" : employee.employeeName,
        helper: dispatch._helperStatus ? employee.employeeName : "Assigned Helpers",
        assignedVehicle: truck.plateNumber || "TBD",
        product: "Assorted Goods",
        quantity: "See Manifest",
        priorityLevel: "Standard",
        notes: dispatch.dispatchNote || order.notes || "No notes provided.",
        confirmBy: "End of Day",
        multipleDeliveries: stops.map((stop: any) => ({
          branch: stop.branchName,
          address: "Address on file",
          contactPerson: stop.contactPerson,
          contactNumber: stop.contactNum,
          deliveryTime: stop.expectedTime,
          quantity: "TBD",
          status: stop.stopStatus,
        }))
      };
    });

    return NextResponse.json(formattedData);

  } catch (error: any) {
    console.error("[Crew API] CRITICAL ERROR:", error);
    return NextResponse.json({ message: error.message || "Failed to fetch dispatches" }, { status: 500 });
  }
}