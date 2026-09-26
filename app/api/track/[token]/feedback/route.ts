import { NextResponse } from "next/server";
import { isTrackingToken } from "@/services/tracking/publicTrackingService";
import { FeedbackError, recordClientFeedback } from "@/services/feedback/deliveryFeedbackService";

// What the client thought, from the tracking page they already have open.
//
// Public on purpose, like the tracking link itself: the token is the capability
// and its holder is the client. There is no login to ask for, and asking for one
// is how a feedback form gets a two per cent response rate.
//
// What the token does not allow is rating a delivery that has not happened - the
// service checks the trip is finished - or voting twice, since one answer per
// trip is enforced by the table and a second submission corrects the first.
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

  const { goodCondition, courteous, comment } = (body ?? {}) as {
    goodCondition?: unknown;
    courteous?: unknown;
    comment?: unknown;
  };

  try {
    const answers = await recordClientFeedback(token, {
      goodCondition: goodCondition as boolean,
      courteous: courteous as boolean,
      comment: typeof comment === "string" ? comment : null,
    });

    return NextResponse.json(
      { message: "Thank you - this goes straight to the crew's record.", data: answers },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof FeedbackError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("POST delivery feedback error:", error);
    return NextResponse.json({ message: "Could not save your answer" }, { status: 500 });
  }
}
