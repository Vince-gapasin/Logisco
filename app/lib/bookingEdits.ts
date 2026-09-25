// What the booking screens may change about a booking, and whether they did.
//
// These screens exist to assign a crew, and they show the booking around that
// crew: when it is for, how urgent it is, what is being carried, what was
// said about it. Those fields were editable and were never sent anywhere, so
// a coordinator could move a delivery to Friday, assign a crew who were free
// on Friday, and leave the booking on Wednesday.
//
// Only fields the booking owns are here. A client's contact details and
// addresses belong to the client record and are changed under Clients &
// Partners, so editing one booking cannot rewrite another's.

export interface BookingEdits {
  deliverySchedule?: string;
  priorityLevel?: string;
  product?: string;
  notes?: string;
}

export interface EditableBooking {
  scheduledDate?: string;
  priorityLevel?: string;
  product?: string;
  /** The free text, without the headed sections the form writes around it. */
  notes?: string;
}

const clean = (value: string | undefined | null) => (value ?? "").trim();

/**
 * What the form changed, or null when nothing did. Saving nothing is worth
 * avoiding: it would write an audit entry and tell a crew their trip moved
 * when it did not.
 */
export function changedBookingFields(original: EditableBooking, form: Record<string, string>): BookingEdits | null {
  const edits: BookingEdits = {};

  if (clean(form.deliverySchedule) && clean(form.deliverySchedule) !== clean(original.scheduledDate)) {
    edits.deliverySchedule = clean(form.deliverySchedule);
  }
  if (clean(form.priorityLevel) && clean(form.priorityLevel) !== clean(original.priorityLevel)) {
    edits.priorityLevel = clean(form.priorityLevel);
  }
  if (clean(form.product) && clean(form.product) !== clean(original.product)) {
    edits.product = clean(form.product);
  }
  // Notes are the one field that may legitimately be emptied.
  if (clean(form.notes) !== clean(original.notes)) {
    edits.notes = clean(form.notes);
  }

  return Object.keys(edits).length > 0 ? edits : null;
}
