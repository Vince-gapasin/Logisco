import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { getUnreadCount } from "@/services/notifications/notificationService";

// Just the number, for the bell in the header. The feed itself is several
// queries and is not worth running every time a badge refreshes.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  try {
    const count = await getUnreadCount(auth.employee.employeeID);
    return NextResponse.json({ data: { count } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET unread notification count error:", error);
    return NextResponse.json({ message: "Failed to count notifications" }, { status: 500 });
  }
}
