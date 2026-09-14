import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { getCrewAssignment, isUuid } from "@/services/dispatch/dispatchService";

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  let body: { dispatchID?: unknown; tripRemarks?: unknown; vehicleIssues?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { dispatchID } = body;
  const tripRemarks = typeof body.tripRemarks === "string" ? body.tripRemarks.trim() : "";
  const vehicleIssues = typeof body.vehicleIssues === "string" ? body.vehicleIssues.trim() : "";

  if (!isUuid(dispatchID)) {
    return NextResponse.json({ message: "Missing or invalid dispatchID" }, { status: 400 });
  }

  try {
    const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
    if (!assignment) {
      return NextResponse.json({ message: "You are not assigned to this dispatch." }, { status: 403 });
    }

    // Combine remarks and issues into finalRemarks for the Reports table
    let combinedRemarks = tripRemarks ? `Trip Remarks: ${tripRemarks}` : "No trip remarks provided.";
    if (vehicleIssues) {
      combinedRemarks += `\nVehicle Issues Observed: ${vehicleIssues}`;
    }
    combinedRemarks += `\nSubmitted by: ${auth.employee.employeeName}`;

    const { error: reportError } = await supabase.from("Reports").insert({
      dispatchID,
      status: "Completed",
      finalRemarks: combinedRemarks,
    });

    if (reportError) throw new Error(`Failed to save report: ${reportError.message}`);

    return NextResponse.json({ message: "Report saved successfully" }, { status: 200 });
  } catch (error) {
    console.error("[Report API] CRITICAL ERROR:", error);
    return NextResponse.json({ message: "Failed to save report" }, { status: 500 });
  }
}
