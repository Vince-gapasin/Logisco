import { NextResponse } from "next/server";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import {
  announceTruckStatus,
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

    // The same announcement the breakdown path makes, rather than a second copy
    // of it here. This one also used to fire on any change at all - an admin
    // setting a truck to On Delivery told every mechanic "Truck back in service"
    // - where the shared one speaks only when a truck leaves the road or returns
    // to it.
    const status = (payload as { truckStatus?: string }).truckStatus;
    if (status && before) {
      // Why, when whoever changed it said why. It becomes the report that opens
      // the maintenance log, which is what an office override actually is: not
      // an account of the work, but of the decision to take the truck off the
      // road before anybody had looked at it.
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";

      await announceTruckStatus(
        id,
        before.truckStatus as string | undefined,
        status,
        { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
        reason || null,
      );
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
