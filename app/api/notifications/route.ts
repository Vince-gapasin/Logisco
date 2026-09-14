import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { getNotificationsForEmployee } from "@/services/notifications/notificationService";

// Role-appropriate notifications derived from live operational data.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  try {
    const data = await getNotificationsForEmployee({
      employeeID: auth.employee.employeeID,
      role: auth.employee.role,
    });

    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET notifications error:", error);
    return NextResponse.json({ message: "Failed to load notifications" }, { status: 500 });
  }
}
