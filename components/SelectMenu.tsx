"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

// A single-choice dropdown with a search box, for lists long enough that a
// native <select> is hard to scan: trucks, drivers, helpers. Each option can
// carry a second line and a tag ("Original driver"), which a <select> cannot.

export interface SelectMenuOption {
  value: string;
  label: string;
  detail?: string | null;
  tag?: string | null;
}

interface SelectMenuProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  placeholder: string;
  emptyText?: string;
  searchPlaceholder?: string;
  /** Adds a "None" row, for optional fields such as a second helper. */
  allowNone?: boolean;
  disabled?: boolean;
}

export default function SelectMenu({
  id,
  value,
  onChange,
  options,
  placeholder,
  emptyText = "Nothing to choose from",
  searchPlaceholder = "Search…",
  allowNone = false,
  disabled = false,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listID = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? options.filter((o) => [o.label, o.detail, o.tag].some((text) => text?.toLowerCase().includes(q)))
      : options;
    return allowNone && !q ? [{ value: "", label: "None" } as SelectMenuOption, ...matches] : matches;
  }, [options, query, allowNone]);

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const show = () => {
    if (disabled) return;
    setQuery("");
    setHighlight(Math.max(0, rows.findIndex((r) => r.value === value)));
    setOpen(true);
    // After the panel renders.
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(rows.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlight];
      if (row) pick(row.value);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listID : undefined}
        className="w-full min-h-11 sm:min-h-10 flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        {selected ? (
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-900">{selected.label}</span>
            {selected.detail && <span className="block truncate text-xs text-slate-500">{selected.detail}</span>}
          </span>
        ) : (
          <span className="truncate text-slate-400">{options.length ? placeholder : emptyText}</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-controls={listID}
              className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-8 text-base sm:text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ul id={listID} role="listbox" className="max-h-56 overflow-y-auto feed-scrollbar space-y-0.5">
            {rows.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-slate-400">
                {options.length ? "No matches" : emptyText}
              </li>
            ) : (
              rows.map((row, index) => {
                const isSelected = row.value === value;
                return (
                  <li
                    key={row.value || "__none"}
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setHighlight(index)}
                    onClick={() => pick(row.value)}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 ${
                      index === highlight ? "bg-slate-100" : ""
                    } ${isSelected ? "text-blue-700" : "text-slate-700"}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-sm ${isSelected ? "font-semibold" : "font-medium"}`}>{row.label}</span>
                        {row.tag && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {row.tag}
                          </span>
                        )}
                      </span>
                      {row.detail && <span className="block truncate text-xs text-slate-500">{row.detail}</span>}
                    </span>
                    <Check className={`h-4 w-4 shrink-0 ${isSelected ? "text-blue-600" : "invisible"}`} />
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
