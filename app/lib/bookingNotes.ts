// Order.notes is a small document, not a comment.
//
// The booking form writes it in sections - [DELIVERY DETAILS] holding the
// priority, the requested date, the schedule and the pickup line, then
// [SUBCON ASSIGNMENT] or [ASSIGNED CREW] if either applies, then [NOTES] for
// whatever the coordinator typed. Editing a booking means changing one line
// of that document and leaving the rest exactly as it was, which is what
// these do. They are pure string work so they can be tested without a
// database.

const DETAILS_HEADING = "[DELIVERY DETAILS]";
const NOTES_HEADING = "[NOTES]";

/** Reads "Label: value" out of the blob, or "" when it is not there. */
export function readNote(notes: string, label: string): string {
  const match = new RegExp(`^${escapeLabel(label)}:[ \\t]*(.*)$`, "im").exec(notes || "");
  return match ? match[1].trim() : "";
}

/**
 * Sets "Label: value", replacing the line if it exists. A label that is not
 * there yet is added to the delivery details, which is where the booking form
 * puts all of them; a blob with no such section gets one.
 */
export function setNote(notes: string, label: string, value: string): string {
  const text = notes ?? "";
  const line = `${label}: ${value}`;
  const existing = new RegExp(`^${escapeLabel(label)}:[ \\t]*.*$`, "im");

  if (existing.test(text)) return text.replace(existing, line);

  const heading = text.indexOf(DETAILS_HEADING);
  if (heading === -1) {
    const prefix = text.trim() ? `${text.trimEnd()}\n\n` : "";
    return `${prefix}${DETAILS_HEADING}\n${line}`;
  }

  const insertAt = heading + DETAILS_HEADING.length;
  return `${text.slice(0, insertAt)}\n${line}${text.slice(insertAt)}`;
}

/** Whatever the coordinator typed, without the headed sections around it. */
export function readNotesBody(notes: string): string {
  const parts = (notes ?? "").split(NOTES_HEADING);
  return parts.length > 1 ? parts.slice(1).join(NOTES_HEADING).trim() : "";
}

/** Replaces that free text, leaving every other section untouched. */
export function setNotesBody(notes: string, body: string): string {
  const text = notes ?? "";
  const heading = text.indexOf(NOTES_HEADING);
  const written = body.trim();

  if (heading === -1) {
    if (!written) return text;
    const prefix = text.trim() ? `${text.trimEnd()}\n\n` : "";
    return `${prefix}${NOTES_HEADING}\n${written}`;
  }

  const kept = text.slice(0, heading).trimEnd();
  if (!written) return kept;
  return `${kept}\n\n${NOTES_HEADING}\n${written}`;
}

// A label is a plain word in practice, but it is interpolated into a regular
// expression, so anything that would change the pattern is escaped.
function escapeLabel(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
