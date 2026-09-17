import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { AVAILABILITY, DELIVERY_STATUS, HELPER_STATUS } from "@/app/lib/enums";
import {
  getCrewAssignment,
  isUuid,
  releaseDispatchResources,
} from "@/services/dispatch/dispatchService";

// Statuses in which the driver can still accept or decline a dispatch.
const RESPONDABLE_STATUSES: string[] = [DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned];

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  let body: { dispatchID?: unknown; action?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { dispatchID, action } = body;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!isUuid(dispatchID)) {
    return NextResponse.json({ message: "Missing or invalid dispatchID" }, { status: 400 });
  }
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ message: 'action must be "accept" or "decline"' }, { status: 400 });
  }
  if (action === "decline" && !reason) {
    return NextResponse.json({ message: "A reason is required to decline" }, { status: 400 });
  }

  try {
    const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
    if (!assignment) {
      return NextResponse.json({ message: "You are not assigned to this dispatch." }, { status: 403 });
    }

    if (assignment.isDriver) {
      // USER IS THE DRIVER: accept or reject the whole dispatch
      if (!RESPONDABLE_STATUSES.includes(assignment.dispatch.status)) {
        return NextResponse.json(
          { message: `This dispatch is already ${assignment.dispatch.status}.` },
          { status: 409 },
        );
      }

      // Column is lowercase in the database: rejectionreason.
      const updateData =
        action === "accept"
          ? { status: DELIVERY_STATUS.accepted }
          : { status: DELIVERY_STATUS.rejected, rejectionreason: reason };

      const { error: updateErr } = await supabase
        .from("DispatchOrder")
        .update(updateData)
        .eq("dispatchID", dispatchID)
        .in("status", RESPONDABLE_STATUSES);

      if (updateErr) throw updateErr;

      // A rejected dispatch no longer holds its truck and crew.
      if (action === "decline") {
        await releaseDispatchResources(dispatchID);
      }

      return NextResponse.json({ message: `Dispatch ${action}ed successfully.` });
    }

    // USER IS A HELPER: update only their own assignment
    const helper = assignment.helper!;
    if (helper.status && helper.status !== HELPER_STATUS.pending) {
      return NextResponse.json({ message: `You have already ${helper.status.toLowerCase()} this assignment.` }, { status: 409 });
    }

    // Column is lowercase in the database: declinereason.
    const updateData =
      action === "accept"
        ? { status: HELPER_STATUS.accepted }
        : { status: HELPER_STATUS.declined, declinereason: reason };

    const { error: updateErr } = await supabase
      .from("DispatchHelper")
      .update(updateData)
      .eq("dhID", helper.dhID);

    if (updateErr) throw updateErr;

    // A helper who declines is free for other dispatches.
    if (action === "decline") {
      const { error: availabilityErr } = await supabase
        .from("Employee")
        .update({ availability: AVAILABILITY.available })
        .eq("employeeID", auth.employee.employeeID);
      if (availabilityErr) console.error("Helper availability reset failed:", availabilityErr.message);
    }

    return NextResponse.json({ message: `Assignment ${action}ed successfully.` });
  } catch (error) {
    console.error("Dispatch response error:", error);
    return NextResponse.json({ message: "Failed to process response" }, { status: 500 });
  }
}
