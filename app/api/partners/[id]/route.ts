import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { deletePartner } from "@/services/client/clientService";
import { updatePartner } from "@/services/client/clientService";
import { updatePartnerSchema } from "@/app/schemas/client/client.schema";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ============================================
// UPDATE PARTNER (PATCH)
// ============================================
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) {
      return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    }

    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const validation = updatePartnerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updatedPartner = await updatePartner(id, validation.data);

    return NextResponse.json(
      { message: "Partner updated successfully", data: updatedPartner },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("PATCH partner error:", error);
    if (typeof error === "object" && error !== null && "message" in error) {
      return NextResponse.json({ message: String(error.message) }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to update partner" }, { status: 500 });
  }
}

// ============================================
// DELETE PARTNER (SOFT DELETE)
// ============================================
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) {
      return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    }

    const { id } = await params;
    await deletePartner(id);

    return NextResponse.json(
      { message: "Partner deactivated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE partner error:", error);
    return NextResponse.json(
      { message: "Failed to deactivate partner" },
      { status: 500 }
    );
  }
}