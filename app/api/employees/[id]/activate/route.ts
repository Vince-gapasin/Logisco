import { NextResponse } from "next/server";
// EMPLOYEE_LOGIN_ACCESS_V1

import { requireAuth, requireRole } from "@/app/lib/auth";
import { activateEmployeeAccount } from "@/services/employee/employeeService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 },
      );
    }

    const employee = await activateEmployeeAccount(id);

    return NextResponse.json(
      {
        message: "Activation email sent successfully",
        data: employee,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Send activation error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to send activation email";

    if (message === "Employee not found") {
      return NextResponse.json({ message }, { status: 404 });
    }

    if (message.includes("already been activated")) {
      return NextResponse.json({ message }, { status: 409 });
    }

    if (message.includes("Please wait")) {
      return NextResponse.json({ message }, { status: 429 });
    }

    return NextResponse.json({ message }, { status: 400 });
  }
}
