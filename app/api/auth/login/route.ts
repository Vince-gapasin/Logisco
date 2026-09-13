// LOGISCO_SESSION_SECURITY_V2

import { NextResponse } from "next/server";

import { supabase } from "@/app/lib/supabase";
import { supabaseAuth } from "@/app/lib/supabaseAuth";
import { getHomeRoute, normalizeRole } from "@/app/lib/routeAccess";

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

    const { data: authData, error: authError } =
      await supabaseAuth.auth.signInWithPassword({ email, password });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 },
      );
    }

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
