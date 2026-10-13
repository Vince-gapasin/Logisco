// The automatic receipt check on a proof of delivery, as the screens and the
// exports name it. The checks are app/lib/podScan.ts (on the phone) and
// services/storage/podScanCheck.ts (on the server).

export type ProofCheck = "passed" | "failed" | "unverified" | null;

/**
 * What the receipt check said, in a word. "Not checked" is not a failure: it is
 * every proof recorded before the check, and every one the office uploaded.
 */
export function proofCheckBadge(
  status: ProofCheck | undefined,
  review?: "approved" | "rejected" | null,
): { text: string; style: string } {
  // The office's decision outranks the scan's: it is the later, human look.
  if (review === "approved") return { text: "Approved by office", style: "bg-emerald-100 text-emerald-800" };
  if (review === "rejected") return { text: "Rejected by office", style: "bg-red-100 text-red-800" };
  switch (status) {
    case "passed":
      return { text: "Verified", style: "bg-emerald-100 text-emerald-800" };
    case "unverified":
      return { text: "Needs review", style: "bg-amber-100 text-amber-800" };
    case "failed":
      return { text: "Check failed", style: "bg-red-100 text-red-800" };
    default:
      return { text: "Not checked", style: "bg-slate-100 text-slate-600" };
  }
}
