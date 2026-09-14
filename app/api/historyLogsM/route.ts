import { NextResponse } from "next/server";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import {
  createHistoryLog,
  getHistoryLogs,
  validateHistoryLog,
} from "@/services/history-logs/historyLogsService";

export async function GET(request: Request) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  try {
    const logs = await getHistoryLogs();
    return NextResponse.json({ data: logs }, { status: 200 });
  } catch (error) {
    console.error("GET history logs error:", error);
    return NextResponse.json({ message: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validateHistoryLog(body, true);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    const newLog = await createHistoryLog(body);
    return NextResponse.json({ message: "Log created successfully", data: newLog }, { status: 201 });
  } catch (error) {
    console.error("POST history log error:", error);
    return NextResponse.json({ message: "Failed to create log" }, { status: 500 });
  }
}
