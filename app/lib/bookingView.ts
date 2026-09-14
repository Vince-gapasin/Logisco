// Maps an Order row from /api/bookings into the shape the booking screens
// render. Scheduling and priority are still stored inside Order.notes as
// free text by the booking form, so they are parsed back out here in one
// place rather than repeating the regexes on every screen.

export interface BookingStopView {
  branchID: number | null;
  branchName: string;
  contactPerson: string;
  contactNum: string;
  expectedTime: string | null;
  status: string;
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
  rejectionReason: string;
  dispatchNote: string;
  totalQuantity: string;
  subconPartner: string;
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
      return "Complete";
    case "Foul Trip":
    case "Rejected":
      return "Returned";
    default:
      return "Created";
  }
}

export function mapOrderToBookingView(order: any): BookingView {
  const client = firstRelated<any>(order.Client);
  const items: any[] = Array.isArray(order.OrderDetails) ? order.OrderDetails : [];
  const stops: any[] = Array.isArray(order.BranchStops) ? order.BranchStops : [];

  const dispatches: any[] = (Array.isArray(order.DispatchOrder)
    ? order.DispatchOrder
    : [order.DispatchOrder]
  ).filter(Boolean);

  // The latest dispatch is the live one; earlier ones were rejected.
  const liveDispatch =
    dispatches.find((d) => !["Rejected", "Foul Trip"].includes(d.status)) ??
    dispatches[dispatches.length - 1] ??
    null;

  // A driver's acceptance lives on the dispatch itself; each helper carries
  // their own status on their DispatchHelper row.
  const driver = firstRelated<any>(liveDispatch?.Driver);
  const truck = firstRelated<any>(liveDispatch?.Truck);

  const driverStatus = (() => {
    if (!liveDispatch) return "Pending";
    if (["Accepted", "In Transit", "Completed"].includes(liveDispatch.status)) return "Accepted";
    if (liveDispatch.status === "Rejected") return "Declined";
    return "Pending";
  })();

  const crews: BookingCrewView[] = [];
  if (liveDispatch) {
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
      .map((stop) => ({
        branchID: stop.branchID ?? null,
        branchName: stop.branchName || "Stop",
        contactPerson: stop.contactPerson || "",
        contactNum: stop.contactNum || "",
        expectedTime: stop.expectedTime ?? null,
        status: stop.stopStatus || "Pending",
        latitude: Number(stop.deliveryLat) || null,
        longitude: Number(stop.deliverLong) || null,
      }))
      .sort((a, b) => (a.branchID ?? 0) - (b.branchID ?? 0)),
    remarks,
    dispatchStatus: liveDispatch?.status ?? null,
    hasDispatch: Boolean(liveDispatch),
    isActive: order.isActive !== false,
    dispatchID: liveDispatch?.dispatchID ?? null,
    truckID: liveDispatch?.truckID ?? null,
    driverID: liveDispatch?.driverID ?? null,
    truckPlate: truck?.plateNumber || "",
    truckModel: truck?.model || "",
    driverName: driver?.employeeName || "",
    crews,
    currentStep: liveDispatch?.current_step ?? 0,
    completedAt: liveDispatch?.completedAt ?? null,
    rejectionReason: liveDispatch?.rejectionreason || "",
    dispatchNote: liveDispatch?.dispatchNote || "",
    totalQuantity: String(
      items.reduce((total, item) => total + (Number(item.quantity) || 0), 0),
    ),
    subconPartner: readNoteField(notes, "Partner"),
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

// Everything assigned but not yet on the road - the "pending" feed.
export function isAwaitingDeparture(booking: BookingView): boolean {
  return (
    booking.isActive &&
    booking.hasDispatch &&
    ["Pending", "Assigned", "Accepted"].includes(booking.dispatchStatus ?? "")
  );
}

export function isInTransit(booking: BookingView): boolean {
  return booking.dispatchStatus === "In Transit";
}

export function isCompleted(booking: BookingView): boolean {
  return booking.dispatchStatus === "Completed";
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
      return "Delivered";
    case "Foul Trip":
      return "Foul Trip";
    case "Rejected":
      return "Declined";
    default:
      return booking.dispatchStatus;
  }
}

// The booking form records the pickup as "Pickup: <address> @ <time>" inside
// Order.notes; there is no pickup table yet.
function parsePickup(booking: BookingView): FeedStopRow[] {
  const raw = /Pickup:\s*(.+)/i.exec(booking.notes || "");
  if (!raw) return [];

  const [address, time] = raw[1].split("@").map((part) => part.trim());
  return [
    {
      warehouseName: address || "Pickup point",
      warehouseAddress: address || "",
      contactPerson: "",
      contactNumber: "",
      pickupTime: time || "",
      quantity: booking.totalQuantity,
      stopStatus: booking.currentStep > 0 ? "Completed" : "Pending",
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
    subconPartner: booking.subconPartner,
    pickupList: parsePickup(booking),
    deliveryList: booking.stops.map((stop) => ({
      branchName: stop.branchName,
      deliveryAddress: booking.businessAddress,
      contactPerson: stop.contactPerson,
      contactNumber: stop.contactNum,
      deliveryTime: formatStopTime(stop.expectedTime),
      quantity: "",
      stopStatus: stop.status,
    })),
    foulDetails: parseFoulDetails(booking),
  };
}

function formatStopTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}
