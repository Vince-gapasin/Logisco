import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { ClientReportError, resolveClientReport } from "@/services/feedback/clientReportService";

// The office resolving a client's report: { note, change? }. The note is the
// reply the client reads on their tracking page, so it is required. `change` is
// set when someone deliberately rewrites the reply from the resolved list.

export async function POST(request: Request, { params }: { params: Promise<{ reportID: string }> }) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { reportID } = await params;
  let body: { note?: unknown; change?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.slice(0, 1000) : "";

  try {
    const { before, orderID } = await resolveClientReport({
      reportID,
      note,
      resolverID: auth.employee.employeeID,
      allowChange: body.change === true,
    });

    // Against the booking, so it shows in that booking's history beside the rest.
    await recordAudit({
      table: "Order",
      recordID: orderID,
      action: "CLIENT_REPORT_RESOLVED",
      actor: auditActor(auth),
      before,
      after: { reportID, status: "resolved", resolutionNote: note.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ClientReportError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("[Client reports] Resolve failed:", error);
    return NextResponse.json({ message: "Could not resolve the report" }, { status: 500 });
  }
}
