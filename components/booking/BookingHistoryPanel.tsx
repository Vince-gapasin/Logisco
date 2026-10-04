"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import BookingHistory from "@/components/booking/BookingHistory";

/**
 * One booking's remarks history, as its own screen.
 *
 * The table was only ever reachable by opening a booking and scrolling to the
 * seventh section of it, which is a long way to go for the question the reports
 * screen is usually being asked: what happened on this one, and where is the
 * proof. It stays there - it belongs in the booking's own details - and this is
 * the short way in from the list.
 *
 * Shaped like the mechanic's repair history and the office's maintenance
 * history: back, what it is about, one card, one table. Three lists behind a
 * History button, and no reason for any of them to look different from the
 * others.
 */
export default function BookingHistoryPanel({
  orderID,
  orderCode,
  clientName,
  onBack,
}: {
  orderID: string;
  orderCode: string;
  clientName?: string | null;
  onBack: () => void;
}) {
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative animate-fade-in">
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the records"
          className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 wrap-break-word">
            Remarks History &mdash; {orderCode}
          </h1>
          {clientName ? <p className="text-sm text-slate-600 truncate">{clientName}</p> : null}
        </div>
      </div>

      <BookingHistory orderID={orderID} title="Remarks History" />
    </div>
  );
}
