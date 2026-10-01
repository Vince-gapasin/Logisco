"use client";

import React from "react";

/**
 * The control that opens the record a table row stands for.
 *
 * Every list in this app opened its records with onClick on the <tr>. That
 * works for a finger and a mouse and for nothing else: a <tr> takes no focus,
 * announces itself as a row rather than as something you can act on, and never
 * responds to Enter. On the six delivery feeds the row was the only way in, so
 * a keyboard or switch-access user could not open a booking at all.
 *
 * A real button fixes all of it at once and without any ARIA: it is focusable,
 * it is announced as a button, Enter and Space work, and the focus ring added
 * in globals.css lands on it. The row keeps its own onClick as a convenience
 * for pointers, which is why this stops propagation - otherwise a click here
 * would open the record twice.
 *
 * It is deliberately styled as the text it wraps rather than as a button. The
 * row is already the tap target; this exists so the record is reachable, not to
 * add a second thing to press, and the screens should look exactly as they did.
 */
export default function RowOpenButton({
  label,
  onOpen,
  className = "",
  children,
}: {
  /** What the record is, for a screen reader: "View booking ORD-1042". The
   *  visible text is usually just an ID, which on its own says nothing. */
  label: string;
  onOpen: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className={`text-left ${className}`}
    >
      {children}
    </button>
  );
}
