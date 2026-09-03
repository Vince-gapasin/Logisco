import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { getAvailableResources } from "@/services/dispatch/dispatchService";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    // Extract the target date from the URL query parameters
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get("date");

    if (!targetDate) {
      return NextResponse.json({ message: "Date parameter is required" }, { status: 400 });
    }

    const resources = await getAvailableResources(targetDate);

    return NextResponse.json({ data: resources }, { status: 200 });
  } catch (error: any) {
    console.error("GET available-resources error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch available resources" },
      { status: 500 }
    );
  }
}