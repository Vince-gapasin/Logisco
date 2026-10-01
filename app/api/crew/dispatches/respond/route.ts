import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { AVAILABILITY, DELIVERY_STATUS, HELPER_STATUS, isDeclineCode } from "@/app/lib/enums";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { crewOf, notify, OFFICE, tripLabel } from "@/services/notifications/notify";
import {
  crewReadinessFor,
  getCrewAssignment,
  isUuid,
  releaseDispatchResources,
} from "@/services/dispatch/dispatchService";

// Statuses in which the driver can still accept or decline a dispatch.
const RESPONDABLE_STATUSES: string[] = [DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned];

// The last yes is worth telling the rest of the crew about.
//
// Otherwise the gate is a trap: somebody accepts, finds Start Delivery greyed
// out because the other person has not answered, and has nothing to do but keep
// reopening the app. The poll enables the button within half a minute of the
// last acceptance - but only for somebody who happens to be looking at it.
//
// Told to everybody on the trip rather than to the driver, because either of
// them can start it, and whoever accepted last does not need telling what they
// just did - notify() drops the actor from its own recipients.
async function announceCrewComplete(
  dispatchID: string,
  actor: { employeeID: string; name: string },
): Promise<void> {
  const readiness = (await crewReadinessFor([dispatchID])).get(dispatchID);
  if (!readiness?.ready) return;

  const crew = await crewOf(dispatchID);
  if (crew.length === 0) return;

  await notify({
    event: "CREW_READY",
    title: "Your crew is complete",
    body: `${actor.name} accepted ${(await tripLabel(dispatchID)) ?? "your delivery"}. Everybody assigned has now accepted, so it can start.`,
    severity: "info",
    employeeIDs: crew,
    entity: { table: "DispatchOrder", id: dispatchID },
    link: "/crew/dashboard",
    actor: { employeeID: actor.employeeID, name: actor.name },
  });
}

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

  // The typed reason stays required and unchanged. The code is what a fair
  // figure can be computed from - "brakes", "brakes are gone" and "unsafe" are
  // one reason typed three ways - and it is optional so an older app build keeps
  // working, its declines simply counting the way they always did.
  const code = isDeclineCode((body as { code?: unknown }).code) ? (body as { code: string }).code : null;

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
          : { status: DELIVERY_STATUS.rejected, rejectionreason: reason, declineCode: code };

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

      await recordAudit({
        table: "DispatchOrder",
        recordID: dispatchID,
        action: action === "accept" ? "CREW_ACCEPT" : "CREW_DECLINE",
        actor: auditActor(auth),
        before: { status: assignment.dispatch.status },
        after: { ...updateData, as: "driver" },
      });

      if (action === "decline") {
        await notify({
          event: "CREW_DECLINED",
          title: "Driver declined a delivery",
          body: `${auth.employee.employeeName} declined ${(await tripLabel(dispatchID)) ?? "a delivery"}${reason ? `: ${reason}` : "."} It needs another crew.`,
          severity: "action",
          roles: OFFICE,
          entity: { table: "DispatchOrder", id: dispatchID },
          link: "/admindashboard/calendar/unassigned-bookings",
          actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
        });
      }

      if (action === "accept") {
        await announceCrewComplete(dispatchID, {
          employeeID: auth.employee.employeeID,
          name: auth.employee.employeeName,
        });
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
        : { status: HELPER_STATUS.declined, declinereason: reason, declineCode: code };

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

    await recordAudit({
      table: "DispatchHelper",
      recordID: helper.dhID,
      action: action === "accept" ? "CREW_ACCEPT" : "CREW_DECLINE",
      actor: auditActor(auth),
      before: { status: helper.status },
      after: { ...updateData, dispatchID, as: "helper" },
    });

    if (action === "decline") {
      await notify({
        event: "CREW_DECLINED",
        title: "Helper declined a delivery",
        body: `${auth.employee.employeeName} declined to help on ${(await tripLabel(dispatchID)) ?? "a delivery"}${reason ? `: ${reason}` : "."}`,
        severity: "action",
        roles: OFFICE,
        entity: { table: "DispatchOrder", id: dispatchID },
        link: "/admindashboard/feeds/pending",
        actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
      });
    }

    if (action === "accept") {
      await announceCrewComplete(dispatchID, {
        employeeID: auth.employee.employeeID,
        name: auth.employee.employeeName,
      });
    }

    return NextResponse.json({ message: `Assignment ${action}ed successfully.` });
  } catch (error) {
    console.error("Dispatch response error:", error);
    return NextResponse.json({ message: "Failed to process response" }, { status: 500 });
  }
}
