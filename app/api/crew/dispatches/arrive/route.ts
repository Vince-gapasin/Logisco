import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { DELIVERY_STATUS, STOP_STATUS } from "@/app/lib/enums";
import { getCrewAssignment, isUuid } from "@/services/dispatch/dispatchService";
import { announceArrival } from "@/services/dispatch/crewUpdateService";

// "I am here."
//
// One tap from the truck when the crew reach a stop, before any of the work at
// it. It exists because the threshold clock had nothing honest to start from.
//
// The app reports a position only when the truck rolls, so an hour of legitimate
// unloading and an hour broken down on a hard shoulder arrive as exactly the same
// thing: nothing. The watchdog told them apart by guessing - within 200 m of a
// stop on the itinerary, assume loading - which needed a radius and a grace
// period, both invented, and produced a hole big enough that a delivery could
// start at the depot, never leave, and never be mentioned to anybody.
//
// A crew who say "I am here" and later "I am done" have answered the question
// instead. The clock runs from whichever of those came last.
//
// Deliberately a separate route from the status update. That one carries the
// proof-of-delivery upload, the step arithmetic and the resource release; it is
// the most consequential call the crew app makes, and adding a second job to it
// to save a file is a poor trade.

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  try {
    const body = (await request.json().catch(() => null)) as {
      dispatchID?: string;
      branchID?: number | string;
      pickupID?: number | string;
    } | null;

    const dispatchID = body?.dispatchID;
    if (!isUuid(dispatchID)) {
      return NextResponse.json({ message: "Missing or invalid dispatchID" }, { status: 400 });
    }

    // A stop is either a delivery branch or a pickup warehouse; one of the two,
    // never both, and never neither.
    const branchID = body?.branchID != null ? Number(body.branchID) : null;
    const pickupID = body?.pickupID != null ? Number(body.pickupID) : null;

    if ((branchID === null) === (pickupID === null)) {
      return NextResponse.json(
        { message: "Name exactly one stop: branchID or pickupID" },
        { status: 400 },
      );
    }
    if (branchID !== null && !Number.isFinite(branchID)) {
      return NextResponse.json({ message: "Invalid branchID" }, { status: 400 });
    }
    if (pickupID !== null && !Number.isFinite(pickupID)) {
      return NextResponse.json({ message: "Invalid pickupID" }, { status: 400 });
    }

    // Only the crew on this trip, and only while it is theirs to report on.
    const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
    if (!assignment?.dispatch) {
      return NextResponse.json({ message: "This trip is not yours" }, { status: 403 });
    }
    const trip = assignment.dispatch;

    const table = branchID !== null ? "BranchStops" : "PickupStops";
    const idColumn = branchID !== null ? "branchID" : "pickupID";
    const idValue = branchID !== null ? branchID : pickupID;

    const nameColumn = branchID !== null ? "branchName" : "warehouseName";
    const { data: stop, error: readError } = await supabase
      .from(table)
      .select(`${idColumn}, ${nameColumn}, stopStatus, arrivedAt, completedAt`)
      .eq(idColumn, idValue)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!stop) {
      return NextResponse.json({ message: "That stop is not on this trip" }, { status: 404 });
    }

    // Already finished. Saying "I am here" afterwards would wind the clock back
    // to a stop the crew have left, which is the one thing this must not do.
    if (stop.completedAt) {
      return NextResponse.json(
        { message: "That stop is already finished" },
        { status: 409 },
      );
    }

    // Already said, and the first time is the true time. Answering 200 keeps a
    // double tap or a retry on a bad line from reading as a failure.
    if (stop.arrivedAt) {
      return NextResponse.json({ success: true, arrivedAt: stop.arrivedAt, repeat: true });
    }

    const arrivedAt = new Date().toISOString();

    const { error: stopError } = await supabase
      .from(table)
      .update({ arrivedAt, stopStatus: STOP_STATUS.arrived })
      .eq(idColumn, idValue);

    if (stopError) throw new Error(stopError.message);

    // The trip's own status follows, so the board and the watchdog can see that
    // this truck is standing somewhere on purpose. Completing the stop sets it
    // back to In Transit, which the status route already does.
    const { error: tripError } = await supabase
      .from("DispatchOrder")
      .update({ status: DELIVERY_STATUS.arrived })
      .eq("dispatchID", dispatchID);

    if (tripError) throw new Error(tripError.message);

    await recordAudit({
      table: "DispatchOrder",
      recordID: dispatchID,
      action: "CREW_ARRIVED",
      actor: auditActor(auth),
      before: { status: trip.status },
      after: { status: DELIVERY_STATUS.arrived, [idColumn]: idValue, arrivedAt },
    });

    await announceArrival(
      dispatchID,
      // The select is built from a variable, so the row comes back as a union
      // of both shapes and neither name is on all of them.
      ((stop as Record<string, unknown>)[nameColumn] as string | null) ||
        (branchID !== null ? "a delivery point" : "a warehouse"),
      arrivedAt,
      { employeeID: auth.employee.employeeID, employeeName: auth.employee.employeeName },
    );

    return NextResponse.json({ success: true, arrivedAt });
  } catch (error) {
    console.error("[Arrive API Error]:", error);
    return NextResponse.json({ message: "Could not record the arrival" }, { status: 500 });
  }
}
