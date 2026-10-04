
// ==========================================
// READ ONLY FIELD
// ==========================================

export function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <label className="block text-xs font-medium text-black mb-1">
        {label}
      </label>
      <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8">
        {value || "—"}
      </div>
    </div>
  );
}
