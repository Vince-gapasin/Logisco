"use client";

import React, { useEffect, useState } from "react";
import { formatDateTime } from "@/app/lib/datetime";

/**
 * Every proof of delivery on a trip, one per stop, warehouses included.
 *
 * Written once and used on both the reports screen and the admin dashboard,
 * because the two had drifted in the way that matters: reports listed the proofs
 * per stop, and the dashboard showed DispatchOrder.pod_url, which is a single
 * column the crew app overwrote at every stop. So the same delivery had a full
 * record on one screen and its last photograph on the other.
 *
 * The POD table is the record. It carries one row per stop with a dispatchID, a
 * time, who recorded it, and - when no photograph was taken - the reason there
 * isn't one. pod_url survives only as a pointer for trips that predate all of
 * that, and is shown when there are no rows at all.
 */

export interface StopProof {
  podID: string;
  proof: string | null;
  receiverName: string | null;
  remarks: string | null;
  deliveredAt: string | null;
  source: string | null;
  missingReason: string | null;
  fileType: string | null;
}

export interface ProofBearingStop {
  branchName?: string | null;
  /** Pickups name themselves differently; both are folded into one list. */
  warehouseName?: string | null;
  POD?: StopProof[];
}

/** A PDF rather than a photograph: a partner may send a signed note as one. */
function isPdf(value: string, fileType?: string | null): boolean {
  if (fileType && fileType.toLowerCase().includes("pdf")) return true;
  return /\.pdf(\?|$)/i.test(value);
}

function Thumbnail({
  href,
  fileType,
  label,
  onOpen,
}: {
  href: string;
  fileType?: string | null;
  label: string;
  /** Given, the image opens in place instead of in a new tab. */
  onOpen?: (src: string, label: string) => void;
}) {
  // A PDF always opens in a new tab. There is nothing useful to do with one in an
  // overlay that the browser's own viewer does not do better.
  if (isPdf(href, fileType)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="min-h-tap md:min-h-0 inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
      >
        View PDF
      </a>
    );
  }

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(href, label)}
        aria-label={`View the proof from ${label}`}
        className="shrink-0 rounded border border-slate-200 hover:border-blue-400 transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={`Proof of delivery from ${label}`}
          className="h-14 w-14 rounded object-cover"
        />
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={href}
        alt={`Proof of delivery from ${label}`}
        className="h-14 w-14 rounded border border-slate-200 object-cover"
      />
    </a>
  );
}

export default function StopProofList({
  pickups = [],
  deliveries = [],
  tripProof = null,
}: {
  pickups?: ProofBearingStop[];
  deliveries?: ProofBearingStop[];
  /** DispatchOrder.pod_url, for trips recorded before the POD rows existed. */
  tripProof?: string | null;
}) {
  const [enlarged, setEnlarged] = useState<{ src: string; label: string } | null>(null);

  // Escape closes the photograph. Registered only while one is open, so it cannot
  // swallow the Escape that closes the booking behind it.
  useEffect(() => {
    if (!enlarged) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEnlarged(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged]);

  const setEnlargedFor = (src: string, label: string) => setEnlarged({ src, label });

  // Pickups first, because that is the order the trip ran in.
  const stops = [
    ...pickups.map((stop) => ({
      ...stop,
      label: stop.warehouseName ?? stop.branchName ?? "Pickup",
      isPickup: true,
    })),
    ...deliveries.map((stop) => ({
      ...stop,
      label: stop.branchName ?? "Stop",
      isPickup: false,
    })),
  ];

  const withProofs = stops.filter((stop) => (stop.POD ?? []).length > 0);

  if (withProofs.length === 0 && !tripProof) {
    return (
      <p className="text-xs text-slate-500">
        No proof of delivery has been recorded for this booking.
      </p>
    );
  }

  const recorded = withProofs.reduce((total, stop) => total + (stop.POD ?? []).length, 0);

  return (
    <div className="space-y-3">
      {recorded > 0 && (
        <p className="text-xs text-slate-600">
          {recorded} {recorded === 1 ? "record" : "records"} across {withProofs.length}{" "}
          {withProofs.length === 1 ? "stop" : "stops"}.
        </p>
      )}

      {withProofs.map((stop) =>
        (stop.POD ?? []).map((pod) => (
          <div
            key={pod.podID}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 wrap-break-word">
                {stop.isPickup && (
                  <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    Pickup
                  </span>
                )}
                {stop.label}
              </p>
              <p className="text-xs text-slate-600">
                {pod.deliveredAt ? formatDateTime(pod.deliveredAt) : ""}
                {pod.receiverName && pod.receiverName !== "N/A"
                  ? ` - received by ${pod.receiverName}`
                  : ""}
                {pod.source === "coordinator" ? " (recorded by a coordinator)" : ""}
              </p>
              {pod.remarks && <p className="text-xs text-slate-500 wrap-break-word">{pod.remarks}</p>}
              {/* A stop finished without a photograph still has a row, so the
                  absence is stated rather than looking like a stop nobody
                  reached. */}
              {!pod.proof && pod.missingReason && (
                <p className="text-xs text-amber-800">No file: {pod.missingReason}</p>
              )}
            </div>
            {pod.proof && (
              <Thumbnail
                href={pod.proof}
                fileType={pod.fileType}
                label={stop.label}
                onOpen={setEnlargedFor}
              />
            )}
          </div>
        )),
      )}

      {enlarged && (
        <div
          className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/85 animate-fade-in"
          onClick={() => setEnlarged(null)}
        >
          <div
            className="flex w-full max-w-3xl flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlarged.src}
              alt={`Proof of delivery from ${enlarged.label}`}
              className="max-h-[70dvh] w-auto max-w-full rounded-xl border border-slate-700 bg-slate-900 object-contain"
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-xs font-medium text-slate-200 wrap-break-word">
                {enlarged.label}
              </span>
              <a
                href={enlarged.src}
                target="_blank"
                rel="noreferrer"
                className="min-h-tap md:min-h-0 inline-flex items-center text-xs font-semibold text-blue-300 hover:underline"
              >
                Open full size
              </a>
              <button
                type="button"
                onClick={() => setEnlarged(null)}
                className="min-h-tap md:min-h-0 inline-flex items-center text-xs font-semibold text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Older trips kept one proof against the trip rather than against a stop. */}
      {tripProof && withProofs.length === 0 && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900">Proof for the whole trip</p>
            <p className="text-xs text-slate-600">
              Recorded before proofs were kept per stop.
            </p>
          </div>
          <Thumbnail href={tripProof} label="the whole trip" onOpen={setEnlargedFor} />
        </div>
      )}
    </div>
  );
}
