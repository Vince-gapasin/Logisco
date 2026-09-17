import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { DELIVERY_STATUS, TRUCK_STATUS } from "@/app/lib/enums";
import {
  getCrewAssignment,
  isUuid,
  releaseDispatchResources,
  TERMINAL_DISPATCH_STATUSES,
} from "@/services/dispatch/dispatchService";

// Emergencies after which the truck must be inspected before its next trip.
const TRUCK_DAMAGE_ISSUES = ["Broken Truck", "Accident"];

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  try {
    const formData = await request.formData();
    const dispatchID = formData.get("dispatchID") as string | null;
    const issueType = ((formData.get("issueType") as string | null) || "").trim();
    const details = ((formData.get("details") as string | null) || "").trim();

    if (!isUuid(dispatchID) || !issueType) {
      return NextResponse.json({ message: "Missing required emergency details" }, { status: 400 });
    }

    const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
    if (!assignment) {
      return NextResponse.json(
        { message: "Only the assigned driver or helper can report an emergency for this delivery." },
        { status: 403 },
      );
    }

    if (TERMINAL_DISPATCH_STATUSES.includes(assignment.dispatch.status)) {
      return NextResponse.json({ message: `Dispatch is already ${assignment.dispatch.status}.` }, { status: 409 });
    }

    // 1. Mark Dispatch as Foul Trip, keeping the existing trip notes
    const emergencyNote = `EMERGENCY [${issueType}] reported by ${auth.employee.employeeName}: ${details || "No details provided"}`;
    const dispatchNote = assignment.dispatch.dispatchNote
      ? `${assignment.dispatch.dispatchNote}\n${emergencyNote}`
      : emergencyNote;

    const { error: updateErr } = await supabase
      .from("DispatchOrder")
      .update({ status: DELIVERY_STATUS.foulTrip, dispatchNote })
      .eq("dispatchID", dispatchID);

    if (updateErr) throw new Error(`Failed to mark foul trip: ${updateErr.message}`);

    // 2. Log into Reports
    const { error: reportErr } = await supabase.from("Reports").insert({
      dispatchID,
      status: DELIVERY_STATUS.foulTrip,
      finalRemarks: `EMERGENCY ALERT\nType: ${issueType}\nReported by: ${auth.employee.employeeName}\nDetails: ${details || "None provided"}`,
    });

    if (reportErr) console.error("[Emergency API] Report insert failed:", reportErr.message);

    // 3. Free the crew; send a damaged truck to maintenance.
    const truckStatus = TRUCK_DAMAGE_ISSUES.includes(issueType)
      ? TRUCK_STATUS.onMaintenance
      : TRUCK_STATUS.available;
    await releaseDispatchResources(dispatchID, truckStatus);

    return NextResponse.json({ message: "Emergency alert broadcasted successfully" }, { status: 200 });
  } catch (error) {
    console.error("[Emergency API] CRITICAL ERROR:", error);
    return NextResponse.json({ message: "Failed to broadcast emergency" }, { status: 500 });
  }
}
