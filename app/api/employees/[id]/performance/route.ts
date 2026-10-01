import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { EMPLOYEE_ROLE } from "@/app/lib/enums";
import {
  DEFAULT_WINDOW_DAYS,
  getEmployeePerformance,
  PerformanceError,
} from "@/services/employee/performanceService";

// One employee's record.
//
// Readable by the office, and by the employee themselves. That second part is
// deliberate: a score somebody is measured by but cannot see is a rumour, and
// the first thing a crew does with a rumour is stop trusting the screen it came
// from. Everything here is shown to them exactly as a supervisor sees it,
// including the weights and the counts behind each figure.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const MANAGERS = [EMPLOYEE_ROLE.admin, EMPLOYEE_ROLE.coordinator];

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ message: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  const isSelf = id === auth.employee.employeeID;
  if (!isSelf && requireRole(auth.employee.role, MANAGERS)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // "all" reads the whole record; a number of days narrows it.
  const asked = new URL(request.url).searchParams.get("days");
  const windowDays =
    asked === "all" ? null : asked && Number.isFinite(Number(asked)) ? Number(asked) : DEFAULT_WINDOW_DAYS;

  if (windowDays !== null && (windowDays < 1 || windowDays > 3650)) {
    return NextResponse.json({ message: "That is not a period this can cover." }, { status: 400 });
  }

  try {
    const data = await getEmployeePerformance(id, { windowDays });

    // Whether this viewer may put a late stop aside. The crew see the same
    // figures and the same excuses, but cannot grant one to themselves.
    const canExcuse = requireRole(auth.employee.role, MANAGERS) === null;

    return NextResponse.json(
      { data: { ...data, viewerCanExcuse: canExcuse } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PerformanceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("GET employee performance error:", error);
    return NextResponse.json({ message: "Could not work out this record" }, { status: 500 });
  }
}
