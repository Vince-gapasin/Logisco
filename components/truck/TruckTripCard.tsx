"use client";

import Link from "next/link";
import { CalendarDays, Package, User } from "lucide-react";
import type { TruckTrip } from "@/services/truck/truckService";

// The booking a truck is on, shown where its status would otherwise just read
// "On Delivery".
//
// That status belongs to the trip. It is set when a truck is assigned to a
// booking and cleared when the trip ends, so the fleet screens say which booking
// it is instead of offering it as something to pick.

/** What the trip's own status means for the truck, in a few words. */
function tripStage(status: string): string {
  switch (status) {
    case "Pending":
    case "Assigned":
      return "Booked - waiting for the crew to accept";
    case "Accepted":
      return "Booked - crew accepted, not yet started";
    case "Start Delivery":
    case "In Warehouse":
      return "Collecting the load";
    case "In Transit":
    case "Arrived":
      return "On the road";
    default:
      return status;
  }
}

export default function TruckTripCard({
  trip,
  showLink = true,
}: {
  trip: TruckTrip;
  /** The link goes to the office's booking feeds, which a mechanic cannot open. */
  showLink?: boolean;
}) {
  return (
    <div className="border border-blue-200 bg-blue-50/60 rounded-xl p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="font-semibold text-blue-900">Current booking</p>
        <span className="text-xs font-semibold text-blue-800 bg-white border border-blue-200 rounded-full px-2.5 py-0.5">
          {tripStage(trip.status)}
        </span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-slate-700">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-500 shrink-0" />
          <dt className="sr-only">Booking</dt>
          <dd className="font-medium text-slate-900">
            {trip.orderCode ?? "Booking"}
            {trip.clientName ? <span className="font-normal text-slate-600"> · {trip.clientName}</span> : null}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
          <dt className="sr-only">Delivery day</dt>
          <dd>{trip.deliverySchedule || "No delivery day recorded"}</dd>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-500 shrink-0" />
          <dt className="sr-only">Driver</dt>
          <dd>{trip.driverName ?? "No driver"}</dd>
        </div>
      </dl>
      {showLink && trip.orderCode && (
        <Link
          href={`/admindashboard/feeds/${["In Transit", "Arrived", "Start Delivery", "In Warehouse"].includes(trip.status) ? "in-transit" : "pending"}?open=${encodeURIComponent(trip.orderCode)}`}
          className="mt-3 inline-block text-xs font-semibold text-blue-700 hover:underline"
        >
          Open the booking
        </Link>
      )}
    </div>
  );
}
