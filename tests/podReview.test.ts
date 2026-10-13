import { beforeEach, describe, expect, it, vi } from "vitest";
import { proofCheckBadge } from "@/app/lib/proofCheck";

// The office's review of a proof the scan could not fully check.
//
// "Needs review" used to be a label nobody could act on: the notification
// opened the live map, and nothing recorded that anyone had looked. Now the
// office approves or rejects, a rejection says why, and two people deciding
// the same proof at once do not both win.

let current: Record<string, unknown> | null;
let updated: Record<string, unknown> | null;
const updates: Record<string, unknown>[] = [];
const conditions: string[] = [];

vi.mock("@/app/lib/supabase", () => {
  const chain = (table: string) => {
    const self: Record<string, unknown> = {
      select: () => self,
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return self;
      },
      eq: (column: string, value: unknown) => {
        conditions.push(`${column}=${value}`);
        return self;
      },
      is: (column: string, value: unknown) => {
        conditions.push(`${column} is ${value}`);
        return self;
      },
      maybeSingle: async () => ({ data: updates.length ? updated : current, error: null }),
    };
    void table;
    return self;
  };
  return { supabase: { from: chain } };
});
vi.mock("@/services/storage/podService", () => ({ signPodUrls: async () => new Map() }));

const { reviewProof, ReviewError } = await import("@/services/storage/podReviewService");

const REVIEWER = "aaaaaaaa-0000-0000-0000-000000000001";

beforeEach(() => {
  current = { podID: "pod-1", dispatchID: "trip-1", validationStatus: "unverified", reviewStatus: null, reviewNote: null };
  updated = { podID: "pod-1" };
  updates.length = 0;
  conditions.length = 0;
});

const review = (decision: "approved" | "rejected", note = "", allowChange = false) =>
  reviewProof({ podID: "pod-1", decision, note, reviewerID: REVIEWER, allowChange });

describe("approving", () => {
  it("records who approved it and when", async () => {
    const result = await review("approved");
    expect(result.dispatchID).toBe("trip-1");
    expect(updates[0]).toMatchObject({ reviewStatus: "approved", reviewedBy: REVIEWER, reviewNote: null });
    expect(typeof updates[0].reviewedAt).toBe("string");
  });

  it("only applies to a proof nobody has reviewed yet", async () => {
    await review("approved");
    expect(conditions).toContain("reviewStatus is null");
  });
});

describe("rejecting", () => {
  it("needs a reason", async () => {
    await expect(review("rejected", "   ")).rejects.toBeInstanceOf(ReviewError);
    expect(updates).toHaveLength(0);
  });

  it("keeps the reason", async () => {
    await review("rejected", " Not signed by the receiver ");
    expect(updates[0]).toMatchObject({ reviewStatus: "rejected", reviewNote: "Not signed by the receiver" });
  });
});

describe("what cannot be reviewed", () => {
  it("a proof that does not need a review", async () => {
    current = { ...current, validationStatus: "passed" };
    await expect(review("approved")).rejects.toMatchObject({ status: 409 });
  });

  it("a proof already reviewed, unless the change is deliberate", async () => {
    current = { ...current, reviewStatus: "approved" };
    await expect(review("rejected", "Wrong branch")).rejects.toMatchObject({ status: 409 });

    await review("rejected", "Wrong branch", true);
    expect(conditions).toContain("reviewStatus=approved");
  });

  it("a proof someone else reviewed a moment ago", async () => {
    updated = null;
    await expect(review("approved")).rejects.toMatchObject({ status: 409 });
  });

  it("a proof that no longer exists", async () => {
    current = null;
    await expect(review("approved")).rejects.toMatchObject({ status: 404 });
  });
});

describe("the badge", () => {
  it("says what the office decided, over what the scan found", () => {
    expect(proofCheckBadge("unverified").text).toBe("Needs review");
    expect(proofCheckBadge("unverified", "approved").text).toBe("Approved by office");
    expect(proofCheckBadge("unverified", "rejected").text).toBe("Rejected by office");
  });
});
