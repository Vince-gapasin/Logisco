import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { deleteClient } from "@/services/client/clientService";
import { updateClient } from "@/services/client/clientService";
import { updateClientSchema } from "@/app/schemas/client/client.schema";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ============================================
// UPDATE CLIENT (PATCH)
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

    const validation = updateClientSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updatedClient = await updateClient(id, validation.data);

    return NextResponse.json(
      { message: "Client updated successfully", data: updatedClient },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("PATCH client error:", error);
    if (typeof error === "object" && error !== null && "message" in error) {
      return NextResponse.json({ message: String(error.message) }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to update client" }, { status: 500 });
  }
}

// ============================================
// DELETE CLIENT (SOFT DELETE)
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
    await deleteClient(id);

    return NextResponse.json(
      { message: "Client deactivated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE client error:", error);
    return NextResponse.json(
      { message: "Failed to deactivate client" },
      { status: 500 }
    );
  }
}