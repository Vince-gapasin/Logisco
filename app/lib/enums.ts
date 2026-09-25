// The database enums, spelled exactly as Postgres holds them.
//
// Every value here was read from pg_enum, not guessed. Writing a label the
// enum does not contain fails the update, and supabase-js returns errors as
// values rather than throwing, so those failures have been silent:
//   - stopStatus "Completed" never existed, so no stop was ever marked
//   - Returned / Cancelled / Delivered appeared on no screen for months
//
// Use these constants instead of string literals so a rename becomes a
// compile error. Verify with:
//   SELECT t.typname, e.enumlabel FROM pg_enum e
//   JOIN pg_type t ON t.oid = e.enumtypid ORDER BY t.typname, e.enumsortorder;

// ==========================================
// delivery_status  (DispatchOrder.status)
// ==========================================
export const DELIVERY_STATUS = {
  pending: "Pending",
  assigned: "Assigned",
  accepted: "Accepted",
  startDelivery: "Start Delivery",
  inWarehouse: "In Warehouse",
  inTransit: "In Transit",
  arrived: "Arrived",
  delivered: "Delivered",
  completed: "Completed",
  returned: "Returned",
  foulTrip: "Foul Trip",
  cancelled: "Cancelled",
  rejected: "Rejected",
} as const;

export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

// Holds a truck and crew until the trip ends.
export const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  DELIVERY_STATUS.pending,
  DELIVERY_STATUS.assigned,
  DELIVERY_STATUS.accepted,
  DELIVERY_STATUS.startDelivery,
  DELIVERY_STATUS.inWarehouse,
  DELIVERY_STATUS.inTransit,
  DELIVERY_STATUS.arrived,
];

// The trip is over: the crew can no longer change it.
export const TERMINAL_DELIVERY_STATUSES: DeliveryStatus[] = [
  DELIVERY_STATUS.delivered,
  DELIVERY_STATUS.completed,
  DELIVERY_STATUS.returned,
  DELIVERY_STATUS.foulTrip,
  DELIVERY_STATUS.cancelled,
  DELIVERY_STATUS.rejected,
];

// Finished successfully, as opposed to interrupted or cancelled.
export const FINISHED_DELIVERY_STATUSES: DeliveryStatus[] = [
  DELIVERY_STATUS.delivered,
  DELIVERY_STATUS.completed,
  DELIVERY_STATUS.returned,
];

// Trips that are over one way or another, so never the live one on a booking.
export const CLOSED_DISPATCH_STATUSES: string[] = [DELIVERY_STATUS.rejected, DELIVERY_STATUS.foulTrip];

export const CLOSED_OR_CANCELLED_STATUSES: string[] = [
  DELIVERY_STATUS.rejected,
  DELIVERY_STATUS.foulTrip,
  DELIVERY_STATUS.cancelled,
];

// Assigned, and nobody has answered yet.
export const AWAITING_CREW_STATUSES: string[] = [DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned];

// Nothing further will happen on these, so nobody needs reminding about them.
export const SETTLED_DISPATCH_STATUSES: string[] = [
  DELIVERY_STATUS.rejected,
  DELIVERY_STATUS.foulTrip,
  DELIVERY_STATUS.completed,
];

// A trip that has not left yet, and so can still be changed from the office.
export const BEFORE_DEPARTURE_STATUSES: string[] = [
  DELIVERY_STATUS.pending,
  DELIVERY_STATUS.assigned,
  DELIVERY_STATUS.accepted,
];

// On the road with the cargo, or finished with it.
export const CARRYING_OR_DONE_STATUSES: string[] = [DELIVERY_STATUS.inTransit, DELIVERY_STATUS.completed];

// Everything from the crew accepting onwards. A trip that is on the road, or
// finished, was accepted before it got there - so this is what "the driver
// agreed to carry it" means, whatever stage it has reached since.
export const ACCEPTED_ONWARDS: string[] = [
  DELIVERY_STATUS.accepted,
  DELIVERY_STATUS.startDelivery,
  DELIVERY_STATUS.inWarehouse,
  DELIVERY_STATUS.inTransit,
  DELIVERY_STATUS.arrived,
  DELIVERY_STATUS.delivered,
  DELIVERY_STATUS.completed,
  DELIVERY_STATUS.returned,
];

// ==========================================
// helper_status  (DispatchHelper.status)
// ==========================================
export const HELPER_STATUS = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
} as const;

export type HelperStatus = (typeof HELPER_STATUS)[keyof typeof HELPER_STATUS];

// ==========================================
// stop_status  (BranchStops.stopStatus)
// ==========================================
export const STOP_STATUS = {
  pending: "Pending",
  arrived: "Arrived",
  delivered: "Successfully Delivered",
  foulTrip: "Foul Trip",
  cancelled: "Cancelled",
} as const;

export type StopStatus = (typeof STOP_STATUS)[keyof typeof STOP_STATUS];

// ==========================================
// Employee.role
// ==========================================
export const EMPLOYEE_ROLE = {
  admin: "Admin",
  coordinator: "Coordinator",
  mechanic: "Mechanic",
  driver: "Driver",
  helper: "Helper",
} as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLE)[keyof typeof EMPLOYEE_ROLE];

// ==========================================
// truck_status  (Truck.truckStatus)
// ==========================================
export const TRUCK_STATUS = {
  available: "Available",
  onMaintenance: "On Maintenance",
  onDelivery: "On Delivery",
  outOfService: "Out of Service",
} as const;

export type TruckStatus = (typeof TRUCK_STATUS)[keyof typeof TRUCK_STATUS];

// ==========================================
// Employee.availability
// ==========================================
// Two things in one word. "Available", "On Leave" and "Unavailable" are what
// an admin set and are the only values stored on the employee; "Booked" and
// "In Transit" are worked out from live dispatches when employees are read.
export const AVAILABILITY = {
  available: "Available",
  onLeave: "On Leave",
  unavailable: "Unavailable",
  booked: "Booked",
  inTransit: "In Transit",
} as const;

export type Availability = (typeof AVAILABILITY)[keyof typeof AVAILABILITY];

/** The values an admin can set, and the only ones the column may hold. */
export const MANUAL_AVAILABILITY: Availability[] = [
  AVAILABILITY.available,
  AVAILABILITY.onLeave,
  AVAILABILITY.unavailable,
];

export function isManualAvailability(value: unknown): value is Availability {
  return typeof value === "string" && MANUAL_AVAILABILITY.includes(value as Availability);
}

/**
 * Whether someone can be given a trip at all. Being booked or on the road
 * makes them busy, which the dispatch screens judge from live trips; this is
 * only about leave.
 */
export function isAssignable(availability: string | null | undefined): boolean {
  return availability !== AVAILABILITY.onLeave && availability !== AVAILABILITY.unavailable;
}

// ==========================================
// Matching helpers
// ==========================================
// Existing rows hold older spellings ("Completed" where a stop now reads
// "Successfully Delivered"), so display checks stay tolerant.

export function isStopDelivered(status?: string | null): boolean {
  return /deliver|complete/i.test(status ?? "");
}

export function isStopFailed(status?: string | null): boolean {
  return /foul|fail|cancel/i.test(status ?? "");
}

export function isDeliveryFinished(status?: string | null): boolean {
  return FINISHED_DELIVERY_STATUSES.includes(status as DeliveryStatus);
}

export function isDeliveryTerminal(status?: string | null): boolean {
  return TERMINAL_DELIVERY_STATUSES.includes(status as DeliveryStatus);
}

export function isDeliveryActive(status?: string | null): boolean {
  return ACTIVE_DELIVERY_STATUSES.includes(status as DeliveryStatus);
}

// ==========================================
// WHO HAS AGREED TO CARRY A TRIP
// ==========================================
// Read from the dispatch and its helper rows, because that is where it is
// recorded. Two screens used to read it from columns named driverConfirmed
// and helperConfirmed, which the Order table does not have and never had, so
// both were always false and a confirmed crew never showed as confirmed.

export interface HelperAssignment {
  status?: string | null;
}

export function hasDriverAccepted(dispatchStatus?: string | null): boolean {
  return ACCEPTED_ONWARDS.includes(dispatchStatus ?? "");
}

/** True when there are helpers and every one of them has accepted. */
export function haveHelpersAccepted(helpers: HelperAssignment[] | null | undefined): boolean {
  const rows = helpers ?? [];
  return rows.length > 0 && rows.every((helper) => helper?.status === HELPER_STATUS.accepted);
}

/**
 * Whether a trip's crew have agreed to it. A trip with no helpers counts as
 * confirmed once its driver has: there is nobody else to hear from.
 */
export function crewHasConfirmed(
  dispatchStatus: string | null | undefined,
  helpers: HelperAssignment[] | null | undefined,
): boolean {
  if (!hasDriverAccepted(dispatchStatus)) return false;
  const rows = helpers ?? [];
  return rows.length === 0 || haveHelpersAccepted(rows);
}
