import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { isUuid } from "@/services/dispatch/dispatchService";
import { auditActor, recordAudit } from "@/services/audit/auditService";
import { sendBookingTrackingLink, trackingRecipient } from "@/services/email/bookingEmail";

// Who the link would go to, so a screen can say so before sending.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: "Invalid booking ID" }, { status: 400 });

  try {
    const recipient = await trackingRecipient(id);
    if (!recipient) return NextResponse.json({ message: "Booking not found" }, { status: 404 });
    return NextResponse.json({ data: { email: recipient.email, reason: recipient.reason } });
  } catch (error) {
    console.error("GET tracking recipient error:", error);
    return NextResponse.json({ message: "Failed to read the booking" }, { status: 500 });
  }
}

/** Sends the tracking link again - a client who never received it, or a corrected address. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { auth, response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: "Invalid booking ID" }, { status: 400 });

  const result = await sendBookingTrackingLink(id);
  if (!result.sent) {
    return NextResponse.json({ message: result.reason ?? "The tracking link was not sent." }, { status: 400 });
  }

  await recordAudit({
    table: "Order",
    recordID: id,
    action: "TRACKING_EMAIL_SENT",
    actor: auditActor(auth),
    after: { to: result.email },
  });

  return NextResponse.json({ data: result });
}
