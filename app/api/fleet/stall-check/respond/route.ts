import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { isUuid } from "@/services/dispatch/dispatchService";
import { recordStallResponse } from "@/services/fleet/stallService";

// "I have dealt with this."
//
// The forty-five minute rung tells the office to call the driver, and until now
// nothing knew whether anybody had. So it escalated at the person who had
// already picked up the phone, and the two-hour rung said the same thing again
// to somebody who had solved it an hour earlier. An alarm that cannot be
// answered is one people learn to ignore, which is the opposite of what a
// watchdog is for.
//
// Answering quietens the ladder for an hour - the same as a crew saying they are
// in traffic, and for the same reason. It buys time; it does not end the matter.
// A trip still silent an hour after somebody said they had handled it has not
// been handled, and the ladder says so.
//
// Ending the trip outright - a foul trip, or closing it as delivered - is the
// other answer, and that is the override on the in-transit feed rather than
// anything here.

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const body = (await request.json().catch(() => null)) as {
    dispatchID?: string;
    reason?: string;
  } | null;

  const dispatchID = body?.dispatchID;
  if (!isUuid(dispatchID)) {
    return NextResponse.json({ message: "Missing or invalid dispatchID" }, { status: 400 });
  }

  const reason = (body?.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json(
      { message: "Say what you did. The next person to see this alert reads it." },
      { status: 400 },
    );
  }

  try {
    await recordStallResponse({
      dispatchID,
      actorID: auth.employee.employeeID,
      reason,
    });

    // Against the trip, so it joins that booking's Remarks History beside
    // everything else that happened to it.
    await recordAudit({
      table: "DispatchOrder",
      recordID: dispatchID,
      action: "STALL_ANSWERED",
      actor: auditActor(auth),
      after: { reason },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record that";
    console.error("[Stall response]:", message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
