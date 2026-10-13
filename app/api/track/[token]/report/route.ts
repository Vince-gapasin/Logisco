import { NextResponse } from "next/server";
import { isTrackingToken } from "@/services/tracking/publicTrackingService";
import { ClientReportError, submitClientReport } from "@/services/feedback/clientReportService";

// A client reporting a problem, from the tracking page they already have open.
//
// Public on purpose, like the tracking link and the feedback beside it: the
// token is the capability and its holder is the client. Unlike feedback it is
// open at every stage of the delivery - a complaint about a late truck is no
// use once the truck has arrived. The service caps how many one link can send
// in a day, so a forwarded link cannot bury the office.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { token } = await params;

  if (!isTrackingToken(token)) {
    return NextResponse.json({ message: "Invalid tracking link" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid or empty JSON body" }, { status: 400 });
  }

  const { category, message, contactBack } = (body ?? {}) as {
    category?: unknown;
    message?: unknown;
    contactBack?: unknown;
  };

  try {
    const report = await submitClientReport(token, { category, message, contactBack });
    return NextResponse.json(
      { message: "Thank you - your report has been sent to the office.", data: report },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ClientReportError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("POST client report error:", error);
    return NextResponse.json({ message: "Could not send your report" }, { status: 500 });
  }
}
