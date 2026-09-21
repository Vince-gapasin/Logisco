"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Info,
  Loader2,
  Truck,
  Users,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import type { IncidentView } from "@/services/foulTrip/foulTripService";

// What dispatch can do about a foul trip. This replaces a screen whose four
// options made no server call and whose driver, truck and mechanic lists were
// hardcoded placeholders: it reported success and changed nothing.

type Action = "reassign" | "reschedule" | "subcontract" | "send_mechanic" | "cancel" | "close";

interface Resources {
  trucks: { truckID: string; plateNumber: string; model?: string | null; truckType?: string | null }[];
  drivers: { employeeID: string; employeeName: string }[];
  helpers: { employeeID: string; employeeName: string }[];
}
interface Partner { subConID: string; companyName: string; isActive?: boolean | null }
interface Mechanic { employeeID: string; employeeName: string; isActive?: boolean | null }

const OPTIONS: { id: Action; title: string; description: string; icon: LucideIcon }[] = [
  { id: "reassign", title: "Re-assign now", description: "A free truck and crew take over today.", icon: Users },
  { id: "reschedule", title: "Reschedule", description: "A truck and crew for a later date.", icon: Calendar },
  { id: "subcontract", title: "Sub-contractor", description: "A partner's truck takes the load.", icon: Truck },
  { id: "send_mechanic", title: "Send a mechanic", description: "Repair it where it stopped; the trip resumes.", icon: Wrench },
  { id: "cancel", title: "Cancel booking", description: "The delivery will not go ahead.", icon: XCircle },
  { id: "close", title: "Close", description: "Already handled outside the system.", icon: CheckCircle2 },
];

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

const field = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50";
const label = "block text-xs font-semibold text-slate-700 mb-1";

export default function RecoveryPanel({
  incident,
  onDone,
}: {
  incident: IncidentView;
  onDone: (message: string) => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // crew
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState("");
  const [resources, setResources] = useState<Resources | null>(null);
  const [truckID, setTruckID] = useState("");
  const [driverID, setDriverID] = useState("");
  const [helper1ID, setHelper1ID] = useState("");
  const [helper2ID, setHelper2ID] = useState("");
  // sub-contractor
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [subConID, setSubConID] = useState("");
  const [partnerDriver, setPartnerDriver] = useState("");
  const [partnerPlate, setPartnerPlate] = useState("");
  const [partnerContact, setPartnerContact] = useState("");
  // mechanic
  const [mechanics, setMechanics] = useState<Mechanic[] | null>(null);
  const [mechanicID, setMechanicID] = useState("");
  const [severity, setSeverity] = useState<"minor" | "major">("minor");
  const [mechanicNote, setMechanicNote] = useState("");
  // cancel / close
  const [text, setText] = useState("");

  const enRoute = incident.status === "mechanic_assigned";
  const canSendMechanic = Boolean(incident.truckID) && !enRoute;
  const resourceDate = action === "reschedule" ? date : today();

  // Availability is read fresh, never from the 60-second GET cache: a truck
  // taken a minute ago must not be offered.
  useEffect(() => {
    if (action !== "reassign" && action !== "reschedule") return;
    let live = true;
    apiFetch<{ data: Resources }>(`/api/dispatch/available-resources?date=${resourceDate}`, { cache: "no-store" })
      .then((res) => live && setResources(res.data))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [action, resourceDate]);

  useEffect(() => {
    if (action !== "subcontract" || partners) return;
    apiFetch<{ data: Partner[] }>("/api/subcontractors")
      .then((res) => setPartners((res.data ?? []).filter((p) => p.isActive !== false)))
      .catch((e: Error) => setError(e.message));
  }, [action, partners]);

  useEffect(() => {
    if (action !== "send_mechanic" || mechanics) return;
    apiFetch<{ data: Mechanic[] }>("/api/employees?role=Mechanic&limit=100")
      .then((res) => setMechanics((res.data ?? []).filter((m) => m.isActive !== false)))
      .catch((e: Error) => setError(e.message));
  }, [action, mechanics]);

  const helpers = useMemo(() => resources?.helpers ?? [], [resources]);

  const choose = (next: Action) => {
    if (next === "send_mechanic" && !canSendMechanic) return;
    // Clicking the open option again used to clear the truck and driver
    // lists without reloading them, leaving "Checking…" for good.
    if (next === action) return;
    setAction(next);
    setError("");
    setText("");
    if (next === "reassign" || next === "reschedule") {
      setResources(null);
      setTruckID("");
      setDriverID("");
      setHelper1ID("");
      setHelper2ID("");
    }
  };

  const submit = async () => {
    if (!action) return;
    setError("");

    let body: Record<string, unknown>;
    let message: string;
    switch (action) {
      case "reassign":
      case "reschedule": {
        if (!truckID || !driverID) return setError("Choose a truck and a driver.");
        if (action === "reschedule" && !date) return setError("Choose the new date.");
        body = { action, truckID, driverID, helper1ID, helper2ID, ...(action === "reschedule" ? { date, time } : {}) };
        message =
          action === "reschedule"
            ? `Rescheduled to ${date}${time ? ` ${time}` : ""}. The new crew must accept it in their app.`
            : "New crew assigned. They will see the trip in their app and must accept it.";
        break;
      }
      case "subcontract": {
        if (!subConID) return setError("Choose the sub-contractor.");
        body = { action, subConID, driverName: partnerDriver, plateNumber: partnerPlate, contactNumber: partnerContact || undefined };
        const partner = partners?.find((p) => p.subConID === subConID)?.companyName ?? "the sub-contractor";
        message = `Handed to ${partner}. Mark it delivered under Recently resolved when they finish.`;
        break;
      }
      case "send_mechanic": {
        if (!mechanicID) return setError("Choose a mechanic.");
        body = { action, mechanicID, severity, notes: mechanicNote || undefined };
        const name = mechanics?.find((m) => m.employeeID === mechanicID)?.employeeName ?? "The mechanic";
        message = `${name} has been sent to the truck. They report back from the site.`;
        break;
      }
      case "cancel":
        body = { action, reason: text };
        message = "Booking cancelled.";
        break;
      case "close":
        body = { action, notes: text };
        message = "Foul trip closed.";
        break;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/foul-trips/${incident.incidentID}`, { method: "POST", body: JSON.stringify(body) });
      onDone(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectable = (id: Action) => id !== "send_mechanic" || canSendMechanic;

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
      <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
        Foul Trip – Choose Recovery Action
      </div>

      {/* Where the incident stands */}
      {enRoute && (
        <div className="mb-4 flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{incident.mechanicName ?? "A mechanic"}</strong> is on the way
            {incident.severity ? ` (${incident.severity})` : ""}. You can still re-assign or sub-contract if you
            would rather not wait.
          </span>
        </div>
      )}
      {!enRoute && incident.mechanicOutcome && (
        <div className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-line">
            {incident.mechanicOutcome === "not_fixable"
              ? `${incident.mechanicName ?? "The mechanic"} could not fix it on site.`
              : "The truck was repaired, but its crew has been given another trip."}
            {incident.mechanicNotes ? `\n${incident.mechanicNotes}` : ""}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {OPTIONS.map((option) => {
          const selected = action === option.id;
          const enabled = selectable(option.id);
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              disabled={!enabled}
              aria-pressed={selected}
              className={`flex min-h-11 items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                selected
                  ? "border-blue-500 bg-blue-50/50 shadow-sm"
                  : enabled
                    ? "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50 cursor-pointer"
                    : "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
              }`}
            >
              <span className={`rounded-lg p-2 ${selected ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${selected ? "text-blue-900" : "text-slate-800"}`}>{option.title}</span>
                <span className={`block text-xs leading-snug ${selected ? "text-blue-700/80" : "text-slate-500"}`}>
                  {option.id === "send_mechanic" && !incident.truckID
                    ? "Not available: a sub-contractor's truck."
                    : option.id === "send_mechanic" && enRoute
                      ? "A mechanic is already on the way."
                      : option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {action && (
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
          {(action === "reassign" || action === "reschedule" || action === "subcontract") && (
            <p className="flex gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              {incident.cargoLoaded
                ? "The cargo was already on the broken-down truck, so the new trip starts by collecting it at the breakdown site."
                : "The cargo had not been collected yet, so the new trip picks it up at the original warehouse."}{" "}
              Stops already delivered are not repeated.
            </p>
          )}

          {(action === "reassign" || action === "reschedule") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {action === "reschedule" && (
                <>
                  <div>
                    <label className={label} htmlFor="rt-date">New date</label>
                    <input id="rt-date" type="date" min={today()} value={date} onChange={(e) => { setDate(e.target.value); setResources(null); setTruckID(""); setDriverID(""); setHelper1ID(""); setHelper2ID(""); }} className={field} />
                  </div>
                  <div>
                    <label className={label} htmlFor="rt-time">Time (optional)</label>
                    <input id="rt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
                  </div>
                </>
              )}
              {!resources ? (
                <p className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking which trucks and crew are free…
                </p>
              ) : (
                <>
                  <div>
                    <label className={label} htmlFor="rt-truck">Truck</label>
                    <select id="rt-truck" value={truckID} onChange={(e) => setTruckID(e.target.value)} className={field}>
                      <option value="">{resources.trucks.length ? "Choose a truck" : "No truck is free"}</option>
                      {resources.trucks.map((t) => (
                        <option key={t.truckID} value={t.truckID}>
                          {t.plateNumber}{t.model || t.truckType ? ` – ${t.model || t.truckType}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="rt-driver">Driver</label>
                    <select id="rt-driver" value={driverID} onChange={(e) => setDriverID(e.target.value)} className={field}>
                      <option value="">{resources.drivers.length ? "Choose a driver" : "No driver is free"}</option>
                      {resources.drivers.map((d) => (
                        <option key={d.employeeID} value={d.employeeID}>{d.employeeName}</option>
                      ))}
                    </select>
                  </div>
                  {[["Helper 1", helper1ID, setHelper1ID, helper2ID], ["Helper 2", helper2ID, setHelper2ID, helper1ID]].map(
                    ([name, value, set, other]) => (
                      <div key={name as string}>
                        <label className={label} htmlFor={`rt-${name}`}>{name as string} (optional)</label>
                        <select
                          id={`rt-${name}`}
                          value={value as string}
                          onChange={(e) => (set as (v: string) => void)(e.target.value)}
                          className={field}
                        >
                          <option value="">None</option>
                          {helpers
                            .filter((h) => h.employeeID !== other)
                            .map((h) => (
                              <option key={h.employeeID} value={h.employeeID}>{h.employeeName}</option>
                            ))}
                        </select>
                      </div>
                    ),
                  )}
                </>
              )}
            </div>
          )}

          {action === "subcontract" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={label} htmlFor="sc-partner">Sub-contractor</label>
                <select id="sc-partner" value={subConID} onChange={(e) => setSubConID(e.target.value)} className={field} disabled={!partners}>
                  <option value="">{partners ? (partners.length ? "Choose a partner" : "No active sub-contractors") : "Loading…"}</option>
                  {(partners ?? []).map((p) => (
                    <option key={p.subConID} value={p.subConID}>{p.companyName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="sc-driver">Their driver</label>
                <input id="sc-driver" value={partnerDriver} onChange={(e) => setPartnerDriver(e.target.value)} className={field} placeholder="Full name" />
              </div>
              <div>
                <label className={label} htmlFor="sc-plate">Their truck&apos;s plate</label>
                <input id="sc-plate" value={partnerPlate} onChange={(e) => setPartnerPlate(e.target.value.toUpperCase())} className={field} placeholder="e.g. ABC-1234" />
              </div>
              <div className="sm:col-span-2">
                <label className={label} htmlFor="sc-contact">Driver&apos;s contact number (optional)</label>
                <input id="sc-contact" value={partnerContact} onChange={(e) => setPartnerContact(e.target.value)} className={field} inputMode="tel" />
              </div>
            </div>
          )}

          {action === "send_mechanic" && (
            <div className="space-y-4">
              <div>
                <label className={label} htmlFor="mc-mechanic">Mechanic</label>
                <select id="mc-mechanic" value={mechanicID} onChange={(e) => setMechanicID(e.target.value)} className={field} disabled={!mechanics}>
                  <option value="">{mechanics ? (mechanics.length ? "Choose a mechanic" : "No active mechanics") : "Loading…"}</option>
                  {(mechanics ?? []).map((m) => (
                    <option key={m.employeeID} value={m.employeeID}>{m.employeeName}</option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend className={label}>How serious is it?</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    ["minor", "Minor", "Fixable at the roadside: tyre, battery, a belt, minor electrical. The trip resumes once repaired."],
                    ["major", "Major", "Needs parts, heavy tools or towing. Be ready to send a replacement truck if it cannot be fixed on site."],
                  ] as const).map(([value, title, hint]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${severity === value ? "border-blue-500 bg-blue-50/50" : "border-slate-100 hover:border-slate-200"}`}
                    >
                      <input type="radio" name="severity" value={value} checked={severity === value} onChange={() => setSeverity(value)} className="mt-1" />
                      <span>
                        <span className="block text-sm font-bold text-slate-800">{title}</span>
                        <span className="block text-xs text-slate-500">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className={label} htmlFor="mc-note">Note for the mechanic (optional)</label>
                <textarea id="mc-note" value={mechanicNote} onChange={(e) => setMechanicNote(e.target.value)} className={`${field} min-h-16`} placeholder="Anything the crew told you" />
              </div>
            </div>
          )}

          {(action === "cancel" || action === "close") && (
            <div>
              <label className={label} htmlFor="cc-text">
                {action === "cancel" ? "Reason for cancelling" : "How was it handled?"}
              </label>
              <textarea
                id="cc-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={`${field} min-h-20`}
                placeholder={action === "cancel" ? "e.g. Client cancelled after the delay" : "e.g. Driver finished the route after a jump-start"}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className={`inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 ${
                action === "cancel" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {action === "cancel" ? "Cancel booking" : action === "close" ? "Close foul trip" : action === "send_mechanic" ? "Send mechanic" : "Confirm recovery"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
