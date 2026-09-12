// LOGISCO_ROUTE_SECURITY_V1

import { NextResponse } from "next/server";

import { requireAuth } from "@/app/lib/auth";
import { getHomeRoute, normalizeRole } from "@/app/lib/routeAccess";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const role = normalizeRole(auth.employee.role);

    if (!role) {
      return NextResponse.json(
        { message: "Employee role is not authorized" },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        valid: true,
        employee: {
          employeeID: auth.employee.employeeID,
          employeeName: auth.employee.employeeName,
          role,
        },
        homeRoute: getHomeRoute(role),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Validate session error:", error);

    return NextResponse.json(
      { message: "Invalid session" },
      { status: 401 },
    );
  }
}
