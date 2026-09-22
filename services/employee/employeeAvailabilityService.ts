import { supabase } from "@/app/lib/supabase";
import {
  ACTIVE_DELIVERY_STATUSES,
  AVAILABILITY,
  DELIVERY_STATUS,
  HELPER_STATUS,
} from "@/app/lib/enums";

export type EmployeeAvailability =
  (typeof AVAILABILITY)[keyof typeof AVAILABILITY];

const BOOKED_WINDOW_MS = 3 * 60 * 60 * 1000;
const MANILA_TIME_OFFSET = "+08:00";

const IN_TRANSIT_STATUSES = new Set<string>([
  DELIVERY_STATUS.startDelivery,
  DELIVERY_STATUS.inWarehouse,
  DELIVERY_STATUS.inTransit,
  DELIVERY_STATUS.arrived,
]);

type ActiveDispatch = {
  dispatchID: string;
  orderID: string;
  driverID: string | null;
  status: string;
};

type HelperAssignment = {
  dispatchID: string;
  helperID: string;
};

function readNoteField(notes: string | null, label: string): string {
  if (!notes) return "";

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = notes.match(
    new RegExp(`(?:^|\\n)${escapedLabel}:\\s*([^\\n\\r]+)`, "i"),
  );

  return match?.[1]?.trim() ?? "";
}

function getScheduledTime(
  notes: string | null,
  expectedTime: string | null,
): number | null {
  const schedule = readNoteField(notes, "Delivery Schedule");
  const date = schedule.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const time = expectedTime?.match(/\d{2}:\d{2}/)?.[0];

  if (!date || !time) return null;

  const timestamp = new Date(
    `${date}T${time}:00${MANILA_TIME_OFFSET}`,
  ).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function getEmployeeAvailabilityMap(
  employeeIDs: string[],
  now = Date.now(),
): Promise<Map<string, EmployeeAvailability>> {
  const uniqueEmployeeIDs = [...new Set(employeeIDs.filter(Boolean))];
  const availability = new Map<string, EmployeeAvailability>(
    uniqueEmployeeIDs.map((employeeID) => [
      employeeID,
      AVAILABILITY.available,
    ]),
  );

  if (uniqueEmployeeIDs.length === 0) return availability;

  // Start with active dispatches so historical helper assignments never
  // produce an oversized DispatchOrder request.
  const { data: dispatchRows, error: dispatchError } = await supabase
    .from("DispatchOrder")
    .select("dispatchID, orderID, driverID, status")
    .in("status", ACTIVE_DELIVERY_STATUSES);

  if (dispatchError) {
    throw new Error(
      `Failed to calculate employee availability: ${dispatchError.message}`,
    );
  }

  const allActiveDispatches = (dispatchRows ?? []) as ActiveDispatch[];
  if (allActiveDispatches.length === 0) return availability;

  const activeDispatchIDs = allActiveDispatches.map(
    ({ dispatchID }) => dispatchID,
  );

  const { data: helperRows, error: helperError } = await supabase
    .from("DispatchHelper")
    .select("dispatchID, helperID")
    .in("dispatchID", activeDispatchIDs)
    .in("helperID", uniqueEmployeeIDs)
    .or(`status.is.null,status.neq.${HELPER_STATUS.declined}`);

  if (helperError) {
    throw new Error(
      `Failed to calculate helper availability: ${helperError.message}`,
    );
  }

  const helperAssignments = (helperRows ?? []) as HelperAssignment[];
  const employeeIDSet = new Set(uniqueEmployeeIDs);
  const helperDispatchIDSet = new Set(
    helperAssignments.map(({ dispatchID }) => dispatchID),
  );
  const activeDispatches = allActiveDispatches.filter(
    ({ dispatchID, driverID }) =>
      (typeof driverID === "string" && employeeIDSet.has(driverID)) ||
      helperDispatchIDSet.has(dispatchID),
  );

  if (activeDispatches.length === 0) return availability;

  const orderIDs = [
    ...new Set(activeDispatches.map(({ orderID }) => orderID).filter(Boolean)),
  ];

  const [{ data: orders, error: ordersError }, { data: stops, error: stopsError }] =
    await Promise.all([
      supabase.from("Order").select("orderID, notes").in("orderID", orderIDs),
      supabase
        .from("BranchStops")
        .select("orderID, expectedTime, sequence, branchID")
        .in("orderID", orderIDs),
    ]);

  if (ordersError) {
    throw new Error(
      `Failed to read booking schedules: ${ordersError.message}`,
    );
  }

  if (stopsError) {
    throw new Error(
      `Failed to read booking times: ${stopsError.message}`,
    );
  }

  const notesByOrder = new Map<string, string | null>();
  for (const order of orders ?? []) {
    notesByOrder.set(order.orderID, order.notes ?? null);
  }

  const firstStopByOrder = new Map<
    string,
    { expectedTime: string | null; sequence: number | null; branchID: number }
  >();

  for (const stop of stops ?? []) {
    const candidate = {
      expectedTime: stop.expectedTime ?? null,
      sequence: stop.sequence ?? null,
      branchID: stop.branchID,
    };
    const current = firstStopByOrder.get(stop.orderID);
    const candidateOrder = candidate.sequence ?? candidate.branchID;
    const currentOrder = current
      ? current.sequence ?? current.branchID
      : Number.POSITIVE_INFINITY;

    if (!current || candidateOrder < currentOrder) {
      firstStopByOrder.set(stop.orderID, candidate);
    }
  }

  const helpersByDispatch = new Map<string, string[]>();
  for (const helper of helperAssignments) {
    const assigned = helpersByDispatch.get(helper.dispatchID) ?? [];
    assigned.push(helper.helperID);
    helpersByDispatch.set(helper.dispatchID, assigned);
  }

  for (const dispatch of activeDispatches) {
    const assignedEmployees = [
      dispatch.driverID,
      ...(helpersByDispatch.get(dispatch.dispatchID) ?? []),
    ].filter(
      (employeeID): employeeID is string =>
        typeof employeeID === "string" &&
        uniqueEmployeeIDs.includes(employeeID),
    );

    if (IN_TRANSIT_STATUSES.has(dispatch.status)) {
      for (const employeeID of assignedEmployees) {
        availability.set(employeeID, AVAILABILITY.inTransit);
      }
      continue;
    }

    const scheduledTime = getScheduledTime(
      notesByOrder.get(dispatch.orderID) ?? null,
      firstStopByOrder.get(dispatch.orderID)?.expectedTime ?? null,
    );
    const bookingWindowStarted =
      scheduledTime === null || now >= scheduledTime - BOOKED_WINDOW_MS;

    if (!bookingWindowStarted) continue;

    for (const employeeID of assignedEmployees) {
      if (availability.get(employeeID) !== AVAILABILITY.inTransit) {
        availability.set(employeeID, AVAILABILITY.booked);
      }
    }
  }

  return availability;
}

export async function getEmployeeAvailability(
  employeeID: string,
): Promise<EmployeeAvailability> {
  const availability = await getEmployeeAvailabilityMap([employeeID]);
  return availability.get(employeeID) ?? AVAILABILITY.available;
}
