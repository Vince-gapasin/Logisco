import { supabase } from "@/app/lib/supabase";
import {
  ACTIVE_DELIVERY_STATUSES,
  AVAILABILITY,
  DELIVERY_STATUS,
  HELPER_STATUS,
  isManualAvailability,
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

/**
 * What one person's availability comes to. On the road wins, because that is
 * what they are actually doing; then what an admin set (On Leave,
 * Unavailable), which is why someone on leave no longer reads as available;
 * then a trip about to start.
 */
export function decideAvailability(state: {
  manual?: string | null;
  onTheRoad?: boolean;
  bookedSoon?: boolean;
}): EmployeeAvailability {
  if (state.onTheRoad) return AVAILABILITY.inTransit;
  if (isManualAvailability(state.manual) && state.manual !== AVAILABILITY.available) {
    return state.manual as EmployeeAvailability;
  }
  return state.bookedSoon ? AVAILABILITY.booked : AVAILABILITY.available;
}

export async function getEmployeeAvailabilityMap(
  employeeIDs: string[],
  now = Date.now(),
): Promise<Map<string, EmployeeAvailability>> {
  const uniqueEmployeeIDs = [...new Set(employeeIDs.filter(Boolean))];
  const availability = new Map<string, EmployeeAvailability>();

  if (uniqueEmployeeIDs.length === 0) return availability;

  // What an admin set for each of them. Nothing else is stored here.
  const { data: employeeRows, error: employeeError } = await supabase
    .from("Employee")
    .select("employeeID, availability")
    .in("employeeID", uniqueEmployeeIDs);

  if (employeeError) {
    throw new Error(
      `Failed to read employee availability: ${employeeError.message}`,
    );
  }

  const manualByEmployee = new Map<string, string | null>(
    (employeeRows ?? []).map((row) => [row.employeeID, row.availability ?? null]),
  );
  const onTheRoad = new Set<string>();
  const bookedSoon = new Set<string>();
  const settle = () => {
    for (const employeeID of uniqueEmployeeIDs) {
      availability.set(
        employeeID,
        decideAvailability({
          manual: manualByEmployee.get(employeeID),
          onTheRoad: onTheRoad.has(employeeID),
          bookedSoon: bookedSoon.has(employeeID),
        }),
      );
    }
    return availability;
  };

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
  if (allActiveDispatches.length === 0) return settle();

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

  if (activeDispatches.length === 0) return settle();

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
        onTheRoad.add(employeeID);
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
      bookedSoon.add(employeeID);
    }
  }

  return settle();
}

export async function getEmployeeAvailability(
  employeeID: string,
): Promise<EmployeeAvailability> {
  const availability = await getEmployeeAvailabilityMap([employeeID]);
  return availability.get(employeeID) ?? AVAILABILITY.available;
}
