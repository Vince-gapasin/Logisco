// Sub-contractor trips.
//
// A partner has no account here. They tell the coordinator how the trip is
// going and send the proof of delivery by message or email, and the
// coordinator records it: the pickup, then each stop with the partner's POD
// (a photo or a PDF) or the reason there is none. When every stop is
// delivered the trip completes. A breakdown is recorded as a foul trip, so it
// is recovered like any other.

import { supabase } from "@/app/lib/supabase";
import { ACTIVE_DELIVERY_STATUSES, DELIVERY_STATUS, STOP_STATUS, isStopDelivered } from "@/app/lib/enums";
import { releaseDispatchResources } from "@/services/dispatch/dispatchService";
import { POD_BUCKET, signPodUrls } from "@/services/storage/podService";
import { recordIncident } from "@/services/foulTrip/foulTripService";
import { partnerColumns, partnerNote, type PartnerChoice } from "@/services/subcon/partner";

export type { PartnerChoice };

export class SubconError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface Actor {
  employeeID: string;
  employeeName?: string | null;
}


// Before departure a partner trip waits as "Accepted": the coordinator has
// agreed it with the partner. Recording the pickup puts it in transit.
const NOT_DEPARTED = [DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned, DELIVERY_STATUS.accepted] as string[];

export const MAX_POD_BYTES = 10 * 1024 * 1024;
export const MIN_REASON_LENGTH = 10;

// ------------------------------------------------------------------ reading

const TRIP_COLUMNS = `
  dispatchID, orderID, status, completedAt, pickupCompletedAt, dispatchNote, pod_url,
  subConID, partnerDriver, partnerPlate, partnerContact,
  SubContractor ( subConID, companyName, contactName, contactNumber ),
  Order ( orderID, orderCode, notes, Client ( company ) ),
  BranchStops ( branchID, branchName, deliveryAddress, contactPerson, contactNum, expectedTime, quantity, sequence, stopStatus, completedAt ),
  PickupStops ( pickupID, warehouseName, pickupAddress, expectedTime, quantity, sequence, stopStatus, completedAt ),
  POD ( podID, branchID, proof, receiverName, remarks, deliveredAt, source, missingReason, fileType, Recorder:Employee!recordedBy ( employeeName ) )
`;

type Embed<T> = T | T[] | null | undefined;

interface PodRow {
  branchID: number | null;
  proof: string | null;
  receiverName: string | null;
  remarks: string | null;
  deliveredAt: string | null;
  missingReason: string | null;
  fileType: string | null;
  Recorder: Embed<{ employeeName: string }>;
}
interface StopRow {
  branchID: number;
  branchName: string | null;
  deliveryAddress: string | null;
  contactPerson: string | null;
  contactNum: string | null;
  expectedTime: string | null;
  quantity: number | null;
  sequence: number | null;
  stopStatus: string | null;
  completedAt: string | null;
}
interface PickupRow {
  warehouseName: string | null;
  pickupAddress: string | null;
  expectedTime: string | null;
  quantity: number | null;
  sequence: number | null;
}
const first = <T,>(value: Embed<T>): T | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

export interface SubconStopView {
  branchID: number;
  branchName: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNum: string;
  expectedTime: string | null;
  quantity: number | null;
  status: string;
  delivered: boolean;
  completedAt: string | null;
  proof: {
    url: string | null;
    isPdf: boolean;
    receiverName: string | null;
    remarks: string | null;
    deliveredAt: string | null;
    missingReason: string | null;
    recordedBy: string | null;
  } | null;
}

export interface SubconTripView {
  dispatchID: string;
  orderID: string;
  orderCode: string | null;
  clientName: string | null;
  status: string;
  scheduledDate: string | null;
  pickedUpAt: string | null;
  completedAt: string | null;
  partner: { subConID: string | null; name: string; contactName: string | null; contactNumber: string | null };
  driverName: string | null;
  plateNumber: string | null;
  driverContact: string | null;
  pickups: { warehouseName: string; pickupAddress: string; expectedTime: string | null; quantity: number | null }[];
  stops: SubconStopView[];
  deliveredCount: number;
  lastUpdate: string | null;
}

const noteField = (note: string | null | undefined, label: string) =>
  new RegExp(`${label}:\\s*([^\\n]*)`).exec(note ?? "")?.[1]?.trim() || null;

async function toViews(rows: Record<string, unknown>[]): Promise<SubconTripView[]> {
  const podPaths = rows.flatMap((row) => ((row.POD as { proof: string | null }[] | null) ?? []).map((p) => p.proof));
  const signed = await signPodUrls(podPaths);

  return rows.map((row) => {
    const partner = first(row.SubContractor as Embed<{ subConID: string; companyName: string; contactName: string | null; contactNumber: string | null }>);
    const order = first(row.Order as Embed<{ orderID: string; orderCode: string; notes: string | null; Client: Embed<{ company: string }> }>);
    const note = row.dispatchNote as string | null;
    const pods = ((row.POD as PodRow[] | null) ?? []).sort((a, b) => String(b.deliveredAt ?? "").localeCompare(String(a.deliveredAt ?? "")));

    const stops: SubconStopView[] = ((row.BranchStops as StopRow[] | null) ?? [])
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.branchID - b.branchID)
      .map((stop) => {
        const pod = pods.find((p) => p.branchID === stop.branchID) ?? null;
        return {
          branchID: stop.branchID,
          branchName: stop.branchName || "Stop",
          deliveryAddress: stop.deliveryAddress || "",
          contactPerson: stop.contactPerson || "",
          contactNum: stop.contactNum || "",
          expectedTime: stop.expectedTime ?? null,
          quantity: stop.quantity ?? null,
          status: stop.stopStatus || STOP_STATUS.pending,
          delivered: isStopDelivered(stop.stopStatus),
          completedAt: stop.completedAt ?? null,
          proof: pod
            ? {
                url: pod.proof ? (signed.get(pod.proof) ?? null) : null,
                isPdf: pod.fileType === "application/pdf" || /\.pdf$/i.test(pod.proof ?? ""),
                receiverName: pod.receiverName && pod.receiverName !== "N/A" ? pod.receiverName : null,
                remarks: pod.remarks ?? null,
                deliveredAt: pod.deliveredAt ?? stop.completedAt ?? null,
                missingReason: pod.missingReason ?? null,
                recordedBy: first(pod.Recorder)?.employeeName ?? null,
              }
            : null,
        };
      });

    const times = [row.pickupCompletedAt as string | null, row.completedAt as string | null, ...stops.map((s) => s.completedAt)]
      .filter((t): t is string => Boolean(t))
      .sort();

    return {
      dispatchID: row.dispatchID as string,
      orderID: row.orderID as string,
      orderCode: order?.orderCode ?? null,
      clientName: first(order?.Client)?.company ?? noteField(order?.notes, "Name"),
      status: row.status as string,
      scheduledDate: noteField(order?.notes, "Delivery Schedule"),
      pickedUpAt: (row.pickupCompletedAt as string | null) ?? null,
      completedAt: (row.completedAt as string | null) ?? null,
      partner: {
        subConID: partner?.subConID ?? null,
        name: partner?.companyName ?? noteField(note, "Subcontractor") ?? "Sub-contractor",
        contactName: partner?.contactName ?? null,
        contactNumber: partner?.contactNumber ?? null,
      },
      driverName: (row.partnerDriver as string | null) ?? noteField(note, "External Driver"),
      plateNumber: (row.partnerPlate as string | null) ?? noteField(note, "Temporary Plate"),
      driverContact: (row.partnerContact as string | null) ?? noteField(note, "Driver Contact"),
      pickups: ((row.PickupStops as PickupRow[] | null) ?? [])
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((p) => ({
          warehouseName: p.warehouseName || "Pickup",
          pickupAddress: p.pickupAddress || "",
          expectedTime: p.expectedTime ?? null,
          quantity: p.quantity ?? null,
        })),
      stops,
      deliveredCount: stops.filter((s) => s.delivered).length,
      lastUpdate: times.at(-1) ?? null,
    };
  });
}

/** Partner trips: those still running, or finished in the last 30 days. */
export async function listSubconTrips(scope: "active" | "recent"): Promise<SubconTripView[]> {
  let query = supabase.from("DispatchOrder").select(TRIP_COLUMNS).not("subConID", "is", null);
  if (scope === "active") {
    query = query.in("status", ACTIVE_DELIVERY_STATUSES);
  } else {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    query = query.not("status", "in", `(${ACTIVE_DELIVERY_STATUSES.map((s) => `"${s}"`).join(",")})`).gte("completedAt", since);
  }
  const { data, error } = await query.order("completedAt", { ascending: false, nullsFirst: true }).limit(200);
  if (error) throw new Error(`Failed to load sub-contractor trips: ${error.message}`);
  return toViews((data ?? []) as Record<string, unknown>[]);
}

export async function getSubconTrip(dispatchID: string): Promise<SubconTripView> {
  const { data, error } = await supabase.from("DispatchOrder").select(TRIP_COLUMNS).eq("dispatchID", dispatchID).maybeSingle();
  if (error) throw new Error(`Failed to load the trip: ${error.message}`);
  if (!data) throw new SubconError("Trip not found.", 404);
  const [view] = await toViews([data as Record<string, unknown>]);
  if (!(data as { subConID: string | null }).subConID && !noteField((data as { dispatchNote: string | null }).dispatchNote, "Subcontractor")) {
    throw new SubconError("This is not a sub-contractor trip.", 400);
  }
  return view;
}

// ----------------------------------------------------------------- creating

async function activePartner(subConID: string) {
  const { data, error } = await supabase
    .from("SubContractor")
    .select("subConID, companyName, isActive")
    .eq("subConID", subConID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.isActive === false) throw new SubconError("That sub-contractor is not active.");
  return data;
}

/**
 * Hands a booking to a partner. A booking with a trip that has not left yet
 * (its own crew not confirmed, say) has that trip removed and its truck and
 * crew freed first; a trip already on the road cannot be handed over here.
 */
export async function createSubconTrip(orderID: string, choice: PartnerChoice, actor: Actor) {
  const partner = await activePartner(choice.subConID);

  const { data: order, error: orderError } = await supabase
    .from("Order")
    .select("orderID, isActive, DispatchOrder ( dispatchID, status )")
    .eq("orderID", orderID)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order || order.isActive === false) throw new SubconError("Booking not found.", 404);

  const live = ((order.DispatchOrder as { dispatchID: string; status: string }[] | null) ?? []).filter((d) =>
    ACTIVE_DELIVERY_STATUSES.includes(d.status as (typeof ACTIVE_DELIVERY_STATUSES)[number]),
  );
  if (live.some((d) => !NOT_DEPARTED.includes(d.status))) {
    throw new SubconError("This booking's trip is already on the road. Report a foul trip to hand it over.", 409);
  }
  // A foul trip is handed on from the foul-trip screen, which moves its
  // undelivered stops to the new trip; here they would stay on the failed one.
  const { count: openIncidents, error: incidentError } = await supabase
    .from("FoulTripIncident")
    .select("incidentID", { count: "exact", head: true })
    .eq("orderID", orderID)
    .in("status", ["open", "mechanic_assigned"]);
  if (incidentError) throw new Error(incidentError.message);
  if (openIncidents) {
    throw new SubconError("This booking has an open foul trip. Hand it to a partner from the Foul Trip feed.", 409);
  }

  for (const trip of live) await discardTrip(trip.dispatchID);

  const { data: dispatch, error } = await supabase
    .from("DispatchOrder")
    .insert({
      orderID,
      truckID: null,
      driverID: null,
      coorID: actor.employeeID,
      status: DELIVERY_STATUS.accepted,
      dispatchNote: partnerNote(partner.companyName, choice),
      ...partnerColumns(choice),
    })
    .select("dispatchID")
    .single();
  if (error) throw new Error(`Failed to create the sub-contractor trip: ${error.message}`);

  const linked = await Promise.all([
    supabase.from("BranchStops").update({ dispatchID: dispatch.dispatchID }).eq("orderID", orderID).is("dispatchID", null),
    supabase.from("PickupStops").update({ dispatchID: dispatch.dispatchID }).eq("orderID", orderID).is("dispatchID", null),
  ]);
  const linkError = linked.find((r) => r.error)?.error;
  if (linkError) {
    await supabase.from("DispatchOrder").delete().eq("dispatchID", dispatch.dispatchID);
    throw new Error(`Failed to link the booking's stops: ${linkError.message}`);
  }

  return { dispatchID: dispatch.dispatchID as string, partner: partner.companyName as string, replaced: live.map((d) => d.dispatchID) };
}

// A trip that never left: free its truck and crew, return its stops to the
// booking, and remove it.
async function discardTrip(dispatchID: string) {
  await releaseDispatchResources(dispatchID);
  await supabase.from("BranchStops").update({ dispatchID: null }).eq("dispatchID", dispatchID);
  await supabase.from("PickupStops").update({ dispatchID: null }).eq("dispatchID", dispatchID);
  await supabase.from("DispatchHelper").delete().eq("dispatchID", dispatchID);
  const { error } = await supabase.from("DispatchOrder").delete().eq("dispatchID", dispatchID);
  if (error) throw new Error(`Failed to remove the previous trip: ${error.message}`);
}

// ---------------------------------------------------------------- updating

async function loadTrip(dispatchID: string) {
  const { data, error } = await supabase
    .from("DispatchOrder")
    .select("dispatchID, orderID, status, pickupCompletedAt, subConID, dispatchNote, BranchStops ( branchID, stopStatus )")
    .eq("dispatchID", dispatchID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new SubconError("Trip not found.", 404);
  if (!data.subConID) throw new SubconError("Only a sub-contractor trip is updated here; your own crew update theirs in the app.");
  if (!ACTIVE_DELIVERY_STATUSES.includes(data.status as (typeof ACTIVE_DELIVERY_STATUSES)[number])) {
    throw new SubconError(`This trip is already ${data.status}.`, 409);
  }
  return data;
}

function checkTime(value: string | null | undefined, label: string): string {
  const time = value ? new Date(value) : new Date();
  if (Number.isNaN(time.getTime())) throw new SubconError(`${label} is not a valid date and time.`);
  if (time.getTime() > Date.now() + 5 * 60 * 1000) throw new SubconError(`${label} cannot be in the future.`);
  return time.toISOString();
}

/** The partner has collected the cargo. */
export async function recordPickup(dispatchID: string, at: string | null | undefined) {
  const trip = await loadTrip(dispatchID);
  if (trip.pickupCompletedAt) throw new SubconError("The pickup is already recorded.", 409);
  const pickedUpAt = checkTime(at, "Pickup time");

  const { error } = await supabase
    .from("DispatchOrder")
    .update({ pickupCompletedAt: pickedUpAt, status: DELIVERY_STATUS.inTransit, current_step: 1 })
    .eq("dispatchID", dispatchID)
    .eq("status", trip.status);
  if (error) throw new Error(`Failed to record the pickup: ${error.message}`);

  await supabase
    .from("PickupStops")
    .update({ stopStatus: STOP_STATUS.delivered, completedAt: pickedUpAt })
    .eq("dispatchID", dispatchID);

  return { dispatchID, pickedUpAt };
}

export interface DeliveryRecord {
  branchID: number;
  file?: File | null;
  missingReason?: string | null;
  receiverName?: string | null;
  deliveredAt?: string | null;
  remarks?: string | null;
}

/**
 * One stop delivered, with the partner's proof - a photo or PDF - or why
 * there is none. The last stop completes the trip.
 */
export async function recordDelivery(dispatchID: string, record: DeliveryRecord, actor: Actor) {
  const trip = await loadTrip(dispatchID);
  const stops = (trip.BranchStops as { branchID: number; stopStatus: string | null }[] | null) ?? [];
  const stop = stops.find((s) => s.branchID === record.branchID);
  if (!stop) throw new SubconError("That stop is not on this trip.");
  if (isStopDelivered(stop.stopStatus)) throw new SubconError("That stop is already recorded as delivered.", 409);

  const file = record.file && record.file.size > 0 ? record.file : null;
  const reason = record.missingReason?.trim() || null;
  if (!file && !reason) throw new SubconError("Attach the proof of delivery the partner sent, or give the reason there is none.");
  if (!file && reason && reason.length < MIN_REASON_LENGTH) {
    throw new SubconError("Give a fuller reason why there is no proof of delivery.");
  }
  if (file) {
    const allowed = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) throw new SubconError("The proof of delivery must be a photo or a PDF.");
    if (file.size > MAX_POD_BYTES) throw new SubconError("The proof of delivery must be 10 MB or smaller.");
  }
  const deliveredAt = checkTime(record.deliveredAt, "Delivery time");

  let proof: string | null = null;
  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "");
    proof = `pod-${dispatchID}-${record.branchID}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(POD_BUCKET)
      .upload(proof, await file.arrayBuffer(), { contentType: file.type });
    if (uploadError) throw new Error(`Failed to store the proof of delivery: ${uploadError.message}`);
  }

  const { error: podError } = await supabase.from("POD").insert({
    branchID: record.branchID,
    dispatchID,
    proof,
    fileType: file?.type ?? null,
    receiverName: record.receiverName?.trim() || "N/A",
    remarks: record.remarks?.trim() || null,
    deliveredAt,
    recordedBy: actor.employeeID,
    source: "coordinator",
    missingReason: file ? null : reason,
  });
  if (podError) {
    if (proof) await supabase.storage.from(POD_BUCKET).remove([proof]);
    throw new Error(`Failed to record the delivery: ${podError.message}`);
  }

  const { error: stopError } = await supabase
    .from("BranchStops")
    .update({ stopStatus: STOP_STATUS.delivered, completedAt: deliveredAt })
    .eq("branchID", record.branchID);
  if (stopError) throw new Error(`Failed to mark the stop delivered: ${stopError.message}`);

  // A delivery means the cargo was collected, whether or not the pickup was
  // reported separately.
  const tripUpdate: Record<string, unknown> = {};
  if (!trip.pickupCompletedAt) {
    tripUpdate.pickupCompletedAt = deliveredAt;
    await supabase.from("PickupStops").update({ stopStatus: STOP_STATUS.delivered, completedAt: deliveredAt }).eq("dispatchID", dispatchID);
  }
  if (proof) tripUpdate.pod_url = proof;

  const remaining = stops.filter((s) => s.branchID !== record.branchID && !isStopDelivered(s.stopStatus)).length;
  if (remaining === 0) {
    tripUpdate.status = DELIVERY_STATUS.completed;
    tripUpdate.completedAt = deliveredAt;
  } else if (NOT_DEPARTED.includes(trip.status)) {
    tripUpdate.status = DELIVERY_STATUS.inTransit;
  }

  if (Object.keys(tripUpdate).length) {
    const { error } = await supabase.from("DispatchOrder").update(tripUpdate).eq("dispatchID", dispatchID);
    if (error) throw new Error(`Failed to update the trip: ${error.message}`);
  }

  return { dispatchID, branchID: record.branchID, completed: remaining === 0, withProof: Boolean(proof) };
}

/**
 * The partner reports a breakdown, an accident or a failed delivery. It
 * becomes a foul trip like any other, so it is recovered from the foul-trip
 * screen: re-assign to our own crew, another partner, reschedule or cancel.
 */
export async function reportProblem(
  dispatchID: string,
  problem: { issueType: string; details?: string | null },
  actor: Actor,
) {
  const trip = await loadTrip(dispatchID);
  const issueType = problem.issueType.trim();
  const details = problem.details?.trim() || null;
  if (!issueType) throw new SubconError("Say what happened.");
  if (issueType === "Other" && !details) throw new SubconError("Describe what happened when choosing Other.");

  const note = `EMERGENCY [${issueType}] reported by ${actor.employeeName ?? "coordinator"} for the partner: ${details ?? "No details provided"}`;
  const { data: marked, error } = await supabase
    .from("DispatchOrder")
    .update({
      status: DELIVERY_STATUS.foulTrip,
      dispatchNote: trip.dispatchNote ? `${trip.dispatchNote}\n${note}` : note,
    })
    .eq("dispatchID", dispatchID)
    .eq("status", trip.status)
    .select("dispatchID")
    .maybeSingle();
  if (error) throw new Error(`Failed to record the problem: ${error.message}`);
  if (!marked) throw new SubconError("This trip was updated by someone else. Refresh and try again.", 409);

  await recordIncident({
    dispatchID,
    orderID: trip.orderID,
    truckID: null,
    reportedBy: actor.employeeID,
    issueType,
    details,
    photoPath: null,
    latitude: null,
    longitude: null,
    dispatchStatusBefore: trip.status,
    cargoLoaded: Boolean(trip.pickupCompletedAt),
  });

  await supabase.from("Reports").insert({
    dispatchID,
    status: DELIVERY_STATUS.foulTrip,
    finalRemarks: `EMERGENCY ALERT\nType: ${issueType}\nReported by: ${actor.employeeName ?? "Coordinator"} (for the partner)\nDetails: ${details ?? "None provided"}`,
  });

  return { dispatchID, issueType };
}
