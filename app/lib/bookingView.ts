import { formatTime } from "@/app/lib/datetime";
// Maps an Order row from /api/bookings into the shape the booking screens
// render. Scheduling and priority are still stored inside Order.notes as
// free text by the booking form, so they are parsed back out here in one
// place rather than repeating the regexes on every screen.
//
// Pickups used to be parsed out of the notes the same way. They are real
// rows now (PickupStops), and the note is read only for orders created
// before that table existed.

import {
  ACCEPTED_ONWARDS,
  DELIVERY_STATUS,
  HELPER_STATUS,
  isStopDelivered,
  STOP_STATUS,
} from "@/app/lib/enums";

export interface StopProofView {
  /** A signed link that expires, or null when the file could not be signed. */
  url: string | null;
  isPdf: boolean;
  receiverName: string | null;
  remarks: string | null;
  deliveredAt: string | null;
  /** Why there is none, when a partner never sent one. */
  missingReason: string | null;
  recordedBy: "crew" | "coordinator";
}

export interface BookingStopView {
  branchID: number | null;
  branchName: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNum: string;
  expectedTime: string | null;
  // Units dropped or collected here; null on rows from before it was kept.
  quantity: number | null;
  sequence: number;
  status: string;
  arrivedAt: string | null;
  completedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  /** What was collected as proof at this stop, newest first. */
  proofs: StopProofView[];
}

export interface BookingPickupView {
  pickupID: number | null;
  warehouseName: string;
  pickupAddress: string;
  contactPerson: string;
  contactNum: string;
  expectedTime: string | null;
  // Units dropped or collected here; null on rows from before it was kept.
  quantity: number | null;
  sequence: number;
  status: string;
  arrivedAt: string | null;
  completedAt: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface BookingRemarkView {
  dateTime: string;
  details: string;
  attachments: string;
  staff: string;
  role: string;
}

export interface BookingCrewView {
  role: string;
  name: string;
  status: string;
  employeeID: string | null;
  reason: string;
}

export interface BookingView {
  id: string;
  orderId: string;
  clientID: string | null;
  clientName: string;
  contactPerson: string;
  contactNumber: string;
  businessAddress: string;
  emailAddress: string;
  product: string;
  scheduledDate: string;
  displayDate: string;
  dateCreated: string;
  createdBy: string;
  priorityLevel: string;
  status: string;
  notes: string;
  stops: BookingStopView[];
  pickups: BookingPickupView[];
  remarks: BookingRemarkView[];
  dispatchStatus: string | null;
  hasDispatch: boolean;
  isActive: boolean;
  dispatchID: string | null;
  truckID: string | null;
  driverID: string | null;
  truckPlate: string;
  truckModel: string;
  driverName: string;
  crews: BookingCrewView[];
  currentStep: number;
  completedAt: string | null;
  pickupCompletedAt: string | null;
  rejectionReason: string;
  dispatchNote: string;
  totalQuantity: string;
  subconPartner: string;
  // Carried by a sub-contractor: the coordinator records its progress.
  isSubcon: boolean;
  plainNotes: string;
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// Pulls "Label: value" out of the notes blob the booking form writes.
function readNoteField(notes: string, label: string): string {
  const match = new RegExp(`${label}:\\s*(.+)`, "i").exec(notes || "");
  return match ? match[1].split("\n")[0].trim() : "";
}

export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}

// DispatchOrder.status -> the stage labels the progress tracker renders.
export function toProgressStage(dispatchStatus: string | null): string {
  switch (dispatchStatus) {
    case null:
    case undefined:
      return "Created";
    case "Pending":
    case "Assigned":
    case "Accepted":
      return "Assigned";
    case "In Transit":
      return "In Transit";
    case "Completed":
    case "Delivered":
      return "Complete";
    // A crew declined before the trip began: nothing went out and nothing
    // came back, so the booking is waiting for a crew again.
    case "Rejected":
      return "Created";

    // The truck is back at base: the last stage of the tracker.
    case "Returned":
    case "Cancelled":
    case "Foul Trip":
      return "Returned";
    default:
      return "Created";
  }
}

export function mapOrderToBookingView(order: any): BookingView {
  const client = firstRelated<any>(order.Client);
  const items: any[] = Array.isArray(order.OrderDetails) ? order.OrderDetails : [];
  const stops: any[] = Array.isArray(order.BranchStops) ? order.BranchStops : [];
  const pickupRows: any[] = Array.isArray(order.PickupStops) ? order.PickupStops : [];

  const dispatches: any[] = (Array.isArray(order.DispatchOrder)
    ? order.DispatchOrder
    : [order.DispatchOrder]
  ).filter(Boolean);

  // The latest dispatch is the live one; earlier ones were rejected.
  const liveDispatch =
    dispatches.find(
      (d) => ![DELIVERY_STATUS.rejected, DELIVERY_STATUS.foulTrip].includes(d.status),
    ) ??
    dispatches[dispatches.length - 1] ??
    null;

  // A driver's acceptance lives on the dispatch itself; each helper carries
  // their own status on their DispatchHelper row.
  const driver = firstRelated<any>(liveDispatch?.Driver);
  const truck = firstRelated<any>(liveDispatch?.Truck);
  const partner = firstRelated<{ companyName?: string | null }>(liveDispatch?.SubContractor);
  const partnerFromNote = /Subcontractor:\s*([^\n]*)/.exec(liveDispatch?.dispatchNote || "")?.[1]?.trim() || "";
  const isSubcon = Boolean(liveDispatch && (liveDispatch.subConID || (!liveDispatch.truckID && partnerFromNote)));

  const driverStatus = (() => {
    if (!liveDispatch) return HELPER_STATUS.pending;
    // Anything from the crew accepting onwards means they accepted.
    if (!ACCEPTED_ONWARDS.includes(liveDispatch.status)) {
      return liveDispatch.status === DELIVERY_STATUS.rejected
        ? HELPER_STATUS.declined
        : HELPER_STATUS.pending;
    }
    return HELPER_STATUS.accepted;
  })();

  const crews: BookingCrewView[] = [];
  // A partner trip has no crew of ours to confirm.
  if (liveDispatch && !isSubcon) {
    crews.push({
      role: "Driver",
      name: driver?.employeeName || "Unassigned",
      status: driverStatus,
      employeeID: liveDispatch.driverID ?? null,
      reason: liveDispatch.rejectionreason || "",
    });

    const helpers: any[] = Array.isArray(liveDispatch.DispatchHelper) ? liveDispatch.DispatchHelper : [];
    helpers.forEach((helper, index) => {
      crews.push({
        role: `Helper #${index + 1}`,
        name: firstRelated<any>(helper.Helper)?.employeeName || "Unassigned",
        status: helper.status || "Pending",
        employeeID: helper.helperID ?? null,
        reason: helper.declinereason || "",
      });
    });
  }

  const notes: string = order.notes || "";
  const scheduledDate = readNoteField(notes, "Delivery Schedule");
  const priorityLevel = readNoteField(notes, "Priority") || "Standard";

  const product =
    items.length > 0
      ? items.map((item) => item.productName).filter(Boolean).join(", ")
      : "No items listed";

  const remarks: BookingRemarkView[] = [];
  if (order.createdAt) {
    remarks.push({
      dateTime: new Date(order.createdAt).toLocaleString("en-PH"),
      details: "Booking created and logged into the system.",
      attachments: "N/A",
      staff: "System",
      role: "Booking",
    });
  }
  if (liveDispatch?.dispatchNote) {
    for (const line of String(liveDispatch.dispatchNote).split("\n")) {
      const text = line.trim();
      if (!text) continue;
      remarks.push({
        dateTime: "",
        details: text,
        attachments: "N/A",
        staff: "Crew",
        role: "Driver",
      });
    }
  }

  return {
    id: order.orderID,
    orderId: order.orderCode || order.orderID,
    clientID: order.clientID ?? null,
    clientName: client?.company || "Walk-in / On-Call",
    contactPerson: client?.contactName || "",
    contactNumber: client?.contact || "",
    businessAddress: client?.businessAdd || "",
    emailAddress: client?.emailAdd || "",
    product,
    scheduledDate,
    displayDate: formatDisplayDate(scheduledDate || order.createdAt),
    dateCreated: formatDisplayDate(order.createdAt),
    createdBy: "—",
    priorityLevel,
    status: toProgressStage(liveDispatch?.status ?? null),
    notes,
    stops: stops
      .map((stop, index) => ({
        branchID: stop.branchID ?? null,
        branchName: stop.branchName || "Stop",
        deliveryAddress: stop.deliveryAddress || "",
        contactPerson: stop.contactPerson || "",
        contactNum: stop.contactNum || "",
        expectedTime: stop.expectedTime ?? null,
        quantity: Number(stop.quantity) || null,
        // Older stops predate the sequence column; their insert order is
        // still reflected by the identity branchID.
        sequence: Number(stop.sequence) || index + 1,
        status: stop.stopStatus || STOP_STATUS.pending,
        arrivedAt: stop.arrivedAt ?? null,
        completedAt: stop.completedAt ?? null,
        latitude: Number(stop.deliveryLat) || null,
        longitude: Number(stop.deliverLong) || null,
        proofs: ((stop.POD as any[]) ?? [])
          .map((pod) => ({
            url: (pod.proof as string | null) ?? null,
            isPdf: pod.fileType === "application/pdf" || /\.pdf(\?|$)/i.test(String(pod.proof ?? "")),
            receiverName: pod.receiverName && pod.receiverName !== "N/A" ? (pod.receiverName as string) : null,
            remarks: (pod.remarks as string | null) ?? null,
            deliveredAt: (pod.deliveredAt as string | null) ?? null,
            missingReason: (pod.missingReason as string | null) ?? null,
            recordedBy: pod.source === "coordinator" ? ("coordinator" as const) : ("crew" as const),
          }))
          .sort((a, b) => String(b.deliveredAt ?? "").localeCompare(String(a.deliveredAt ?? ""))),
      }))
      .sort((a, b) => a.sequence - b.sequence || (a.branchID ?? 0) - (b.branchID ?? 0)),
    pickups: pickupRows
      .map((pickup, index) => ({
        pickupID: pickup.pickupID ?? null,
        warehouseName: pickup.warehouseName || "Pickup point",
        pickupAddress: pickup.pickupAddress || "",
        contactPerson: pickup.contactPerson || "",
        contactNum: pickup.contactNum || "",
        expectedTime: pickup.expectedTime ?? null,
        quantity: Number(pickup.quantity) || null,
        sequence: Number(pickup.sequence) || index + 1,
        status: pickup.stopStatus || STOP_STATUS.pending,
        arrivedAt: pickup.arrivedAt ?? null,
        completedAt: pickup.completedAt ?? null,
        latitude: Number(pickup.pickupLat) || null,
        longitude: Number(pickup.pickupLong) || null,
      }))
      .sort((a, b) => a.sequence - b.sequence),
    remarks,
    dispatchStatus: liveDispatch?.status ?? null,
    hasDispatch: Boolean(liveDispatch),
    isActive: order.isActive !== false,
    dispatchID: liveDispatch?.dispatchID ?? null,
    truckID: liveDispatch?.truckID ?? null,
    driverID: liveDispatch?.driverID ?? null,
    truckPlate: truck?.plateNumber || liveDispatch?.partnerPlate || "",
    truckModel: truck?.model || "",
    driverName: driver?.employeeName || liveDispatch?.partnerDriver || "",
    crews,
    currentStep: liveDispatch?.current_step ?? 0,
    completedAt: liveDispatch?.completedAt ?? null,
    pickupCompletedAt: liveDispatch?.pickupCompletedAt ?? null,
    rejectionReason: liveDispatch?.rejectionreason || "",
    dispatchNote: liveDispatch?.dispatchNote || "",
    totalQuantity: String(
      items.reduce((total, item) => total + (Number(item.quantity) || 0), 0),
    ),
    subconPartner: partner?.companyName || partnerFromNote || readNoteField(notes, "Partner"),
    isSubcon,
    plainNotes: (notes.split("[NOTES]")[1] || "").trim(),
  };
}

// A booking still waiting for a truck and crew. A dispatch the driver
// rejected also lands back here: the booking needs assigning again.
export function isAwaitingAssignment(booking: BookingView): boolean {
  return booking.isActive && (!booking.hasDispatch || booking.dispatchStatus === "Rejected");
}

// Assigned, but at least one crew member has not confirmed yet.
export function isAwaitingCrewConfirmation(booking: BookingView): boolean {
  return (
    booking.isActive &&
    booking.hasDispatch &&
    ["Pending", "Assigned"].includes(booking.dispatchStatus ?? "") &&
    booking.crews.some((crew) => crew.status === "Pending")
  );
}

// Confirmed by the crew and waiting to depart.
export function isReadyToDepart(booking: BookingView): boolean {
  return booking.isActive && booking.dispatchStatus === "Accepted";
}

// Everything assigned but not yet on the road.
export function isAwaitingDeparture(booking: BookingView): boolean {
  return (
    booking.isActive &&
    booking.hasDispatch &&
    ["Pending", "Assigned", "Accepted"].includes(booking.dispatchStatus ?? "")
  );
}

// The "pending" feed: every booking a coordinator still has to move before it
// can leave - waiting for a crew, declined by one, or assigned and waiting to
// depart. This is the same rule the dashboard's Pending Bookings box uses, so
// a booking is listed in both places or in neither.
export function isPendingBooking(booking: BookingView): boolean {
  return isAwaitingDeparture(booking) || isAwaitingAssignment(booking);
}

export function isInTransit(booking: BookingView): boolean {
  return booking.dispatchStatus === "In Transit";
}

export function isCompleted(booking: BookingView): boolean {
  return ["Completed", "Delivered", "Returned"].includes(booking.dispatchStatus ?? "");
}

export function isCancelled(booking: BookingView): boolean {
  return booking.dispatchStatus === "Cancelled";
}

// Cancelled bookings are deactivated, so they stay out of this feed.
export function isFoulTrip(booking: BookingView): boolean {
  return booking.isActive && booking.dispatchStatus === "Foul Trip";
}

// ==========================================
// FEED ROWS
// ==========================================
// The four feed screens (pending, in-transit, completed, foul trip) all render
// the same record shape. This adapts a BookingView into it.

export interface FeedStopRow {
  warehouseName?: string;
  warehouseAddress?: string;
  branchName?: string;
  deliveryAddress?: string;
  contactPerson: string;
  contactNumber: string;
  pickupTime?: string;
  deliveryTime?: string;
  quantity: string;
  stopStatus: string;
}

export interface FeedBooking {
  id: string;
  orderId: string;
  clientName: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  businessAddress: string;
  product: string;
  quantity: string;
  scheduledDate: string;
  displayDate: string;
  dateCreated: string;
  createdBy: string;
  status: string;
  confirmationStatus: string;
  priorityLevel: string;
  notes: string;
  remarks: BookingRemarkView[];
  crews: BookingCrewView[];
  driver: string;
  helper: string;
  truckPlate: string;
  // The live trip, so a screen can re-assign it.
  dispatchID: string | null;
  truckID: string | null;
  truckModel: string;
  subconPartner: string;
  pickupList: FeedStopRow[];
  deliveryList: FeedStopRow[];
  foulDetails: {
    reason: string;
    reportedAt: string;
    reportedBy: string;
    description: string;
    attachment: string;
  } | null;
}

function confirmationLabel(booking: BookingView): string {
  if (booking.isSubcon && ["Pending", "Assigned", "Accepted"].includes(booking.dispatchStatus ?? "")) return "Sub-con";
  switch (booking.dispatchStatus) {
    case null:
    case undefined:
      return "Unassigned";
    case "Pending":
    case "Assigned":
      return booking.crews.every((crew) => crew.status === "Accepted") ? "Crew Confirmed" : "Pending Crew";
    case "Accepted":
      return "Crew Confirmed";
    case "In Transit":
      return "On Route";
    case "Completed":
    case "Delivered":
      return "Delivered";
    case "Returned":
      return "Returned to base";
    case "Cancelled":
      return "Cancelled";
    case "Foul Trip":
      return "Foul Trip";
    case "Rejected":
      return "Declined";
    default:
      return booking.dispatchStatus;
  }
}

// Pickups are rows now. Orders created before the PickupStops table still
// carry theirs as "Pickup: <place> @ <time>" in Order.notes, and those are
// read here so old bookings keep showing a collection point.
function parsePickup(booking: BookingView): FeedStopRow[] {
  if (booking.pickups.length > 0) {
    return booking.pickups.map((pickup) => ({
      warehouseName: pickup.warehouseName,
      warehouseAddress: pickup.pickupAddress || pickup.warehouseName,
      contactPerson: pickup.contactPerson,
      contactNumber: pickup.contactNum,
      pickupTime: formatStopTime(pickup.expectedTime),
      // Older pickups have no quantity of their own; show the order's.
      quantity: pickup.quantity ? String(pickup.quantity) : booking.totalQuantity,
      stopStatus: isStopDelivered(pickup.status)
        ? "Completed"
        : booking.pickupCompletedAt
          ? "Completed"
          : pickup.status,
    }));
  }

  const raw = /Pickup:\s*(.+)/i.exec(booking.notes || "");
  if (!raw) return [];

  const [address, time] = raw[1].split("@").map((part) => part.trim());
  return [
    {
      warehouseName: address || "Pickup point",
      warehouseAddress: address || "",
      contactPerson: "",
      contactNumber: "",
      pickupTime: formatStopTime(time),
      quantity: booking.totalQuantity,
      stopStatus:
        booking.pickupCompletedAt || booking.currentStep > 0 ? "Completed" : "Pending",
    },
  ];
}

// The crew app appends "EMERGENCY [type] reported by name: details" to the
// dispatch note when a foul trip is raised.
function parseFoulDetails(booking: BookingView): FeedBooking["foulDetails"] {
  if (booking.dispatchStatus !== "Foul Trip" && booking.dispatchStatus !== "Rejected") return null;

  const emergency = /EMERGENCY \[(.+?)\](?: reported by (.+?))?:\s*(.*)/i.exec(booking.dispatchNote || "");

  return {
    reason: emergency?.[1] || booking.rejectionReason || "Reported by crew",
    reportedAt: booking.completedAt ? new Date(booking.completedAt).toLocaleString("en-PH") : "",
    reportedBy: emergency?.[2] || booking.driverName || "Crew",
    description: emergency?.[3] || booking.rejectionReason || booking.dispatchNote || "No details provided.",
    attachment: "",
  };
}

export function toFeedBooking(booking: BookingView): FeedBooking {
  const helpers = booking.crews.filter((crew) => crew.role.startsWith("Helper"));

  return {
    id: booking.id,
    orderId: booking.orderId,
    clientName: booking.clientName,
    contactPerson: booking.contactPerson,
    contactNumber: booking.contactNumber,
    emailAddress: booking.emailAddress,
    businessAddress: booking.businessAddress,
    product: booking.product,
    quantity: booking.totalQuantity,
    scheduledDate: booking.scheduledDate,
    displayDate: booking.displayDate,
    dateCreated: booking.dateCreated,
    createdBy: booking.createdBy,
    status: booking.status,
    confirmationStatus: confirmationLabel(booking),
    priorityLevel: booking.priorityLevel,
    notes: booking.plainNotes,
    remarks: booking.remarks,
    crews: booking.crews,
    driver: booking.driverName || "Unassigned",
    helper: helpers.map((crew) => crew.name).join(", ") || "None",
    truckPlate: booking.truckPlate || "TBD",
    dispatchID: booking.dispatchID,
    truckID: booking.truckID,
    truckModel: booking.truckModel,
    subconPartner: booking.subconPartner,
    pickupList: parsePickup(booking),
    deliveryList: booking.stops.map((stop) => ({
      branchName: stop.branchName,
      deliveryAddress: stop.deliveryAddress || booking.businessAddress,
      contactPerson: stop.contactPerson,
      contactNumber: stop.contactNum,
      deliveryTime: formatStopTime(stop.expectedTime),
      quantity: stop.quantity ? String(stop.quantity) : "",
      stopStatus: stop.status,
    })),
    foulDetails: parseFoulDetails(booking),
  };
}

function formatStopTime(value: string | null): string {
  return formatTime(value);
}
