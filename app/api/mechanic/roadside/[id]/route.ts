import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/app/lib/auth";
import { EMPLOYEE_ROLE } from "@/app/lib/enums";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { isUuid } from "@/services/dispatch/dispatchService";
import { FoulTripError, mechanicReport } from "@/services/foulTrip/foulTripService";

type RouteContext = { params: Promise<{ id: string }> };

const reportSchema = z.object({
  outcome: z.enum(["fixed", "not_fixable"]),
  notes: z.string().trim().max(1000).optional(),
});

// POST /api/mechanic/roadside/:incidentID - the verdict from the site.
export async function POST(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, [EMPLOYEE_ROLE.mechanic]);
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: "Invalid job ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    const result = await mechanicReport(id, auth.employee.employeeID, parsed.data);
    await recordAudit({
      table: "FoulTripIncident",
      recordID: id,
      action: "FOUL_TRIP_MECHANIC_REPORT",
      actor: auditActor(auth),
      after: { ...parsed.data, ...result },
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof FoulTripError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("[Roadside] report failed:", error);
    return NextResponse.json({ message: "Failed to record the report" }, { status: 500 });
  }
}
