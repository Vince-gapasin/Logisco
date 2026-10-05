import { Star } from "lucide-react";

// How a rating, or one measure behind it, is put into words and colour. Shared
// by the profile's Performance tab and the rankings so both read the same.

export interface Verdict {
  word: string;
  text: string;
  bg: string;
  border: string;
  bar: string;
}

const EXCELLENT: Verdict = { word: "Excellent", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500" };
const GOOD: Verdict = { word: "Good", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", bar: "bg-blue-500" };
const FAIR: Verdict = { word: "Fair", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500" };
const POOR: Verdict = { word: "Needs improvement", text: "text-red-700", bg: "bg-red-50", border: "border-red-200", bar: "bg-red-500" };

/** A 1-to-5 rating in one word. */
export function ratingVerdict(rating: number): Verdict {
  if (rating >= 4.5) return EXCELLENT;
  if (rating >= 3.5) return GOOD;
  if (rating >= 2.5) return FAIR;
  return POOR;
}

/** A 0-to-1 measure in one word, on the same bands the rating uses. */
export function rateVerdict(rate: number): Verdict {
  if (rate >= 0.9) return EXCELLENT;
  if (rate >= 0.75) return GOOD;
  if (rate >= 0.5) return { ...FAIR, word: "Needs work" };
  return { ...POOR, word: "Poor" };
}

/** Five stars, filled to the rating. */
export function Stars({ rating, size = "w-5 h-5" }: { rating: number; size?: string }) {
  const row = (className: string) => (
    <div className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((index) => (
        <Star key={index} className={`${size} shrink-0 ${className}`} />
      ))}
    </div>
  );

  return (
    <div className="relative inline-block" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {row("text-slate-200 fill-slate-200")}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${(Math.min(5, Math.max(0, rating)) / 5) * 100}%` }}>
        {row("text-amber-400 fill-amber-400")}
      </div>
    </div>
  );
}
