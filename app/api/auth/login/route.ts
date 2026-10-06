// LOGISCO_SESSION_SECURITY_V2

import { NextResponse } from "next/server";

import { supabase } from "@/app/lib/supabase";
import { supabaseAuth } from "@/app/lib/supabaseAuth";
import { getHomeRoute, normalizeRole } from "@/app/lib/routeAccess";
import {
  clearFailedSignIns,
  recordFailedSignIn,
  signInIsLocked,
} from "@/services/auth/loginThrottleService";

export async function POST(request: Request) {
  try {
    let body: { email?: string; password?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Invalid or empty JSON body" },
        { status: 400 },
      );
    }

    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 },
      );
    }

    // Checked before the password, so a locked account answers the same
    // whether or not the guess was right - otherwise the lock would still let
    // someone learn the password, just more slowly.
    if (await signInIsLocked(email)) {
      return NextResponse.json(
        { message: "Too many failed sign-ins. Wait 15 minutes, or reset your password." },
        { status: 429 },
      );
    }

    const { data: authData, error: authError } =
      await supabaseAuth.auth.signInWithPassword({ email, password });

    if (authError || !authData.user || !authData.session) {
      await recordFailedSignIn(email);
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 },
      );
    }

    await clearFailedSignIns(email);

    const { data: employee, error: employeeError } = await supabase
      .from("Employee")
      .select(
        "employeeID,employeeName,emailAddress,role,auth_id,isActive,activation_completed_at",
      )
      .eq("auth_id", authData.user.id)
      .maybeSingle();

    if (employeeError) {
      console.error("Employee lookup error:", employeeError);
      return NextResponse.json(
        { message: "Failed to retrieve employee information" },
        { status: 500 },
      );
    }

    if (!employee) {
      return NextResponse.json(
        { message: "No employee account is linked to this user" },
        { status: 404 },
      );
    }

    if (employee.isActive === false) {
      return NextResponse.json(
        { message: "Employee account is inactive" },
        { status: 403 },
      );
    }

    if (!employee.activation_completed_at) {
      return NextResponse.json(
        { message: "Employee login access has not been activated" },
        { status: 403 },
      );
    }

    // The profile follows the login address, repaired here rather than relied on
    // elsewhere.
    //
    // The two can drift: confirming an email change updates the auth account
    // first and the Employee row second, and that second write can fail. They
    // also drifted under the old change-email route, which updated both and
    // reported a 500 telling the user to find an administrator. Signing in is
    // the one moment both values are certainly in hand, so it is where they are
    // put back together.
    const signedInWith = authData.user.email?.toLowerCase() ?? "";
    if (signedInWith && (employee.emailAddress ?? "").toLowerCase() !== signedInWith) {
      const { error: syncError } = await supabase
        .from("Employee")
        .update({ emailAddress: signedInWith })
        .eq("employeeID", employee.employeeID);

      // Never fails the sign-in. The address they just authenticated with is
      // correct whether or not the profile caught up.
      if (syncError) console.error("[Login] Profile email not synced:", syncError.message);
    }

    const role = normalizeRole(employee.role);

    if (!role) {
      return NextResponse.json(
        { message: "Employee role is not authorized" },
        { status: 403 },
      );
    }

    const response = NextResponse.json(
      {
        email: authData.user.email,
        role,
        token: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        accessTokenExpiresAt: authData.session.expires_at ?? null,
        employeeId: employee.employeeID,
        employeeName: employee.employeeName,
        route: getHomeRoute(role),
      },
      { status: 200 },
    );

    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
