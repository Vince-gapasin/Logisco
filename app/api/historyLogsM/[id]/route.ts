import { NextResponse } from "next/server";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import { EMPLOYEE_ROLE } from "@/app/lib/enums";
import {
  deleteHistoryLog,
  mechanicMayWorkOnLog,
  updateHistoryLog,
  validateHistoryLog,
} from "@/services/history-logs/historyLogsService";

type RouteContext = { params: Promise<{ id: string }> };

type Auth = Awaited<ReturnType<typeof authorize>>["auth"];

// A log on another mechanic's repair is theirs to change. The office may
// change any.
async function refusedLog(auth: Auth, id: string) {
  if (!auth || auth.employee.role !== EMPLOYEE_ROLE.mechanic) return null;
  if (await mechanicMayWorkOnLog(id, auth.employee.employeeID)) return null;
  return NextResponse.json({ message: "This log is on another mechanic's repair." }, { status: 403 });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { auth, response } = await authorize(request, FLEET_ROLES);
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
    const refused = await refusedLog(auth, id);
    if (refused) return refused;

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
  const { auth, response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  try {
    const { id } = await params;
    const refused = await refusedLog(auth, id);
    if (refused) return refused;

    await deleteHistoryLog(id);
    return NextResponse.json({ message: "Log deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("DELETE history log error:", error);
    return NextResponse.json({ message: "Failed to delete log" }, { status: 500 });
  }
}
