import { NextResponse } from "next/server";
import { authorize, CREW_ROLES } from "@/app/lib/auth";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { notify, OFFICE, tripLabel } from "@/services/notifications/notify";
import { getCrewAssignment, isUuid } from "@/services/dispatch/dispatchService";
import { FoulTripError, markIssueSorted, openIssuesOn } from "@/services/foulTrip/foulTripService";

// What the crew reported on this trip and have not cleared, and the way they
// clear it.
//
// The crew could report a problem they could carry on through - the wrong
// product collected, a receiver not there - and then had no way of saying it
// was sorted. Only the office's Close button could, so the report stayed open
// on their screen and the client went on being shown a problem that no longer
// existed, for the rest of the delivery.

export async function GET(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  const dispatchID = new URL(request.url).searchParams.get("dispatchID");
  if (!isUuid(dispatchID)) {
    return NextResponse.json({ message: "Missing or invalid dispatchID" }, { status: 400 });
  }

  const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
  if (!assignment) {
    return NextResponse.json({ message: "You are not assigned to this delivery." }, { status: 403 });
  }

  try {
    return NextResponse.json(
      { issues: await openIssuesOn(dispatchID) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Crew issues] Could not read them:", error);
    return NextResponse.json({ message: "Could not read what was reported" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, CREW_ROLES);
  if (response) return response;

  let body: { dispatchID?: unknown; incidentID?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { dispatchID, incidentID } = body;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  if (!isUuid(dispatchID) || !isUuid(incidentID)) {
    return NextResponse.json({ message: "Missing or invalid dispatchID or incidentID" }, { status: 400 });
  }

  const assignment = await getCrewAssignment(dispatchID, auth.employee.employeeID);
  if (!assignment) {
    return NextResponse.json(
      { message: "Only the assigned driver or helper can clear a report on this delivery." },
      { status: 403 },
    );
  }

  try {
    const { issueType } = await markIssueSorted(
      incidentID,
      dispatchID,
      { employeeID: auth.employee.employeeID, employeeName: auth.employee.employeeName },
      note,
    );

    await recordAudit({
      table: "FoulTripIncident",
      recordID: incidentID,
      action: "ISSUE_SORTED",
      actor: auditActor(auth),
      before: { status: "open" },
      after: { status: "resolved", dispatchID, issueType, note },
    });

    // The office were told when it was reported, so they are told when it
    // stops being true. Quietly - nothing needs doing about it, and an alert
    // that says "nothing to do" teaches people to skip the ones that mean it.
    await notify({
      event: "DELIVERY_ISSUE_SORTED",
      title: `Sorted: ${issueType}`,
      body:
        `${auth.employee.employeeName} says the ${issueType.toLowerCase()} on ` +
        `${(await tripLabel(dispatchID)) ?? "a delivery"} is sorted.` +
        (note ? ` ${note}` : "") +
        " The delivery is carrying on.",
      severity: "info",
      roles: OFFICE,
      entity: { table: "DispatchOrder", id: dispatchID },
      link: "/admindashboard/feeds/foul-trip",
      actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
    });

    return NextResponse.json({ message: "Marked as sorted. The office has been told." });
  } catch (error) {
    if (error instanceof FoulTripError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("[Crew issues] Could not clear it:", error);
    return NextResponse.json({ message: "Could not record that. Try again." }, { status: 500 });
  }
}
