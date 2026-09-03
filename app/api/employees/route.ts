import { NextResponse } from "next/server";

import {
  requireAuth,
  requireRole,
} from "@/app/lib/auth";

import {
  getEmployees,
  createEmployee,
} from "@/services/employee/employeeService";

import {
  employeeQuerySchema,
  createEmployeeSchema,
} from "@/app/schemas/employee/employee.schema";

// ============================================
// GET ALL EMPLOYEES
// All authenticated employees can access
// ============================================

export async function GET(request: Request) {
  try {
    // AUTHENTICATION
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

    // READ QUERY PARAMETERS
    const { searchParams } = new URL(
      request.url
    );

    const rawQuery = Object.fromEntries(
      searchParams.entries()
    );

    // VALIDATE QUERY PARAMETERS
    const validation =
      employeeQuerySchema.safeParse(
        rawQuery
      );

    if (!validation.success) {
      return NextResponse.json(
        {
          message:
            "Invalid employee query parameters",

          errors:
            validation.error
              .flatten()
              .fieldErrors,
        },
        {
          status: 400,
        }
      );
    }

    // FETCH EMPLOYEES
    const result = await getEmployees(
      validation.data
    );

    const {
      page,
      limit,
    } = validation.data;

    // SUCCESS
    return NextResponse.json(
      {
        data: result.employees,

        pagination: {
          page,
          limit,
          total: result.total,

          totalPages: Math.ceil(
            result.total / limit
          ),
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "GET employees error:",
      error
    );

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch employees",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================
// CREATE EMPLOYEE
// Admin only
// ============================================

export async function POST(request: Request) {
  try {
    // AUTHENTICATION
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

    // AUTHORIZATION
    const roleError = requireRole(
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

    // READ BODY
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          message:
            "Invalid or empty JSON body",
        },
        {
          status: 400,
        }
      );
    }

    // VALIDATE BODY
    const validation =
      createEmployeeSchema.safeParse(
        body
      );

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Validation failed",

          errors:
            validation.error
              .flatten()
              .fieldErrors,
        },
        {
          status: 400,
        }
      );
    }

    // CREATE EMPLOYEE
    const employee = await createEmployee(
      validation.data
    );

    // SUCCESS
    return NextResponse.json(
      {
        message:
          "Employee created successfully",

        data: employee,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST employee error:",
      error
    );

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to create employee",
      },
      {
        status: 500,
      }
    );
  }
}