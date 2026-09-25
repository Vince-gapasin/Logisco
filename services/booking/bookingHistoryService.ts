// What happened to a booking, in order.
//
// The screens used to build this by splitting the trip note into lines. Those
// lines carry no time and no author, so they could not be ordered, and a
// crew member declining - recorded properly everywhere else - never appeared
// at all. The audit trail has the time, the person and what they did, so the
// history is read from there.

import { supabase } from "@/app/lib/supabase";
import { formatDateTime } from "@/app/lib/datetime";

export interface BookingHistoryEntry {
  id: string;
  at: string;
  /** "22 Sep 2026, 8:00 AM" */
  dateTime: string;
  title: string;
  detail: string;
  actorName: string;
  actorRole: string;
}

interface AuditRow {
  auditID: string;
  tableName: string;
  action: string;
  recordID: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  timestamp: string;
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Turns one audited action into a line someone can read. */
function describe(row: AuditRow): { title: string; detail: string } | null {
  const data = (row.newData ?? {}) as Record<string, unknown>;
  const before = (row.oldData ?? {}) as Record<string, unknown>;
  const as = text(data.as) || "crew";

  switch (`${row.tableName}/${row.action}`) {
    case "Order/CREATE":
      return {
        title: "Booking created",
        detail: `${data.stops ?? 0} delivery stop(s), ${data.pickups ?? 0} pickup(s).`,
      };
    case "Order/CANCEL":
      return { title: "Booking cancelled", detail: text(data.reason) || "No reason given." };

    case "DispatchOrder/ASSIGN":
      return { title: "Crew and truck assigned", detail: "Waiting for the crew to accept." };
    case "DispatchOrder/REASSIGN":
      return { title: "Crew re-assigned", detail: "Confirmations were reset for the new crew." };
    case "DispatchOrder/CREW_ACCEPT":
    case "DispatchHelper/CREW_ACCEPT":
      return { title: `Accepted by the ${as}`, detail: "They confirmed the assignment." };
    case "DispatchOrder/CREW_DECLINE":
    case "DispatchHelper/CREW_DECLINE": {
      const reason = text(data.rejectionreason) || text(data.declinereason) || text(data.reason);
      return {
        title: `Declined by the ${as}`,
        detail: reason ? `Reason: ${reason}` : "No reason given.",
      };
    }
    case "DispatchOrder/TRIP_PROGRESS": {
      const status = text(data.status) || "Updated";
      const stop = text(data.stop);
      return {
        title: `Status: ${status}`,
        detail: [stop ? `Stop: ${stop}` : "", data.proof ? "Proof of delivery uploaded." : ""]
          .filter(Boolean)
          .join(" ") || `Moved from ${text(before.status) || "the previous status"}.`,
      };
    }
    case "DispatchOrder/TRIP_COMPLETE":
      return { title: "Delivery completed", detail: "All stops were delivered." };
    case "DispatchOrder/EMERGENCY":
      return {
        title: `Foul trip reported: ${text(data.issueType) || "problem"}`,
        detail: [text(data.details), data.located ? "Location sent." : "", data.photo ? "Photo attached." : ""]
          .filter(Boolean)
          .join(" ") || "The trip was interrupted.",
      };

    case "DispatchOrder/SUBCON_ASSIGN":
      return { title: "Handed to a sub-contractor", detail: "A partner is carrying this booking." };
    case "DispatchOrder/SUBCON_PICKUP":
      return { title: "Partner collected the cargo", detail: "Recorded by the coordinator." };
    case "DispatchOrder/SUBCON_DELIVER":
      return {
        title: data.completed ? "Partner delivered the last stop" : "Partner delivered a stop",
        detail: data.withProof ? "Proof of delivery recorded." : "No proof of delivery was sent.",
      };
    case "DispatchOrder/SUBCON_PROBLEM":
      return { title: "Partner reported a problem", detail: text(data.issueType) || "The trip was interrupted." };

    case "FoulTripIncident/FOUL_TRIP_REASSIGN":
      return { title: "Recovered: re-assigned", detail: "Another truck and crew took the delivery." };
    case "FoulTripIncident/FOUL_TRIP_RESCHEDULE":
      return { title: "Recovered: rescheduled", detail: text(data.date) ? `Moved to ${text(data.date)}.` : "Moved to a later date." };
    case "FoulTripIncident/FOUL_TRIP_SUBCONTRACT":
      return { title: "Recovered: handed to a partner", detail: "A sub-contractor took the load." };
    case "FoulTripIncident/FOUL_TRIP_SEND_MECHANIC":
      return { title: "Mechanic sent", detail: `Severity: ${text(data.severity) || "not stated"}.` };
    case "FoulTripIncident/FOUL_TRIP_MECHANIC_REPORT":
      return {
        title: data.outcome === "fixed" ? "Truck repaired on site" : "Truck could not be fixed on site",
        detail: text(data.notes) || (data.resumed ? "The trip carried on." : "A replacement was needed."),
      };
    case "FoulTripIncident/FOUL_TRIP_CANCEL":
      return { title: "Cancelled after a foul trip", detail: text(data.reason) || "No reason given." };
    case "FoulTripIncident/FOUL_TRIP_CLOSE":
      return { title: "Foul trip closed", detail: text(data.notes) || "Handled outside the system." };
    case "FoulTripIncident/FOUL_TRIP_COMPLETE_SUBCONTRACT":
      return { title: "Partner delivery completed", detail: "Marked delivered by the coordinator." };

    default:
      // Something audited that this list has not learned to say yet. Better a
      // plain line than a gap in the history.
      return { title: row.action.replaceAll("_", " ").toLowerCase(), detail: "" };
  }
}

/** Everything recorded against a booking, its trips, its crew and its foul trips. Newest first. */
export async function getBookingHistory(orderID: string): Promise<BookingHistoryEntry[]> {
  const { data: order, error: orderError } = await supabase
    .from("Order")
    .select("orderID, DispatchOrder ( dispatchID, DispatchHelper ( dhID ) ), FoulTripIncident ( incidentID )")
    .eq("orderID", orderID)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) return [];

  const trips = ((order.DispatchOrder as { dispatchID: string; DispatchHelper: { dhID: string }[] | null }[] | null) ?? []);
  const recordIDs = [
    orderID,
    ...trips.map((trip) => trip.dispatchID),
    ...trips.flatMap((trip) => (trip.DispatchHelper ?? []).map((helper) => String(helper.dhID))),
    ...(((order.FoulTripIncident as { incidentID: string }[] | null) ?? []).map((incident) => incident.incidentID)),
  ].filter(Boolean);

  const { data, error } = await supabase
    .from("AuditTrail")
    .select("auditID, tableName, action, recordID, oldData, newData, timestamp")
    .in("recordID", recordIDs)
    .order("timestamp", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AuditRow[])
    .map((row) => {
      const described = describe(row);
      if (!described) return null;
      const by = (row.newData?.by ?? {}) as { name?: string; role?: string };
      return {
        id: row.auditID,
        at: row.timestamp,
        dateTime: formatDateTime(row.timestamp),
        title: described.title,
        detail: described.detail,
        actorName: by.name ?? "System",
        actorRole: by.role ?? "System",
      } satisfies BookingHistoryEntry;
    })
    .filter((entry): entry is BookingHistoryEntry => entry !== null);
}
