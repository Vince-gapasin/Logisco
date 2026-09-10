import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireRole } from "@/app/lib/auth";
import { backfillFuelPriceHistory } from "@/services/externalFactors/fuelPriceService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const roleError = requireRole(auth.employee.role, [
      "Admin",
      "Coordinator",
    ]);

    if (roleError) {
      return NextResponse.json(
        { message: roleError.error },
        { status: roleError.status },
      );
    }

    let months = 24;

    try {
      const body = await request.json();

      if (body?.months !== undefined) {
        months = Number(body.months);
      }
    } catch {
      // An empty request body uses the default of 24 months.
    }

    const result = await backfillFuelPriceHistory(months);

    return NextResponse.json(
      {
        message: "Historical fuel prices backfilled successfully.",
        data: result,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Fuel backfill error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to backfill historical fuel prices.",
      },
      { status: 500 },
    );
  }
}