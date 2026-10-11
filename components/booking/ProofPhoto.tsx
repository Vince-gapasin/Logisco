"use client";

import React, { useEffect, useState } from "react";

/**
 * One proof-of-delivery photograph: a thumbnail that opens full screen.
 *
 * For the customer's tracking page, which shows a single receipt per stop and
 * none of the office's tooling around it. The office list (StopProofList) keeps
 * its own, with download and PDF handling the customer does not need.
 */
export default function ProofPhoto({ src, label }: { src: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  // Escape closes it. Registered only while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The link is signed for an hour. A page left open longer gets a dead image;
  // saying so beats a broken-image icon.
  if (broken) {
    return <p className="text-xs text-slate-500">Refresh the page to view the proof of delivery.</p>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View the proof of delivery for ${label}`}
        className="mt-2 inline-flex min-h-tap md:pointer-fine:min-h-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 pr-3 text-xs font-semibold text-blue-700 hover:border-blue-400 transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          className="h-12 w-12 rounded object-cover"
        />
        View proof of delivery
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Proof of delivery for ${label}`}
          className="fixed inset-0 z-110 flex items-center justify-center overflow-y-auto bg-slate-950/85 p-4 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-auto flex w-full max-w-3xl flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Proof of delivery for ${label}`}
              className="max-h-[75dvh] w-auto max-w-full rounded-xl border border-slate-700 bg-slate-900 object-contain"
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-xs font-medium text-slate-200 wrap-break-word">{label}</span>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center text-xs font-semibold text-blue-300 hover:underline"
              >
                Open full size
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center text-xs font-semibold text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
