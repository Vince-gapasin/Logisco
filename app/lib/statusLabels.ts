// What a booking's status is called on screen - one name per state, everywhere.
//
// The same booking used to read "Assign Crew" on the dashboard, "UNASSIGNED"
// in the feed, "Pending" in the reports and "Status: Created | Unassigned" in
// its own window; "Waiting Crew Dispatch", "Crew Confirmed" and "Crew to Start
// Delivery" all meant the crew had said yes. The internal values stay as they
// are - screens branch on them - and this is only the wording people read.

const BOOKING_LABELS: Record<string, string> = {
  // Nobody is on it yet.
  Unassigned: "Needs a crew",
  "Assign Crew": "Needs a crew",
  // A crew turned it down, so it needs a new one.
  "Assign Now": "Crew declined",
  Declined: "Crew declined",
  Rejected: "Crew declined",
  // Assigned, waiting for everyone to accept.
  "Pending Crew": "Waiting for crew",
  // Everyone accepted; the trip has not started.
  "Crew Confirmed": "Crew confirmed",
  "Waiting Crew Dispatch": "Crew confirmed",
  // Out on the road.
  "On Route": "On the road",
  "In Transit": "On the road",
  "In-Transit": "On the road",
  // Finished, one way or another.
  Delivered: "Delivered",
  Completed: "Delivered",
  "Foul Trip": "Foul trip",
  Cancelled: "Cancelled",
  "Returned to base": "Returned to base",
  "Sub-con": "With sub-con partner",
  // The reports' word for a booking that has not set off yet.
  Pending: "Not started",
};

/** The on-screen name for a booking status. Unknown values pass through unchanged. */
export function bookingStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return BOOKING_LABELS[status] ?? status;
}

const CREW_ANSWER_LABELS: Record<string, string> = {
  Pending: "Not answered yet",
  Accepted: "Accepted",
  Declined: "Declined",
};

/** How one crew member has answered their assignment. */
export function crewAnswerLabel(status: string | null | undefined): string {
  if (!status) return "";
  return CREW_ANSWER_LABELS[status] ?? status;
}
