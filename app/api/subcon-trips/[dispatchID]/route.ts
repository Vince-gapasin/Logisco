import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { isUuid } from "@/services/dispatch/dispatchService";
import { notify, OFFICE, tripLabel } from "@/services/notifications/notify";
import {
  getSubconTrip,
  recordDelivery,
  recordPickup,
  reportProblem,
  SubconError,
} from "@/services/subcon/subconService";

type RouteContext = { params: Promise<{ dispatchID: string }> };

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

export async function GET(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { dispatchID } = await params;
  if (!isUuid(dispatchID)) return NextResponse.json({ message: "Invalid trip ID" }, { status: 400 });

  try {
    return NextResponse.json({ data: await getSubconTrip(dispatchID) });
  } catch (error) {
    if (error instanceof SubconError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("[Sub-con trip] read failed:", error);
    return NextResponse.json({ message: "Failed to load the trip" }, { status: 500 });
  }
}

/**
 * What the partner reported, recorded by the coordinator. Multipart, because
 * a delivery carries the partner's proof: action = pickup | deliver | problem.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { dispatchID } = await params;
  if (!isUuid(dispatchID)) return NextResponse.json({ message: "Invalid trip ID" }, { status: 400 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Send the update as a form." }, { status: 400 });
  }

  const actor = { employeeID: auth.employee.employeeID, employeeName: auth.employee.employeeName };
  const action = text(form, "action");

  try {
    let result: Record<string, unknown>;
    switch (action) {
      case "pickup":
        result = await recordPickup(dispatchID, text(form, "at") || null);
        break;
      case "deliver": {
        const branchID = Number(text(form, "branchID"));
        if (!Number.isInteger(branchID)) return NextResponse.json({ message: "Choose the stop." }, { status: 400 });
        const file = form.get("proof");
        result = await recordDelivery(
          dispatchID,
          {
            branchID,
            file: file instanceof File ? file : null,
            missingReason: text(form, "missingReason") || null,
            receiverName: text(form, "receiverName") || null,
            deliveredAt: text(form, "deliveredAt") || null,
            remarks: text(form, "remarks") || null,
          },
          actor,
        );
        break;
      }
      case "problem":
        result = await reportProblem(dispatchID, { issueType: text(form, "issueType"), details: text(form, "details") || null }, actor);
        break;
      default:
        return NextResponse.json({ message: "Unknown update." }, { status: 400 });
    }

    await recordAudit({
      table: "DispatchOrder",
      recordID: dispatchID,
      action: `SUBCON_${action.toUpperCase()}`,
      actor: auditActor(auth),
      after: result,
    });
    if (action === "deliver" && (result as { completed?: boolean }).completed) {
      await notify({
        event: "TRIP_COMPLETED",
        title: "Partner delivery completed",
        body: `${(await tripLabel(dispatchID)) ?? "A partner booking"} has been delivered in full.`,
        severity: "info",
        roles: OFFICE,
        entity: { table: "DispatchOrder", id: dispatchID },
        link: "/admindashboard/feeds/completed",
        actor,
      });
    } else if (action === "problem") {
      await notify({
        event: "FOUL_TRIP_REPORTED",
        title: `Partner reported: ${(result as { issueType?: string }).issueType ?? "a problem"}`,
        body: `${(await tripLabel(dispatchID)) ?? "A partner booking"} could not continue. It needs recovery.`,
        severity: "urgent",
        roles: OFFICE,
        entity: { table: "DispatchOrder", id: dispatchID },
        link: "/admindashboard/feeds/foul-trip",
        actor,
      });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof SubconError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error(`[Sub-con trip] ${action} failed:`, error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to record the update" }, { status: 500 });
  }
}
