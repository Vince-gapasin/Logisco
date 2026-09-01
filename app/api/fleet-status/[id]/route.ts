import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { getTruckById, updateTruck, deleteTruck } from "@/services/truck/truckService";
import { updateTruckSchema } from "@/app/schemas/truck/truck.schema";
import type { TruckResponse } from "@/types/truck";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ============================================
// GET SINGLE TRUCK
// ============================================
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const truck = await getTruckById(id);

    if (!truck) {
      return NextResponse.json({ message: "Truck not found" }, { status: 404 });
    }

    const response: TruckResponse = { data: truck };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("GET single truck error:", error);
    return NextResponse.json(
      { message: "Failed to fetch truck" },
      { status: 500 }
    );
  }
}

// ============================================
// UPDATE TRUCK
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

    // ZOD VALIDATION (Partial fields)
    const validation = updateTruckSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updatedTruck = await updateTruck(id, validation.data);

    if (!updatedTruck) {
      return NextResponse.json({ message: "Truck not found" }, { status: 404 });
    }

    const response: TruckResponse = {
      message: "Truck updated successfully",
      data: updatedTruck,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("PATCH truck error:", error);
    return NextResponse.json(
      { message: "Failed to update truck" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE TRUCK (SOFT DELETE)
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
    const deletedTruck = await deleteTruck(id);

    if (!deletedTruck) {
      return NextResponse.json({ message: "Truck not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Truck deactivated successfully", data: deletedTruck },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE truck error:", error);
    return NextResponse.json(
      { message: "Failed to delete truck" },
      { status: 500 }
    );
  }
}