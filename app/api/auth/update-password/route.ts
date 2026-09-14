import { NextResponse } from "next/server";
import { authorize, verifyCurrentPassword } from "@/app/lib/auth";
import { getPasswordPolicyError } from "@/app/lib/passwordPolicy";
import { supabase } from "@/app/lib/supabase";

export async function POST(request: Request) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: "Current and new password are required" }, { status: 400 });
  }

  const policyError = getPasswordPolicyError(newPassword);
  if (policyError) {
    return NextResponse.json({ message: policyError }, { status: 400 });
  }

  if (newPassword === currentPassword) {
    return NextResponse.json({ message: "New password must be different from the current password" }, { status: 400 });
  }

  try {
    // A stolen session token alone must not be enough to take over the account.
    if (!(await verifyCurrentPassword(auth.user.email, currentPassword))) {
      return NextResponse.json({ message: "Current password is incorrect" }, { status: 403 });
    }

    const { error } = await supabase.auth.admin.updateUserById(auth.user.id, { password: newPassword });
    if (error) throw error;

    // Sign out every other device that was using the old password.
    const token = request.headers.get("authorization")!.substring(7);
    const { error: signOutError } = await supabase.auth.admin.signOut(token, "others");
    if (signOutError) console.error("Failed to revoke other sessions:", signOutError.message);

    return NextResponse.json({ message: "Password updated successfully!" }, { status: 200 });
  } catch (error) {
    console.error("Update password error:", error);
    return NextResponse.json({ message: "Failed to update password" }, { status: 500 });
  }
}
