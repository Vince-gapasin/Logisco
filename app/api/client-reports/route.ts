import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { countOpenReports, listReportsForOffice, type ReportQueue } from "@/services/feedback/clientReportService";

// Problems clients reported from their tracking page. ?queue=open (the
// default) or resolved. ?count=1 answers only how many are open.

const QUEUES: ReportQueue[] = ["open", "resolved"];

export async function GET(request: Request) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const params = new URL(request.url).searchParams;
  try {
    if (params.get("count")) {
      return NextResponse.json({ open: await countOpenReports() });
    }
    const queue = (params.get("queue") ?? "open") as ReportQueue;
    if (!QUEUES.includes(queue)) {
      return NextResponse.json({ message: "Unknown report queue" }, { status: 400 });
    }
    return NextResponse.json({ reports: await listReportsForOffice(queue) });
  } catch (error) {
    console.error("[Client reports] List failed:", error);
    return NextResponse.json({ message: "Could not load the client reports" }, { status: 500 });
  }
}
