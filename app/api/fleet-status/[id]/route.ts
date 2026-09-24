import { NextResponse } from "next/server";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { MECHANICS, notify, OFFICE } from "@/services/notifications/notify";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import {
  deleteTruck,
  getTruckById,
  toTruckPayload,
  updateTruck,
  validateTruckPayload,
} from "@/services/truck/truckService";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  try {
    const { id } = await params;
    const truck = await getTruckById(id);

    if (!truck) {
      return NextResponse.json({ message: "Truck not found" }, { status: 404 });
    }
    return NextResponse.json(truck);
  } catch (error) {
    console.error("GET truck error:", error);
    return NextResponse.json({ message: "Failed to fetch truck details" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const payload = toTruckPayload(body);
  const validationError = validateTruckPayload(payload, false);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    const { id } = await params;
    const before = await getTruckById(id);
    const truck = await updateTruck(id, payload);

    if (!truck) {
      return NextResponse.json({ message: "Truck not found" }, { status: 404 });
    }

    await recordAudit({
      table: "Truck",
      recordID: id,
      action: "UPDATE",
      actor: auditActor(auth),
      before: before
        ? { truckStatus: before.truckStatus, plateNumber: before.plateNumber }
        : null,
      after: payload,
    });

    const status = (payload as { truckStatus?: string }).truckStatus;
    if (status && before && status !== before.truckStatus) {
      const grounded = status === "On Maintenance" || status === "Out of Service";
      await notify({
        event: "TRUCK_STATUS_CHANGED",
        title: grounded ? `Truck ${status.toLowerCase()}` : "Truck back in service",
        body: `${before.plateNumber} is now ${status.toLowerCase()}.`,
        severity: grounded ? "action" : "info",
        roles: [...OFFICE, ...MECHANICS],
        entity: { table: "Truck", id },
        link: "/mechanic/fleet-status",
        actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
      });
    }

    return NextResponse.json(truck);
  } catch (error) {
    console.error("PUT truck error:", error);
    const isDuplicate = (error as { code?: string })?.code === "23505";
    return NextResponse.json(
      { message: isDuplicate ? "A truck with this plate number or code already exists" : "Failed to update truck" },
      { status: isDuplicate ? 409 : 500 },
    );
  }
}

// Soft delete: trucks are referenced by dispatches and maintenance logs,
// so the row is deactivated rather than removed.
export async function DELETE(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  try {
    const { id } = await params;
    const truck = await deleteTruck(id);

    if (!truck) {
      return NextResponse.json({ message: "Truck not found" }, { status: 404 });
    }

    await recordAudit({
      table: "Truck",
      recordID: id,
      action: "RETIRE",
      actor: auditActor(auth),
      after: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE truck error:", error);
    return NextResponse.json({ message: "Failed to delete truck" }, { status: 500 });
  }
}
