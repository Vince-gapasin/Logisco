"use client";

import React, { useCallback, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Package,
  Paperclip,
  Phone,
  Truck,
  X,
} from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";
import type { SubconStopView, SubconTripView } from "@/services/subcon/subconService";

// A partner's trip, updated by the coordinator from what the partner reports:
// the pickup, each stop with the POD they sent (or why there is none), or a
// problem, which becomes a foul trip.

const MIN_REASON = 10;
const ISSUES = ["Broken Truck", "Accident", "Severe Traffic", "Client Rejected", "Other"];

// datetime-local wants local time without a zone.
const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—");

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50";
const label = "block text-xs font-semibold text-slate-700 mb-1";

async function postForm(dispatchID: string, form: FormData) {
  return apiFetch(`/api/subcon-trips/${dispatchID}`, { method: "POST", body: form });
}

function StopProof({ stop }: { stop: SubconStopView }) {
  const proof = stop.proof;
  if (!proof) return <p className="text-xs text-slate-500">Delivered {when(stop.completedAt)}</p>;
  return (
    <div className="space-y-1 text-xs text-slate-600">
      <p>
        Delivered {when(proof.deliveredAt)}
        {proof.receiverName ? ` · received by ${proof.receiverName}` : ""}
      </p>
      {proof.url ? (
        <a href={proof.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-blue-600 hover:underline">
          {proof.isPdf ? (
            <>
              <FileText className="h-4 w-4" /> View proof of delivery (PDF)
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proof.url} alt="Proof of delivery" className="h-12 w-12 rounded object-cover border border-slate-200" />
              View proof of delivery
            </>
          )}
        </a>
      ) : proof.missingReason ? (
        <p className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-amber-900">
          <strong>No proof of delivery:</strong> {proof.missingReason}
        </p>
      ) : null}
      {proof.remarks && <p>Remarks: {proof.remarks}</p>}
      {proof.recordedBy && <p className="text-slate-400">Recorded by {proof.recordedBy}</p>}
    </div>
  );
}

function DeliveryForm({ dispatchID, stop, onSaved }: { dispatchID: string; stop: SubconStopView; onSaved: (message: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [noProof, setNoProof] = useState(false);
  const [reason, setReason] = useState("");
  const [receiver, setReceiver] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(localNow());
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (!noProof && !file) return setError("Attach the proof of delivery the partner sent, or tick that there is none.");
    if (noProof && reason.trim().length < MIN_REASON) return setError("Give the reason there is no proof of delivery (at least 10 characters).");
    if (file && !(file.type.startsWith("image/") || file.type === "application/pdf")) return setError("Attach a photo or a PDF.");
    if (file && file.size > 10 * 1024 * 1024) return setError("The file must be 10 MB or smaller.");
    if (!deliveredAt) return setError("Enter when it was delivered.");

    const form = new FormData();
    form.append("action", "deliver");
    form.append("branchID", String(stop.branchID));
    if (!noProof && file) form.append("proof", file);
    if (noProof) form.append("missingReason", reason.trim());
    form.append("receiverName", receiver.trim());
    form.append("deliveredAt", toIso(deliveredAt));
    form.append("remarks", remarks.trim());

    setSaving(true);
    try {
      const res = await postForm(dispatchID, form);
      const completed = (res as { data?: { completed?: boolean } })?.data?.completed;
      onSaved(completed ? "Last stop delivered. The trip is complete." : `${stop.branchName} recorded as delivered.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the delivery.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      {!noProof && (
        <div>
          <label className={label} htmlFor={`pod-${stop.branchID}`}>Proof of delivery (photo or PDF) *</label>
          <input
            id={`pod-${stop.branchID}`}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          {file && (
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Paperclip className="h-3.5 w-3.5" /> {file.name} ({Math.ceil(file.size / 1024)} KB)
            </p>
          )}
        </div>
      )}
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={noProof} onChange={(e) => setNoProof(e.target.checked)} className="mt-1" />
        The partner did not send a proof of delivery
      </label>
      {noProof && (
        <div>
          <label className={label} htmlFor={`reason-${stop.branchID}`}>Reason *</label>
          <textarea
            id={`reason-${stop.branchID}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${field} min-h-16`}
            placeholder="e.g. Receiver signed on the partner's paper copy; partner will send it on Monday"
          />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor={`recv-${stop.branchID}`}>Received by</label>
          <input id={`recv-${stop.branchID}`} value={receiver} onChange={(e) => setReceiver(e.target.value)} className={field} placeholder="Receiver's name" />
        </div>
        <div>
          <label className={label} htmlFor={`at-${stop.branchID}`}>Delivered at *</label>
          <input
            id={`at-${stop.branchID}`}
            type="datetime-local"
            value={deliveredAt}
            max={localNow()}
            onChange={(e) => setDeliveredAt(e.target.value)}
            className={field}
          />
        </div>
      </div>
      <div>
        <label className={label} htmlFor={`rem-${stop.branchID}`}>Remarks</label>
        <input id={`rem-${stop.branchID}`} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={field} placeholder="Optional" />
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Record delivery
        </button>
      </div>
    </div>
  );
}

interface SubconTripModalProps {
  dispatchID: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

// Mounted per trip, so opening another one starts fresh.
export default function SubconTripModal(props: SubconTripModalProps) {
  if (!props.dispatchID) return null;
  return <SubconTrip key={props.dispatchID} {...props} dispatchID={props.dispatchID} />;
}

function SubconTrip({ dispatchID, onClose, onChanged }: SubconTripModalProps & { dispatchID: string }) {
  const [trip, setTrip] = useState<SubconTripView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [openStop, setOpenStop] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [pickupAt, setPickupAt] = useState(localNow());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showProblem, setShowProblem] = useState(false);
  const [issue, setIssue] = useState(ISSUES[0]);
  const [details, setDetails] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: SubconTripView }>(`/api/subcon-trips/${dispatchID}`, { cache: "no-store" });
      setTrip(res.data);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the trip.");
    }
  }, [dispatchID]);

  // Loaded now, and kept current if someone else records an update.
  usePolling(() => void load(), 60000);

  const done = (message: string) => {
    setNotice(message);
    setOpenStop(null);
    setShowProblem(false);
    setActionError("");
    void load();
    onChanged?.();
  };

  const run = async (form: FormData, message: string) => {
    setBusy(true);
    setActionError("");
    try {
      await postForm(dispatchID, form);
      done(message);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const recordPickup = () => {
    const form = new FormData();
    form.append("action", "pickup");
    form.append("at", toIso(pickupAt));
    void run(form, "Pickup recorded. The trip is in transit.");
  };

  const sendProblem = () => {
    if (issue === "Other" && !details.trim()) return setActionError("Describe what happened.");
    const form = new FormData();
    form.append("action", "problem");
    form.append("issueType", issue);
    form.append("details", details.trim());
    void run(form, "Recorded as a foul trip. Recover it from the Foul Trip feed.");
  };

  const active = trip && ["Pending", "Assigned", "Accepted", "In Transit", "Start Delivery", "In Warehouse", "Arrived"].includes(trip.status);

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="subcon-title">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-full flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 bg-[#000c31] text-white">
          <div className="min-w-0">
            <h2 id="subcon-title" className="text-lg font-bold truncate">
              Sub-con Trip{trip?.orderCode ? `: ${trip.orderCode}` : ""}
            </h2>
            <p className="text-xs opacity-80">{trip ? `${trip.clientName ?? "Client"} · ${trip.status}` : "Loading…"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-sm text-slate-800">
          {loadError && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700">{loadError}</p>}
          {!trip && !loadError && (
            <p className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading the trip…</p>
          )}

          {trip && (
            <>
              {notice && (
                <p role="status" className="flex gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> {notice}
                </p>
              )}

              {/* Who is carrying it */}
              <div className="rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Partner</p>
                  <p className="font-semibold text-slate-900">{trip.partner.name}</p>
                  {trip.partner.contactNumber && (
                    <a href={`tel:${trip.partner.contactNumber}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {trip.partner.contactName ? `${trip.partner.contactName} · ` : ""}{trip.partner.contactNumber}
                    </a>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Their driver and truck</p>
                  <p className="text-slate-900">
                    <Truck className="inline h-4 w-4 mr-1 text-slate-400" />
                    {[trip.driverName, trip.plateNumber].filter(Boolean).join(" · ") || "Not given"}
                  </p>
                  {trip.driverContact && (
                    <a href={`tel:${trip.driverContact}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {trip.driverContact}
                    </a>
                  )}
                </div>
              </div>

              {/* Pickup */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <Package className="h-4 w-4 text-slate-400" /> Pickup
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {trip.pickups.map((p) => p.warehouseName).join(", ") || "No pickup recorded on the booking"}
                </p>
                {trip.pickedUpAt ? (
                  <p className="mt-2 text-sm text-emerald-700">Picked up {when(trip.pickedUpAt)}</p>
                ) : active ? (
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2">
                    <div className="sm:w-60">
                      <label className={label} htmlFor="pickup-at">Picked up at</label>
                      <input id="pickup-at" type="datetime-local" value={pickupAt} max={localNow()} onChange={(e) => setPickupAt(e.target.value)} className={field} />
                    </div>
                    <button
                      type="button"
                      onClick={recordPickup}
                      disabled={busy}
                      className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Record pickup
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Not recorded.</p>
                )}
              </div>

              {/* Stops */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">
                  Deliveries <span className="font-normal text-slate-500">· {trip.deliveredCount} of {trip.stops.length} delivered</span>
                </p>
                <ol className="mt-3 space-y-3">
                  {trip.stops.map((stop, i) => (
                    <li key={stop.branchID} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {i + 1}. {stop.branchName}
                            {stop.quantity ? <span className="font-normal text-slate-500"> · {stop.quantity} units</span> : null}
                          </p>
                          <p className="text-xs text-slate-500">{stop.deliveryAddress}</p>
                        </div>
                        {stop.delivered ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Delivered</span>
                        ) : active ? (
                          <button
                            type="button"
                            onClick={() => setOpenStop(openStop === stop.branchID ? null : stop.branchID)}
                            className="min-h-10 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            {openStop === stop.branchID ? "Close" : "Record delivery"}
                          </button>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                            <Clock className="inline h-3 w-3 mr-1" />{stop.status}
                          </span>
                        )}
                      </div>
                      {stop.delivered && <div className="mt-2"><StopProof stop={stop} /></div>}
                      {!stop.delivered && openStop === stop.branchID && (
                        <DeliveryForm key={stop.branchID} dispatchID={trip.dispatchID} stop={stop} onSaved={done} />
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {/* A problem becomes a foul trip */}
              {active && (
                <div className="rounded-xl border border-red-100 p-4">
                  {!showProblem ? (
                    <button type="button" onClick={() => setShowProblem(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:underline">
                      <AlertTriangle className="h-4 w-4" /> The partner reported a problem
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">This records a foul trip. Recover it from the Foul Trip feed: re-assign, another partner, reschedule or cancel.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={label} htmlFor="issue">What happened</label>
                          <select id="issue" value={issue} onChange={(e) => setIssue(e.target.value)} className={field}>
                            {ISSUES.map((i) => <option key={i}>{i}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={label} htmlFor="issue-details">Details{issue === "Other" ? " *" : ""}</label>
                          <input id="issue-details" value={details} onChange={(e) => setDetails(e.target.value)} className={field} placeholder="What the partner said" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowProblem(false)} className="min-h-11 rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">Cancel</button>
                        <button type="button" onClick={sendProblem} disabled={busy} className="min-h-11 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                          Record foul trip
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {actionError && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700">{actionError}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
