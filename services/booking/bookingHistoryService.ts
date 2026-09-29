// What happened to a booking, in order.
//
// The screens used to build this by splitting the trip note into lines. Those
// lines carry no time and no author, so they could not be ordered, and a
// crew member declining - recorded properly everywhere else - never appeared
// at all. The audit trail has the time, the person and what they did, so the
// history is read from there.

import { supabase } from "@/app/lib/supabase";
import { formatDateTime } from "@/app/lib/datetime";
import { signPodUrls } from "@/services/storage/podService";

export interface BookingHistoryEntry {
  id: string;
  at: string;
  /** "22 Sep 2026, 8:00 AM" */
  dateTime: string;
  title: string;
  detail: string;
  actorName: string;
  actorRole: string;
  /**
   * The proof of delivery taken at the stop this line is about, when there is
   * one - so the history doubles as the index of them. Signed, and expiring.
   */
  proof: { url: string; label: string; isPdf: boolean } | null;
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
    case "Order/UPDATE": {
      // Only what actually moved, and what it moved from.
      const fields: Record<string, string> = {
        deliverySchedule: "Schedule",
        priorityLevel: "Priority",
        product: "Product",
        notes: "Notes",
      };
      const changes = Object.entries(fields)
        .filter(([key]) => text(data[key]) !== text(before[key]))
        .map(([key, label]) => `${label}: ${text(before[key]) || "empty"} to ${text(data[key]) || "empty"}`);

      return {
        title: "Booking edited",
        detail: changes.length > 0 ? changes.join("; ") : "No visible change.",
      };
    }

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
    case "DispatchOrder/CREW_ARRIVED":
      return {
        title: "Crew arrived at a stop",
        detail: "They reported reaching it, so the trip is not counted as quiet while they work.",
      };
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

  const proofs = await proofsByStop(trips.map((trip) => trip.dispatchID), orderID);

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
        proof: proofs.get(stopKeyOf(row)) ?? null,
      } satisfies BookingHistoryEntry;
    })
    .filter((entry): entry is BookingHistoryEntry => entry !== null);
}

/**
 * Which stop an audited line is about, as a key.
 *
 * The status route records the stop it completed alongside the status, which is
 * what lets a proof be matched to the line that produced it rather than to a
 * time that happens to be near it.
 */
function stopKeyOf(row: AuditRow): string {
  const stop = (row.newData?.stop ?? null) as
    | { branchID?: number | string; pickupID?: number | string }
    | null;
  if (!stop) return "";
  if (stop.branchID != null) return `branch:${stop.branchID}`;
  if (stop.pickupID != null) return `pickup:${stop.pickupID}`;
  return "";
}

/**
 * Every proof on this booking, keyed by the stop it was taken at.
 *
 * Read by trip where the rows carry a dispatchID, and by branch as well, because
 * proofs written before the crew route filled that column in have only the stop.
 * A stop with several - a re-upload, or a coordinator adding one later - keeps
 * the newest, which is the one anybody asking to see it means.
 */
async function proofsByStop(
  dispatchIDs: string[],
  orderID: string,
): Promise<Map<string, { url: string; label: string; isPdf: boolean }>> {
  const keyed = new Map<string, { url: string; label: string; isPdf: boolean }>();

  const { data: stops } = await supabase
    .from("BranchStops")
    .select("branchID, branchName")
    .eq("orderID", orderID);

  const branchIDs = (stops ?? []).map((stop) => stop.branchID as number);
  const branchNames = new Map(
    (stops ?? []).map((stop) => [stop.branchID as number, (stop.branchName as string) ?? "Stop"]),
  );

  const { data: pickups } = await supabase
    .from("PickupStops")
    .select("pickupID, warehouseName")
    .eq("orderID", orderID);

  const pickupNames = new Map(
    (pickups ?? []).map((stop) => [
      stop.pickupID as number,
      (stop.warehouseName as string) ?? "Pickup",
    ]),
  );

  const columns = "podID, proof, fileType, branchID, pickupID, deliveredAt";
  const queries = [];
  if (dispatchIDs.length > 0) {
    queries.push(supabase.from("POD").select(columns).in("dispatchID", dispatchIDs));
  }
  if (branchIDs.length > 0) {
    queries.push(supabase.from("POD").select(columns).in("branchID", branchIDs));
  }
  if (pickups && pickups.length > 0) {
    queries.push(
      supabase
        .from("POD")
        .select(columns)
        .in("pickupID", pickups.map((stop) => stop.pickupID as number)),
    );
  }
  if (queries.length === 0) return keyed;

  const results = await Promise.all(queries);

  const rows: {
    podID: string;
    proof: string | null;
    fileType: string | null;
    branchID: number | null;
    pickupID: number | null;
    deliveredAt: string | null;
  }[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.error) {
      console.warn("[History] Could not read the proofs:", result.error.message);
      continue;
    }
    for (const row of (result.data ?? []) as (typeof rows)[number][]) {
      if (seen.has(row.podID)) continue;
      seen.add(row.podID);
      rows.push(row);
    }
  }

  const withFile = rows.filter((row) => row.proof);
  if (withFile.length === 0) return keyed;

  const signed = await signPodUrls(withFile.map((row) => row.proof));

  // Newest last, so the newest wins the key.
  withFile.sort((a, b) => (a.deliveredAt ?? "").localeCompare(b.deliveredAt ?? ""));

  for (const row of withFile) {
    const url = signed.get(row.proof ?? "");
    if (!url) continue;

    const key =
      row.branchID != null
        ? `branch:${row.branchID}`
        : row.pickupID != null
          ? `pickup:${row.pickupID}`
          : "";
    if (!key) continue;

    const label =
      row.branchID != null
        ? branchNames.get(row.branchID) ?? "Stop"
        : pickupNames.get(row.pickupID as number) ?? "Pickup";

    keyed.set(key, {
      url,
      label,
      isPdf: /\.pdf(\?|$)/i.test(url) || Boolean(row.fileType?.toLowerCase().includes("pdf")),
    });
  }

  return keyed;
}
