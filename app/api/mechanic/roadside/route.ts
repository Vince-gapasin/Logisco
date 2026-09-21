import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { EMPLOYEE_ROLE } from "@/app/lib/enums";
import { listMechanicJobs } from "@/services/foulTrip/foulTripService";

// GET /api/mechanic/roadside - broken-down trucks this mechanic was sent to.
export async function GET(request: Request) {
  const { auth, response } = await authorize(request, [EMPLOYEE_ROLE.mechanic]);
  if (response) return response;

  try {
    const jobs = await listMechanicJobs(auth.employee.employeeID);
    return NextResponse.json({ data: jobs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Roadside] load failed:", error);
    return NextResponse.json({ message: "Failed to load roadside jobs" }, { status: 500 });
  }
}
