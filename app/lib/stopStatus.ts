// The stop_status enum in the database, spelled exactly as Postgres holds it.
// Writing any other value fails the update, which is how stops silently went
// unmarked: the crew route wrote "Completed", which is not a valid label.

export const STOP_STATUS = {
  pending: "Pending",
  arrived: "Arrived",
  delivered: "Successfully Delivered",
  foulTrip: "Foul Trip",
  cancelled: "Cancelled",
} as const;

export type StopStatus = (typeof STOP_STATUS)[keyof typeof STOP_STATUS];

// Matches "Successfully Delivered" as well as the older "Completed"/"Delivered"
// values sitting in existing rows.
export function isStopDelivered(status?: string | null): boolean {
  return /deliver|complete/i.test(status ?? "");
}

export function isStopFailed(status?: string | null): boolean {
  return /foul|fail|cancel/i.test(status ?? "");
}
