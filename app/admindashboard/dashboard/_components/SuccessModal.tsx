"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { CheckCircle2, Copy } from "lucide-react";

// ==========================================
// SUCCESS MODAL COMPONENT
// ==========================================

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
  trackingToken?: string;
  /** The booking just made, so its link can be emailed again. */
  orderID?: string;
}

export function SuccessModal({ isOpen, onClose, orderCode, trackingToken, orderID }: SuccessModalProps) {
  const [copied, setCopied] = useState(false);
  // The link is emailed to the client when the booking is made. This says
  // where it went, and sends it again - a wrong address, or a client who
  // never received it.
  const [emailState, setEmailState] = useState<{ status: "idle" | "sending" | "sent" | "failed"; message: string }>({
    status: "idle",
    message: "",
  });

  if (!isOpen) return null;

  // Customer-facing tracking link for this order.
  const trackingLink =
    trackingToken && typeof window !== "undefined"
      ? `${window.location.origin}/client-view?token=${trackingToken}`
      : "";

  const emailTrackingLink = async () => {
    if (!orderID) return;
    setEmailState({ status: "sending", message: "" });
    try {
      const res = await apiFetch<{ data: { email: string | null } }>(`/api/bookings/${orderID}/tracking-email`, {
        method: "POST",
      });
      setEmailState({ status: "sent", message: `Sent to ${res.data?.email ?? "the client"}.` });
    } catch (error) {
      setEmailState({
        status: "failed",
        message: error instanceof Error ? error.message : "Could not send it.",
      });
    }
  };

  const copyTrackingLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this tracking link:", trackingLink);
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center">
        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">
          Booking Generated Successfully!
        </h3>
        <p className="text-sm font-semibold text-blue-600 mb-3">
          Order ID: {orderCode}
        </p>
        <p className="text-xs text-slate-600 mb-4">
          Your booking has been generated successfully.
        </p>

        {trackingLink && (
          <div className="mb-6 text-left">
            <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">
              Customer tracking link
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={trackingLink}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={copyTrackingLink}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={emailTrackingLink}
                disabled={!orderID || emailState.status === "sending"}
                className="min-h-tap md:min-h-0 inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {emailState.status === "sending" ? "Sending…" : "Email it to the client"}
              </button>
              {emailState.message && (
                <span className={`text-xs ${emailState.status === "failed" ? "text-red-600" : "text-emerald-700"}`}>
                  {emailState.message}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-[11px] text-slate-500 mt-1.5">
              The client is emailed this link automatically when the booking is made.
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors shadow-md"
        >
          Done
        </button>
      </div>
    </div>
  );
}
