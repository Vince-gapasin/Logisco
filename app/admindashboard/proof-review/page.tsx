"use client";

// Proof Review: where the office looks at proofs of delivery the scan could
// not fully check, and approves or rejects each one.
//
// The "Check the proof" notification opens this page. So does the "Review"
// link beside a proof marked Needs review on a booking.

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ClipboardCheck, MapPin, XCircle } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { formatDateTime } from "@/app/lib/datetime";
import { useToast } from "@/components/Toast";
import ListLoadError from "@/components/ListLoadError";
import ProofPhoto from "@/components/booking/ProofPhoto";
import type { ProofForReview, ReviewQueue } from "@/services/storage/podReviewService";

const TABS: { queue: ReviewQueue; label: string }[] = [
  { queue: "pending", label: "Needs review" },
  { queue: "approved", label: "Approved" },
  { queue: "rejected", label: "Rejected" },
];

function ProofCard({
  proof,
  highlighted,
  onDecided,
}: {
  proof: ProofForReview;
  highlighted: boolean;
  onDecided: () => void;
}) {
  const showToast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const decide = async (decision: "approved" | "rejected") => {
    if (decision === "rejected" && !note.trim()) {
      showToast("Say why the proof is rejected.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/pod/${proof.podID}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // From the Approved or Rejected tab, a decision is a deliberate change.
        body: JSON.stringify({ decision, note, change: proof.reviewStatus !== null }),
      });
      showToast(decision === "approved" ? "Proof approved." : "Proof rejected.", "success");
      onDecided();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save the review.", "error");
    } finally {
      setSaving(false);
    }
  };

  const mapLink =
    proof.captureLat !== null && proof.captureLng !== null
      ? `https://www.google.com/maps?q=${proof.captureLat},${proof.captureLng}`
      : null;

  return (
    <li
      id={`pod-${proof.podID}`}
      className={`rounded-2xl border bg-white p-4 shadow-sm ${highlighted ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200"}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="shrink-0">
          {proof.photoUrl ? (
            <ProofPhoto src={proof.photoUrl} label={proof.stopName} />
          ) : (
            <p className="text-xs text-slate-500">The photo could not be loaded.</p>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5 text-sm">
          <p className="font-semibold text-slate-900 wrap-break-word">
            {proof.isPickup && (
              <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                Pickup
              </span>
            )}
            {proof.stopName}
          </p>
          <p className="text-xs text-slate-600">
            {[proof.orderCode, proof.client].filter(Boolean).join(" · ") || "Booking not found"}
          </p>
          <p className="text-xs text-slate-600">
            {proof.deliveredAt ? `Closed ${formatDateTime(proof.deliveredAt)}` : "Closed"}
            {proof.crewName ? ` by ${proof.crewName}` : ""}
            {proof.receiverName ? ` · received by ${proof.receiverName}` : ""}
          </p>
          {proof.reasons && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 wrap-break-word">
              <span className="font-semibold">Why it needs a look: </span>
              {proof.reasons}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{proof.scanMethod === "scanner" ? "Taken with the receipt scanner" : "Taken with the plain camera"}</span>
            {proof.capturedAt && <span>at {formatDateTime(proof.capturedAt)}</span>}
            {mapLink && (
              <a href={mapLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Where it was taken
              </a>
            )}
          </p>

          {proof.reviewStatus && (
            <p className={`text-xs font-semibold ${proof.reviewStatus === "approved" ? "text-emerald-700" : "text-red-700"}`}>
              {proof.reviewStatus === "approved" ? "Approved" : "Rejected"}
              {proof.reviewedByName ? ` by ${proof.reviewedByName}` : ""}
              {proof.reviewedAt ? `, ${formatDateTime(proof.reviewedAt)}` : ""}
              {proof.reviewNote ? ` - ${proof.reviewNote}` : ""}
            </p>
          )}
        </div>
      </div>

      {rejecting ? (
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-medium text-slate-700" htmlFor={`note-${proof.podID}`}>
            Why is it rejected? <span className="text-red-500">*</span>
          </label>
          <textarea
            id={`note-${proof.podID}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex. Not signed by the receiver; get a signed copy from the branch."
            className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <p className="text-xs text-slate-500">
            The client will not see a rejected proof. Replace it with a good copy from the booking to fix the record.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejecting(false)}
              disabled={saving}
              className="min-h-tap md:pointer-fine:min-h-0 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => decide("rejected")}
              disabled={saving || !note.trim()}
              className="min-h-tap md:pointer-fine:min-h-0 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Reject proof"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {proof.reviewStatus !== "rejected" && (
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={saving}
              className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Reject
            </button>
          )}
          {proof.reviewStatus !== "approved" && (
            <button
              type="button"
              onClick={() => decide("approved")}
              disabled={saving}
              className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {saving ? "Saving..." : "Approve"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function ProofReviewScreen() {
  const searchParams = useSearchParams();
  const focusPod = searchParams.get("pod");
  const [queue, setQueue] = useState<ReviewQueue>("pending");
  const [proofs, setProofs] = useState<ProofForReview[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (which: ReviewQueue) => {
    try {
      const result = await apiFetch<{ proofs: ProofForReview[] }>(`/api/pod/review?queue=${which}`, { cache: "no-store" });
      setProofs(result.proofs);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the proofs to review.");
    }
  }, []);

  useEffect(() => {
    // The rows land in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(queue);
  }, [load, queue]);

  // From a notification or a booking: bring that proof into view.
  useEffect(() => {
    if (!focusPod || !proofs) return;
    document.getElementById(`pod-${focusPod}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusPod, proofs]);

  const switchTo = (next: ReviewQueue) => {
    if (next === queue) return;
    setProofs(null);
    setQueue(next);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-5xl mx-auto bg-slate-50 min-h-[100dvh]">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-blue-600" aria-hidden="true" />
          Proof Review
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Proofs of delivery the receipt scan could not fully check. Look at each photo, then approve it or reject it.
        </p>
      </div>

      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.queue}
            role="tab"
            type="button"
            aria-selected={queue === tab.queue}
            onClick={() => switchTo(tab.queue)}
            className={`min-h-tap md:pointer-fine:min-h-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              queue === tab.queue ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            {tab.queue === "pending" && queue === "pending" && proofs ? ` (${proofs.length})` : ""}
          </button>
        ))}
      </div>

      {loadError && <ListLoadError message={loadError} onRetry={() => void load(queue)} compact={Boolean(proofs?.length)} />}

      {!proofs && !loadError && <p className="text-sm text-slate-500">Loading...</p>}

      {proofs && proofs.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          {queue === "pending"
            ? "Nothing to review. Every proof has been checked."
            : queue === "approved"
              ? "No proofs have been approved yet."
              : "No proofs have been rejected."}
        </p>
      )}

      {proofs && proofs.length > 0 && (
        <ul className="space-y-3">
          {proofs.map((proof) => (
            <ProofCard key={proof.podID} proof={proof} highlighted={proof.podID === focusPod} onDecided={() => void load(queue)} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProofReviewPage() {
  // useSearchParams needs a boundary to prerender.
  return (
    <React.Suspense fallback={null}>
      <ProofReviewScreen />
    </React.Suspense>
  );
}
