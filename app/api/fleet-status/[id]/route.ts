import { NextResponse } from "next/server";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import { TRUCK_STATUS } from "@/app/lib/enums";
import {
  announceTruckStatus,
  deleteTruck,
  getCurrentTrip,
  getTruckById,
  restoreTruck,
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
    // Which booking holds it, so the screen can say rather than just "On Delivery".
    const currentTrip = await getCurrentTrip(id);
    return NextResponse.json({ ...truck, currentTrip });
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

  // { restore: true } brings a retired truck back from the archive.
  if (body.restore === true) {
    try {
      const { id } = await params;
      const truck = await restoreTruck(id);
      if (!truck) {
        return NextResponse.json({ message: "Truck not found among the disabled trucks" }, { status: 404 });
      }

      await recordAudit({
        table: "Truck",
        recordID: id,
        action: "RESTORE",
        actor: auditActor(auth),
        after: { isActive: true, truckStatus: truck.truckStatus },
      });

      // Back in the fleet and bookable: told like any truck back in service.
      await announceTruckStatus(id, TRUCK_STATUS.outOfService, truck.truckStatus, {
        employeeID: auth.employee.employeeID,
        name: auth.employee.employeeName,
      });

      return NextResponse.json(truck);
    } catch (error) {
      console.error("RESTORE truck error:", error);
      return NextResponse.json({ message: "Failed to restore truck" }, { status: 500 });
    }
  }

  const payload = toTruckPayload(body);
  const validationError = validateTruckPayload(payload, false);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    const { id } = await params;
    const before = await getTruckById(id);

    // The status is dispatch's while a trip holds the truck. "On Delivery" is
    // only ever set by assigning a trip; and a truck on one cannot be put back
    // to Available or grounded by hand - that is a foul trip, or the booking
    // override, which deal with the trip as well as the truck.
    const status = (payload as { truckStatus?: string }).truckStatus;
    if (status && status !== before?.truckStatus) {
      if (status === TRUCK_STATUS.onDelivery) {
        return NextResponse.json(
          { message: "A truck goes On Delivery when it is assigned to a booking, not by hand." },
          { status: 409 },
        );
      }
      const trip = await getCurrentTrip(id);
      if (trip) {
        return NextResponse.json(
          {
            message: `This truck is on booking ${trip.orderCode ?? ""} (${trip.status}). Its status follows that trip - report a foul trip or use the booking override instead.`,
            currentTrip: trip,
          },
          { status: 409 },
        );
      }
    }

    const truck = await updateTruck(id, payload);

    if (!truck) {
      return NextResponse.json({ message: "Truck not found" }, { status: 404 });
    }

    await recordAudit({
      table: "Truck",
      recordID: id,
      action: "UPDATE",
      actor: auditActor(auth),
      // What each changed field was, so the truck's history can say "from A to
      // B" and not only "set to B". This kept the status and plate alone.
      before: before
        ? Object.fromEntries(
            Object.keys(payload).map((field) => [field, (before as unknown as Record<string, unknown>)[field] ?? null]),
          )
        : null,
      after: { ...payload, ...(typeof body.reason === "string" && body.reason.trim() ? { reason: body.reason.trim() } : {}) },
    });

    // The same announcement the breakdown path makes, rather than a second copy
    // of it here. This one also used to fire on any change at all - an admin
    // setting a truck to On Delivery told every mechanic "Truck back in service"
    // - where the shared one speaks only when a truck leaves the road or returns
    // to it.
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
        // The mechanic's screen saves its inspection log first and then sends
        // the status with logOpened, so grounding does not open a second one.
        { openLog: body.logOpened !== true },
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

    // A truck out on a delivery is carrying somebody's goods; retiring it
    // would strand the trip. It has to come back first.
    const current = await getTruckById(id);
    if (current?.truckStatus === TRUCK_STATUS.onDelivery) {
      return NextResponse.json(
        { message: "This truck is on a delivery. It can be disabled once it is back." },
        { status: 409 },
      );
    }

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
