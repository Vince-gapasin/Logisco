import { NextResponse } from "next/server";
// EMPLOYEE_LOGIN_ACCESS_V1

import { requireAuth, requireRole } from "@/app/lib/auth";
import {
  getEmployees,
  createEmployee,
} from "@/services/employee/employeeService";
import {
  employeeQuerySchema,
  createEmployeeSchema,
} from "@/app/schemas/employee/employee.schema";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const { searchParams } = new URL(request.url);
    const validation = employeeQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid employee query parameters",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await getEmployees(validation.data);
    const { page, limit } = validation.data;

    return NextResponse.json(
      {
        data: result.employees,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET employees error:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to fetch employees",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const roleError = requireRole(auth.employee.role, ["Admin"]);
    if (roleError) {
      return NextResponse.json(
        { message: roleError.error },
        { status: roleError.status },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Invalid or empty JSON body" },
        { status: 400 },
      );
    }

    const validation = createEmployeeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const employee = await createEmployee(validation.data);
    return NextResponse.json(
      { message: "Employee created successfully", data: employee },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST employee error:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to create employee",
      },
      { status: 500 },
    );
  }
}
