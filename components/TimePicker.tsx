"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Clock, X } from "lucide-react";
import { isValidClockTime, QUARTER_MINUTES } from "@/app/lib/bookingRules";

// A clock time picked on the quarter hour, drawn the same on every device.
//
// <input type="time"> was a typing box with a spinner on Windows, a scroll
// wheel on an iPhone and a clock face on Android, and all of them let any
// minute through. This is one panel everywhere: AM/PM, then an hour, then
// :00, :15, :30 or :45. The value stays "HH:mm" in 24-hour time, which is what
// the server and the database already speak.
//
// A time that is not on the quarter hour - an older booking's 08:10 - is shown
// as it is; it only changes when someone picks a new one.

interface TimePickerProps {
  id?: string;
  /** "HH:mm" (or "HH:mm:ss" as the database returns it), or "" for none. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  /** Adds a clear button, for optional times. */
  allowClear?: boolean;
  /** "HH:mm": slots after this are greyed out, e.g. no future time for something that already happened. */
  max?: string;
  /** "HH:mm": slots before this are greyed out, e.g. no time already gone for a stop booked today. */
  min?: string;
  /** "cell" fits a table row; "field" matches the full-size inputs. */
  size?: "cell" | "field";
  disabled?: boolean;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DAY = 24 * 60;
const PANEL_WIDTH = 288;

const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (total: number) => `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;

/** "14:30" → "2:30 PM". */
export function formatClock(value: string): string {
  if (!isValidClockTime(value)) return "";
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

export default function TimePicker({
  id,
  value,
  onChange,
  placeholder = "Select time",
  invalid = false,
  allowClear = false,
  max,
  min,
  size = "field",
  disabled = false,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelID = useId();

  const current = isValidClockTime(value) ? toMinutes(value.trim()) : null;
  const hour24 = current === null ? null : Math.floor(current / 60);
  const minute = current === null ? null : current % 60;
  // Which half of the day the hour buttons show. Follows the value, but can be
  // flipped before an hour is chosen.
  const [pm, setPm] = useState(hour24 !== null && hour24 >= 12);
  const limit = max && isValidClockTime(max) ? toMinutes(max) : null;
  const floor = min && isValidClockTime(min) ? toMinutes(min) : null;
  const outOfRange = (total: number) => (limit !== null && total > limit) || (floor !== null && total < floor);

  // The panel is portalled to <body> and placed with fixed coordinates, so a
  // table that scrolls sideways or a modal's overflow cannot clip it.
  const place = useCallback(() => {
    const box = buttonRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.min(Math.max(8, box.left), window.innerWidth - width - 8);
    const height = panelRef.current?.offsetHeight ?? 260;
    const below = box.bottom + 6;
    const top = below + height > window.innerHeight - 8 && box.top - height - 6 > 8 ? box.top - height - 6 : below;
    setPos({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const show = () => {
    if (disabled) return;
    setPm(hour24 !== null ? hour24 >= 12 : false);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  // An hour keeps the chosen minute when it is a quarter, else starts at :00 -
  // or at the first quarter that is in range, so picking an hour never lands
  // on a slot shown greyed out.
  const pickHour = (h12: number) => {
    const h = (h12 % 12) + (pm ? 12 : 0);
    const kept = minute !== null && minute % 15 === 0 ? minute : 0;
    const m = outOfRange(h * 60 + kept) ? (QUARTER_MINUTES.find((q) => !outOfRange(h * 60 + q)) ?? kept) : kept;
    onChange(fromMinutes(h * 60 + m));
  };
  // An hour is open when any of its quarters is.
  const hourOff = (h: number) => QUARTER_MINUTES.every((q) => outOfRange(h * 60 + q));

  const pickMinute = (m: number) => {
    if (hour24 === null) return;
    onChange(fromMinutes(hour24 * 60 + m));
    close();
  };

  const flipHalf = (toPm: boolean) => {
    setPm(toPm);
    if (hour24 !== null && toPm !== hour24 >= 12) onChange(fromMinutes(((hour24 + 12) % 24) * 60 + (minute ?? 0)));
  };

  // Arrow keys step a quarter hour, on the field or in the panel; Escape closes.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = e.key === "ArrowUp" ? 15 : -15;
      // An empty field starts at 8:00, or on the first open quarter when 8:00 is greyed out.
      const start = floor !== null && floor > 8 * 60 ? Math.ceil(floor / 15) * 15 - step : 8 * 60;
      const base = current === null ? start : current - (current % 15) + (step < 0 && current % 15 ? 15 : 0);
      const next = (((base + step) % DAY) + DAY) % DAY;
      if (outOfRange(next)) return;
      setPm(next >= 12 * 60);
      onChange(fromMinutes(next));
    }
  };

  const chip = (on: boolean, off = false) =>
    `min-h-tap md:pointer-fine:min-h-9 rounded-md border text-sm font-medium transition-colors ${
      off
        ? "border-slate-100 text-slate-300 cursor-not-allowed"
        : on
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-200 text-slate-700 hover:bg-slate-100"
    }`;

  const trigger =
    size === "cell"
      ? `w-full flex items-center gap-1.5 bg-transparent border rounded px-1.5 py-1 text-left ${invalid ? "border-red-500 bg-red-50" : "border-slate-200"}`
      : `w-full min-h-tap sm:min-h-10 flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm ${invalid ? "border-red-500" : "border-slate-300"}`;

  const label = formatClock(value);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelID : undefined}
        className={`${trigger} focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:bg-slate-50`}
      >
        <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className={`flex-1 truncate ${label ? "text-slate-900" : "text-slate-500"}`}>{label || placeholder}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelID}
            role="dialog"
            aria-label="Choose a time"
            onKeyDown={onKeyDown}
            style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: "hidden" }}
            className="fixed z-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => flipHalf(false)} className={chip(!pm)} aria-pressed={!pm}>
                AM
              </button>
              <button type="button" onClick={() => flipHalf(true)} className={chip(pm)} aria-pressed={pm}>
                PM
              </button>
            </div>

            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hour</p>
            <div className="mb-3 grid grid-cols-6 gap-1.5">
              {HOURS.map((h12) => {
                const h = (h12 % 12) + (pm ? 12 : 0);
                const off = hourOff(h);
                const on = hour24 === h;
                return (
                  <button key={h12} type="button" disabled={off} onClick={() => pickHour(h12)} className={chip(on, off)} aria-pressed={on}>
                    {h12}
                  </button>
                );
              })}
            </div>

            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Minute</p>
            <div className="grid grid-cols-4 gap-1.5">
              {QUARTER_MINUTES.map((m) => {
                // Waits for an hour rather than guessing one.
                const off = hour24 === null || outOfRange(hour24 * 60 + m);
                const on = minute === m;
                return (
                  <button key={m} type="button" disabled={off} onClick={() => pickMinute(m)} className={chip(on, off)} aria-pressed={on}>
                    :{pad(m)}
                  </button>
                );
              })}
            </div>

            {(allowClear && value) || (minute !== null && minute % 15 !== 0) ? (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                <span className="text-slate-500">
                  {minute !== null && minute % 15 !== 0 ? `Was ${label} - pick a new time to change it` : ""}
                </span>
                {allowClear && value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      close();
                    }}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            ) : null}
          </div>,
          document.body,
        )}
    </div>
  );
}
