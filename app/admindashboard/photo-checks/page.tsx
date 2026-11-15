"use client";

// Photo checks: whether the crew's receipt scan and the mechanic's photo check
// refuse a photo that falls short, or accept it and mark it for review.
//
// Admins and coordinators change them here; every change is in the audit trail
// and the office is notified.

import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { formatDateTime } from "@/app/lib/datetime";
import { useToast } from "@/components/Toast";
import ListLoadError from "@/components/ListLoadError";

type Mode = "strict" | "relaxed";
type CheckKey = "podReceiptCheck" | "repairPhotoCheck";
interface Setting {
  mode: Mode;
  updatedAt: string | null;
  updatedByName: string | null;
}

const CHECKS: { key: CheckKey; title: string; strict: string; relaxed: string }[] = [
  {
    key: "podReceiptCheck",
    title: "Receipt scan (proof of delivery)",
    strict:
      "A receipt photo is refused when it cannot be read, is not signed, does not carry the receiver's name, was used before, or was not taken at the stop. The crew scan again.",
    relaxed:
      "Every receipt photo is accepted, including from the phone's gallery. One that would have been refused is sent to Proof Review with the reasons.",
  },
  {
    key: "repairPhotoCheck",
    title: "Mechanic photos",
    strict:
      "A maintenance photo is refused when it does not show a truck or the work on it, was used on another log, or is too old. The mechanic takes another.",
    relaxed:
      "Every maintenance photo is accepted. One that would have been refused is marked Needs review on the log, with the reasons.",
  },
];

export default function PhotoChecksPage() {
  const showToast = useToast();
  const [settings, setSettings] = useState<Record<CheckKey, Setting> | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState<CheckKey | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Record<CheckKey, Setting> }>("/api/settings/photo-checks", { cache: "no-store" });
      setSettings(res.data);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the photo checks.");
    }
  }, []);

  useEffect(() => {
    // The settings land in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const change = async (key: CheckKey, mode: Mode) => {
    setSaving(key);
    try {
      const res = await apiFetch<{ data: Record<CheckKey, Setting> }>("/api/settings/photo-checks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: mode }),
      });
      setSettings(res.data);
      showToast(mode === "relaxed" ? "Relaxed. Every photo is now accepted." : "Strict again.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save the change.", "error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-3xl mx-auto bg-slate-50 min-h-[100dvh]">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" aria-hidden="true" />
          Photo checks
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Whether a photo that fails its check is refused, or accepted and marked for review. Every change is recorded, and the office is told.
        </p>
      </div>

      {loadError && <ListLoadError message={loadError} onRetry={() => void load()} compact={Boolean(settings)} />}
      {!settings && !loadError && <p className="text-sm text-slate-500">Loading...</p>}

      {settings && (
        <ul className="space-y-4">
          {CHECKS.map((check) => {
            const setting = settings[check.key];
            const relaxed = setting.mode === "relaxed";
            return (
              <li key={check.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-slate-900">{check.title}</h2>
                    <p className={`mt-1 text-xs font-bold uppercase tracking-wide ${relaxed ? "text-amber-700" : "text-emerald-700"}`}>
                      {relaxed ? "Relaxed" : "Strict"}
                    </p>
                  </div>
                  <div role="radiogroup" aria-label={check.title} className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                    {(["strict", "relaxed"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={setting.mode === mode}
                        disabled={saving !== null || setting.mode === mode}
                        onClick={() => void change(check.key, mode)}
                        className={`min-h-tap md:pointer-fine:min-h-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-default ${
                          setting.mode === mode
                            ? mode === "relaxed"
                              ? "bg-amber-500 text-white shadow-sm"
                              : "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-700 hover:bg-white"
                        }`}
                      >
                        {saving === check.key && setting.mode !== mode ? "Saving..." : mode === "strict" ? "Strict" : "Relaxed"}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-700">{relaxed ? check.relaxed : check.strict}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {setting.updatedAt
                    ? `Last changed ${formatDateTime(setting.updatedAt)}${setting.updatedByName ? ` by ${setting.updatedByName}` : ""}.`
                    : "Not changed since it was set up."}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
