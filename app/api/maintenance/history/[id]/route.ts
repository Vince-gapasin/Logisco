import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireRole, FLEET_ROLES } from "@/app/lib/auth";
import {
  updateHistoryLog,
  deleteHistoryLog,
} from "@/services/maintenance/maintenanceService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const roleError = requireRole(auth.employee.role, FLEET_ROLES);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });

    const { id } = await params;
    const body = await request.json();

    const updatedHistory = await updateHistoryLog(id, body);

    return NextResponse.json(updatedHistory, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update maintenance history";

    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const roleError = requireRole(auth.employee.role, FLEET_ROLES);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });

    const { id } = await params;

    await deleteHistoryLog(id);

    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete maintenance history";

    return NextResponse.json({ message }, { status: 500 });
  }
}