import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { getClients, createClient } from "@/services/client/clientService";
import { createClientSchema } from "@/app/schemas/client/client.schema";
import type { ClientsResponse, ClientResponse } from "@/types/client";

// ============================================
// GET ALL ACTIVE CLIENTS
// ============================================
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });

    const clients = await getClients();

    const response: ClientsResponse = {
      data: clients,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("GET clients error:", error);
    return NextResponse.json(
      { message: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// ============================================
// CREATE CLIENT (WITH WAREHOUSES & BRANCHES)
// ============================================
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) {
      return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const validation = createClientSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const newClient = await createClient(validation.data);

    const response: ClientResponse = {
      message: "Client added successfully",
      data: newClient,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error("POST client error:", error);
    if (typeof error === "object" && error !== null && "message" in error) {
      return NextResponse.json({ message: String(error.message) }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create client" }, { status: 500 });
  }
}