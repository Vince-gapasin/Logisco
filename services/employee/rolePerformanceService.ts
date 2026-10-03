import { supabase } from "@/app/lib/supabase";
import { selectAll, selectAllIn } from "@/app/lib/selectAll";
import { expectedAt } from "@/app/lib/performance";
import {
  EMPTY_MECHANIC_FACTS,
  EMPTY_OFFICE_FACTS,
  LOGIN_SETUP_HOURS,
  NOTICE_HOURS,
  PROMPT_HOURS,
  REPAIR_HOLD_DAYS,
  type MechanicFacts,
  type OfficeFacts,
} from "@/app/lib/rolePerformance";

// Gathering the facts that rolePerformance.ts rates, from what the system
// already records. Nothing new is stored: mechanics are read off the
// maintenance logs and the roadside jobs, the office off the audit trail every
// assignment, recovery and staff change already writes.

const GROUNDED = ["On Maintenance", "Out of Service"];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const minutesBetween = (from: number, to: number) => (to - from) / 60_000;
const time = (value: string | null | undefined) => (value ? Date.parse(value) : NaN);

type Embed<T> = T | T[] | null;
const rows = <T,>(value: Embed<T> | undefined): T[] => (Array.isArray(value) ? value : value ? [value] : []);

// ---------------------------------------------------------------- mechanic

interface LogRow {
  id: string;
  truckID: string | null;
  created_at: string | null;
  date: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
  LogMechanics: Embed<{ role: string | null; employeeID: string | null }>;
  LogNotes: Embed<{ phase: string | null; issue: string | null; remarks: string | null }>;
  LogPhotos: Embed<{ phase: string | null }>;
}

interface IncidentRow {
  truckID: string | null;
  reportedAt: string | null;
  mechanicID: string | null;
  mechanicAssignedAt: string | null;
  mechanicRespondedAt: string | null;
  mechanicOutcome: string | null;
}

/**
 * A mechanic's record over the window, from `from` (ISO) or all of it.
 *
 * Maintenance cycles are read per truck: a log that takes a truck off the road
 * opens one, a log that puts it back - or records the final work - closes it.
 * A repair "held" when the same truck was not grounded again, or broken down on
 * the road, within REPAIR_HOLD_DAYS of the mechanic signing it off.
 */
export async function gatherMechanicFacts(employeeID: string, from: string | null): Promise<MechanicFacts> {
  const since = from ? Date.parse(from) : -Infinity;
  const now = Date.now();

  const logs = await selectAll<LogRow>((start, end) =>
    supabase
      .from("HistoryLogsM")
      .select(
        "id, truckID, created_at, date, statusBefore, statusAfter, LogMechanics ( role, employeeID ), LogNotes ( phase, issue, remarks ), LogPhotos ( phase )",
      )
      .order("created_at", { ascending: true })
      .range(start, end),
  );
  const incidents = await selectAll<IncidentRow>((start, end) =>
    supabase
      .from("FoulTripIncident")
      .select("truckID, reportedAt, mechanicID, mechanicAssignedAt, mechanicRespondedAt, mechanicOutcome")
      .range(start, end),
  );

  const facts: MechanicFacts = { ...EMPTY_MECHANIC_FACTS, pickUpMinutes: [], roadsideMinutes: [], repairDays: [] };

  const on = (log: LogRow, role?: "Primary") =>
    rows(log.LogMechanics).some((m) => m.employeeID === employeeID && (!role || m.role === role));
  const anyMechanic = (log: LogRow) => rows(log.LogMechanics).some((m) => Boolean(m.employeeID));
  const at = (log: LogRow) => time(log.created_at ?? log.date);
  const grounding = (log: LogRow) =>
    GROUNDED.includes(log.statusAfter ?? "") && !GROUNDED.includes(log.statusBefore ?? "");
  const isFinal = (log: LogRow) =>
    rows(log.LogNotes).some((note) => note.phase === "Final" && (note.issue || note.remarks)) ||
    (GROUNDED.includes(log.statusBefore ?? "") && !GROUNDED.includes(log.statusAfter ?? "") && Boolean(log.statusAfter));

  const byTruck = new Map<string, LogRow[]>();
  for (const log of logs) {
    const key = log.truckID ?? "";
    if (!byTruck.has(key)) byTruck.set(key, []);
    byTruck.get(key)!.push(log);
  }

  for (const truckLogs of byTruck.values()) {
    truckLogs.sort((a, b) => at(a) - at(b));
    let cycleStart: LogRow | null = null;
    let cycleClaimed = false;

    for (let index = 0; index < truckLogs.length; index += 1) {
      const log = truckLogs[index];
      const when = at(log);
      const inWindow = when >= since;

      if (grounding(log)) {
        cycleStart = log;
        // Grounded by somebody else - the office, a breakdown - is a job waiting
        // to be picked up. Grounded by a mechanic is a job already taken.
        cycleClaimed = anyMechanic(log);
        continue;
      }

      // Documentation, on every log they wrote as the lead.
      if (inWindow && on(log, "Primary")) {
        facts.logsWritten += 1;
        const hasPhoto = rows(log.LogPhotos).length > 0;
        const hasRemarks = rows(log.LogNotes).some((note) => Boolean(note.remarks?.trim()));
        if (hasPhoto && hasRemarks) facts.logsDocumented += 1;
      }

      // Pick-up: the first mechanic to log on a job nobody had taken.
      if (cycleStart && !cycleClaimed && anyMechanic(log)) {
        cycleClaimed = true;
        if (inWindow && on(log, "Primary")) {
          facts.pickUpMinutes.push(minutesBetween(at(cycleStart), when));
        }
      }

      if (isFinal(log) && on(log)) {
        if (inWindow) {
          facts.repairsFinished += 1;
          if (cycleStart) facts.repairDays.push((when - at(cycleStart)) / DAY);

          // Whether it held, once there has been time to know.
          if (when + REPAIR_HOLD_DAYS * DAY <= now) {
            facts.repairsObserved += 1;
            const until = when + REPAIR_HOLD_DAYS * DAY;
            const groundedAgain = truckLogs
              .slice(index + 1)
              .some((later) => grounding(later) && at(later) > when && at(later) <= until);
            const brokeDown = incidents.some(
              (incident) =>
                incident.truckID === log.truckID &&
                time(incident.reportedAt) > when &&
                time(incident.reportedAt) <= until,
            );
            if (!groundedAgain && !brokeDown) facts.repairsHeld += 1;
          }
        }
        cycleStart = null;
      }
    }
  }

  for (const incident of incidents) {
    if (incident.mechanicID !== employeeID || !incident.mechanicRespondedAt) continue;
    const responded = time(incident.mechanicRespondedAt);
    if (responded < since) continue;
    facts.roadsideJobs += 1;
    if (incident.mechanicOutcome === "fixed") facts.roadsideFixed += 1;
    const assigned = time(incident.mechanicAssignedAt);
    if (Number.isFinite(assigned) && responded >= assigned) {
      facts.roadsideMinutes.push(minutesBetween(assigned, responded));
    }
  }

  return facts;
}

// ------------------------------------------------------------------ office

interface AuditRow {
  tableName: string;
  action: string;
  recordID: string | null;
  newData: Record<string, unknown> | null;
  timestamp: string;
}

const ASSIGNING = ["ASSIGN", "REASSIGN", "SUBCON_ASSIGN"];
const DECLINING = ["CREW_DECLINE", "CREW_WITHDRAW"];

/** The trip an audit row is about: its record, or the dispatch a helper row names. */
const dispatchOf = (row: AuditRow) =>
  row.tableName === "DispatchHelper" ? String(row.newData?.dispatchID ?? "") : String(row.recordID ?? "");

/**
 * A coordinator's or admin's record, read off the audit trail.
 *
 * Assignments are judged by when they were made against when the delivery was
 * due - a day ahead, or within two hours of a booking that came in late, is in
 * good time. A decline is answered by the next assignment on the same booking; a
 * breakdown by the first recovery action anyone took on it, credited to whoever
 * took it.
 */
export async function gatherOfficeFacts(
  employeeID: string,
  from: string | null,
  options: { includeStaff: boolean },
): Promise<OfficeFacts> {
  const facts: OfficeFacts = { ...EMPTY_OFFICE_FACTS, declineRecoveryMinutes: [], foulTripMinutes: [] };

  const mine = await selectAll<AuditRow>((start, end) => {
    let query = supabase
      .from("AuditTrail")
      .select("tableName, action, recordID, newData, timestamp")
      .eq("newData->by->>employeeID", employeeID)
      .order("timestamp", { ascending: true })
      .range(start, end);
    if (from) query = query.gte("timestamp", from);
    return query;
  });

  // --- what they did, counted
  const assignments = mine.filter((row) => row.tableName === "DispatchOrder" && ASSIGNING.includes(row.action));
  facts.assignments = assignments.length;
  facts.bookingsCreated = mine.filter((row) => row.tableName === "Order" && row.action === "CREATE").length;
  facts.overrides = mine.filter((row) => row.action.startsWith("OVERRIDE_")).length;

  // --- assignments in good time, and declines answered
  const assignedDispatchIDs = [...new Set(assignments.map((row) => String(row.recordID ?? "")).filter(Boolean))];
  if (assignedDispatchIDs.length > 0) {
    const trips = await selectAllIn<{ dispatchID: string; orderID: string | null }, string>(
      assignedDispatchIDs,
      (chunk, start, end) => supabase.from("DispatchOrder").select("dispatchID, orderID").in("dispatchID", chunk).range(start, end),
    );
    const orderOfDispatch = new Map(trips.map((trip) => [trip.dispatchID, trip.orderID ?? ""]));
    const orderIDs = [...new Set(trips.map((trip) => trip.orderID).filter((id): id is string => Boolean(id)))];

    const orders = await selectAllIn<
      { orderID: string; createdAt: string | null; notes: string | null; BranchStops: Embed<{ expectedTime: string | null }>; DispatchOrder: Embed<{ dispatchID: string }> },
      string
    >(orderIDs, (chunk, start, end) =>
      supabase
        .from("Order")
        .select("orderID, createdAt, notes, BranchStops ( expectedTime ), DispatchOrder ( dispatchID )")
        .in("orderID", chunk)
        .range(start, end),
    );
    const orderByID = new Map(orders.map((order) => [order.orderID, order]));

    for (const row of assignments) {
      const order = orderByID.get(orderOfDispatch.get(String(row.recordID)) ?? "");
      if (!order) continue;
      const assignedAt = time(row.timestamp);
      const schedule = /Delivery Schedule:\s*(\d{4}-\d{2}-\d{2})/.exec(order.notes ?? "")?.[1] ?? null;
      const earliest = rows(order.BranchStops)
        .map((stop) => stop.expectedTime)
        .filter((value): value is string => Boolean(value))
        .sort()[0];
      const due = time(expectedAt(schedule, earliest ?? null));
      const prompt = assignedAt - time(order.createdAt) <= PROMPT_HOURS * HOUR;
      const ahead = Number.isFinite(due) && due - assignedAt >= NOTICE_HOURS * HOUR;

      if (Number.isFinite(due) || prompt) {
        facts.assignmentsJudged += 1;
        if (ahead || prompt) facts.assignmentsOnNotice += 1;
      }
    }

    // Every assignment and decline on those bookings, by anyone, in order.
    const allDispatchIDs = [...new Set(orders.flatMap((order) => rows(order.DispatchOrder).map((d) => d.dispatchID)))];
    const orderOf = new Map<string, string>();
    for (const order of orders) for (const trip of rows(order.DispatchOrder)) orderOf.set(trip.dispatchID, order.orderID);

    const tripEvents = await selectAllIn<AuditRow, string>(allDispatchIDs, (chunk, start, end) =>
      supabase
        .from("AuditTrail")
        .select("tableName, action, recordID, newData, timestamp")
        .eq("tableName", "DispatchOrder")
        .in("action", [...ASSIGNING, ...DECLINING])
        .in("recordID", chunk)
        .range(start, end),
    );
    const helperEvents = await selectAllIn<AuditRow, string>(allDispatchIDs, (chunk, start, end) =>
      supabase
        .from("AuditTrail")
        .select("tableName, action, recordID, newData, timestamp")
        .eq("tableName", "DispatchHelper")
        .in("action", DECLINING)
        .in("newData->>dispatchID", chunk)
        .range(start, end),
    );

    const timeline = new Map<string, AuditRow[]>();
    for (const event of [...tripEvents, ...helperEvents]) {
      const orderID = orderOf.get(dispatchOf(event));
      if (!orderID) continue;
      if (!timeline.has(orderID)) timeline.set(orderID, []);
      timeline.get(orderID)!.push(event);
    }

    for (const events of timeline.values()) {
      events.sort((a, b) => time(a.timestamp) - time(b.timestamp));
      for (let index = 1; index < events.length; index += 1) {
        const event = events[index];
        const previous = events[index - 1];
        const byThem = String((event.newData?.by as { employeeID?: string } | undefined)?.employeeID ?? "") === employeeID;
        if (!byThem || !ASSIGNING.includes(event.action) || !DECLINING.includes(previous.action)) continue;
        if (from && time(event.timestamp) < Date.parse(from)) continue;
        facts.declineRecoveryMinutes.push(minutesBetween(time(previous.timestamp), time(event.timestamp)));
      }
    }
  }

  // --- breakdowns answered first
  const recoveries = mine.filter(
    (row) => row.tableName === "FoulTripIncident" && row.action.startsWith("FOUL_TRIP_") && row.action !== "FOUL_TRIP_MECHANIC_REPORT",
  );
  const incidentIDs = [...new Set(recoveries.map((row) => String(row.recordID ?? "")).filter(Boolean))];
  if (incidentIDs.length > 0) {
    const incidents = await selectAllIn<{ incidentID: string; reportedAt: string | null }, string>(
      incidentIDs,
      (chunk, start, end) => supabase.from("FoulTripIncident").select("incidentID, reportedAt").in("incidentID", chunk).range(start, end),
    );
    const allRecoveries = await selectAllIn<AuditRow, string>(incidentIDs, (chunk, start, end) =>
      supabase
        .from("AuditTrail")
        .select("tableName, action, recordID, newData, timestamp")
        .eq("tableName", "FoulTripIncident")
        .like("action", "FOUL_TRIP_%")
        .neq("action", "FOUL_TRIP_MECHANIC_REPORT")
        .in("recordID", chunk)
        .range(start, end),
    );

    for (const incident of incidents) {
      const first = allRecoveries
        .filter((row) => row.recordID === incident.incidentID)
        .sort((a, b) => time(a.timestamp) - time(b.timestamp))[0];
      const firstBy = String((first?.newData?.by as { employeeID?: string } | undefined)?.employeeID ?? "");
      const reported = time(incident.reportedAt);
      if (first && firstBy === employeeID && Number.isFinite(reported)) {
        facts.foulTripMinutes.push(Math.max(0, minutesBetween(reported, time(first.timestamp))));
      }
    }
  }

  // --- new staff given their login (admins)
  if (options.includeStaff) {
    const added = mine.filter((row) => row.tableName === "Employee" && row.action === "CREATE");
    facts.employeesAdded = added.length;
    const addedIDs = [...new Set(added.map((row) => String(row.recordID ?? "")).filter(Boolean))];
    if (addedIDs.length > 0) {
      const activations = await selectAllIn<AuditRow, string>(addedIDs, (chunk, start, end) =>
        supabase
          .from("AuditTrail")
          .select("tableName, action, recordID, newData, timestamp")
          .eq("tableName", "Employee")
          .eq("action", "ACTIVATE")
          .in("recordID", chunk)
          .range(start, end),
      );
      for (const row of added) {
        const addedAt = time(row.timestamp);
        const sent = activations
          .filter((activation) => activation.recordID === row.recordID)
          .map((activation) => time(activation.timestamp))
          .sort((a, b) => a - b)[0];
        const deadline = addedAt + LOGIN_SETUP_HOURS * HOUR;
        if (Number.isFinite(sent)) {
          facts.loginsJudged += 1;
          if (sent <= deadline) facts.loginsOnTime += 1;
        } else if (Date.now() > deadline) {
          facts.loginsJudged += 1;
        }
      }
    }
  }

  return facts;
}
