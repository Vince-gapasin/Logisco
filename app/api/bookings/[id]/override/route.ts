import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { notify, OFFICE, tripLabel } from "@/services/notifications/notify";
import {
  overrideBooking,
  type OverrideAction,
} from "@/services/booking/overrideService";

// The office ending a booking the crew cannot or will not end.
//
// Cancel a trip that is already on the road, declare a foul trip the crew never
// reported, or close a delivery they finished and drove away from. All three
// were impossible from the office: cancelBooking refuses once the cargo moves,
// and the foul trip flow could only be opened from the crew app. A trip whose
// crew had gone silent stayed In Transit until somebody edited the database.
//
// Office roles only, a reason always, and every one audited against the trip so
// it appears in that booking's Remarks History with the name of whoever did it.
// An override that could not be told apart from the crew's own work would make
// the history worth less than no history at all.

const ACTIONS: OverrideAction[] = ["cancel", "foul-trip", "complete"];

const AUDIT_ACTION: Record<OverrideAction, string> = {
  cancel: "OVERRIDE_CANCEL",
  "foul-trip": "OVERRIDE_FOUL_TRIP",
  complete: "OVERRIDE_COMPLETE",
};

const ANNOUNCEMENT: Record<OverrideAction, string> = {
  cancel: "cancelled by the office",
  "foul-trip": "marked as a foul trip by the office",
  complete: "closed by the office",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { id: orderID } = await params;
  if (!orderID) {
    return NextResponse.json({ message: "Missing booking id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    reason?: string;
    issueType?: string;
  } | null;

  const action = body?.action as OverrideAction | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json(
      { message: `Action must be one of: ${ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const reason = (body?.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json(
      { message: "Say why. An override is recorded against your name." },
      { status: 400 },
    );
  }

  try {
    const result = await overrideBooking({
      orderID,
      action,
      reason,
      issueType: body?.issueType,
      actorID: auth.employee.employeeID,
    });

    // Against the trip where there is one, so it lands in that booking's
    // Remarks History beside everything else that happened to it. A cancel
    // before any trip existed has only the order to hang on.
    await recordAudit({
      table: result.dispatchID ? "DispatchOrder" : "Order",
      recordID: result.dispatchID ?? orderID,
      action: AUDIT_ACTION[action],
      actor: auditActor(auth),
      before: { status: result.previousStatus },
      after: { reason, issueType: body?.issueType ?? null, stopsClosed: result.stopsClosed },
    });

    // The rest of the office should not learn about this by noticing the board
    // changed. Deduped per trip per action, so two people pressing it once
    // between them does not send two.
    await notify({
      event: "TRUCK_STALLED",
      title: `Booking ${ANNOUNCEMENT[action]}`,
      body:
        `${(await tripLabel(result.dispatchID ?? "")) ?? orderID} was ${ANNOUNCEMENT[action]}: ${reason}` +
        (result.stopsClosed > 0
          ? ` ${result.stopsClosed} stop(s) were closed without proof.`
          : ""),
      severity: action === "complete" ? "info" : "action",
      roles: OFFICE,
      dedupeKey: `override:${result.dispatchID ?? orderID}:${action}`,
      entity: result.dispatchID
        ? { table: "DispatchOrder", id: result.dispatchID }
        : { table: "Order", id: orderID },
      link: "/admindashboard/dashboard",
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not override this booking";
    console.error("[Override API]:", message);
    // These messages are written for the person reading them - a booking already
    // closed, a trip that never left - so they are returned rather than swapped
    // for something generic.
    return NextResponse.json({ message }, { status: 400 });
  }
}
