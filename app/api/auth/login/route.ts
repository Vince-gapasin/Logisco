import { NextResponse } from "next/server";

import { supabaseAuth } from "@/app/lib/supabaseAuth";
import { supabase } from "@/app/lib/supabase";

export async function POST(request: Request) {
  try {
    let body: {
      email?: string;
      password?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          message: "Invalid or empty JSON body",
        },
        { status: 400 }
      );
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        {
          message: "Email and password are required",
        },
        { status: 400 }
      );
    }

    // Authenticate user with Supabase Auth
    const {
      data: authData,
      error: authError,
    } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json(
        {
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    // Find employee connected to this auth user
    const {
      data: employee,
      error: employeeError,
    } = await supabase
      .from("Employee")
      .select(
        `
        employeeID,
        employeeName,
        emailAddress,
        role,
        auth_id,
        isActive
        `
      )
      .eq("auth_id", authData.user.id)
      .maybeSingle();

    if (employeeError) {
      console.error(
        "Employee lookup error:",
        employeeError
      );

      return NextResponse.json(
        {
          message: "Failed to retrieve employee information",
        },
        { status: 500 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          message:
            "No employee account is linked to this user",
        },
        { status: 404 }
      );
    }

    if (employee.isActive === false) {
      return NextResponse.json(
        {
          message: "Employee account is inactive",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        email: authData.user.email,
        role: employee.role,

        token:
          authData.session.access_token,

        employeeId:
          employee.employeeID,

        employeeName:
          employee.employeeName,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Login API error:", error);

    return NextResponse.json(
      {
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}