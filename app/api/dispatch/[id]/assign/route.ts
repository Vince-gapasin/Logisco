import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { assignDispatch } from "@/services/dispatch/dispatchService";
import { assignDispatchSchema } from "@/app/schemas/dispatch/dispatch.schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });

    const { id } = await params;
    const body = await request.json();

    const validation = assignDispatchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ message: "Validation failed", errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const dispatch = await assignDispatch(id, validation.data);

    return NextResponse.json({ message: "Crew and Truck successfully assigned.", data: dispatch }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 400 });
  }
}