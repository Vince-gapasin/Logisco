import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/app/lib/auth";
import {
  updateSubcontractor,
  deleteSubcontractor,
} from "@/services/subcontractor/subcontractorService";
import { updatePartnerSchema } from "@/app/schemas/client/client.schema";
import { DuplicateNameError } from "@/services/client/uniqueName";
import { fromPartnerFields, partnerFields } from "@/app/api/subcontractors/partnerFields";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });

    const validation = updatePartnerSchema.safeParse(partnerFields(body as Record<string, unknown>));
    if (!validation.success) {
      return NextResponse.json({ message: "Validation failed", errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const updatedSubcontractor = await updateSubcontractor(id, fromPartnerFields(validation.data));

    return NextResponse.json(updatedSubcontractor, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update subcontractor";

    if (error instanceof DuplicateNameError) return NextResponse.json({ message }, { status: 409 });
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });

    const { id } = await params;

    await deleteSubcontractor(id);

    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete subcontractor";

    return NextResponse.json({ message }, { status: 500 });
  }
}