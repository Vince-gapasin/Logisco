"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Trash2, X } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { ACCEPTED_ONWARDS } from "@/app/lib/enums";

/**
 * The office ending a booking the crew cannot or will not end.
 *
 * Three things were impossible from the office until now. Cancelling refused once
 * the cargo was moving - "use the foul trip flow instead" - and the foul trip
 * flow could only be opened from the crew app, so a trip whose crew had gone
 * silent could not be cancelled, could not be declared a foul trip, and could not
 * be finished. It stayed In Transit until somebody edited the database.
 *
 * The reason is required and it is not decoration: it is written to the audit
 * trail and appears in that booking's Remarks History under the name of whoever
 * pressed the button. Someone reading the history a month later has to be able to
 * tell an override from the crew's own work, and why it happened.
 */

type Action = "cancel" | "foul-trip" | "complete";

const CHOICES: {
  action: Action;
  label: string;
  hint: string;
  icon: typeof Trash2;
  tone: string;
  selected: string;
}[] = [
  {
    action: "complete",
    label: "Close it as delivered",
    hint: "They delivered everything and never closed the trip. Stops still open are closed with no proof of delivery, and the report says so.",
    icon: CheckCircle2,
    tone: "border-slate-200 hover:border-emerald-400",
    selected: "border-emerald-500 bg-emerald-50/60",
  },
  {
    action: "foul-trip",
    label: "Declare a foul trip",
    hint: "Something went wrong and the crew have not reported it. Opens the same recovery the crew's report opens, so a replacement can be arranged.",
    icon: ShieldAlert,
    tone: "border-slate-200 hover:border-amber-400",
    selected: "border-amber-500 bg-amber-50/60",
  },
  {
    action: "cancel",
    label: "Cancel the booking",
    hint: "The delivery is not happening. The truck and crew are released and the booking is closed.",
    icon: Trash2,
    tone: "border-slate-200 hover:border-red-400",
    selected: "border-red-500 bg-red-50/60",
  },
];

export default function BookingOverrideModal({
  isOpen,
  onClose,
  orderID,
  orderCode,
  tripStatus,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderID: string;
  orderCode: string;
  /** Where the trip has got to, so choices that cannot apply are not offered. */
  tripStatus?: string | null;
  /** Called after a successful override, to reload whatever is behind this. */
  onDone: (message: string) => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [issueType, setIssueType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  // A foul trip is something going wrong on a job a crew has taken, and closing
  // one as delivered says a crew delivered it. Neither can be true before anyone
  // has accepted it. The server refuses both, but refusing after somebody has
  // chosen and typed out a reason is a poor way to say so.
  const accepted = !tripStatus || ACCEPTED_ONWARDS.includes(tripStatus);
  const blockedBecause = accepted
    ? null
    : `Not until a crew accepts this booking - it is ${tripStatus}.`;

  const chosen = CHOICES.find((choice) => choice.action === action);

  const submit = async () => {
    if (!action) {
      setError("Choose what to do with this booking.");
      return;
    }
    if (!reason.trim()) {
      setError("Say why. This is recorded against your name.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await apiFetch(`/api/bookings/${orderID}/override`, {
        method: "POST",
        body: JSON.stringify({ action, reason: reason.trim(), issueType: issueType.trim() }),
      });
      onDone(
        action === "cancel"
          ? "Booking cancelled."
          : action === "foul-trip"
            ? "Foul trip declared. It is in the recovery list now."
            : "Booking closed.",
      );
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not do that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85dvh] flex flex-col shadow-2xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              End this booking from the office
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 wrap-break-word">{orderCode}</p>
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

        <div className="p-5 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-600">
            For when the crew cannot do it themselves - an unreachable driver, a dead phone, a
            delivery finished and never closed. Whichever you choose is recorded in this
            booking&apos;s history with your name and your reason.
          </p>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-700 mb-1">
              What happened to this delivery?
            </legend>
            {CHOICES.map((choice) => {
              const Icon = choice.icon;
              const isChosen = action === choice.action;
              // Cancelling is always available; it is the answer for a booking
              // that has not started as much as for one that has.
              const blocked = choice.action !== "cancel" && !accepted;

              return (
                <label
                  key={choice.action}
                  className={`flex gap-3 rounded-xl border-2 p-3 transition-colors ${
                    blocked
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                      : `cursor-pointer ${isChosen ? choice.selected : choice.tone}`
                  }`}
                >
                  <input
                    type="radio"
                    name="override"
                    checked={isChosen}
                    disabled={blocked}
                    onChange={() => {
                      setAction(choice.action);
                      setError("");
                    }}
                    className="mt-1 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <Icon className="w-4 h-4 shrink-0" />
                      {choice.label}
                    </span>
                    <span className="block text-xs text-slate-600 mt-0.5">
                      {blocked ? blockedBecause : choice.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {action === "foul-trip" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                What kind of problem?
              </label>
              <input
                type="text"
                value={issueType}
                onChange={(event) => setIssueType(event.target.value)}
                placeholder="Ex. Crew unreachable"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Why <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
              }}
              placeholder="Ex. Driver unreachable since 2pm, client confirmed the delivery arrived."
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto min-h-tap sm:min-h-0 px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-sm transition-colors"
          >
            Never mind
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !action}
            className={`w-full sm:w-auto min-h-tap sm:min-h-0 px-5 py-2.5 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60 ${
              action === "cancel"
                ? "bg-red-600 hover:bg-red-700"
                : action === "foul-trip"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {saving ? "Working..." : chosen ? chosen.label : "Choose one"}
          </button>
        </div>
      </div>
    </div>
  );
}
