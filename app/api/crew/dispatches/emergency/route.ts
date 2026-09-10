import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ message: "Server Configuration Error" }, { status: 500 });
  }

  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ message: "Invalid session" }, { status: 401 });

    const formData = await request.formData();
    const dispatchID = formData.get("dispatchID") as string;
    const issueType = formData.get("issueType") as string;
    const details = formData.get("details") as string;
    // We can extract emergencyImage here if you want to save it to Supabase Storage later

    if (!dispatchID || !issueType) {
      return NextResponse.json({ message: "Missing required emergency details" }, { status: 400 });
    }

    // 1. Fetch current dispatch to get assigned resources
    const { data: dispatchRecord } = await adminClient
      .from("DispatchOrder")
      .select(`truckID, driverID, DispatchHelper(helperID)`)
      .eq("dispatchID", dispatchID)
      .single();

    // 2. Mark Dispatch as Foul Trip
    await adminClient
      .from("DispatchOrder")
      .update({ status: "Foul Trip", dispatchNote: `EMERGENCY [${issueType}]: ${details}` })
      .eq("dispatchID", dispatchID);

    // 3. Log into Reports
    await adminClient
      .from("Reports")
      .insert({
        dispatchID: dispatchID,
        status: "Foul Trip",
        finalRemarks: `EMERGENCY ALERT\nType: ${issueType}\nDetails: ${details || "None provided"}`
      });

    // 4. Resource Management (Lock truck if broken, free up personnel)
    if (dispatchRecord) {
      if (dispatchRecord.truckID) {
        // If the truck broke down or crashed, lock it in Maintenance. Otherwise, make it Available.
        const newTruckStatus = ["Broken Truck", "Accident"].includes(issueType) ? "Maintenance" : "Available";
        await adminClient.from("Truck").update({ truckStatus: newTruckStatus }).eq("truckID", dispatchRecord.truckID);
      }
      
      // Free the crew regardless of the truck's state
      if (dispatchRecord.driverID) {
        await adminClient.from("Employee").update({ availability: "Available" }).eq("employeeID", dispatchRecord.driverID);
      }
      if (dispatchRecord.DispatchHelper) {
        for (const helper of dispatchRecord.DispatchHelper) {
          if (helper.helperID) {
            await adminClient.from("Employee").update({ availability: "Available" }).eq("employeeID", helper.helperID);
          }
        }
      }
    }

    return NextResponse.json({ message: "Emergency alert broadcasted successfully" }, { status: 200 });

  } catch (error: any) {
    console.error("[Emergency API] CRITICAL ERROR:", error);
    return NextResponse.json({ message: error.message || "Failed to broadcast emergency" }, { status: 500 });
  }
}