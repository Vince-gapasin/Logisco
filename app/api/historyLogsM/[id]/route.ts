import { NextResponse } from "next/server";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import {
  deleteHistoryLog,
  updateHistoryLog,
  validateHistoryLog,
} from "@/services/history-logs/historyLogsService";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validateHistoryLog(body, false);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    const { id } = await params;
    const updatedLog = await updateHistoryLog(id, body);
    return NextResponse.json({ message: "Log updated successfully", data: updatedLog }, { status: 200 });
  } catch (error) {
    console.error("PUT history log error:", error);
    const notFound = error instanceof Error && error.message === "Log not found";
    return NextResponse.json(
      { message: notFound ? "Log not found" : "Failed to update log" },
      { status: notFound ? 404 : 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  try {
    const { id } = await params;
    await deleteHistoryLog(id);
    return NextResponse.json({ message: "Log deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("DELETE history log error:", error);
    return NextResponse.json({ message: "Failed to delete log" }, { status: 500 });
  }
}
