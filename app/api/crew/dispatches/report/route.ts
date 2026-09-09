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

    const body = await request.json();
    const { dispatchID, tripRemarks, vehicleIssues } = body;

    if (!dispatchID) {
      return NextResponse.json({ message: "Missing dispatchID" }, { status: 400 });
    }

    // Combine remarks and issues into finalRemarks for the Reports table
    let combinedRemarks = tripRemarks ? `Trip Remarks: ${tripRemarks}` : "No trip remarks provided.";
    if (vehicleIssues) {
      combinedRemarks += `\nVehicle Issues Observed: ${vehicleIssues}`;
    }

    const { error: reportError } = await adminClient
      .from("Reports")
      .insert({
        dispatchID: dispatchID,
        status: "Completed",
        finalRemarks: combinedRemarks
      });

    if (reportError) {
      console.error("[Report API] Insert Error:", reportError);
      throw new Error(`Failed to save report: ${reportError.message}`);
    }

    return NextResponse.json({ message: "Report saved successfully" }, { status: 200 });

  } catch (error: any) {
    console.error("[Report API] CRITICAL ERROR:", error);
    return NextResponse.json({ message: error.message || "Failed to save report" }, { status: 500 });
  }
}