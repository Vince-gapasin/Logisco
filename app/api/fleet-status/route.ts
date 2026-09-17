import { NextResponse } from "next/server";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import {
  createFleetTruck,
  getFleet,
  toTruckPayload,
  validateTruckPayload,
} from "@/services/truck/truckService";

export async function GET(request: Request) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  try {
    const data = await getFleet();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET fleet error:", error);
    return NextResponse.json({ message: "Failed to fetch trucks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { auth, response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const payload = toTruckPayload(body);
  const validationError = validateTruckPayload(payload, true);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    const truck = await createFleetTruck(payload);

    await recordAudit({
      table: "Truck",
      recordID: (truck as { truckID?: string } | null)?.truckID,
      action: "CREATE",
      actor: auditActor(auth),
      after: payload,
    });

    return NextResponse.json(truck, { status: 201 });
  } catch (error) {
    console.error("POST truck error:", error);
    const isDuplicate = (error as { code?: string })?.code === "23505";
    return NextResponse.json(
      { message: isDuplicate ? "A truck with this plate number or code already exists" : "Failed to create truck" },
      { status: isDuplicate ? 409 : 500 },
    );
  }
}
