import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { isValidPhone, PHONE_RULE } from "@/app/lib/bookingRules";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { createSubconTrip, listSubconTrips, SubconError } from "@/services/subcon/subconService";
import { notify, OFFICE } from "@/services/notifications/notify";

// Partner trips, which the coordinator updates on the partner's behalf.

export async function GET(request: Request) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const scope = new URL(request.url).searchParams.get("scope") === "recent" ? "recent" : "active";
  try {
    return NextResponse.json({ data: await listSubconTrips(scope) });
  } catch (error) {
    console.error("[Sub-con trips] list failed:", error);
    return NextResponse.json({ message: "Failed to load sub-contractor trips" }, { status: 500 });
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const createSchema = z.object({
  orderID: z.string().uuid(),
  subConID: z.string().uuid("Choose the sub-contractor"),
  driverName: optionalText(120),
  plateNumber: optionalText(20),
  contactNumber: optionalText(20).refine((value) => !value || isValidPhone(value), PHONE_RULE),
  helpers: z.array(z.string().trim().min(1).max(120)).max(2).optional(),
});

/** Hand a booking to a partner. */
export async function POST(request: Request) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    const { orderID, ...choice } = parsed.data;
    const result = await createSubconTrip(orderID, choice, {
      employeeID: auth.employee.employeeID,
      employeeName: auth.employee.employeeName,
    });
    await recordAudit({
      table: "DispatchOrder",
      recordID: result.dispatchID,
      action: "SUBCON_ASSIGN",
      actor: auditActor(auth),
      after: { orderID, ...choice, replacedTrips: result.replaced },
    });
    await notify({
      event: "SUBCON_ASSIGNED",
      title: "Booking handed to a partner",
      body: `${result.partner} is carrying a booking. Record their pickup and deliveries under Reports > Sub-con Trips.`,
      severity: "info",
      roles: OFFICE,
      entity: { table: "DispatchOrder", id: result.dispatchID },
      link: "/admindashboard/reports",
      actor: { employeeID: auth.employee.employeeID, name: auth.employee.employeeName },
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof SubconError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("[Sub-con trips] create failed:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to hand the booking to the partner" }, { status: 500 });
  }
}
