import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { synchronizeLatestFuelPrice } from "@/services/externalFactors/fuelPriceService";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);

    if ("error" in auth) {
      return NextResponse.json(
        { message: auth.error },
        { status: auth.status },
      );
    }

    const result = await synchronizeLatestFuelPrice();

    return NextResponse.json(
      {
        message: result.alreadySynchronized
          ? "Latest DOE fuel price was already synchronized."
          : "Latest DOE fuel price synchronized successfully.",
        data: result.record,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Fuel synchronization error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to synchronize fuel price.",
      },
      { status: 500 },
    );
  }
}