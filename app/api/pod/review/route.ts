import { NextResponse } from "next/server";
import { authorize, OFFICE_ROLES } from "@/app/lib/auth";
import { countPendingReviews, listProofsForReview, type ReviewQueue } from "@/services/storage/podReviewService";

// Proofs of delivery for the office to review. ?queue=pending (the default),
// approved or rejected. ?count=1 answers only how many are waiting.

const QUEUES: ReviewQueue[] = ["pending", "approved", "rejected"];

export async function GET(request: Request) {
  const { response } = await authorize(request, OFFICE_ROLES);
  if (response) return response;

  const params = new URL(request.url).searchParams;
  try {
    if (params.get("count")) {
      return NextResponse.json({ pending: await countPendingReviews() });
    }
    const queue = (params.get("queue") ?? "pending") as ReviewQueue;
    if (!QUEUES.includes(queue)) {
      return NextResponse.json({ message: "Unknown review queue" }, { status: 400 });
    }
    return NextResponse.json({ proofs: await listProofsForReview(queue) });
  } catch (error) {
    console.error("[POD review] List failed:", error);
    return NextResponse.json({ message: "Could not load the proofs to review" }, { status: 500 });
  }
}
