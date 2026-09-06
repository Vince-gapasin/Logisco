import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { dispatchID, action, reason } = await request.json(); // action = "accept" | "decline"

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;
    const adminClient = createClient(supabaseUrl, supabaseSecretKey);

    // 1. Identify User
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ message: "Invalid session" }, { status: 401 });

    // 2. Find Employee ID
    const { data: employee } = await adminClient
      .from("Employee")
      .select("employeeID")
      .eq("auth_id", user.id)
      .single();

    if (!employee) return NextResponse.json({ message: "Employee not found" }, { status: 404 });

    // 3. Check if they are the Driver
    const { data: dispatchAsDriver } = await adminClient
      .from("DispatchOrder")
      .select("dispatchID")
      .eq("dispatchID", dispatchID)
      .eq("driverID", employee.employeeID)
      .single();

    if (dispatchAsDriver) {
      // USER IS THE DRIVER: Update the whole Dispatch Order
      const updateData = action === "accept" 
        ? { status: "Accepted" } 
        : { status: "Rejected", rejectionReason: reason };

      const { error: updateErr } = await adminClient
        .from("DispatchOrder")
        .update(updateData)
        .eq("dispatchID", dispatchID);

      if (updateErr) throw updateErr;
      return NextResponse.json({ message: `Dispatch ${action}ed successfully.` });
    }

    // 4. Check if they are a Helper
    const { data: helperAssignment } = await adminClient
      .from("DispatchHelper")
      .select("dhID")
      .eq("dispatchID", dispatchID)
      .eq("helperID", employee.employeeID)
      .single();

    if (helperAssignment) {
      // USER IS A HELPER: Update only their specific Helper assignment
      const updateData = action === "accept" 
        ? { status: "Accepted" } 
        : { status: "Declined", declineReason: reason };

      const { error: updateErr } = await adminClient
        .from("DispatchHelper")
        .update(updateData)
        .eq("dhID", helperAssignment.dhID);

      if (updateErr) throw updateErr;
      return NextResponse.json({ message: `Assignment ${action}ed successfully.` });
    }

    return NextResponse.json({ message: "You are not assigned to this dispatch." }, { status: 403 });

  } catch (error: any) {
    console.error("Dispatch response error:", error);
    return NextResponse.json({ message: error.message || "Failed to process response" }, { status: 500 });
  }
}