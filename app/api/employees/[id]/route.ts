import { NextResponse } from "next/server";

import {
  requireAuth,
  requireRole,
} from "@/app/lib/auth";

import {
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} from "@/services/employee/employeeService";

import {
  employeeIdSchema,
  updateEmployeeSchema,
} from "@/app/schemas/employee/employee.schema";

import type {
  EmployeeResponse,
} from "@/types/employee";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};


// ============================================
// GET EMPLOYEE BY ID
// All authenticated roles can access
// ============================================

export async function GET(
  request: Request,
  { params }: RouteContext
) {
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

    const { id } = await params;

    // VALIDATE ID
    const idValidation =
      employeeIdSchema.safeParse(id);

    if (!idValidation.success) {
      return NextResponse.json(
        {
          message: "Invalid employee ID",
        },
        {
          status: 400,
        }
      );
    }

    const employee = await getEmployeeById(
      idValidation.data
    );

    if (!employee) {
      return NextResponse.json(
        {
          message: "Employee not found",
        },
        {
          status: 404,
        }
      );
    }

    const response: EmployeeResponse = {
      data: employee,
    };

    return NextResponse.json(
      response,
      {
        status: 200,
      }
    );

  } catch (error) {
    console.error(
      "GET employee error:",
      error
    );

    return NextResponse.json(
      {
        message: "Failed to fetch employee",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================
// UPDATE EMPLOYEE
// Admin + Coordinator only
// ============================================

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
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
      [
        "Admin",
        "Coordinator",
      ]
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

    const { id } = await params;

    // VALIDATE ID
    const idValidation =
      employeeIdSchema.safeParse(id);

    if (!idValidation.success) {
      return NextResponse.json(
        {
          message: "Invalid employee ID",
        },
        {
          status: 400,
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
          message: "Invalid or empty JSON body",
        },
        {
          status: 400,
        }
      );
    }

    // VALIDATE BODY
    const validation =
      updateEmployeeSchema.safeParse(body);

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

    // PREVENT EMPTY PATCH
    if (
      Object.keys(validation.data).length === 0
    ) {
      return NextResponse.json(
        {
          message:
            "No employee fields provided",
        },
        {
          status: 400,
        }
      );
    }

    const employee = await updateEmployee(
      idValidation.data,
      validation.data
    );

    if (!employee) {
      return NextResponse.json(
        {
          message: "Employee not found",
        },
        {
          status: 404,
        }
      );
    }

    const response: EmployeeResponse = {
      message:
        "Employee updated successfully",
      data: employee,
    };

    return NextResponse.json(
      response,
      {
        status: 200,
      }
    );

  } catch (error) {
    console.error(
      "PATCH employee error:",
      error
    );

    return NextResponse.json(
      {
        message: "Failed to update employee",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================
// DELETE EMPLOYEE
// Admin only
// ============================================

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
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

    const { id } = await params;

    // VALIDATE ID
    const idValidation =
      employeeIdSchema.safeParse(id);

    if (!idValidation.success) {
      return NextResponse.json(
        {
          message: "Invalid employee ID",
        },
        {
          status: 400,
        }
      );
    }

    const employee = await deleteEmployee(
      idValidation.data
    );

    if (!employee) {
      return NextResponse.json(
        {
          message: "Employee not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      {
        message:
          "Employee deleted successfully",
      },
      {
        status: 200,
      }
    );

  } catch (error) {
    console.error(
      "DELETE employee error:",
      error
    );

    return NextResponse.json(
      {
        message: "Failed to delete employee",
      },
      {
        status: 500,
      }
    );
  }
}