import { NextResponse } from "next/server";
import { updateHistoryLog, deleteHistoryLog } from "@/services/history-logs/historyLogsService";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const updatedLog = await updateHistoryLog(id, body);
    return NextResponse.json({ message: "Log updated successfully", data: updatedLog }, { status: 200 });
  } catch (error: any) {
    console.error("PUT history log error:", error);
    return NextResponse.json({ message: error.message || "Failed to update log" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    await deleteHistoryLog(id);

    return NextResponse.json({ message: "Log deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("DELETE history log error:", error);
    return NextResponse.json({ message: "Failed to delete log" }, { status: 500 });
  }
}