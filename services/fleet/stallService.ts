// Watching for a truck that has gone quiet on the road.
//
// Reads the trips that are out, works out how long each has been silent, and
// says something once per trip per threshold. Safe to call as often as you
// like: whether anything is said is decided by the notification's dedupe key,
// not by how often this runs.

import { supabase } from "@/app/lib/supabase";
import {
  assessStall,
  crewCheckInLink,
  crewHelpAlert,
  crewUnreachedAlert,
  crewUnreachedDedupeKey,
  crewHelpDedupeKey,
  delayContinuingAlert,
  delayDedupeKey,
  isCheckInState,
  leftOpenAlert,
  WATCHED_STATUSES,
  leftOpenDedupeKey,
  neverReportedAlert,
  neverReportedDedupeKey,
  stallAlert,
  stallDedupeKey,
  STOP_AT_RISK_MIN,
  thresholdFor,
  whyCrewUnreached,
  type CrewCheckIn,
  type CrewUnreached,
  type StallCause,
  type StallContext,
  type StallMessage,
  type StallThreshold,
  type StallVerdict,
} from "@/app/lib/stallRules";
import { expectedAt } from "@/app/lib/performance";
import {
  crewOf,
  notify,
  notifyWithOutcome,
  OFFICE,
  tripLabel,
  type Severity,
} from "@/services/notifications/notify";
import {
  checkerDownAlert,
  checkerDownDedupeKey,
  checkerHealth,
  checkerRecoveredAlert,
  checkerRecoveredDedupeKey,
  type CheckerHealth,
} from "@/app/lib/schedulerHealth";
import { getAllWaypoints } from "@/services/fleet/routePlanService";

const METRES_PER_DEGREE = 111_320;

function metresBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const north = (a.latitude - b.latitude) * METRES_PER_DEGREE;
  const east = (a.longitude - b.longitude) * METRES_PER_DEGREE * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(north, east);
}

export interface StalledTrip {
  dispatchID: string;
  orderCode: string | null;
  truck: string | null;
  verdict: StallVerdict;
  /** What the crew last said about this silence, when they have said anything. */
  checkIn: CrewCheckIn | null;
  /** Whether anything was said about it this time round. */
  raised: boolean;
}

interface LiveTrip {
  dispatchID: string;
  status: string;
  orderCode: string | null;
  truck: string | null;
  lastReportedAt: string | null;
  /** When the app last spoke at all, heartbeat or movement. */
  lastContactAt: string | null;
  position: { latitude: number; longitude: number } | null;
  /** The date the delivery was booked for, which dates the stops' clock times. */
  deliverySchedule: string | null;
}

/** The trips that are out on the road, with wherever they last reported from. */
async function tripsOnTheRoad(): Promise<LiveTrip[]> {
  const { data: dispatches, error } = await supabase
    .from("DispatchOrder")
    .select(
      "dispatchID, status, Order ( orderCode, deliverySchedule ), Truck ( plateNumber )",
    )
    .in("status", WATCHED_STATUSES);

  if (error) throw new Error(`Could not read the trips on the road: ${error.message}`);
  if (!dispatches || dispatches.length === 0) return [];

  const { data: locations, error: locationError } = await supabase
    .from("FleetLocations")
    .select("dispatch_id, latitude, longitude, updated_at, moved_at")
    .in("dispatch_id", dispatches.map((trip) => trip.dispatchID));

  // Checked, because this read was unchecked and the consequence was ugly:
  // without its error, a failure here left every truck looking as though it had
  // never reported, so nothing was ever stalled and the check announced that it
  // had found no problems. A watchdog that goes blind must say so, loudly.
  if (locationError) {
    throw new Error(
      `Could not read where the trucks are: ${locationError.message}. ` +
        `If this names moved_at, apply supabase/migrations/20260927020000_fleet_moved_at.sql.`,
    );
  }

  const positionOf = new Map((locations ?? []).map((row) => [row.dispatch_id, row]));

  return dispatches.map((trip) => {
    const order = Array.isArray(trip.Order) ? trip.Order[0] : trip.Order;
    const truck = Array.isArray(trip.Truck) ? trip.Truck[0] : trip.Truck;
    const seen = positionOf.get(trip.dispatchID);

    return {
      dispatchID: trip.dispatchID as string,
      status: trip.status as string,
      orderCode: (order as { orderCode?: string } | null)?.orderCode ?? null,
      truck: (truck as { plateNumber?: string } | null)?.plateNumber ?? null,
      deliverySchedule:
        (order as { deliverySchedule?: string } | null)?.deliverySchedule ?? null,
      // Movement is what the ladder counts; contact is how the cause is judged.
      // Before the app sends heartbeats the two are the same, and moved_at is
      // null on rows written by an older deployment.
      lastReportedAt: (seen?.moved_at as string) ?? (seen?.updated_at as string) ?? null,
      lastContactAt: (seen?.updated_at as string) ?? null,
      position:
        seen && Number(seen.latitude) && Number(seen.longitude)
          ? { latitude: seen.latitude as number, longitude: seen.longitude as number }
          : null,
    };
  });
}

/**
 * How far this truck is from the nearest stop on its itinerary.
 *
 * Null when either end is unknown, which the rules treat as "cannot vouch for
 * it" rather than "it is fine" - a stop with no coordinates should not be able
 * to silence an alarm.
 */
async function metresToNearestStop(trip: LiveTrip): Promise<number | null> {
  if (!trip.position) return null;

  // Every stop, not only the ones still to come: parked where they have just
  // delivered is still parked at one of their own stops.
  const stops = await getAllWaypoints(trip.dispatchID);
  if (stops.length === 0) return null;

  return Math.min(...stops.map((stop) => metresBetween(trip.position!, stop)));
}

/**
 * What the crew last told us about this trip, and whether they are at a stop.
 *
 * The threshold's starting gun. Movement alone could not tell an hour of
 * unloading from an hour broken down, because the app reports only when the truck
 * rolls - so the watchdog guessed from how near a stop the truck happened to be,
 * with a radius and a grace period that were both invented. A crew who have said
 * "I am here" and then "I am done" have answered it instead.
 *
 * atDeclaredStop is the honest version of the old guess: they said they arrived
 * and have not said they finished, so they are working.
 */
async function crewProgress(
  dispatchID: string,
): Promise<{ lastCrewUpdateAt: string | null; atDeclaredStop: boolean }> {
  const [branches, pickups] = await Promise.all([
    supabase
      .from("BranchStops")
      .select("arrivedAt, completedAt")
      .eq("dispatchID", dispatchID),
    supabase
      .from("PickupStops")
      .select("arrivedAt, completedAt")
      .eq("dispatchID", dispatchID),
  ]);

  if (branches.error) console.warn("Could not read stop progress:", branches.error.message);
  if (pickups.error) console.warn("Could not read pickup progress:", pickups.error.message);

  const stops = [...(branches.data ?? []), ...(pickups.data ?? [])] as {
    arrivedAt: string | null;
    completedAt: string | null;
  }[];

  let latest = 0;
  let atDeclaredStop = false;

  for (const stop of stops) {
    for (const moment of [stop.arrivedAt, stop.completedAt]) {
      if (!moment) continue;
      const at = new Date(moment).getTime();
      if (Number.isFinite(at)) latest = Math.max(latest, at);
    }
    // Arrived and not finished. One such stop is enough; a crew cannot be at two.
    if (stop.arrivedAt && !stop.completedAt) atDeclaredStop = true;
  }

  return {
    lastCrewUpdateAt: latest > 0 ? new Date(latest).toISOString() : null,
    atDeclaredStop,
  };
}

/**
 * The next stop this delay is about to make late, if there is one.
 *
 * The ladder only knows how long a truck has been quiet. That is the wrong thing
 * to escalate on by itself: fifteen minutes with an afternoon of slack and
 * fifteen minutes on a delivery that was due at two both read as fifteen
 * minutes. This is what tells them apart.
 *
 * The earliest stop still outstanding decides it - not the nearest one, since a
 * truck stuck early in a run threatens the first promise it has left to keep.
 *
 * Null when nothing is at risk, and null when the answer cannot be trusted:
 * without a booked date there is nothing to attach a clock time to, and a stop
 * whose time will not parse is not evidence of anything.
 */
async function stopAtRisk(
  trip: LiveTrip,
  now: Date,
): Promise<{ stopName: string; minutesLate: number } | null> {
  if (!trip.deliverySchedule) return null;

  const { data, error } = await supabase
    .from("BranchStops")
    .select("branchName, expectedTime, stopStatus, sequence")
    .eq("dispatchID", trip.dispatchID)
    .order("sequence", { ascending: true });

  if (error) {
    console.warn("Could not read the stops for this trip:", error.message);
    return null;
  }

  for (const stop of data ?? []) {
    // Delivered or failed: this one is no longer a promise anybody can keep.
    const status = String(stop.stopStatus ?? "").toLowerCase();
    if (status.includes("deliver") || status.includes("fail") || status.includes("cancel")) {
      continue;
    }

    const due = expectedAt(trip.deliverySchedule, stop.expectedTime as string);
    if (!due) continue;

    const minutesLate = Math.round((now.getTime() - new Date(due).getTime()) / 60_000);
    if (minutesLate < -STOP_AT_RISK_MIN) return null; // Comfortable: hours of slack.

    return {
      stopName: (stop.branchName as string) || "The next stop",
      minutesLate,
    };
  }

  return null;
}

/**
 * The crew's most recent answer for each of these trips.
 *
 * One query for all of them, newest first, keeping the first seen per trip.
 * Older answers are kept in the table on purpose - a sequence reading "traffic,
 * traffic, vehicle problem" says more than whichever came last - but only the
 * newest can speak for the silence happening now.
 */
async function latestCheckIns(dispatchIDs: string[]): Promise<Map<string, CrewCheckIn>> {
  const newest = new Map<string, CrewCheckIn>();
  if (dispatchIDs.length === 0) return newest;

  const { data, error } = await supabase
    .from("StallCheckIn")
    .select("dispatchID, state, createdAt")
    .in("dispatchID", dispatchIDs)
    .order("createdAt", { ascending: false });

  if (error) {
    // Before the migration is applied there is nothing to read, and a stall
    // check that refused to run without it would be worse than one that runs
    // exactly as it did before.
    console.warn("Could not read crew check-ins:", error.message);
    return newest;
  }

  for (const row of data ?? []) {
    const dispatchID = row.dispatchID as string;
    if (newest.has(dispatchID)) continue;
    if (!isCheckInState(row.state) || !row.createdAt) continue;
    newest.set(dispatchID, { state: row.state, at: row.createdAt as string });
  }

  return newest;
}

/**
 * Looks at every trip on the road and says something about the quiet ones.
 *
 * Returns what it found either way, so a screen can colour a trip amber at
 * fifteen minutes without anybody being notified about it.
 *
 * Notifying is optional because this is reached two ways. The fleet board polls
 * it every thirty seconds from every open tab, and a GET that sends push
 * notifications as a side effect is a surprise nobody needs - it also made the
 * timing of an alert depend on who happened to have a browser open. The board
 * reads; the schedule tells people.
 */
export async function checkForStalledTrips(
  now = new Date(),
  options: { notify?: boolean } = {},
): Promise<StalledTrip[]> {
  const telling = options.notify ?? true;
  const trips = await tripsOnTheRoad();
  const answers = await latestCheckIns(trips.map((trip) => trip.dispatchID));
  const responses = await latestStallResponses(trips.map((trip) => trip.dispatchID));
  const found: StalledTrip[] = [];

  for (const trip of trips) {
    const checkIn = answers.get(trip.dispatchID) ?? null;

    // Worked out before the verdict, not after, because it decides one of the
    // verdict's own branches: whether standing at a stop still excuses the
    // silence. Reused for the alert below, so it is read once either way.
    const atRisk = await stopAtRisk(trip, now);
    const progress = await crewProgress(trip.dispatchID);

    const verdict = assessStall({
      lastReportedAt: trip.lastReportedAt,
      lastContactAt: trip.lastContactAt,
      lastCrewUpdateAt: progress.lastCrewUpdateAt,
      atDeclaredStop: progress.atDeclaredStop,
      status: trip.status,
      metresToNearestStop: await metresToNearestStop(trip),
      checkIn,
      officeRespondedAt: responses.get(trip.dispatchID) ?? null,
      stopAtRisk: atRisk !== null,
      now,
    });

    // The crew have said something is wrong. Nothing about the clock matters
    // now; somebody on the truck has told us.
    if (verdict.reason === "crew asked for help" && checkIn) {
      const raised = telling ? await raiseCrewHelp(trip, checkIn, verdict.silentFor) : false;
      found.push({ ...trip, verdict, checkIn, raised });
      continue;
    }

    // A delay the crew explained that is still going. Not a stall - nothing has
    // gone quiet and nobody is missing - so it is a decision to prepare for
    // rather than an alarm. Once per answer: the office is told, and the crew
    // are asked once whether it has cleared, because the office should not be
    // deciding on half-hour-old information when the crew can refresh it.
    if (verdict.reason === "delay continuing" && checkIn && verdict.crewSaid) {
      const raised = telling
        ? await raiseDelayContinuing(trip, checkIn, verdict.crewSaid.minutesAgo)
        : false;
      found.push({ ...trip, verdict, checkIn, raised });
      continue;
    }

    // A day of silence is a trip nobody closed. Said once a day, calmly, rather
    // than escalated as an emergency for ever.
    if (verdict.reason === "left open") {
      const raised = telling ? await raiseLeftOpen(trip, verdict.silentFor, now) : false;
      found.push({ ...trip, verdict, checkIn, raised });
      continue;
    }

    // Marked as on the road with no position ever recorded. The rules stay quiet
    // about it - they cannot tell a trip that has not set off from one whose app
    // is broken - but a watched status means the crew have said they have set
    // off, and nothing arriving after that is its own kind of wrong: there is no
    // position for anybody to look at, the office included.
    if (verdict.reason === "never reported") {
      const raised = telling ? await raiseNeverReported(trip, now) : false;
      found.push({ ...trip, verdict, checkIn, raised });
      continue;
    }

    // Standing still within reach of one of its own stops, and the crew have not
    // said they arrived. The office is left alone for the first hour - loading
    // takes time - but the crew are asked from fifteen minutes like anybody else
    // whose truck has stopped: it costs them one tap, and a truck that set off
    // and never left the depot is exactly this case.
    if (verdict.reason === "at a stop" && !progress.atDeclaredStop && verdict.quietSince) {
      const rung = thresholdFor(verdict.silentFor);
      if (rung) {
        const raised = telling
          ? await raiseCrewQuestion(trip, rung, verdict.silentFor, verdict.quietSince)
          : false;
        found.push({ ...trip, verdict, checkIn, raised });
        continue;
      }
    }

    if (!verdict.stalled || !verdict.threshold || !trip.lastReportedAt) {
      if (verdict.silentFor > 0) {
        found.push({ ...trip, verdict, checkIn, raised: false });
      }
      continue;
    }

    const raised = telling
      ? await raiseStall(trip, verdict.threshold, verdict.silentFor, verdict.quietSince ?? trip.lastReportedAt, verdict.cause, {
          atStop: verdict.atStop,
          atRisk,
          // Whether anybody has spoken for this silence, which is what the later
          // rungs lead with.
          answered: responses.has(trip.dispatchID),
        })
      : false;
    found.push({ ...trip, verdict, checkIn, raised });
  }

  return found;
}

/**
 * A trip on the road whose app has never spoken. Said once a day, calmly.
 *
 * Not urgent: nothing is known to be wrong with the truck, and dressing it as an
 * emergency is how people learn to ignore emergencies. But it does have to be
 * said, because this was the one case the watchdog was completely silent about -
 * and it is the case where the office has least to work with.
 */
async function raiseNeverReported(trip: LiveTrip, now: Date): Promise<boolean> {
  const alert = neverReportedAlert(await labelFor(trip));

  const told = await notify({
    event: "TRUCK_STALLED",
    title: alert.title,
    body: alert.body,
    severity: "action",
    roles: OFFICE,
    dedupeKey: neverReportedDedupeKey(trip.dispatchID, now),
    entity: { table: "DispatchOrder", id: trip.dispatchID },
    link: "/admindashboard/fleet-tracking",
  });

  return told > 0;
}

/**
 * A stated delay that has run past the point of being ordinary.
 *
 * Once per answer rather than once per check: the dedupe key is the moment the
 * crew spoke, so the same jam does not report itself every ten minutes, and a
 * crew who answer again later start a new one - which is the point of asking
 * them, because their answer resets the half hour and refreshes what the office
 * is deciding on.
 */
async function raiseDelayContinuing(
  trip: LiveTrip,
  checkIn: CrewCheckIn,
  minutesSinceAnswer: number,
): Promise<boolean> {
  const label = await labelFor(trip);
  const asked = delayContinuingAlert(label, checkIn.state, minutesSinceAnswer);
  let told = 0;
  let unreached: CrewUnreached | null = null;

  // The crew first, so the office is told the truth about whether they were
  // asked. In their own words, and pointed at the trip with the question open:
  // the office link is under /admindashboard, which the crew portal refuses.
  if (asked.crew) {
    const result = await askCrewDirectly(
      trip,
      asked.crew,
      "action",
      delayDedupeKey(trip.dispatchID, checkIn.at, "crew"),
    );
    told += result.told;
    unreached = result.unreached;
  }

  const alert = unreached
    ? delayContinuingAlert(label, checkIn.state, minutesSinceAnswer, false)
    : asked;

  told += await notify({
    event: "TRUCK_STALLED",
    title: alert.office.title,
    body: alert.office.body,
    // Something to get ready for, not something to drop everything over.
    severity: "action",
    roles: OFFICE,
    dedupeKey: delayDedupeKey(trip.dispatchID, checkIn.at, "office"),
    entity: { table: "DispatchOrder", id: trip.dispatchID },
    link: "/admindashboard/fleet-tracking",
  });

  if (unreached) told += await raiseCrewUnreached(trip, label, minutesSinceAnswer, unreached, checkIn.at);

  return told > 0;
}

/**
 * Asks the crew, on the channel that vibrates, and says whether it landed.
 *
 * Every crew stall alert goes through here. They used to go out on the general
 * channel, which Android created without vibration, and the only measure of
 * success was that a row had been written - so a crew with no phone signed in
 * counted as asked.
 */
async function askCrewDirectly(
  trip: LiveTrip,
  message: StallMessage,
  severity: Severity,
  dedupeKey: string,
): Promise<{ told: number; unreached: CrewUnreached | null }> {
  const crew = await crewOf(trip.dispatchID);
  if (crew.length === 0) return { told: 0, unreached: whyCrewUnreached(0, null) };

  const outcome = await notifyWithOutcome({
    event: "TRUCK_STALLED",
    title: message.title,
    body: message.body,
    severity,
    employeeIDs: crew,
    dedupeKey,
    entity: { table: "DispatchOrder", id: trip.dispatchID },
    link: crewCheckInLink(trip.dispatchID),
    channel: "alerts",
  });

  return { told: outcome.recipients, unreached: whyCrewUnreached(crew.length, outcome) };
}

/** The crew could not be alerted, so the office has to ring them. Once per silence. */
async function raiseCrewUnreached(
  trip: LiveTrip,
  label: string,
  silentFor: number,
  why: CrewUnreached,
  since: string,
): Promise<number> {
  const alert = crewUnreachedAlert(label, silentFor, why);
  return notify({
    event: "CREW_UNREACHED",
    title: alert.title,
    body: alert.body,
    severity: "action",
    roles: OFFICE,
    dedupeKey: crewUnreachedDedupeKey(trip.dispatchID, since),
    entity: { table: "DispatchOrder", id: trip.dispatchID },
    link: "/admindashboard/fleet-tracking",
  });
}

/**
 * Asks the crew only - for a truck standing near one of its own stops, where
 * the office is not bothered for the first hour but the crew still are.
 */
async function raiseCrewQuestion(
  trip: LiveTrip,
  rung: StallThreshold,
  silentFor: number,
  quietSince: string,
): Promise<boolean> {
  const label = await labelFor(trip);
  const message = stallAlert(rung, label, silentFor, "unknown", { atStop: true }).crew;
  if (!message) return false;

  const asked = await askCrewDirectly(
    trip,
    message,
    "action",
    stallDedupeKey(trip.dispatchID, rung, quietSince, "crew"),
  );
  let told = asked.told;
  if (asked.unreached) told += await raiseCrewUnreached(trip, label, silentFor, asked.unreached, quietSince);
  return told > 0;
}

/** The crew have reported trouble. Straight to the office, once per answer. */
async function raiseCrewHelp(trip: LiveTrip, checkIn: CrewCheckIn, silentFor: number): Promise<boolean> {
  const alert = crewHelpAlert(await labelFor(trip), checkIn.state, silentFor);

  const told = await notify({
    event: "TRUCK_STALLED",
    title: alert.title,
    body: alert.body,
    severity: "urgent",
    roles: OFFICE,
    dedupeKey: crewHelpDedupeKey(trip.dispatchID, checkIn.at),
    entity: { table: "DispatchOrder", id: trip.dispatchID },
    link: "/admindashboard/fleet-tracking",
  });

  return told > 0;
}

async function labelFor(trip: LiveTrip): Promise<string> {
  return (await tripLabel(trip.dispatchID)) ?? trip.orderCode ?? trip.truck ?? "A delivery";
}

async function raiseStall(
  trip: LiveTrip,
  threshold: StallThreshold,
  silentFor: number,
  /** When the clock started: what each rung is said once against. */
  quietSince: string,
  cause: StallCause,
  context: StallContext = {},
): Promise<boolean> {
  const label = await labelFor(trip);
  const asked = stallAlert(threshold, label, silentFor, cause, context);
  let told = 0;
  let unreached: CrewUnreached | null = null;

  // The crew first, so the office's alert can say truthfully whether they were
  // asked. In their own words, on the channel that vibrates, and pointed at the
  // trip with the question open: the office link is under /admindashboard,
  // which the crew portal refuses them, and the bare dashboard has no buttons
  // to answer with.
  if (asked.crew) {
    const result = await askCrewDirectly(
      trip,
      asked.crew,
      asked.severity,
      stallDedupeKey(trip.dispatchID, threshold, quietSince, "crew"),
    );
    told += result.told;
    unreached = result.unreached;
  }

  const alert = unreached
    ? stallAlert(threshold, label, silentFor, cause, { ...context, crewReached: false })
    : asked;

  // Fifteen minutes is for the board and the crew, not for the office's phones.
  if (alert.notifyOffice) {
    told += await notify({
      event: "TRUCK_STALLED",
      title: alert.office.title,
      body: alert.office.body,
      severity: alert.severity,
      roles: OFFICE,
      dedupeKey: stallDedupeKey(trip.dispatchID, threshold, quietSince, "office"),
      entity: { table: "DispatchOrder", id: trip.dispatchID },
      link: "/admindashboard/fleet-tracking",
    });
  }

  // Including at fifteen, where the office would otherwise hear nothing: a crew
  // who cannot be alerted is the office's to ring, straight away.
  if (unreached) told += await raiseCrewUnreached(trip, label, silentFor, unreached, quietSince);

  return told > 0;
}

/** The tidying reminder for a trip that was never closed. */
async function raiseLeftOpen(trip: LiveTrip, silentFor: number, now: Date): Promise<boolean> {
  const alert = leftOpenAlert(await labelFor(trip), silentFor);

  const told = await notify({
    event: "TRIP_LEFT_OPEN",
    title: alert.title,
    body: alert.body,
    severity: "action",
    roles: OFFICE,
    dedupeKey: leftOpenDedupeKey(trip.dispatchID, now),
    entity: { table: "DispatchOrder", id: trip.dispatchID },
    link: "/admindashboard/fleet-tracking",
  });

  return told > 0;
}

// ------------------------------------------------ answering a stall alert

/**
 * The office saying they have acted on a silence.
 *
 * The forty-five minute rung tells them to call the driver and then had no way
 * of knowing whether anybody did - so it kept escalating at the person who had
 * already picked up the phone, and the two-hour rung repeated it to somebody who
 * had solved it an hour earlier.
 *
 * Written to DispatchInterventionLog, which was in the schema, shaped for
 * exactly this - dispatch, who acted, what kind of intervention, the reason and
 * the time - and used by nothing.
 */
export async function recordStallResponse(input: {
  dispatchID: string;
  actorID: string;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.from("DispatchInterventionLog").insert({
    dispatchID: input.dispatchID,
    actionTakenBy: input.actorID,
    interventionType: STALL_RESPONSE_TYPE,
    reason: input.reason,
    timeStamp: new Date().toISOString(),
  });

  if (error) throw new Error(`Could not record that: ${error.message}`);
}

const STALL_RESPONSE_TYPE = "stall_answered";

/**
 * The newest answer for each of these trips.
 *
 * One query for all of them, newest first, keeping the first seen per trip - the
 * same shape as the crew's check-ins, because the question is the same: has
 * anybody spoken for this silence, and how long ago.
 */
async function latestStallResponses(dispatchIDs: string[]): Promise<Map<string, string>> {
  const newest = new Map<string, string>();
  if (dispatchIDs.length === 0) return newest;

  const { data, error } = await supabase
    .from("DispatchInterventionLog")
    .select("dispatchID, timeStamp")
    .eq("interventionType", STALL_RESPONSE_TYPE)
    .in("dispatchID", dispatchIDs)
    .order("timeStamp", { ascending: false });

  if (error) {
    // Before the table is in use there is nothing to read, and a watchdog that
    // refused to run without it would be worse than one that runs as it did.
    console.warn("Could not read the stall responses:", error.message);
    return newest;
  }

  for (const row of data ?? []) {
    const dispatchID = row.dispatchID as string;
    if (!dispatchID || newest.has(dispatchID)) continue;
    if (row.timeStamp) newest.set(dispatchID, row.timeStamp as string);
  }

  return newest;
}

// -------------------------------------------------- is the checker still alive

/** The name this check records itself under. */
export const STALL_CHECK = "stall-check";

/**
 * The last time the scheduled check completed, for a screen that wants to say
 * whether it is still running.
 *
 * Never throws. A board that cannot answer "is the watchdog alive" should still
 * draw the trucks; the warning simply does not appear.
 */
export async function lastCheckRunAt(name = STALL_CHECK): Promise<string | null> {
  const { data, error } = await supabase
    .from("ScheduledCheck")
    .select("lastRunAt")
    .eq("name", name)
    .maybeSingle();

  if (error) {
    console.error("[Stall check] Could not read the last run:", error.message);
    return null;
  }

  return (data?.lastRunAt as string | null) ?? null;
}

/**
 * Writes down that the check ran, and says how long it had been away.
 *
 * Returns the previous run's time so the caller can notice a gap. One row per
 * named check, overwritten: the question is "when did this last work", and a
 * log of 144 rows a day to answer it is a table nobody prunes.
 *
 * Best-effort, like every other notification path here. A check that found a
 * stalled truck and raised it has done its job whether or not it managed to
 * write down that it ran.
 */
export async function recordCheckRun(
  found: StalledTrip[],
  now: Date,
  name = STALL_CHECK,
): Promise<{ previousRunAt: string | null }> {
  const previousRunAt = await lastCheckRunAt(name);

  const { error } = await supabase.from("ScheduledCheck").upsert(
    {
      name,
      lastRunAt: now.toISOString(),
      tripsChecked: found.length,
      alertsRaised: found.filter((trip) => trip.raised).length,
    },
    { onConflict: "name" },
  );

  if (error) console.error("[Stall check] Could not record the run:", error.message);

  return { previousRunAt };
}

/**
 * The checker telling the office it had stopped.
 *
 * Said on the way back, by the thing that stopped - which needs no extra
 * trigger, because by definition it is running when it says this. It names the
 * window rather than the fault: "it is working now" is no use to somebody
 * deciding whether a delivery that ran quiet at four o'clock was chased.
 *
 * Nothing is said the first time it ever runs. A checker that has never run is
 * a system being set up, not one that has failed.
 */
export async function announceRecovery(
  previousRunAt: string | null,
  now: Date,
): Promise<boolean> {
  if (!previousRunAt) return false;

  const health = checkerHealth(previousRunAt, now);
  if (!health.overdue || health.ranMinutesAgo === null) return false;

  const alert = checkerRecoveredAlert(health.ranMinutesAgo);

  const told = await notify({
    event: "STALL_CHECK_RECOVERED",
    title: alert.title,
    body: alert.body,
    severity: "action",
    roles: OFFICE,
    dedupeKey: checkerRecoveredDedupeKey(previousRunAt),
    link: "/admindashboard/fleet-tracking",
  });

  return told > 0;
}

/**
 * Telling the office, in the feed, that nothing is watching the trucks.
 *
 * Raised by the board's read rather than by the schedule, because the schedule
 * is the thing that has stopped. That makes it the one notification in this
 * system sent from a GET, which is a rule worth breaking exactly here: the
 * alternative is a failure whose only symptom is silence, and this has now
 * happened twice.
 *
 * Guarded twice over. A module-level day stamp keeps a board left open from
 * attempting an insert every thirty seconds, and the dedupe key makes it once a
 * day however many instances are running.
 */
let announcedDownOn: string | null = null;

export async function announceCheckerDown(
  health: CheckerHealth,
  now: Date,
): Promise<boolean> {
  const alert = checkerDownAlert(health);
  if (!alert) return false;

  const today = now.toISOString().slice(0, 10);
  if (announcedDownOn === today) return false;
  announcedDownOn = today;

  const told = await notify({
    event: "STALL_CHECK_DOWN",
    title: alert.title,
    body: alert.body,
    // Nothing is watching the fleet. There is no quieter way to put that.
    severity: "urgent",
    roles: OFFICE,
    dedupeKey: checkerDownDedupeKey(now),
    link: "/admindashboard/fleet-tracking",
  });

  return told > 0;
}
