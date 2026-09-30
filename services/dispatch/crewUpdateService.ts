import { notify, OFFICE, tripLabel } from "@/services/notifications/notify";
import { CHECK_IN_LABELS, isCallForHelp, type CheckInState } from "@/app/lib/stallRules";

/**
 * Telling the office what the crew just did.
 *
 * Almost none of it reached them. A crew could set off, reach a warehouse,
 * collect a load, reach a delivery point, hand it over and report a delay, and
 * the office would be told exactly once - when the whole trip completed. The
 * fleet board could see all of it, because the board recomputes the state on
 * every poll; the notification feed is a record of things that were said, and
 * nothing was saying them.
 *
 * Worse, the check-in answered the crew with "Your coordinator has been told",
 * which was not true of anybody.
 *
 * All of it is best-effort. A notification must never fail the thing that
 * caused it: a delivery that was recorded is recorded whether or not anybody
 * was told about it, which is the rule notify() itself is built on.
 *
 * Severity is the whole design here. Ordinary progress is "info" - it belongs in
 * the feed, it is not an interruption - so that the handful of things that are
 * genuinely urgent still read as urgent. A feed where an arrival shouts as
 * loudly as a breakdown is a feed people stop opening.
 */

interface Actor {
  employeeID: string;
  employeeName: string;
}

const LINK = "/admindashboard/fleet-tracking";

async function tell(input: {
  dispatchID: string;
  event: string;
  title: string;
  body: string;
  severity: "info" | "action" | "urgent";
  dedupeKey: string;
  actor: Actor;
  link?: string;
}): Promise<void> {
  try {
    await notify({
      event: input.event,
      title: input.title,
      body: input.body,
      severity: input.severity,
      roles: OFFICE,
      dedupeKey: input.dedupeKey,
      entity: { table: "DispatchOrder", id: input.dispatchID },
      link: input.link ?? LINK,
      actor: { employeeID: input.actor.employeeID, name: input.actor.employeeName },
    });
  } catch (error) {
    console.error("[Crew update] Not announced:", error instanceof Error ? error.message : error);
  }
}

/** The trip has left. The first thing the office has been able to see happen. */
export async function announceDeparture(
  dispatchID: string,
  actor: Actor,
  lastReportedAt: string,
): Promise<void> {
  await tell({
    dispatchID,
    event: "TRIP_DEPARTED",
    title: "Trip started",
    body: `${actor.employeeName} has set off on ${(await tripLabel(dispatchID)) ?? "a delivery"}.`,
    severity: "info",
    // Per departure, not per call: a retry on a bad line must not say it twice.
    dedupeKey: `departed:${dispatchID}:${lastReportedAt}`,
    actor,
  });
}

/** "I am here." One tap from the truck, and now one line in the feed. */
export async function announceArrival(
  dispatchID: string,
  stopName: string,
  arrivedAt: string,
  actor: Actor,
): Promise<void> {
  await tell({
    dispatchID,
    event: "CREW_ARRIVED",
    title: `Arrived at ${stopName}`,
    body:
      `${actor.employeeName} reported reaching ${stopName} on ` +
      `${(await tripLabel(dispatchID)) ?? "a delivery"}. Nothing is being counted against the trip while they are there.`,
    severity: "info",
    dedupeKey: `arrived:${dispatchID}:${arrivedAt}`,
    actor,
  });
}

/** A stop finished: collected, or handed over and signed for. */
export async function announceStopDone(
  dispatchID: string,
  stop: { name: string; isPickup: boolean; receiverName?: string | null; hasProof: boolean },
  completedAt: string,
  actor: Actor,
): Promise<void> {
  const received = stop.receiverName?.trim();

  await tell({
    dispatchID,
    event: "STOP_COMPLETED",
    title: stop.isPickup ? `Collected from ${stop.name}` : `Delivered to ${stop.name}`,
    body:
      `${actor.employeeName} finished ${stop.name} on ${(await tripLabel(dispatchID)) ?? "a delivery"}.` +
      (received && received !== "N/A" ? ` Received by ${received}.` : "") +
      // Said plainly rather than left to be discovered in the report: a stop
      // closed without a photograph is the one the office may want to ask about
      // while the crew are still near it.
      (stop.hasProof ? "" : " No photograph was taken at this stop."),
    severity: "info",
    dedupeKey: `stop-done:${dispatchID}:${completedAt}`,
    actor,
  });
}

/**
 * The crew saying why they have gone quiet.
 *
 * The one the office most needs and the one they were least likely to get. It
 * reached the fleet board as a line under the trip, for whoever happened to be
 * looking at it, and the scheduled watchdog would not mention it for up to ten
 * minutes - if at all, since an ordinary delay is suppressed for the first half
 * hour on purpose.
 *
 * Two of the answers are not delays at all. "Needs help" and "Truck has a
 * problem" are the crew telling us something is wrong, and waiting for a cron
 * tick to pass that on is ten minutes nobody has.
 */
export async function announceCheckIn(
  dispatchID: string,
  state: CheckInState,
  note: string | null,
  at: string,
  actor: Actor,
): Promise<void> {
  const urgent = isCallForHelp(state);
  const said = CHECK_IN_LABELS[state];

  await tell({
    dispatchID,
    event: "CREW_CHECK_IN",
    title: urgent ? `Crew need help: ${said}` : `Crew reported: ${said}`,
    body:
      `${actor.employeeName} reported "${said}" on ${(await tripLabel(dispatchID)) ?? "a delivery"}.` +
      (note ? ` ${note}` : "") +
      (urgent
        ? " Call them now."
        : " The delivery is carrying on, and the customer can see the reason."),
    severity: urgent ? "urgent" : "info",
    // One per answer. A crew who answer again have said something new.
    dedupeKey: `check-in:${dispatchID}:${at}`,
    actor,
  });
}

/** The crew's own account of the trip, filed at the end of it. */
export async function announceTripReport(
  dispatchID: string,
  hasVehicleIssues: boolean,
  actor: Actor,
  at: string,
): Promise<void> {
  await tell({
    dispatchID,
    event: "TRIP_REPORT_FILED",
    title: "Trip report filed",
    body:
      `${actor.employeeName} filed their report on ${(await tripLabel(dispatchID)) ?? "a delivery"}.` +
      (hasVehicleIssues
        ? " They noted a problem with the truck - worth reading before it goes out again."
        : ""),
    // A noted vehicle problem is something to act on before the next trip.
    severity: hasVehicleIssues ? "action" : "info",
    dedupeKey: `trip-report:${dispatchID}:${at}`,
    actor,
    link: "/admindashboard/reports",
  });
}
