"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";

type CheckKey = "podReceiptCheck" | "repairPhotoCheck";

const WHAT: Record<CheckKey, string> = {
  podReceiptCheck: "The receipt check is relaxed: every proof-of-delivery photo is accepted, and the ones that would not have passed come here for review.",
  repairPhotoCheck: "The mechanic photo check is relaxed: every maintenance photo is accepted, and the ones that would not have passed are marked Needs review.",
};

/**
 * Said on the screens that receive what a relaxed check lets through, so
 * nobody reviewing is surprised by the volume, with the way back to strict.
 * Shows nothing while the check is strict, or if the setting cannot be read.
 */
export default function PhotoCheckBanner({ check }: { check: CheckKey }) {
  const [relaxed, setRelaxed] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{ data: Record<CheckKey, { mode?: string }> }>("/api/settings/photo-checks", { cache: "no-store" })
      .then((res) => {
        if (active) setRelaxed(res.data?.[check]?.mode === "relaxed");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [check]);

  if (!relaxed) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        {WHAT[check]}{" "}
        <Link href="/admindashboard/photo-checks" className="font-semibold text-amber-900 underline">
          Photo checks
        </Link>
      </p>
    </div>
  );
}
