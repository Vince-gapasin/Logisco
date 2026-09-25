import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { assignDispatch, reassignDispatch } from "@/services/dispatch/dispatchService";
import { assignDispatchSchema } from "@/app/schemas/dispatch/dispatch.schema";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { crewOf, notify, tripLabel } from "@/services/notifications/notify";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });

    const { id } = await params;
    const body = await request.json();

    const validation = assignDispatchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ message: "Validation failed", errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dispatch = await assignDispatch(id, validation.data);

    await recordAudit({
      table: "DispatchOrder",
      recordID: dispatch?.dispatchID,
      action: "ASSIGN",
      actor: auditActor(auth),
      after: { orderID: id, ...validation.data },
    });

    await notify({
      event: "CREW_ASSIGNED",
      title: "New delivery assignment",
      body: `New assignment for ${(await tripLabel(dispatch?.dispatchID)) ?? "a delivery"}. Open it to accept or decline.`,
      severity: "action",
      employeeIDs: [validation.data.driverID, validation.data.helper1ID, validation.data.helper2ID],
      entity: { table: "DispatchOrder", id: dispatch?.dispatchID },
      link: "/crew/dashboard",
      actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
    });

    return NextResponse.json({ message: "Crew and Truck successfully assigned.", data: dispatch }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Internal Server Error" }, { status: 400 });
  }
}

// Re-assign an existing dispatch that has not departed yet. [id] is the
// dispatchID here, not the orderID used by POST.
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });

    const { id } = await params;
    const body = await request.json();

    const validation = assignDispatchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ message: "Validation failed", errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    // Read before the change, so whoever is dropped can be told.
    const previousCrew = await crewOf(id);
    const dispatch = await reassignDispatch(id, validation.data);

    await recordAudit({
      table: "DispatchOrder",
      recordID: id,
      action: "REASSIGN",
      actor: auditActor(auth),
      after: validation.data,
    });

    const newCrew = [validation.data.driverID, validation.data.helper1ID, validation.data.helper2ID].filter(
      (employeeID): employeeID is string => Boolean(employeeID),
    );
    await notify({
      event: "CREW_ASSIGNED",
      title: "New delivery assignment",
      body: `New assignment for ${(await tripLabel(id)) ?? "a delivery"}. Open it to accept or decline.`,
      severity: "action",
      employeeIDs: newCrew,
      entity: { table: "DispatchOrder", id },
      link: "/crew/dashboard",
      actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
    });
    await notify({
      event: "CREW_REMOVED",
      title: "You are off a delivery",
      body: `${(await tripLabel(id)) ?? "A delivery"} you were assigned to has been given to another crew.`,
      severity: "info",
      employeeIDs: previousCrew.filter((employeeID) => !newCrew.includes(employeeID)),
      entity: { table: "DispatchOrder", id },
      link: "/crew/dashboard",
      actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
    });

    return NextResponse.json({ message: "Crew and truck updated. Confirmation has been reset.", data: dispatch }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Internal Server Error" }, { status: 400 });
  }
}