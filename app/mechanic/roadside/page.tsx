"use client";

import React, { useCallback, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Wrench,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";
import type { IncidentView } from "@/services/foulTrip/foulTripService";

// Trucks that broke down on a delivery and that dispatch has sent this
// mechanic to. The verdict from the site decides what happens next: fixed,
// and the same trip carries on; not fixable, and dispatch sends a
// replacement truck.

const SEVERITY: Record<string, { label: string; tone: string; hint: string }> = {
  minor: {
    label: "Minor",
    tone: "bg-amber-100 text-amber-800",
    hint: "Expected to be fixable at the roadside.",
  },
  major: {
    label: "Major",
    tone: "bg-red-100 text-red-700",
    hint: "May need parts, heavy tools or a tow.",
  },
};

function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function since(iso: string | null) {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleString("en-PH");
}

function JobCard({ job, onReported }: { job: IncidentView; onReported: (message: string) => void }) {
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState<"fixed" | "not_fixable" | null>(null);
  const [error, setError] = useState("");

  const active = job.status === "mechanic_assigned";
  const severity = SEVERITY[job.severity ?? ""];
  const located = job.latitude != null && job.longitude != null;
  const dispatchNote = job.mechanicNotes?.split("\n").find((l) => l.startsWith("Dispatch: "))?.slice(10);

  const report = async (outcome: "fixed" | "not_fixable") => {
    if (outcome === "not_fixable" && !notes.trim()) {
      setError("Say what is wrong, so dispatch knows what kind of truck to send.");
      return;
    }
    setError("");
    setSending(outcome);
    try {
      const res = await apiFetch<{ data: { resumed: boolean; reason: string | null } }>(
        `/api/mechanic/roadside/${job.incidentID}`,
        { method: "POST", body: JSON.stringify({ outcome, notes: notes.trim() || undefined }) },
      );
      const { resumed, reason } = res.data;
      onReported(
        resumed
          ? "Recorded. The crew can carry on with the delivery."
          : reason === "crew_reassigned"
            ? "Recorded. The crew has been given another trip, so dispatch will re-assign this one. The truck is back in service."
            : "Recorded. Dispatch will send a replacement truck.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your report.");
    } finally {
      setSending(null);
    }
  };

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-slate-100">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">
            {job.truckPlate ?? "Truck"} <span className="font-normal text-slate-500">· {job.issueType}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {job.orderCode ?? ""}{job.clientName ? ` · ${job.clientName}` : ""} · reported {since(job.reportedAt)}
          </p>
        </div>
        {active && severity ? (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${severity.tone}`}>{severity.label}</span>
        ) : !active ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              job.mechanicOutcome === "fixed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {job.mechanicOutcome === "fixed" ? "Fixed" : job.mechanicOutcome === "not_fixable" ? "Not fixable on site" : "Reassigned by dispatch"}
          </span>
        ) : null}
      </header>

      <div className="px-4 sm:px-5 py-4 space-y-4 text-sm text-slate-700">
        {active && severity && <p className="text-xs text-slate-500">{severity.hint}</p>}

        {job.details && (
          <p>
            <span className="font-semibold text-slate-900">Crew report: </span>
            {job.details}
          </p>
        )}
        {dispatchNote && (
          <p>
            <span className="font-semibold text-slate-900">From dispatch: </span>
            {dispatchNote}
          </p>
        )}

        {job.photoUrl && (
          <a href={job.photoUrl} target="_blank" rel="noreferrer" className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={job.photoUrl} alt="Photo from the crew" className="h-32 w-auto max-w-full rounded-xl border border-slate-200 object-cover" />
          </a>
        )}

        {active && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {located ? (
              <a
                href={mapsLink(job.latitude!, job.longitude!)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              >
                <Navigation className="h-4 w-4" /> Directions to the truck
              </a>
            ) : (
              <p className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-500">
                <MapPin className="h-4 w-4 shrink-0" /> No location was sent. Call the crew for directions.
              </p>
            )}
            {job.reporterContact ? (
              <a
                href={`tel:${job.reporterContact}`}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Phone className="h-4 w-4" /> Call {job.reporterName ?? "the crew"}
              </a>
            ) : (
              <p className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-500">
                <Phone className="h-4 w-4 shrink-0" /> No contact number on file for {job.reporterName ?? "the crew"}.
              </p>
            )}
          </div>
        )}

        {active ? (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <label htmlFor={`notes-${job.incidentID}`} className="block text-xs font-semibold text-slate-700">
              What did you find and do?
            </label>
            <textarea
              id={`notes-${job.incidentID}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Replaced the fan belt, tested, truck running normally"
              className="w-full min-h-20 rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => report("fixed")}
                disabled={sending !== null}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {sending === "fixed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Fixed – trip can continue
              </button>
              <button
                type="button"
                onClick={() => report("not_fixable")}
                disabled={sending !== null}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {sending === "not_fixable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Can&apos;t fix it here
              </button>
            </div>
          </div>
        ) : (
          job.mechanicNotes && (
            <p className="whitespace-pre-line border-t border-slate-100 pt-3 text-xs text-slate-500">{job.mechanicNotes}</p>
          )
        )}
      </div>
    </article>
  );
}

export default function RoadsideJobsPage() {
  const [jobs, setJobs] = useState<IncidentView[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: IncidentView[] }>("/api/mechanic/roadside", { cache: "no-store" });
      setJobs(res.data ?? []);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load roadside jobs.");
    }
  }, []);

  // A new job should reach a mechanic who is already out on the road.
  usePolling(() => void load(), 60000);

  const active = (jobs ?? []).filter((j) => j.status === "mechanic_assigned");
  const past = (jobs ?? []).filter((j) => j.status !== "mechanic_assigned");

  const onReported = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 5000);
    void load();
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" /> Roadside Jobs
          </h1>
          <p className="text-sm text-slate-600 mt-1">Trucks that broke down on a delivery, waiting for you.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh"
          className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {toast && (
        <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {toast}
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {loadError}
        </div>
      )}

      {jobs === null && !loadError ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <>
          {active.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
              <p className="font-semibold text-slate-800">No trucks waiting for you</p>
              <p className="text-sm text-slate-500">When dispatch sends you to a breakdown it appears here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {active.map((job) => (
                <JobCard key={job.incidentID} job={job} onReported={onReported} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Clock className="h-4 w-4" /> Last 14 days
              </h2>
              {past.map((job) => (
                <JobCard key={job.incidentID} job={job} onReported={onReported} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
