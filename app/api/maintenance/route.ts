import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { createMaintenanceRecord, getAllActiveMaintenance } from "@/services/maintenance/maintenanceService";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
    const records = await getAllActiveMaintenance();
    return NextResponse.json({ data: records }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
    const body = await request.json();
    const newRecord = await createMaintenanceRecord(body);
    return NextResponse.json(newRecord, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}