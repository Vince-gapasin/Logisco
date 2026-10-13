"use client";

// Client Reports: problems clients reported from their tracking page, and the
// office's reply to each.
//
// The "Client report" notification opens this page. The reply written here is
// shown to the client on the same tracking page they reported from, so it is
// written to them, not about them.

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Mail, MessageSquareWarning, Phone } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { formatDateTime } from "@/app/lib/datetime";
import { reportCategoryLabel } from "@/app/lib/clientReports";
import { useToast } from "@/components/Toast";
import ListLoadError from "@/components/ListLoadError";
import type { ReportForOffice, ReportQueue } from "@/services/feedback/clientReportService";

const TABS: { queue: ReportQueue; label: string }[] = [
  { queue: "open", label: "Open" },
  { queue: "resolved", label: "Resolved" },
];

function ReportCard({
  report,
  highlighted,
  onResolved,
}: {
  report: ReportForOffice;
  highlighted: boolean;
  onResolved: () => void;
}) {
  const showToast = useToast();
  const [replying, setReplying] = useState(false);
  const [note, setNote] = useState(report.resolutionNote ?? "");
  const [saving, setSaving] = useState(false);

  const resolve = async () => {
    if (!note.trim()) {
      showToast("Write a reply for the client saying what was done.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/client-reports/${report.reportID}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // From the Resolved tab, a reply is a deliberate change.
        body: JSON.stringify({ note, change: report.status === "resolved" }),
      });
      showToast(report.status === "resolved" ? "Reply updated." : "Report resolved.", "success");
      setReplying(false);
      onResolved();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not resolve the report.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li
      id={`report-${report.reportID}`}
      className={`rounded-2xl border bg-white p-4 shadow-sm ${highlighted ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{reportCategoryLabel(report.category)}</p>
          <p className="text-xs text-slate-600">
            {[report.orderCode, report.client].filter(Boolean).join(" · ") || "Booking not found"}
            {report.driverName ? ` · driver ${report.driverName}` : ""}
          </p>
        </div>
        <p className="text-xs text-slate-500">Sent {formatDateTime(report.createdAt)}</p>
      </div>

      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 whitespace-pre-line wrap-break-word">
        {report.message}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        {report.contactBack && (
          <span className="font-semibold text-slate-800">Reach them at: {report.contactBack}</span>
        )}
        {report.clientContact && (
          <a href={`tel:${report.clientContact}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {report.clientContact}
          </a>
        )}
        {report.clientEmail && (
          <a href={`mailto:${report.clientEmail}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {report.clientEmail}
          </a>
        )}
      </div>

      {report.status === "resolved" && !replying && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <p className="font-semibold">
            Resolved{report.resolvedByName ? ` by ${report.resolvedByName}` : ""}
            {report.resolvedAt ? `, ${formatDateTime(report.resolvedAt)}` : ""}
          </p>
          {report.resolutionNote && <p className="mt-0.5 whitespace-pre-line wrap-break-word">{report.resolutionNote}</p>}
        </div>
      )}

      {replying ? (
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-medium text-slate-700" htmlFor={`reply-${report.reportID}`}>
            Reply to the client <span className="text-red-500">*</span>
          </label>
          <textarea
            id={`reply-${report.reportID}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            placeholder="Ex. Sorry for the delay - the truck was held at the port. We have spoken to the crew and credited the late fee."
            className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <p className="text-xs text-slate-500">The client sees this reply on their tracking page.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setReplying(false)}
              disabled={saving}
              className="min-h-tap md:pointer-fine:min-h-0 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={resolve}
              disabled={saving || !note.trim()}
              className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {saving ? "Saving..." : report.status === "resolved" ? "Update reply" : "Resolve"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setReplying(true)}
            className={`min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold ${
              report.status === "resolved"
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {report.status === "resolved" ? "Edit reply" : "Reply and resolve"}
          </button>
        </div>
      )}
    </li>
  );
}

function ClientReportsScreen() {
  const searchParams = useSearchParams();
  const focusReport = searchParams.get("report");
  const [queue, setQueue] = useState<ReportQueue>("open");
  const [reports, setReports] = useState<ReportForOffice[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (which: ReportQueue) => {
    try {
      const result = await apiFetch<{ reports: ReportForOffice[] }>(`/api/client-reports?queue=${which}`, { cache: "no-store" });
      setReports(result.reports);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the client reports.");
    }
  }, []);

  useEffect(() => {
    // The rows land in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(queue);
  }, [load, queue]);

  // From a notification: bring that report into view.
  useEffect(() => {
    if (!focusReport || !reports) return;
    document.getElementById(`report-${focusReport}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusReport, reports]);

  const switchTo = (next: ReportQueue) => {
    if (next === queue) return;
    setReports(null);
    setQueue(next);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-5xl mx-auto bg-slate-50 min-h-[100dvh]">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <MessageSquareWarning className="w-6 h-6 text-blue-600" aria-hidden="true" />
          Client Reports
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Problems and complaints clients sent from their tracking page. Deal with each one, then resolve it with a reply the client will see.
        </p>
      </div>

      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.queue}
            role="tab"
            type="button"
            aria-selected={queue === tab.queue}
            onClick={() => switchTo(tab.queue)}
            className={`min-h-tap md:pointer-fine:min-h-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              queue === tab.queue ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            {tab.queue === "open" && queue === "open" && reports ? ` (${reports.length})` : ""}
          </button>
        ))}
      </div>

      {loadError && <ListLoadError message={loadError} onRetry={() => void load(queue)} compact={Boolean(reports?.length)} />}

      {!reports && !loadError && <p className="text-sm text-slate-500">Loading...</p>}

      {reports && reports.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          {queue === "open" ? "No open reports. Every client report has been dealt with." : "No reports have been resolved yet."}
        </p>
      )}

      {reports && reports.length > 0 && (
        <ul className="space-y-3">
          {reports.map((report) => (
            <ReportCard
              key={report.reportID}
              report={report}
              highlighted={report.reportID === focusReport}
              onResolved={() => void load(queue)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ClientReportsPage() {
  // useSearchParams needs a boundary to prerender.
  return (
    <React.Suspense fallback={null}>
      <ClientReportsScreen />
    </React.Suspense>
  );
}
