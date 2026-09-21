import { NextResponse } from "next/server";
import { authorize } from "@/app/lib/auth";
import { normalizeQuery, searchForRole } from "@/services/search/searchService";

// GET /api/search?q=... - the portal header search.
//
// Any signed-in employee may call it; what comes back is decided by their
// role inside searchForRole, so a driver only ever sees their own trips.
export async function GET(request: Request) {
  const { auth, response } = await authorize(request);
  if (response) return response;

  const q = normalizeQuery(new URL(request.url).searchParams.get("q"));
  if (!q) {
    return NextResponse.json({ query: "", results: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const results = await searchForRole(auth.employee.role, auth.employee.employeeID, q);
    return NextResponse.json({ query: q, results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Search] failed:", error);
    return NextResponse.json({ message: "Search failed" }, { status: 500 });
  }
}
