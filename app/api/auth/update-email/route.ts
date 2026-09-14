import { NextResponse } from "next/server";
import { authorize, verifyCurrentPassword } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!EMAIL_PATTERN.test(newEmail)) {
    return NextResponse.json({ message: "A valid new email is required" }, { status: 400 });
  }
  if (!currentPassword) {
    return NextResponse.json({ message: "Your current password is required to change your email" }, { status: 400 });
  }
  if (newEmail === auth.user.email?.toLowerCase()) {
    return NextResponse.json({ message: "That is already your email address" }, { status: 400 });
  }

  try {
    // A stolen session token alone must not be enough to move the account.
    if (!(await verifyCurrentPassword(auth.user.email, currentPassword))) {
      return NextResponse.json({ message: "Current password is incorrect" }, { status: 403 });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(auth.user.id, {
      email: newEmail,
      email_confirm: true,
    });

    if (updateError) {
      const alreadyUsed = /already (been )?registered|already exists/i.test(updateError.message);
      return NextResponse.json(
        { message: alreadyUsed ? "That email address is already in use" : "Failed to update email" },
        { status: alreadyUsed ? 409 : 500 },
      );
    }

    // Keep the employee profile in sync with the login email.
    const { error: dbError } = await supabase
      .from("Employee")
      .update({ emailAddress: newEmail })
      .eq("employeeID", auth.employee.employeeID);

    if (dbError) {
      console.error("Failed to sync employee email:", dbError.message);
      return NextResponse.json(
        { message: "Login email updated, but the profile email could not be synced. Please contact an admin." },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Email updated successfully!" }, { status: 200 });
  } catch (error) {
    console.error("Update email error:", error);
    return NextResponse.json({ message: "Failed to update email" }, { status: 500 });
  }
}
