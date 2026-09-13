import { NextResponse } from "next/server";
// EMPLOYEE_LOGIN_ACCESS_V1

import { requireAuth } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

const TABLE = "Employee";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const authUser = auth.user;
    if (!authUser?.id) {
      return NextResponse.json(
        { message: "Authenticated user not found" },
        { status: 401 },
      );
    }

    const { data: updatedEmployee, error: updateError } = await supabase
      .from(TABLE)
      .update({
        isActive: true,
        activation_completed_at: new Date().toISOString(),
      })
      .eq("auth_id", authUser.id)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error("Complete employee activation error:", updateError);
      return NextResponse.json(
        { message: "Failed to activate employee login access" },
        { status: 500 },
      );
    }

    if (!updatedEmployee) {
      return NextResponse.json(
        { message: "Employee account not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        message: "Employee login access activated successfully",
        data: updatedEmployee,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Complete activation error:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to complete activation",
      },
      { status: 500 },
    );
  }
}
