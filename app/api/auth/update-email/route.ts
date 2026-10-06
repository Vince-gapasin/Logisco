import { NextResponse } from "next/server";
import { authorize, verifyCurrentPassword } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import {
  createEmailChangeToken,
  EMAIL_CHANGE_VALID_FOR_MS,
} from "@/app/lib/emailChangeToken";
import {
  sendEmailChangeConfirmation,
  sendEmailChangeNotice,
} from "@/services/email/emailChangeEmail";
import { emailIsConfigured } from "@/services/email/emailService";
import { auditActor, recordAudit } from "@/services/audit/auditService";

// Asking to change the address you sign in with.
//
// This used to do it. It called updateUserById with email_confirm: true, which
// marks an address confirmed without anybody proving they can read it - so a
// typo moved the account to a mailbox that may not exist, or to a stranger's,
// and there was no way back, because signing in to fix it needs the address you
// can no longer read.
//
// Now it only asks. The link that completes it goes to the new address, and
// reading the link is the proof. The account is untouched until then.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Where the confirmation link points. Not the address the request came in on
// outside development: the caller picks that, and a link in an email should
// only ever lead to this site. APP_URL is what the activation and reset emails
// use; NEXT_PUBLIC_SITE_URL is kept for deployments that set only that.
function siteUrl(request: Request): string | null {
  const configured = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL)?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return process.env.NODE_ENV !== "production" ? new URL(request.url).origin : null;
}

export async function POST(request: Request) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  let body: { newEmail?: unknown; currentPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const currentEmail = auth.user.email?.toLowerCase() ?? "";

  if (!EMAIL_PATTERN.test(newEmail)) {
    return NextResponse.json({ message: "A valid new email is required" }, { status: 400 });
  }
  if (!currentPassword) {
    return NextResponse.json(
      { message: "Your current password is required to change your email" },
      { status: 400 },
    );
  }
  if (newEmail === currentEmail) {
    return NextResponse.json({ message: "That is already your email address" }, { status: 400 });
  }

  // Without mail there is no way to prove the address, and quietly changing it
  // anyway is the behaviour this replaced. Said plainly rather than failing
  // somewhere further in.
  if (!emailIsConfigured()) {
    return NextResponse.json(
      { message: "Email is not set up on this system, so an address cannot be confirmed. Ask an administrator." },
      { status: 503 },
    );
  }

  const site = siteUrl(request);
  if (!site) {
    console.error("Email change: APP_URL is not set, so no confirmation link can be sent.");
    return NextResponse.json(
      { message: "Email changes are not set up on this server. Ask an administrator." },
      { status: 503 },
    );
  }

  try {
    // A stolen session token alone must not be enough to move the account.
    if (!(await verifyCurrentPassword(auth.user.email, currentPassword))) {
      return NextResponse.json({ message: "Current password is incorrect" }, { status: 403 });
    }

    // Checked before anything is sent, so somebody cannot learn which addresses
    // are registered by watching which ones produce a confirmation email.
    const { data: taken, error: lookupError } = await supabase
      .from("Employee")
      .select("employeeID")
      .ilike("emailAddress", newEmail)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);
    if (taken && taken.employeeID !== auth.employee.employeeID) {
      return NextResponse.json({ message: "That email address is already in use" }, { status: 409 });
    }

    const token = createEmailChangeToken({
      employeeID: auth.employee.employeeID,
      newEmail,
      // Pins the request to the address it was made from, so a link left over
      // from an earlier change cannot be opened after a later one.
      fromEmail: currentEmail,
    });

    const confirmUrl = `${site}/api/auth/confirm-email-change?token=${encodeURIComponent(token)}`;

    const sent = await sendEmailChangeConfirmation({
      to: newEmail,
      name: auth.employee.employeeName,
      confirmUrl,
      validForMinutes: Math.round(EMAIL_CHANGE_VALID_FOR_MS / 60_000),
    });

    if (!sent) {
      return NextResponse.json(
        { message: "The confirmation email could not be sent. Nothing has changed - try again shortly." },
        { status: 502 },
      );
    }

    // The address being left behind is told, because it is the only way its
    // owner finds out if it was not them who asked. Best-effort: the change is
    // already pending and failing it here would help nobody.
    if (currentEmail) {
      await sendEmailChangeNotice({
        to: currentEmail,
        name: auth.employee.employeeName,
        newEmail,
      });
    }

    await recordAudit({
      table: "Employee",
      recordID: auth.employee.employeeID,
      action: "EMAIL_CHANGE_REQUESTED",
      actor: auditActor(auth),
      before: { emailAddress: currentEmail },
      after: { requestedEmail: newEmail, confirmed: false },
    });

    return NextResponse.json(
      {
        message: `Check ${newEmail} for a confirmation link. Your current address signs you in until you open it.`,
        pending: true,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Update email error:", error);
    return NextResponse.json({ message: "Failed to request the email change" }, { status: 500 });
  }
}
