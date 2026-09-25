import { supabase } from "@/app/lib/supabase";
import {
  ACTIVE_DELIVERY_STATUSES,
  DELIVERY_STATUS,
  HELPER_STATUS,
  TRUCK_STATUS,
  AWAITING_CREW_STATUSES,
  CLOSED_DISPATCH_STATUSES,
  SETTLED_DISPATCH_STATUSES,
} from "@/app/lib/enums";

// A person's notifications: what happened, and what is still the case.
//
// Events are written when they happen (see notify.ts) and stored with a row
// per recipient, so read state belongs to the person rather than to a
// browser. Standing conditions - a truck on maintenance, a booking with no
// crew - are not events and are still worked out from live data here; they
// end by themselves when the condition does, so there is nothing to mark as
// read on the server. Both are merged into one feed, newest first.

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: string;
  /** Where the feed should take them. */
  link?: string | null;
  /** Stored events carry their read state; standing conditions do not. */
  isRead?: boolean;
  isStored?: boolean;
  createdAt?: string;
  /** What this item is about: "DispatchOrder:<id>". */
  entityKey?: string;
  /** Events that already told them this; the standing item then stays quiet. */
  supersededBy?: string[];
  truckPlate?: string;
  vehicleType?: string;
  issue?: string;
  crewName?: string;
  reason?: string;
}

// The pages colour by type; severity is what an event records.
const TYPE_BY_SEVERITY: Record<string, string> = {
  urgent: "warning",
  action: "approval",
  info: "reminder",
};

/** Events written for this person, newest first. */

// The joined shapes these standing queries read. Each selects a little more
// than the last, so the fields are optional and the names come from the
// generated schema.
interface ClientEmbed {
  company?: string | null;
}
interface OrderEmbed {
  orderID?: string;
  orderCode?: string | null;
  Client?: ClientEmbed | ClientEmbed[] | null;
}
interface TruckEmbed {
  plateNumber?: string | null;
}
interface DispatchEmbed {
  dispatchID?: string;
  status?: string | null;
  Order?: OrderEmbed | OrderEmbed[] | null;
  Truck?: TruckEmbed | TruckEmbed[] | null;
}

async function storedNotifications(employeeID: string, limit = 100): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("NotificationRecipient")
    .select(
      "recipientID, readAt, Notification ( notificationID, event, title, body, severity, link, createdAt, actorName, entityTable, entityID )",
    )
    .eq("employeeID", employeeID)
    .order("recipientID", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row): AppNotification | null => {
      const event = firstRelated<{
        notificationID: string;
        event: string;
        title: string;
        body: string;
        severity: string;
        link: string | null;
        createdAt: string;
        entityTable: string | null;
        entityID: string | null;
      }>(row.Notification);
      if (!event) return null;
      return {
        id: event.notificationID,
        title: event.title,
        message: event.body,
        time: relativeTime(event.createdAt),
        type: TYPE_BY_SEVERITY[event.severity] ?? "reminder",
        link: event.link ?? null,
        isRead: Boolean(row.readAt),
        isStored: true,
        createdAt: event.createdAt,
        entityKey: event.entityTable && event.entityID ? `${event.entityTable}:${event.entityID}` : undefined,
        // Carried so a standing item can tell it already said this.
        supersededBy: [event.event],
      };
    })
    .filter((item): item is AppNotification => item !== null)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// Trucks unchecked for longer than this are flagged to mechanics.
const MAINTENANCE_CHECK_DAYS = 30;

function relativeTime(value: string | null | undefined): string {
  if (!value) return "";
  const stamp = new Date(value).getTime();
  if (Number.isNaN(stamp)) return "";

  const minutes = Math.round((Date.now() - stamp) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ==========================================
// CREW (driver / helper)
// ==========================================
async function crewNotifications(employeeID: string): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];

  const { data: driverDispatches, error: driverError } = await supabase
    .from("DispatchOrder")
    .select("dispatchID, status, Order ( orderCode, Client ( company ) ), Truck ( plateNumber )")
    .eq("driverID", employeeID)
    .in("status", ACTIVE_DELIVERY_STATUSES);

  if (driverError) throw new Error(driverError.message);

  for (const dispatch of driverDispatches ?? []) {
    const order = firstRelated<OrderEmbed>(dispatch.Order);
    const client = firstRelated<ClientEmbed>(order?.Client);
    const truck = firstRelated<TruckEmbed>(dispatch.Truck);
    const label = order?.orderCode ?? dispatch.dispatchID;

    if ([DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned].includes(dispatch.status)) {
      notifications.push({
        id: `crew-assign-${dispatch.dispatchID}`,
        title: "New Delivery Assignment",
        message: `New assignment for ${label}${client?.company ? ` (Client: ${client.company})` : ""}. Open it to accept or decline.`,
        time: "",
        type: "assignment",
        truckPlate: truck?.plateNumber ?? undefined,
        entityKey: `DispatchOrder:${dispatch.dispatchID}`,
        supersededBy: ["CREW_ASSIGNED"],
      });
    } else if (dispatch.status === DELIVERY_STATUS.inTransit) {
      notifications.push({
        id: `crew-transit-${dispatch.dispatchID}`,
        title: "Trip in progress",
        message: `${label} is in transit. Remember to upload proof of delivery at every stop.`,
        time: "",
        type: "reminder",
        truckPlate: truck?.plateNumber ?? undefined,
      });
    }
  }

  // Assignments where this employee is a helper and has not replied.
  const { data: helperRows, error: helperError } = await supabase
    .from("DispatchHelper")
    .select("dhID, status, DispatchOrder ( dispatchID, status, Order ( orderCode, Client ( company ) ) )")
    .eq("helperID", employeeID)
    .eq("status", HELPER_STATUS.pending);

  if (helperError) throw new Error(helperError.message);

  for (const row of helperRows ?? []) {
    const dispatch = firstRelated<DispatchEmbed>(row.DispatchOrder);
    if (!dispatch) continue;
    // A trip that is over needs nobody chased about it.
    if (SETTLED_DISPATCH_STATUSES.includes(dispatch.status ?? "")) {
      continue;
    }

    const order = firstRelated<OrderEmbed>(dispatch.Order);
    const client = firstRelated<ClientEmbed>(order?.Client);

    notifications.push({
      id: `crew-helper-${row.dhID}`,
      title: "New Helper Assignment",
      message: `You are assigned as helper on ${order?.orderCode ?? dispatch.dispatchID}${client?.company ? ` (Client: ${client.company})` : ""}. Please confirm.`,
      time: "",
      type: "assignment",
      entityKey: `DispatchOrder:${dispatch.dispatchID}`,
      supersededBy: ["CREW_ASSIGNED"],
    });
  }

  return notifications;
}

// ==========================================
// ADMIN / COORDINATOR
// ==========================================
async function adminNotifications(): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];

  const { data: orders, error: orderError } = await supabase
    .from("Order")
    .select("orderID, orderCode, createdAt, isActive, Client ( company ), DispatchOrder ( dispatchID, status )")
    .eq("isActive", true)
    .order("createdAt", { ascending: false })
    .limit(200);

  if (orderError) throw new Error(orderError.message);

  for (const order of orders ?? []) {
    const dispatches = ((order.DispatchOrder as DispatchEmbed[] | null) ?? []).filter(Boolean);
    const live =
      dispatches.find((d) => !CLOSED_DISPATCH_STATUSES.includes(d.status ?? "")) ??
      dispatches[dispatches.length - 1];
    const client = firstRelated<ClientEmbed>(order.Client);
    const company = client?.company ? ` (${client.company})` : "";

    if (!live || live.status === DELIVERY_STATUS.rejected) {
      notifications.push({
        id: `admin-unassigned-${order.orderID}`,
        title: live ? "Dispatch declined - needs re-assignment" : "Booking awaiting assignment",
        message: `${order.orderCode}${company} has no active crew assigned.`,
        time: relativeTime(order.createdAt),
        type: "approval",
      });
    } else if (AWAITING_CREW_STATUSES.includes(live.status ?? "")) {
      notifications.push({
        id: `admin-confirm-${live.dispatchID}`,
        title: "Waiting for crew confirmation",
        message: `${order.orderCode}${company} is assigned but the crew has not confirmed yet.`,
        time: relativeTime(order.createdAt),
        type: "reminder",
      });
    }
  }

  // Foul trips waiting on dispatch, from the incident record - which knows
  // when it was reported and whether a mechanic is already on the way.
  const { data: incidents, error: incidentError } = await supabase
    .from("FoulTripIncident")
    .select("incidentID, dispatchID, status, issueType, reportedAt, Order ( orderCode, Client ( company ) )")
    .eq("blocking", true)
    .in("status", ["open", "mechanic_assigned"])
    .order("reportedAt", { ascending: false })
    .limit(50);

  if (incidentError) throw new Error(incidentError.message);

  for (const incident of incidents ?? []) {
    const order = firstRelated<{ orderCode: string; Client: unknown }>(
      incident.Order as unknown as { orderCode: string; Client: unknown },
    );
    const client = firstRelated<{ company: string }>(order?.Client as { company: string } | null);
    const company = client?.company ? ` (${client.company})` : "";
    const enRoute = incident.status === "mechanic_assigned";
    notifications.push({
      entityKey: incident.dispatchID ? `DispatchOrder:${incident.dispatchID}` : undefined,
      supersededBy: ["FOUL_TRIP_REPORTED"],
      id: `admin-foul-${incident.incidentID}`,
      title: enRoute ? "Mechanic on the way" : `Foul trip: ${incident.issueType}`,
      message: enRoute
        ? `${order?.orderCode ?? "A booking"}${company} - waiting for the mechanic's report.`
        : `${order?.orderCode ?? "A booking"}${company} was interrupted and needs recovery.`,
      time: relativeTime(incident.reportedAt),
      type: enRoute ? "reminder" : "warning",
    });
  }

  // Trucks that are out of service.
  const { data: trucks, error: truckError } = await supabase
    .from("Truck")
    .select("truckID, plateNumber, truckStatus")
    .eq("isActive", true)
    .in("truckStatus", [TRUCK_STATUS.onMaintenance, TRUCK_STATUS.outOfService]);

  if (truckError) throw new Error(truckError.message);

  for (const truck of trucks ?? []) {
    notifications.push({
      id: `admin-truck-${truck.truckID}`,
      title: `Truck ${truck.truckStatus.toLowerCase()}`,
      message: `${truck.plateNumber} is currently ${truck.truckStatus.toLowerCase()} and unavailable for dispatch.`,
      time: "",
      type: "warning",
      truckPlate: truck.plateNumber,
    });
  }

  return notifications;
}

// ==========================================
// MECHANIC
// ==========================================
async function mechanicNotifications(employeeID: string): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];

  // Broken-down trucks this mechanic has been sent to.
  const { data: jobs, error: jobError } = await supabase
    .from("FoulTripIncident")
    .select("incidentID, severity, issueType, mechanicAssignedAt, Truck ( plateNumber )")
    .eq("mechanicID", employeeID)
    .eq("status", "mechanic_assigned");

  if (jobError) throw new Error(jobError.message);

  for (const job of jobs ?? []) {
    const truck = firstRelated<{ plateNumber: string }>(job.Truck as unknown as { plateNumber: string });
    notifications.push({
      id: `mech-roadside-${job.incidentID}`,
      title: job.severity === "major" ? "Roadside job - major" : "Roadside job",
      message: `${truck?.plateNumber ?? "A truck"} broke down (${job.issueType}). Open Roadside Jobs for the location.`,
      time: relativeTime(job.mechanicAssignedAt),
      type: "assignment",
      truckPlate: truck?.plateNumber,
    });
  }

  const { data: trucks, error } = await supabase
    .from("Truck")
    .select("truckID, plateNumber, truckType, truckStatus, lastChecked")
    .eq("isActive", true);

  if (error) throw new Error(error.message);

  const staleBefore = Date.now() - MAINTENANCE_CHECK_DAYS * 24 * 60 * 60 * 1000;

  for (const truck of trucks ?? []) {
    if (
      truck.truckStatus === TRUCK_STATUS.onMaintenance ||
      truck.truckStatus === TRUCK_STATUS.outOfService
    ) {
      notifications.push({
        id: `mech-repair-${truck.truckID}`,
        title: "Repair Assignment",
        message: `${truck.plateNumber} (${truck.truckType}) is marked ${truck.truckStatus.toLowerCase()} and needs servicing.`,
        time: relativeTime(truck.lastChecked),
        type: "assignment",
        truckPlate: truck.plateNumber,
        vehicleType: truck.truckType,
        issue: `Status: ${truck.truckStatus}`,
      });
      continue;
    }

    const lastChecked = truck.lastChecked ? new Date(truck.lastChecked).getTime() : null;
    if (lastChecked === null || lastChecked < staleBefore) {
      notifications.push({
        id: `mech-check-${truck.truckID}`,
        title: "Maintenance check due",
        message: lastChecked
          ? `${truck.plateNumber} has not been checked in over ${MAINTENANCE_CHECK_DAYS} days.`
          : `${truck.plateNumber} has no recorded maintenance check.`,
        time: relativeTime(truck.lastChecked),
        type: "reminder",
        truckPlate: truck.plateNumber,
        vehicleType: truck.truckType,
      });
    }
  }

  return notifications;
}

/** The conditions that still hold for this person's role. */
async function standingNotifications(employee: { employeeID: string; role: string }): Promise<AppNotification[]> {
  const role = (employee.role ?? "").trim().toLowerCase();

  if (role === "driver" || role === "helper") return crewNotifications(employee.employeeID);
  if (role === "mechanic") return mechanicNotifications(employee.employeeID);
  if (role === "admin" || role === "coordinator" || role === "dispatcher") return adminNotifications();

  return [];
}

export async function getNotificationsForEmployee(employee: {
  employeeID: string;
  role: string;
}): Promise<AppNotification[]> {
  // One slow half must not cost the other.
  const [stored, standing] = await Promise.all([
    storedNotifications(employee.employeeID).catch((error) => {
      console.error("[Notifications] Stored events unavailable:", error instanceof Error ? error.message : error);
      return [] as AppNotification[];
    }),
    standingNotifications(employee).catch((error) => {
      console.error("[Notifications] Standing items unavailable:", error instanceof Error ? error.message : error);
      return [] as AppNotification[];
    }),
  ]);

  // A condition that still holds can repeat what an event already said - a
  // crew member was told of the assignment, and it is also still unanswered.
  // The event is the one with a time and a read state, so it stays.
  const told = new Set(
    stored.flatMap((item) => (item.entityKey ? (item.supersededBy ?? []).map((event) => `${event}|${item.entityKey}`) : [])),
  );
  const notAlreadyTold = standing.filter(
    (item) => !(item.entityKey && (item.supersededBy ?? []).some((event) => told.has(`${event}|${item.entityKey}`))),
  );

  return [...stored, ...notAlreadyTold];
}

/** Unread events. Standing items are not counted: they are not "new". */
export async function getUnreadCount(employeeID: string): Promise<number> {
  const { count, error } = await supabase
    .from("NotificationRecipient")
    .select("recipientID", { count: "exact", head: true })
    .eq("employeeID", employeeID)
    .is("readAt", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Marks the given events read for this person, or all of them. */
export async function markNotificationsRead(employeeID: string, notificationIDs?: string[]): Promise<number> {
  let query = supabase
    .from("NotificationRecipient")
    .update({ readAt: new Date().toISOString() })
    .eq("employeeID", employeeID)
    .is("readAt", null);

  if (notificationIDs?.length) query = query.in("notificationID", notificationIDs);

  const { data, error } = await query.select("recipientID");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
