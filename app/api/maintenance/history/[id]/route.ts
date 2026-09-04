import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { updateHistoryLog, deleteHistoryLog } from "@/services/maintenance/maintenanceService";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
    const body = await request.json();
    const updatedLog = await updateHistoryLog(params.id, body);
    return NextResponse.json(updatedLog, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
    await deleteHistoryLog(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}