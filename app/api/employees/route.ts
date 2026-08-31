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

import type {
  CreateEmployeeDto,
  EmployeeResponse,
  EmployeesResponse,
} from "@/types/employee";


// ============================================
// GET ALL EMPLOYEES
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

    // QUERY PARAMETERS
    const { searchParams } = new URL(request.url);

    const validation = employeeQuerySchema.safeParse({
      page:
        searchParams.get("page") ??
        undefined,

      limit:
        searchParams.get("limit") ??
        undefined,

      search:
        searchParams.get("search") ??
        undefined,

      role:
        searchParams.get("role") ??
        undefined,

      availability:
        searchParams.get("availability") ??
        undefined,

      healthStatus:
        searchParams.get("healthStatus") ??
        undefined,

      isActive:
        searchParams.get("isActive") ??
        undefined,

      sortBy:
        searchParams.get("sortBy") ??
        undefined,

      sortOrder:
        searchParams.get("sortOrder") ??
        undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid query parameters",
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

    const query = validation.data;

    const {
      employees,
      total,
    } = await getEmployees(query);

    const response: EmployeesResponse = {
      data: employees,

      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(
          total / query.limit
        ),
      },
    };

    return NextResponse.json(
      response,
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
          "Failed to fetch employees",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================
// CREATE EMPLOYEE
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

    // Authorization
    const roleError = requireRole(
      auth.employee.role,
      ["Admin", "Coordinator"]
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

    // CHECK CONTENT TYPE
    const contentType =
      request.headers.get("content-type");

    if (
      !contentType?.includes(
        "application/json"
      )
    ) {
      return NextResponse.json(
        {
          message:
            "Content-Type must be application/json",
        },
        {
          status: 415,
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

    // ZOD VALIDATION
    const validation =
      createEmployeeSchema.safeParse(body);

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

    const employeeData: CreateEmployeeDto =
      validation.data;

    // CREATE EMPLOYEE
    const employee =
      await createEmployee(employeeData);

    const response: EmployeeResponse = {
      message:
        "Employee created successfully",
      data: employee,
    };

    return NextResponse.json(
      response,
      {
        status: 201,
      }
    );

  } catch (error: unknown) {
    console.error(
      "POST employee error:",
      error
    );

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error
    ) {
      return NextResponse.json(
        {
          message: String(
            error.message
          ),
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json(
      {
        message:
          "Failed to create employee",
      },
      {
        status: 500,
      }
    );
  }
}