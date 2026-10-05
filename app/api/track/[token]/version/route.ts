import { NextResponse } from "next/server";
import { getTrackingVersion, isTrackingToken } from "@/services/tracking/publicTrackingService";

// The open tracking page asks this every few seconds: a fingerprint of the
// delivery, so it only fetches the whole thing when something has changed.
// Public for the same reason the tracking route is - the token is the key.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params;

  if (!isTrackingToken(token)) {
    return NextResponse.json({ message: "Invalid tracking link" }, { status: 400 });
  }

  try {
    const version = await getTrackingVersion(token);
    if (version === null) {
      return NextResponse.json({ message: "Tracking link not found" }, { status: 404 });
    }
    return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET tracking version error:", error);
    return NextResponse.json({ message: "Failed to check for updates" }, { status: 500 });
  }
}
