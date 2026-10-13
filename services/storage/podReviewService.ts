// The office reviewing proofs of delivery the scan could not fully check.
//
// A stop closes as "Needs review" when something about its receipt could not
// be checked - most often a phone on an app without the scanner. The office is
// told, and this is where they look: the photo, why it needs a look, which
// booking and stop, who took it, when and where. They approve it or reject it,
// and the decision is kept on the proof with their name on it.
//
// Rejecting does not reopen the stop. The goods were handed over and the crew
// have moved on; what is wrong is the record, and the record is fixed by the
// office uploading a good copy (the replace action on the booking's proof). A
// rejected proof is hidden from the client's tracking page until then.

import { supabase } from "@/app/lib/supabase";
import { signPodUrls } from "@/services/storage/podService";

export type ReviewQueue = "pending" | "approved" | "rejected";
export type ReviewDecision = "approved" | "rejected";

export interface ProofForReview {
  podID: string;
  dispatchID: string | null;
  orderCode: string | null;
  client: string | null;
  /** The branch or warehouse, and which kind of stop it was. */
  stopName: string;
  isPickup: boolean;
  photoUrl: string | null;
  fileType: string | null;
  receiverName: string | null;
  deliveredAt: string | null;
  crewName: string | null;
  /** Why it needs a look, as the scan and the server put it. */
  reasons: string | null;
  scanMethod: string | null;
  capturedAt: string | null;
  captureLat: number | null;
  captureLng: number | null;
  reviewStatus: ReviewDecision | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
}

/** Enough to clear a backlog, and short enough to load on a phone. */
const PAGE = 100;

interface PodRow {
  podID: string;
  dispatchID: string | null;
  branchID: number | null;
  pickupID: number | null;
  proof: string | null;
  fileType: string | null;
  receiverName: string | null;
  deliveredAt: string | null;
  recordedBy: string | null;
  validationNotes: string | null;
  scanMethod: string | null;
  capturedAt: string | null;
  captureLat: number | null;
  captureLng: number | null;
  reviewStatus: ReviewDecision | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

const COLUMNS =
  "podID, dispatchID, branchID, pickupID, proof, fileType, receiverName, deliveredAt, recordedBy, validationNotes, " +
  "scanMethod, capturedAt, captureLat, captureLng, reviewStatus, reviewedBy, reviewedAt, reviewNote";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** How many proofs are waiting for the office. */
export async function countPendingReviews(): Promise<number> {
  const { count, error } = await supabase
    .from("POD")
    .select("podID", { count: "exact", head: true })
    .eq("validationStatus", "unverified")
    .is("reviewStatus", null);
  if (error) throw new Error(`Proof review count failed: ${error.message}`);
  return count ?? 0;
}

export async function listProofsForReview(queue: ReviewQueue): Promise<ProofForReview[]> {
  let query = supabase.from("POD").select(COLUMNS).eq("validationStatus", "unverified");
  query =
    queue === "pending"
      ? query.is("reviewStatus", null).order("deliveredAt", { ascending: true })
      : query.eq("reviewStatus", queue).order("reviewedAt", { ascending: false });

  const { data, error } = await query.limit(PAGE);
  if (error) throw new Error(`Proof review list failed: ${error.message}`);
  const rows = (data ?? []) as unknown as PodRow[];
  if (rows.length === 0) return [];

  const ids = <T,>(values: (T | null)[]) => [...new Set(values.filter((v): v is T => v !== null))];
  const dispatchIDs = ids(rows.map((r) => r.dispatchID));
  const branchIDs = ids(rows.map((r) => r.branchID));
  const pickupIDs = ids(rows.map((r) => r.pickupID));
  const employeeIDs = ids([...rows.map((r) => r.recordedBy), ...rows.map((r) => r.reviewedBy)]);

  const [trips, branches, pickups, employees, signed] = await Promise.all([
    dispatchIDs.length
      ? supabase.from("DispatchOrder").select("dispatchID, Order ( orderCode, Client ( company ) )").in("dispatchID", dispatchIDs)
      : Promise.resolve({ data: [] }),
    branchIDs.length
      ? supabase.from("BranchStops").select("branchID, branchName").in("branchID", branchIDs)
      : Promise.resolve({ data: [] }),
    pickupIDs.length
      ? supabase.from("PickupStops").select("pickupID, warehouseName").in("pickupID", pickupIDs)
      : Promise.resolve({ data: [] }),
    employeeIDs.length
      ? supabase.from("Employee").select("employeeID, employeeName").in("employeeID", employeeIDs)
      : Promise.resolve({ data: [] }),
    signPodUrls(rows.map((r) => r.proof)),
  ]);

  const tripBy = new Map<string, { orderCode: string | null; client: string | null }>();
  for (const trip of (trips.data ?? []) as { dispatchID: string; Order: unknown }[]) {
    const order = one(trip.Order as { orderCode: string | null; Client: unknown } | null);
    const client = one(order?.Client as { company: string | null } | null);
    tripBy.set(trip.dispatchID, { orderCode: order?.orderCode ?? null, client: client?.company ?? null });
  }
  const branchBy = new Map(((branches.data ?? []) as { branchID: number; branchName: string | null }[]).map((b) => [b.branchID, b.branchName]));
  const pickupBy = new Map(((pickups.data ?? []) as { pickupID: number; warehouseName: string | null }[]).map((p) => [p.pickupID, p.warehouseName]));
  const nameBy = new Map(((employees.data ?? []) as { employeeID: string; employeeName: string }[]).map((e) => [e.employeeID, e.employeeName]));

  return rows.map((row) => {
    const trip = row.dispatchID ? tripBy.get(row.dispatchID) : undefined;
    const isPickup = row.pickupID !== null;
    return {
      podID: row.podID,
      dispatchID: row.dispatchID,
      orderCode: trip?.orderCode ?? null,
      client: trip?.client ?? null,
      stopName:
        (isPickup ? pickupBy.get(row.pickupID as number) : row.branchID !== null ? branchBy.get(row.branchID) : null) ??
        (isPickup ? "Pickup" : "Stop"),
      isPickup,
      photoUrl: row.proof ? signed.get(row.proof) ?? null : null,
      fileType: row.fileType,
      receiverName: row.receiverName && row.receiverName !== "N/A" ? row.receiverName : null,
      deliveredAt: row.deliveredAt,
      crewName: row.recordedBy ? nameBy.get(row.recordedBy) ?? null : null,
      reasons: row.validationNotes,
      scanMethod: row.scanMethod,
      capturedAt: row.capturedAt,
      captureLat: row.captureLat,
      captureLng: row.captureLng,
      reviewStatus: row.reviewStatus,
      reviewedAt: row.reviewedAt,
      reviewedByName: row.reviewedBy ? nameBy.get(row.reviewedBy) ?? null : null,
      reviewNote: row.reviewNote,
    };
  });
}

export class ReviewError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Records the office's decision. Only on a proof that needs one, and only once
 * unless `allowChange` - a reviewer changing their mind does it on purpose,
 * from the reviewed list, not by a second click racing the first.
 */
export async function reviewProof(input: {
  podID: string;
  decision: ReviewDecision;
  note: string;
  reviewerID: string;
  allowChange: boolean;
}): Promise<{ before: Pick<PodRow, "reviewStatus" | "reviewNote">; dispatchID: string | null }> {
  const note = input.note.trim();
  if (input.decision === "rejected" && !note) {
    throw new ReviewError("Say why the proof is rejected.", 400);
  }

  const { data: current, error: readError } = await supabase
    .from("POD")
    .select("podID, dispatchID, validationStatus, reviewStatus, reviewNote")
    .eq("podID", input.podID)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new ReviewError("That proof no longer exists.", 404);
  if (current.validationStatus !== "unverified") {
    throw new ReviewError("This proof does not need a review.", 409);
  }
  if (current.reviewStatus && !input.allowChange) {
    throw new ReviewError(`This proof was already ${current.reviewStatus}. Refresh the list.`, 409);
  }

  let update = supabase
    .from("POD")
    .update({
      reviewStatus: input.decision,
      reviewedBy: input.reviewerID,
      reviewedAt: new Date().toISOString(),
      reviewNote: note || null,
    })
    .eq("podID", input.podID);
  // Two reviewers on the same proof: the second is told, not silently applied.
  update = current.reviewStatus ? update.eq("reviewStatus", current.reviewStatus) : update.is("reviewStatus", null);

  const { data: updated, error } = await update.select("podID").maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new ReviewError("Someone else reviewed this proof just now. Refresh the list.", 409);

  return {
    before: { reviewStatus: current.reviewStatus as ReviewDecision | null, reviewNote: current.reviewNote as string | null },
    dispatchID: current.dispatchID as string | null,
  };
}
