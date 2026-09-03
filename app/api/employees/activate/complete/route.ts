import { NextResponse } from "next/server";

import { requireAuth } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";

const TABLE = "Employee";

export async function POST(request: Request) {
  try {
    // ==========================================
    // 1. VERIFY AUTHENTICATED USER
    // ==========================================

    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        {
          message: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    // ==========================================
    // 2. GET AUTH USER
    // ==========================================

    const authUser = auth.user;

    if (!authUser?.id) {
      return NextResponse.json(
        {
          message: "Authenticated user not found",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================
    // 3. FIND EMPLOYEE USING AUTH ID
    // ==========================================

    const {
      data: employee,
      error: employeeError,
    } = await supabase
      .from(TABLE)
      .select("*")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (employeeError) {
      console.error(
        "Find employee error:",
        employeeError
      );

      return NextResponse.json(
        {
          message: "Failed to find employee account",
        },
        {
          status: 500,
        }
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          message: "Employee account not found",
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================
    // 4. ACTIVATE EMPLOYEE
    // ==========================================

    const {
      data: updatedEmployee,
      error: updateError,
    } = await supabase
      .from(TABLE)
      .update({
        isActive: true,
      })
      .eq(
        "employeeID",
        employee.employeeID
      )
      .select()
      .single();

    if (updateError) {
      console.error(
        "Activate employee error:",
        updateError
      );

      return NextResponse.json(
        {
          message:
            "Failed to activate employee account",
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // 5. SUCCESS
    // ==========================================

    return NextResponse.json(
      {
        message:
          "Employee account activated successfully",

        data: updatedEmployee,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Complete activation error:",
      error
    );

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to complete activation",
      },
      {
        status: 500,
      }
    );
  }
}