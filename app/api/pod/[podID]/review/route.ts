import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { reviewProof, ReviewError, type ReviewDecision } from "@/services/storage/podReviewService";

// The office's decision on one proof: { decision: "approved" | "rejected",
// note, change? }. A rejection needs a note. `change` is set when a reviewer
// deliberately reverses an earlier decision from the reviewed list.

export async function POST(request: Request, { params }: { params: Promise<{ podID: string }> }) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { podID } = await params;
  let body: { decision?: unknown; note?: unknown; change?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ message: "Choose approve or reject" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 1000) : "";

  try {
    const { before, dispatchID } = await reviewProof({
      podID,
      decision: decision as ReviewDecision,
      note,
      reviewerID: auth.employee.employeeID,
      allowChange: body.change === true,
    });

    // Against the trip, so it shows in that booking's history beside the rest.
    await recordAudit({
      table: "DispatchOrder",
      recordID: dispatchID,
      action: "POD_REVIEW",
      actor: auditActor(auth),
      before,
      after: { podID, reviewStatus: decision, reviewNote: note.trim() || null },
    });

    return NextResponse.json({ success: true, reviewStatus: decision });
  } catch (error) {
    if (error instanceof ReviewError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("[POD review] Decision failed:", error);
    return NextResponse.json({ message: "Could not save the review" }, { status: 500 });
  }
}
