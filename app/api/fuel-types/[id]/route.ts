import { NextResponse } from "next/server";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import { FuelTypeError, retireFuelType, updateFuelType } from "@/services/fleet/fuelTypeService";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid or empty JSON body" }, { status: 400 });
  }

  const { name, unit, isActive, sortOrder } = (body ?? {}) as Record<string, unknown>;

  try {
    const data = await updateFuelType((await params).id, { name, unit, isActive, sortOrder });
    return NextResponse.json({ message: "Saved.", data });
  } catch (error) {
    if (error instanceof FuelTypeError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("PATCH fuel type error:", error);
    return NextResponse.json({ message: "Could not save the fuel type" }, { status: 500 });
  }
}

/**
 * Retires a fuel, or removes it when nothing has ever used it.
 *
 * Never blanks the fuel on a fleet of trucks: see retireFuelType.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  try {
    const { deleted } = await retireFuelType((await params).id);
    return NextResponse.json({
      message: deleted
        ? "Removed."
        : "Retired. Trucks and prices that already use it keep it; it is no longer offered for new ones.",
    });
  } catch (error) {
    if (error instanceof FuelTypeError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("DELETE fuel type error:", error);
    return NextResponse.json({ message: "Could not retire the fuel type" }, { status: 500 });
  }
}
