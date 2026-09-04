import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { getAllSubcontractors, createSubcontractor } from "@/services/subcontractor/subcontractorService";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
    
    const subcontractors = await getAllSubcontractors();
    return NextResponse.json({ data: subcontractors }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status });
    
    const body = await request.json();
    const newSubcon = await createSubcontractor(body);
    
    return NextResponse.json({ message: "Subcontractor added successfully", data: newSubcon }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}