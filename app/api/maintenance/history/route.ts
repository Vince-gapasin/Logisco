import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { getHistoryLogs, createHistoryLog } from "@/services/maintenance/maintenanceService";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
    const logs = await getHistoryLogs();
    return NextResponse.json(logs, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
    const body = await request.json();
    const newLog = await createHistoryLog(body);
    return NextResponse.json(newLog, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}