import { ApiError, apiFetch } from "@/app/lib/apiClient";
import type { BookingEdits } from "@/app/lib/bookingEdits";

// Saving what an edit window changed about a booking, with the one question a
// save can come back with.
//
// Both edit windows - the pending feed's and the calendar's - save the same
// way, and this used to be written out in each of them; every change had to be
// made twice. They now share it.

export type SaveEditsOutcome =
  | { saved: true }
  /** Nothing was saved: moving to today needs the coordinator's say-so first. */
  | { saved: false; question: string };

/**
 * Sends the edits, if there are any. Moved to today with times the crew may
 * not make - or that could not be checked - the server saves nothing and
 * returns the question; asked again with keepAnyway, it saves.
 */
export async function saveBookingEdits(
  bookingID: string,
  edits: BookingEdits | null,
  keepAnyway = false,
): Promise<SaveEditsOutcome> {
  if (!edits) return { saved: true };

  try {
    await apiFetch(`/api/bookings/${bookingID}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "update", ...edits, ...(keepAnyway ? { acknowledgeTightSchedule: true } : {}) }),
    });
    return { saved: true };
  } catch (error) {
    // A 409 is also "already on the road"; only the question carries this.
    const asked =
      error instanceof ApiError &&
      error.status === 409 &&
      (error.body as { needsConfirmation?: string } | null)?.needsConfirmation === "tightSchedule";
    if (asked) return { saved: false, question: error.message };
    throw error;
  }
}
