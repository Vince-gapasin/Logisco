"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import StopProofList, { type ProofBearingStop } from "@/components/booking/StopProofList";

/**
 * Every proof on one delivery, opened from a link in the records table.
 *
 * The proofs were only reachable by opening the booking and scrolling to a card
 * in the middle of it. From the records table they are now one click, which is
 * where somebody checking a month of deliveries actually is.
 *
 * Two layers, because "show me the proofs" and "let me read this signature" are
 * different requests: the list, with each stop's time and receiver, and a
 * full-size overlay on top of it when a photograph is tapped.
 */
export default function ProofViewerModal({
  isOpen,
  onClose,
  orderCode,
  pickups = [],
  deliveries = [],
  tripProof = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
  pickups?: ProofBearingStop[];
  deliveries?: ProofBearingStop[];
  tripProof?: string | null;
}) {
  const [enlarged, setEnlarged] = useState<{ src: string; label: string } | null>(null);

  // Escape closes the photograph first and the dialog second, so it never takes
  // two presses to get back to where you were.
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (enlarged) setEnlarged(null);
      else onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, enlarged, onClose]);

  // There is deliberately no effect resetting `enlarged` when this closes. An
  // enlarged photograph left behind would reappear the next time a row was
  // clicked, and clearing it from an effect is a setState during render in all
  // but name. The caller mounts this only while a record is open, so closing
  // unmounts it and the state goes with it - which is what a key or a conditional
  // mount is for.
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85dvh] flex flex-col shadow-2xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Proof of Delivery</h3>
            <p className="text-xs text-slate-600 wrap-break-word">{orderCode}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <StopProofList
            pickups={pickups}
            deliveries={deliveries}
            tripProof={tripProof}
            onOpenImage={(src, label) => setEnlarged({ src, label })}
          />
        </div>
      </div>

      {enlarged && (
        <div
          className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/85 animate-fade-in"
          onClick={() => setEnlarged(null)}
        >
          <div
            className="max-w-3xl w-full flex flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlarged.src}
              alt={`Proof of delivery from ${enlarged.label}`}
              className="max-h-[70dvh] w-auto max-w-full rounded-xl border border-slate-700 object-contain bg-slate-900"
            />
            <div className="flex items-center gap-3">
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
    </div>
  );
}
