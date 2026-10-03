import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { RANKED_ROLES, rankRole } from "@/services/employee/rankingService";

// GET /api/employees/rankings?role=Driver&days=180
// One role's employees, best first. The office's view, like the profiles.
export async function GET(request: Request) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const params = new URL(request.url).searchParams;
  const role = params.get("role") ?? "";
  if (!RANKED_ROLES.includes(role)) {
    return NextResponse.json({ message: "Choose a role to rank." }, { status: 400 });
  }

  const days = params.get("days");
  const windowDays = days === "all" ? null : days && Number.isFinite(Number(days)) ? Number(days) : 180;
  if (windowDays !== null && (windowDays < 1 || windowDays > 3650)) {
    return NextResponse.json({ message: "That is not a period this can cover." }, { status: 400 });
  }

  try {
    const data = await rankRole(role, windowDays);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET rankings error:", error);
    return NextResponse.json({ message: "Could not rank this role" }, { status: 500 });
  }
}
