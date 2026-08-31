import { NextResponse } from "next/server";

import {
  requireAuth,
  requireRole,
} from "@/app/lib/auth";

import {
  activateEmployeeAccount,
} from "@/services/employee/employeeService";

import {
  employeeIdSchema,
} from "@/app/schemas/employee/employee.schema";


type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};


// ==========================================
// ACTIVATE EMPLOYEE ACCOUNT
// ADMIN ONLY
// ==========================================

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    // ========================================
    // AUTHENTICATION
    // ========================================

    const auth =
      await requireAuth(
        request
      );

    if ("error" in auth) {
      return NextResponse.json(
        {
          message:
            auth.error,
        },
        {
          status:
            auth.status,
        }
      );
    }


    // ========================================
    // AUTHORIZATION
    // ========================================

    const roleError =
      requireRole(
        auth.employee.role,
        ["Admin"]
      );

    if (roleError) {
      return NextResponse.json(
        {
          message:
            roleError.error,
        },
        {
          status:
            roleError.status,
        }
      );
    }


    // ========================================
    // VALIDATE EMPLOYEE ID
    // ========================================

    const { id } =
      await params;

    const idValidation =
      employeeIdSchema.safeParse(
        id
      );

    if (
      !idValidation.success
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid employee ID",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================
    // ACTIVATE
    // ========================================

    const employee =
      await activateEmployeeAccount(
        idValidation.data
      );


    return NextResponse.json(
      {
        message:
          "Activation email sent successfully",

        data:
          employee,
      },
      {
        status: 200,
      }
    );

  } catch (error) {
    console.error(
      "Activate employee error:",
      error
    );


    const message =
      error instanceof Error
        ? error.message
        : "Failed to activate employee account";


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