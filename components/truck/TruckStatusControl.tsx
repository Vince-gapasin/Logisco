"use client";

// The office changing a truck's status, when the mechanic cannot.
//
// WHY IT IS NOT THE MECHANIC'S FORM
//
// On the mechanic's side, changing a status opens a maintenance log: what was
// found, what was done, which mechanics worked on it, photographs at each
// phase. That is right for them - they are recording work they did.
//
// The office is doing something else. A coordinator grounding a truck at
// eleven at night because the driver rang in, or putting one back because the
// mechanic said so on the phone, has none of those answers. Put through the
// same form they would leave it blank or fill it in from what they were told,
// and an invented repair record is worse than no repair record: it reads
// afterwards as a mechanic's own account of the work.
//
// So they are asked the one thing they do know, and the only thing that makes
// an override accountable: why. It goes into the maintenance log the server
// already opens, as the report that started the cycle - which is exactly what
// it is. The mechanic fills in the rest when they get to it.

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { TRUCK_STATUS, type TruckStatus } from "@/app/lib/enums";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";
import type { TruckTrip } from "@/services/truck/truckService";
import TruckTripCard from "@/components/truck/TruckTripCard";

// On Delivery is not among them. It is the truck's side of a trip - set when
// the truck is assigned to a booking, cleared when the trip ends - and picking
// it by hand made a truck unbookable with no trip behind it.
const CHOICES: TruckStatus[] = [
  TRUCK_STATUS.available,
  TRUCK_STATUS.onMaintenance,
  TRUCK_STATUS.outOfService,
];

/** The two that mean the truck is off the road. */
const grounded = (status: string) =>
  status === TRUCK_STATUS.onMaintenance || status === TRUCK_STATUS.outOfService;

/**
 * Whether this change is one somebody has to answer for.
 *
 * Taking a truck off the road and putting it back are the two that matter: one
 * stops it being dispatched, the other says it is safe to drive. Moving between
 * Available and On Delivery is the day's ordinary traffic and needs no reason.
 */
export function needsReason(from: string, to: string): boolean {
  return grounded(from) !== grounded(to);
}

export default function TruckStatusControl({
  plateNumber,
  current,
  trip,
  onChange,
  onClose,
}: {
  plateNumber: string;
  current: string;
  /** The booking holding the truck. While there is one, its status is not changed here. */
  trip?: TruckTrip | null;
  /** Saves it. Returns a message when it was refused. */
  onChange: (status: TruckStatus, reason: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<TruckStatus | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mustExplain = target !== null && needsReason(current, target);
  const returning = target === TRUCK_STATUS.available && grounded(current);

  const save = async () => {
    if (!target) return;

    if (mustExplain && reason.trim().length < 3) {
      setError("Say why, so the log shows who decided this and on what.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const refused = await onChange(target, reason.trim());
      if (refused) {
        setError(refused);
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 bg-[#000c31] text-white">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold truncate">Change status</h2>
            <p className="text-slate-300 text-xs mt-0.5 truncate">{plateNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 min-w-tap min-h-tap sm:pointer-fine:min-w-0 sm:pointer-fine:min-h-0 inline-flex items-center justify-center rounded-lg hover:bg-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {trip ? (
          <div className="p-5 space-y-4">
            <TruckTripCard trip={trip} />
            <p className="text-sm text-slate-600">
              This truck&apos;s status follows its booking, so it cannot be changed here. If the
              truck has broken down, report a foul trip; to stop or close the delivery, use the
              booking&apos;s override.
            </p>
          </div>
        ) : (
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Currently {current}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CHOICES.filter((choice) => choice !== current).map((choice) => {
                const styles = getStatusStyles(choice);
                const picked = target === choice;

                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => {
                      setTarget(choice);
                      setError(null);
                    }}
                    aria-pressed={picked}
                    className={`min-h-tap sm:pointer-fine:min-h-0 px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                      picked
                        ? "border-blue-600 bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 align-middle ${
                        styles.bgLight.split(" ")[0]
                      }`}
                    />
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>

          {mustExplain && (
            <div>
              <label
                htmlFor="truck-status-reason"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Why {returning ? "it is back in service" : "it is off the road"}
                <span className="text-red-500"> *</span>
              </label>
              <textarea
                id="truck-status-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder={
                  returning
                    ? "e.g. Mechanic confirmed by phone that the brake line is replaced."
                    : "e.g. Driver reported the clutch slipping on the way back from Lipa."
                }
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />

              {returning && (
                <p className="mt-2 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>
                    This records that <strong>you</strong> put the truck back, not that a mechanic
                    signed it off. Say who told you it was fixed.
                  </span>
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
        )}

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-tap sm:pointer-fine:min-h-0 px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            {trip ? "Close" : "Cancel"}
          </button>
          {!trip && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!target || saving}
            className="min-h-tap sm:pointer-fine:min-h-0 px-5 py-2.5 bg-blue-700 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Change status"}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
