import { NextResponse } from "next/server";
import { authorize, FLEET_ROLES } from "@/app/lib/auth";
import { getLogPhotos } from "@/services/history-logs/historyLogsService";

// Image data for the logs currently being viewed:
//   GET /api/historyLogsM/photos?logIDs=id1,id2
// The list endpoint returns only presence flags, so photos load on demand.
const MAX_LOGS_PER_REQUEST = 50;

export async function GET(request: Request) {
  const { response } = await authorize(request, FLEET_ROLES);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const logIDs = (searchParams.get("logIDs") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_LOGS_PER_REQUEST);

  if (logIDs.length === 0) {
    return NextResponse.json({ data: {} });
  }

  try {
    const data = await getLogPhotos(logIDs);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET log photos error:", error);
    return NextResponse.json({ message: "Failed to load photos" }, { status: 500 });
  }
}
