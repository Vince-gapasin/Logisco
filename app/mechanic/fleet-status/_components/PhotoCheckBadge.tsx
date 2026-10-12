import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { PhotoCheckResult } from "./types";

// What the photo check found, under a maintenance photo. A photo from before
// the check has none, and shows nothing.
export function PhotoCheckBadge({ check }: { check?: PhotoCheckResult | null }) {
  if (!check) return null;

  const passed = check.status === "passed";
  const saw = check.topLabels.slice(0, 2).join(", ");
  // Every reason: the one that matters most ("the checker could not run") is
  // not always the first.
  const why = check.notes.join(" ");

  return (
    <p
      className={`mt-1 flex items-start gap-1 text-xs sm:text-[11px] leading-snug max-w-[16rem] ${passed ? "text-emerald-700" : "text-amber-700"}`}
    >
      {passed ? <ShieldCheck aria-hidden className="w-3.5 h-3.5 shrink-0 mt-px" /> : <ShieldAlert aria-hidden className="w-3.5 h-3.5 shrink-0 mt-px" />}
      <span>
        {passed ? "Photo checked" : "Needs review"}
        {saw && <>: looks like {saw}</>}
        {!passed && why && <span className="block text-slate-500">{why}</span>}
      </span>
    </p>
  );
}
