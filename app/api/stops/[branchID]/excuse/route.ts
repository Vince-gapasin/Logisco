import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import {
  excuseStopDelay,
  ExcuseError,
  revokeStopDelayExcuse,
} from "@/services/employee/delayExcuseService";

// A late stop the office accepts was not the crew's doing.
//
// Office roles only, and audited both ways. The grant is the one part of the
// performance feature that can be leaned on - it is the button that makes a bad
// figure better - so who used it and why is on the record, and every grant shows
// up on the employee's own screen where they and their supervisor can see it.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ branchID: string }> };

function stopIDFrom(raw: string): number | null {
  const branchID = Number(raw);
  return Number.isInteger(branchID) && branchID > 0 ? branchID : null;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const branchID = stopIDFrom((await params).branchID);
  if (branchID === null) {
    return NextResponse.json({ message: "Invalid stop" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid or empty JSON body" }, { status: 400 });
  }

  const { reason, notes } = (body ?? {}) as { reason?: unknown; notes?: unknown };

  try {
    const excuse = await excuseStopDelay(branchID, { reason, notes }, { employeeID: auth!.employee.employeeID });

    await recordAudit({
      table: "StopDelayExcuse",
      recordID: String(branchID),
      action: "CREATE",
      actor: auditActor(auth),
      after: { reason: excuse.reason, notes: excuse.notes },
    });

    return NextResponse.json({ message: "This delay no longer counts against the crew.", data: excuse });
  } catch (error) {
    if (error instanceof ExcuseError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("POST stop delay excuse error:", error);
    return NextResponse.json({ message: "Could not excuse the delay" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const branchID = stopIDFrom((await params).branchID);
  if (branchID === null) {
    return NextResponse.json({ message: "Invalid stop" }, { status: 400 });
  }

  try {
    await revokeStopDelayExcuse(branchID);

    await recordAudit({
      table: "StopDelayExcuse",
      recordID: String(branchID),
      action: "DELETE",
      actor: auditActor(auth),
    });

    return NextResponse.json({ message: "This delay counts again." });
  } catch (error) {
    if (error instanceof ExcuseError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("DELETE stop delay excuse error:", error);
    return NextResponse.json({ message: "Could not undo the excuse" }, { status: 500 });
  }
}
