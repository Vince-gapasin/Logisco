import { NextResponse } from "next/server";
import { getHistoryLogs, createHistoryLog } from "@/services/history-logs/historyLogsService";

export async function GET() {
  try {
    const logs = await getHistoryLogs();
    return NextResponse.json({ data: logs }, { status: 200 });
  } catch (error) {
    console.error("GET history logs error:", error);
    return NextResponse.json({ message: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newLog = await createHistoryLog(body);

    return NextResponse.json({ message: "Log created successfully", data: newLog }, { status: 201 });
  } catch (error: any) {
    console.error("POST history log error:", error);
    return NextResponse.json({ message: error.message || "Failed to create log" }, { status: 500 });
  }
}