import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/app/lib/auth";
import {
  updateSubcontractor,
  deleteSubcontractor,
} from "@/services/subcontractor/subcontractorService";

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

    const { id } = await params;
    const body = await request.json();

    const updatedSubcontractor = await updateSubcontractor(id, body);

    return NextResponse.json(updatedSubcontractor, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update subcontractor";

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