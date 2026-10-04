"use client";

// ==========================================
// LOGISCO - MORE ACTIONS MENU
// ==========================================
// The three-dots button on a record's page, holding what is done to the record
// rather than the work it is in the middle of: History, Edit, Disable, Delete.
// The page header keeps the work buttons in view; these were the ones crowding
// it, and every record page had its own copy of the dropdown or none at all.

import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export interface MoreAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Red, for what takes the record away: Disable, Delete. */
  danger?: boolean;
  /** Shown but not offered, with the reason on hover - rather than an item
      that vanishes and leaves the user wondering where it went. */
  disabledReason?: string;
  /** A rule above this item, to set the destructive ones apart. */
  separated?: boolean;
}

interface MoreActionsMenuProps {
  actions: MoreAction[];
  /** What the button is called for a screen reader, e.g. "More actions for NKA-7536". */
  label?: string;
}

export default function MoreActionsMenu({ actions, label = "More actions" }: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2.5 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 transition-colors shadow-xs cursor-pointer"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl animate-fade-in"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            const disabled = Boolean(action.disabledReason);
            return (
              <React.Fragment key={action.label}>
                {action.separated && <div className="my-1 border-t border-slate-100" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  title={action.disabledReason}
                  onClick={() => {
                    setOpen(false);
                    action.onSelect();
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 min-h-tap md:pointer-fine:min-h-0 text-left text-sm font-medium transition-colors ${
                    disabled
                      ? "cursor-not-allowed bg-slate-50 text-slate-400"
                      : action.danger
                        ? "cursor-pointer text-red-600 hover:bg-red-50"
                        : "cursor-pointer text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${disabled ? "" : action.danger ? "" : "text-slate-500"}`} />
                  {action.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
