import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { updateSubcontractor, deleteSubcontractor } from "@/services/subcontractor/subcontractorService";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const body = await request.json();
    const updatedSubcon = await updateSubcontractor(params.id, body);
    return NextResponse.json(updatedSubcon, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });

    await deleteSubcontractor(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}