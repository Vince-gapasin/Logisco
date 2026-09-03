import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { getPartners, createPartner } from "@/services/client/clientService";
import { createPartnerSchema } from "@/app/schemas/client/client.schema";
import type { PartnersResponse, PartnerResponse } from "@/types/client";

// ============================================
// GET ALL ACTIVE PARTNERS
// ============================================
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const partners = await getPartners();

    const response: PartnersResponse = {
      data: partners,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("GET partners error:", error);
    return NextResponse.json(
      { message: "Failed to fetch partners" },
      { status: 500 }
    );
  }
}

// ============================================
// CREATE PARTNER
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

    const validation = createPartnerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const newPartner = await createPartner(validation.data);

    const response: PartnerResponse = {
      message: "Partner added successfully",
      data: newPartner,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    console.error("POST partner error:", error);
    if (typeof error === "object" && error !== null && "message" in error) {
      return NextResponse.json({ message: String(error.message) }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create partner" }, { status: 500 });
  }
}