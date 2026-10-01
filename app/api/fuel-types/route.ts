import { NextResponse } from "next/server";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import {
  createFuelType,
  FuelTypeError,
  listFuelTypes,
  listFuelTypesWithUsage,
} from "@/services/fleet/fuelTypeService";

// The fuels a truck can burn.
//
// Readable by anyone signed in, because the truck form needs it to draw a
// dropdown. Changing the list is a fleet decision, so writing is fleet roles.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await authorize(request);
  if (response) return response;

  const params = new URL(request.url).searchParams;

  try {
    // The management screen wants retired fuels and a count of what uses each;
    // a form wants only what it may offer.
    const data = params.get("usage") === "true" ? await listFuelTypesWithUsage() : await listFuelTypes();
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FuelTypeError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("GET fuel types error:", error);
    return NextResponse.json({ message: "Could not load the fuel types" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid or empty JSON body" }, { status: 400 });
  }

  const { name, unit, sortOrder } = (body ?? {}) as Record<string, unknown>;

  try {
    const data = await createFuelType({ name, unit, sortOrder });
    return NextResponse.json({ message: `"${data.name}" added.`, data }, { status: 201 });
  } catch (error) {
    if (error instanceof FuelTypeError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("POST fuel type error:", error);
    return NextResponse.json({ message: "Could not add the fuel type" }, { status: 500 });
  }
}
