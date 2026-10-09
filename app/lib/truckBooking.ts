import type { TruckTrip } from "@/services/truck/truckService";

// How the fleet lists read a truck that is on a booking.
//
// The truck's own record says "On Delivery" from the moment it is assigned,
// because that is what keeps it off every other booking. But a truck the crew
// has not set off in yet is still in the yard, and the office and the mechanics
// need to tell the two apart. So the lists split it by the trip's own status:
// booked until the crew starts the trip, on delivery once it is on the road.
// Nothing here is stored - the record keeps "On Delivery" either way.

export const ALREADY_BOOKED = "Already Booked";

/** The trip has a truck, but the crew has not started it yet. */
const WAITING_TRIP_STATUSES = new Set(["Pending", "Assigned", "Accepted"]);

/** The status a fleet list shows for a truck, given the trip it is on. */
export function shownTruckStatus(status: string, trip: TruckTrip | null | undefined): string {
  if (status === "On Delivery" && trip && WAITING_TRIP_STATUSES.has(trip.status)) return ALREADY_BOOKED;
  return status;
}

/** The day a trip delivers, or the days: "2026-10-09 – 2026-10-11" for a run of several. */
export function deliveryDays(trip: TruckTrip): string | null {
  if (!trip.deliverySchedule) return null;
  return trip.deliveryEnd ? `${trip.deliverySchedule} – ${trip.deliveryEnd}` : trip.deliverySchedule;
}

/** One line naming the booking, for a list row: code, client, delivery day, driver. */
export function bookingSummary(trip: TruckTrip): string {
  return [
    trip.orderCode ?? "Booking",
    trip.clientName,
    trip.deliverySchedule ? `Delivery ${deliveryDays(trip)}` : null,
    trip.driverName ? `Driver ${trip.driverName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
