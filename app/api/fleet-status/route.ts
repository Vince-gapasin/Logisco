import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { getTrucks, createTruck } from "@/services/truck/truckService";
import { createTruckSchema } from "@/app/schemas/truck/truck.schema";
import type { TrucksResponse, TruckResponse } from "@/types/truck";

// ============================================
// GET ALL ACTIVE TRUCKS
// ============================================
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const trucks = await getTrucks();

    const response: TrucksResponse = {
      data: trucks,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("GET trucks error:", error);
    return NextResponse.json(
      { message: "Failed to fetch trucks" },
      { status: 500 }
    );
  }
}

// ============================================
// CREATE TRUCK
// ============================================
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    // Restrict creation to Admins and Coordinators
    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) {
      return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    }

    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { message: "Content-Type must be application/json" },
        { status: 415 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Invalid or empty JSON body" },
        { status: 400 }
      );
    }

    // ZOD VALIDATION & DATA CLEANING
    const validation = createTruckSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const truckData = validation.data;
    const newTruck = await createTruck(truckData);

    const response: TruckResponse = {
      message: "Truck created successfully",
      data: newTruck,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error("POST truck error:", error);
    if (typeof error === "object" && error !== null && "message" in error) {
      return NextResponse.json(
        { message: String(error.message) },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Failed to create truck" },
      { status: 500 }
    );
  }
}