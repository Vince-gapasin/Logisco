import { supabase } from "@/app/lib/supabase";
import {
  ACTIVE_DELIVERY_STATUSES,
  DELIVERY_STATUS,
  HELPER_STATUS,
  TRUCK_STATUS,
} from "@/app/lib/enums";

// Notifications are derived from current operational data rather than stored:
// there is no Notification table yet, and every item below is something the
// database already knows. Each item carries a stable id so the client can
// remember which ones the user has dismissed.
//
// Note this is polled, not pushed - a driver still only sees a new assignment
// when the app is open.

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: string;
  truckPlate?: string;
  vehicleType?: string;
  issue?: string;
  crewName?: string;
  reason?: string;
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
    const order = firstRelated<any>(dispatch.Order);
    const client = firstRelated<any>(order?.Client);
    const truck = firstRelated<any>(dispatch.Truck);
    const label = order?.orderCode ?? dispatch.dispatchID;

    if ([DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned].includes(dispatch.status)) {
      notifications.push({
        id: `crew-assign-${dispatch.dispatchID}`,
        title: "New Delivery Assignment",
        message: `New assignment for ${label}${client?.company ? ` (Client: ${client.company})` : ""}. Open it to accept or decline.`,
        time: "",
        type: "assignment",
        truckPlate: truck?.plateNumber,
      });
    } else if (dispatch.status === DELIVERY_STATUS.inTransit) {
      notifications.push({
        id: `crew-transit-${dispatch.dispatchID}`,
        title: "Trip in progress",
        message: `${label} is in transit. Remember to upload proof of delivery at every stop.`,
        time: "",
        type: "reminder",
        truckPlate: truck?.plateNumber,
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
    const dispatch = firstRelated<any>(row.DispatchOrder);
    if (!dispatch) continue;
    if (
      [DELIVERY_STATUS.rejected, DELIVERY_STATUS.foulTrip, DELIVERY_STATUS.completed].includes(
        dispatch.status,
      )
    ) {
      continue;
    }

    const order = firstRelated<any>(dispatch.Order);
    const client = firstRelated<any>(order?.Client);

    notifications.push({
      id: `crew-helper-${row.dhID}`,
      title: "New Helper Assignment",
      message: `You are assigned as helper on ${order?.orderCode ?? dispatch.dispatchID}${client?.company ? ` (Client: ${client.company})` : ""}. Please confirm.`,
      time: "",
      type: "assignment",
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
    const dispatches = ((order.DispatchOrder as any[]) ?? []).filter(Boolean);
    const live =
      dispatches.find(
        (d) => ![DELIVERY_STATUS.rejected, DELIVERY_STATUS.foulTrip].includes(d.status),
      ) ?? dispatches[dispatches.length - 1];
    const client = firstRelated<any>(order.Client);
    const company = client?.company ? ` (${client.company})` : "";

    if (!live || live.status === DELIVERY_STATUS.rejected) {
      notifications.push({
        id: `admin-unassigned-${order.orderID}`,
        title: live ? "Dispatch declined - needs re-assignment" : "Booking awaiting assignment",
        message: `${order.orderCode}${company} has no active crew assigned.`,
        time: relativeTime(order.createdAt),
        type: "approval",
      });
    } else if ([DELIVERY_STATUS.pending, DELIVERY_STATUS.assigned].includes(live.status)) {
      notifications.push({
        id: `admin-confirm-${live.dispatchID}`,
        title: "Waiting for crew confirmation",
        message: `${order.orderCode}${company} is assigned but the crew has not confirmed yet.`,
        time: relativeTime(order.createdAt),
        type: "reminder",
      });
    } else if (live.status === DELIVERY_STATUS.foulTrip) {
      notifications.push({
        id: `admin-foul-${live.dispatchID}`,
        title: "Foul trip reported",
        message: `${order.orderCode}${company} was interrupted and needs attention.`,
        time: relativeTime(order.createdAt),
        type: "warning",
      });
    }
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
async function mechanicNotifications(): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];

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

export async function getNotificationsForEmployee(employee: {
  employeeID: string;
  role: string;
}): Promise<AppNotification[]> {
  const role = (employee.role ?? "").trim().toLowerCase();

  if (role === "driver" || role === "helper") return crewNotifications(employee.employeeID);
  if (role === "mechanic") return mechanicNotifications();
  if (role === "admin" || role === "coordinator" || role === "dispatcher") return adminNotifications();

  return [];
}
