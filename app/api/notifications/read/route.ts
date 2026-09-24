import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { markNotificationsRead } from "@/services/notifications/notificationService";

// Read state belongs to the person, not the browser they happened to use.
export async function POST(request: Request) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  let body: { ids?: unknown; all?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // An empty body means "all of them".
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : undefined;

  try {
    const marked = await markNotificationsRead(auth.employee.employeeID, body.all ? undefined : ids);
    return NextResponse.json({ data: { marked } });
  } catch (error) {
    console.error("POST notifications read error:", error);
    return NextResponse.json({ message: "Failed to mark notifications as read" }, { status: 500 });
  }
}
