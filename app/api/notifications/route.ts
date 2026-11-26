import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { getNotificationsForEmployee, getUnreadCount } from "@/services/notifications/notificationService";

// Role-appropriate notifications derived from live operational data.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  try {
    // The feed holds the newest events only; the unread total is counted over
    // all of them, the same number the bell shows. A failed count leaves the
    // page to count what it has rather than failing the feed.
    const [data, unreadCount] = await Promise.all([
      getNotificationsForEmployee({
        employeeID: auth.employee.employeeID,
        role: auth.employee.role,
      }),
      getUnreadCount(auth.employee.employeeID).catch(() => null),
    ]);

    return NextResponse.json({ data, unreadCount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET notifications error:", error);
    return NextResponse.json({ message: "Failed to load notifications" }, { status: 500 });
  }
}
