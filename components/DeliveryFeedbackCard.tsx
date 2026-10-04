"use client";

// The two questions, asked on the tracking page once the delivery is done.
//
// Deliberately not a star rating. Stars ask a client to score things the system
// already timed, and the answer that comes back is a mood. These two are things
// only the person who took the delivery knows, and they can be answered in one
// tap each without reading anything.
//
// It is also easy to ignore, on purpose. Nothing is inferred from a client who
// does not answer, so there is no nagging, no modal over the page, and no second
// ask once they have answered.

import { useState } from "react";
import { Check, MessageSquare, X } from "lucide-react";

export interface FeedbackAnswers {
  goodCondition: boolean;
  courteous: boolean;
  comment?: string | null;
}

export interface FeedbackInvitation {
  invited: boolean;
  answered: boolean;
  answers: FeedbackAnswers | null;
}

interface Props {
  token: string;
  invitation: FeedbackInvitation;
  /** Called after a successful save, so the page can refresh what it shows. */
  onSaved?: (answers: FeedbackAnswers) => void;
}

const QUESTIONS = [
  { key: "goodCondition" as const, text: "Did everything arrive in good condition?" },
  { key: "courteous" as const, text: "Was the crew courteous and professional?" },
];

export default function DeliveryFeedbackCard({ token, invitation, onSaved }: Props) {
  const [answers, setAnswers] = useState<Partial<FeedbackAnswers>>(invitation.answers ?? {});
  const [comment, setComment] = useState(invitation.answers?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(invitation.answered);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!invitation.answered);

  if (!invitation.invited) return null;

  const bothAnswered = typeof answers.goodCondition === "boolean" && typeof answers.courteous === "boolean";

  const submit = async () => {
    if (!bothAnswered) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/track/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodCondition: answers.goodCondition,
          courteous: answers.courteous,
          comment: comment.trim() || null,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.message ?? "We could not save that. Please try again.");
        return;
      }

      setSaved(true);
      setEditing(false);
      onSaved?.(result.data as FeedbackAnswers);
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Already answered, and not being changed: thank them and get out of the way.
  if (saved && !editing) {
    return (
      <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Check className="w-4 h-4" />
          </span>
          <span className="text-sm font-semibold text-slate-900">Thank you for the feedback</span>
        </div>
        <p className="text-xs text-slate-500">
          It goes on the crew&apos;s record, where their supervisor sees it.
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Change my answer
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <span className="text-sm font-semibold text-slate-900">How did this delivery go?</span>
        <span className="text-xs font-medium text-slate-500">Two questions</span>
      </div>

      <div className="flex flex-col gap-3.5">
        {QUESTIONS.map((question) => (
          <div key={question.key} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-700 min-w-0 flex-1">{question.text}</span>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-pressed={answers[question.key] === true}
                onClick={() => setAnswers((current) => ({ ...current, [question.key]: true }))}
                className={`min-h-tap md:pointer-fine:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  answers[question.key] === true
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                }`}
              >
                <Check className="w-3.5 h-3.5" /> Yes
              </button>

              <button
                type="button"
                aria-pressed={answers[question.key] === false}
                onClick={() => setAnswers((current) => ({ ...current, [question.key]: false }))}
                className={`min-h-tap md:pointer-fine:min-h-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  answers[question.key] === false
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-red-300"
                }`}
              >
                <X className="w-3.5 h-3.5" /> No
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="feedback-comment" className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <MessageSquare className="w-3.5 h-3.5" /> Anything else? (optional)
        </label>
        <textarea
          id="feedback-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Anything the coordinator should know."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-y"
        />
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!bothAnswered || saving}
          className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 transition-colors"
        >
          {saving ? "Sending..." : "Send feedback"}
        </button>
        {!bothAnswered && <span className="text-xs text-slate-500">Please answer both questions.</span>}
      </div>
    </div>
  );
}
