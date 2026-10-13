"use client";

// "Report a problem", on the tracking page at every stage of a delivery.
//
// The feedback questions wait until the delivery is done; a complaint should
// not have to. A single row with a button while nothing is wrong, so it costs
// a customer whose delivery is going fine one line of the page. Opened, it asks
// what it is about and what happened - nothing else is required.
//
// What they sent stays on the card with where it stands, and the office's reply
// once there is one, so the client can see it was read rather than wonder.

import { useState } from "react";
import { CheckCircle2, Clock, MessageSquareWarning, Send } from "lucide-react";
import { formatDateTime } from "@/app/lib/datetime";
import {
  MAX_CONTACT_BACK,
  MAX_REPORT_MESSAGE,
  REPORT_CATEGORIES,
  reportCategoryLabel,
  type ClientReportSummary,
  type ReportCategory,
} from "@/app/lib/clientReports";

interface Props {
  token: string;
  reports: ClientReportSummary[];
  /** Called after a report is sent, so the page can refresh what it shows. */
  onSent?: () => void;
}

export default function ClientReportCard({ token, reports, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [message, setMessage] = useState("");
  const [contactBack, setContactBack] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const ready = category !== null && message.trim().length > 0;

  const reset = () => {
    setCategory(null);
    setMessage("");
    setContactBack("");
    setError(null);
  };

  const submit = async () => {
    if (!ready) return;
    setSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/track/${token}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: message.trim(), contactBack: contactBack.trim() || null }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.message ?? "We could not send that. Please try again.");
        return;
      }

      reset();
      setOpen(false);
      setJustSent(true);
      onSent?.();
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      id="report-a-problem"
      className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
      aria-labelledby="report-a-problem-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquareWarning className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <h2 id="report-a-problem-title" className="text-sm font-semibold text-slate-900">
            Something not right?
          </h2>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setJustSent(false);
            }}
            className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
          >
            Report a problem
          </button>
        )}
      </div>

      {justSent && !open && (
        <p className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Sent. The office has been told, and their reply will appear here.
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-4 border-t border-slate-100 p-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-medium text-slate-600">What is it about?</legend>
            <div className="flex flex-wrap gap-2">
              {REPORT_CATEGORIES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={category === option.key}
                  onClick={() => setCategory(option.key)}
                  className={`min-h-tap md:pointer-fine:min-h-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    category === option.key
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-message" className="text-xs font-medium text-slate-600">
              What happened?
            </label>
            <textarea
              id="report-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              maxLength={MAX_REPORT_MESSAGE}
              placeholder="Tell us what went wrong, and at which stop if there is more than one."
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-contact" className="text-xs font-medium text-slate-600">
              Best way to reach you (optional)
            </label>
            <input
              id="report-contact"
              type="text"
              value={contactBack}
              onChange={(event) => setContactBack(event.target.value)}
              maxLength={MAX_CONTACT_BACK}
              autoComplete="tel"
              placeholder="If not the number or email on the booking"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={sending}
              className="min-h-tap md:pointer-fine:min-h-0 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!ready || sending}
              className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-500"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {sending ? "Sending..." : "Send report"}
            </button>
          </div>
        </div>
      )}

      {reports.length > 0 && (
        <ul className="flex flex-col gap-3 border-t border-slate-100 p-5">
          {reports.map((report) => (
            <li key={report.reportID} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{reportCategoryLabel(report.category)}</p>
                {report.status === "resolved" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Resolved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    <Clock className="h-3 w-3" aria-hidden="true" /> Received
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 whitespace-pre-line break-words">{report.message}</p>
              <p className="text-[11px] text-slate-500">Sent {formatDateTime(report.createdAt)}</p>
              {report.status === "resolved" && report.resolutionNote && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Reply from Logisco{report.resolvedAt ? ` · ${formatDateTime(report.resolvedAt)}` : ""}
                  </p>
                  <p className="text-xs text-slate-800 whitespace-pre-line break-words">{report.resolutionNote}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
