import { NextResponse } from "next/server";

import {
  requireAuth,
  requireRole,
} from "@/app/lib/auth";

import {
  activateEmployeeAccount,
} from "@/services/employee/employeeService";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    // ==========================================
    // 1. AUTHENTICATE ADMIN
    // ==========================================

    const auth =
      await requireAuth(request);

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
    // 2. ADMIN ONLY
    // ==========================================

    const roleError =
      requireRole(
        auth.employee.role,
        ["Admin"]
      );

    if (roleError) {
      return NextResponse.json(
        {
          message: roleError.error,
        },
        {
          status: roleError.status,
        }
      );
    }

    // ==========================================
    // 3. GET EMPLOYEE ID
    // ==========================================

    const { id } =
      await params;

    if (!id) {
      return NextResponse.json(
        {
          message:
            "Employee ID is required",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // 4. SEND ACTIVATION EMAIL
    // ==========================================
    //
    // IMPORTANT:
    // This does NOT activate the employee.
    //
    // The service:
    // - creates/sends invitation
    // - stores auth_id
    // - stores activation_sent_at
    // - keeps isActive = false
    //
    // ==========================================

    const employee =
      await activateEmployeeAccount(id);

    // ==========================================
    // 5. SUCCESS
    // ==========================================

    return NextResponse.json(
      {
        message:
          "Activation email sent successfully",

        data: employee,
      },
      {
        status: 200,
      }
    );

  } catch (error) {
    console.error(
      "Send activation error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to send activation email";

    if (
      message ===
      "Employee not found"
    ) {
      return NextResponse.json(
        {
          message,
        },
        {
          status: 404,
        }
      );
    }

    if (
      message.includes(
        "already been activated"
      )
    ) {
      return NextResponse.json(
        {
          message,
        },
        {
          status: 409,
        }
      );
    }

    if (
      message.includes(
        "Please wait"
      )
    ) {
      return NextResponse.json(
        {
          message,
        },
        {
          status: 429,
        }
      );
    }

    return NextResponse.json(
      {
        message,
      },
      {
        status: 400,
      }
    );
  }
}