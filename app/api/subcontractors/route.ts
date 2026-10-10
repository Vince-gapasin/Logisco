import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { getAllSubcontractors, createSubcontractor } from "@/services/subcontractor/subcontractorService";
import { createPartnerSchema } from "@/app/schemas/client/client.schema";
import { DuplicateNameError } from "@/services/client/uniqueName";
import { fromPartnerFields, partnerFields } from "@/app/api/subcontractors/partnerFields";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    
    const subcontractors = await getAllSubcontractors();
    return NextResponse.json({ data: subcontractors }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const roleError = requireRole(auth.employee.role, ["Admin", "Coordinator"]);
    if (roleError) return NextResponse.json({ message: roleError.error }, { status: roleError.status });
    
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });

    // The partner rules, which this route - the one the Clients & Partners
    // page saves through - never applied: an email like "qa@test", or any
    // contract type at all, was saved as sent.
    const validation = createPartnerSchema.safeParse(partnerFields(body as Record<string, unknown>));
    if (!validation.success) {
      return NextResponse.json({ message: "Validation failed", errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const newSubcon = await createSubcontractor(fromPartnerFields(validation.data));
    return NextResponse.json({ message: "Subcontractor added successfully", data: newSubcon }, { status: 201 });
  } catch (error) {
    // A name already in use is the caller's to fix, not a server fault.
    if (error instanceof DuplicateNameError) return NextResponse.json({ message: error.message }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Something went wrong" }, { status: 500 });
  }
}