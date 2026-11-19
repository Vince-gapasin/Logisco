import { Package } from "lucide-react";
import { describeItem, type StopItem } from "@/app/lib/stopItems";

// What to load or drop off at one stop, a line per product. A booking made
// before products were listed per stop has none, and shows the booking's
// product line and the stop's quantity as it always has.
export function StopProducts({
  items,
  fallbackProduct,
  fallbackQuantity,
  verb,
}: {
  items?: StopItem[];
  fallbackProduct?: string;
  fallbackQuantity?: string;
  /** "Load" at a pickup, "Drop off" at a delivery. */
  verb: "Load" | "Drop off";
}) {
  if (!items || items.length === 0) {
    return (
      <>
        <span className="text-slate-700 truncate">Product: {fallbackProduct || "N/A"}</span>
        <span className="text-slate-700 truncate">Qty: {fallbackQuantity || "N/A"}</span>
      </>
    );
  }

  return (
    <div className="mt-1 rounded-lg border border-slate-200 bg-white/70 p-2">
      <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
        <Package className="h-3.5 w-3.5" /> {verb}
      </p>
      <ul className="space-y-0.5">
        {items.map((item, index) => (
          <li key={index} className="text-sm font-medium text-slate-800">
            {describeItem(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}
