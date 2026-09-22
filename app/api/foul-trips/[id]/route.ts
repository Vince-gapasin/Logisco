import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { isValidPhone, PHONE_RULE } from "@/app/lib/bookingRules";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { isUuid } from "@/services/dispatch/dispatchService";
import {
  cancel,
  close,
  FoulTripError,
  reassign,
  sendMechanic,
  subcontract,
} from "@/services/foulTrip/foulTripService";

type RouteContext = { params: Promise<{ id: string }> };

const uuid = z.string().uuid();
// Selects send "" for "none chosen".
const optionalUuid = z
  .union([z.string().uuid(), z.literal("")])
  .optional()
  .transform((value) => value || undefined);
const crew = { truckID: uuid, driverID: uuid, helper1ID: optionalUuid, helper2ID: optionalUuid };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reassign"), ...crew }),
  z.object({
    action: z.literal("reschedule"),
    ...crew,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    time: z
      .union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")])
      .optional()
      .transform((value) => value || undefined),
  }),
  z.object({
    action: z.literal("subcontract"),
    subConID: uuid,
    driverName: z.string().trim().min(2, "Enter the partner driver's name").max(120),
    plateNumber: z.string().trim().min(2, "Enter the partner truck's plate").max(20),
    contactNumber: z
      .string()
      .trim()
      .max(40)
      .optional()
      .refine((value) => !value || isValidPhone(value), PHONE_RULE),
  }),
  z.object({
    action: z.literal("send_mechanic"),
    mechanicID: uuid,
    severity: z.enum(["minor", "major"]),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3, "Give a reason").max(500) }),
  z.object({ action: z.literal("close"), notes: z.string().trim().min(3, "Say how it was handled").max(1000) }),
]);

// POST /api/foul-trips/:incidentID - what dispatch decided to do about it.
export async function POST(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: "Invalid foul trip ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const input = parsed.data;
  const actor = { employeeID: auth.employee.employeeID, employeeName: auth.employee.employeeName };

  try {
    let result: Record<string, unknown>;
    switch (input.action) {
      case "reassign":
        result = await reassign(id, input, actor);
        break;
      case "reschedule":
        result = await reassign(id, input, actor, { date: input.date, time: input.time ?? null });
        break;
      case "subcontract":
        result = await subcontract(id, input, actor);
        break;
      case "send_mechanic":
        result = await sendMechanic(id, input);
        break;
      case "cancel":
        result = await cancel(id, input.reason, actor);
        break;
      case "close":
        result = await close(id, input.notes, actor);
        break;
    }

    await recordAudit({
      table: "FoulTripIncident",
      recordID: id,
      action: `FOUL_TRIP_${input.action.toUpperCase()}`,
      actor: auditActor(auth),
      after: { ...input, ...result },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof FoulTripError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    // assignDispatch reports a taken truck or crew member as a plain error
    // whose message is written for the person choosing.
    console.error("[Foul trips] action failed:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update the foul trip" },
      { status: 400 },
    );
  }
}
