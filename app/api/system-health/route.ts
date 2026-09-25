import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { checkSystem } from "@/services/health/healthService";

// What this deployment can and cannot do, asked of the deployment itself.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await authorize(request, ["Admin"]);
  if (response) return response;

  try {
    const checks = await checkSystem();
    return NextResponse.json({ data: { checks } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET system health error:", error);
    return NextResponse.json({ message: "Failed to check the system" }, { status: 500 });
  }
}
