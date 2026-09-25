import { NextResponse } from "next/server";
import { requireAuth, requireRole, FLEET_ROLES } from "@/app/lib/auth";
import { getHistoryLogs, createHistoryLog } from "@/services/maintenance/maintenanceService";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const roleError = requireRole(auth.employee.role, FLEET_ROLES);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    const logs = await getHistoryLogs();
    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const roleError = requireRole(auth.employee.role, FLEET_ROLES);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    const body = await request.json();
    const newLog = await createHistoryLog(body);
    return NextResponse.json(newLog, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}