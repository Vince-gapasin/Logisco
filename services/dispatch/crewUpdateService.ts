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

/**
 * A stop closed with no photograph.
 *
 * The only stop event worth a notification, because it is the only one the
 * office can still act on: the crew are standing there, and a phone call now is
 * a proof recovered rather than a gap in the record found weeks later.
 *
 * Every stop used to be announced - set off, arrived, collected, delivered -
 * which on a four-drop delivery is six notifications for a trip going entirely
 * to plan. Ordinary progress belongs on the fleet board, which recomputes it on
 * every poll. The feed is for the things somebody may have to do something
 * about.
 */
export async function announceMissingProof(
  dispatchID: string,
  stopName: string,
  completedAt: string,
  actor: Actor,
): Promise<void> {
  await tell({
    dispatchID,
    event: "POD_MISSING",
    title: `No proof at ${stopName}`,
    body:
      `${actor.employeeName} closed ${stopName} on ${(await tripLabel(dispatchID)) ?? "a delivery"} ` +
      `without a photograph. They may still be there - a call now is quicker than chasing it later.`,
    // Something to do, and a short window to do it in.
    severity: "action",
    dedupeKey: `no-proof:${dispatchID}:${completedAt}`,
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

/**
 * The crew's own account of the trip, when it names something wrong.
 *
 * Only then. A report with nothing in it arrives beside TRIP_COMPLETED and says
 * the same thing twice; a report that mentions the truck is something to read
 * before it goes out again.
 */
export async function announceTripReport(
  dispatchID: string,
  hasVehicleIssues: boolean,
  actor: Actor,
  at: string,
): Promise<void> {
  if (!hasVehicleIssues) return;

  await tell({
    dispatchID,
    event: "TRIP_REPORT_FILED",
    title: "Trip report notes a truck problem",
    body:
      `${actor.employeeName} finished ${(await tripLabel(dispatchID)) ?? "a delivery"} and ` +
      `reported a problem with the truck. Worth reading before it goes out again.`,
    severity: "action",
    dedupeKey: `trip-report:${dispatchID}:${at}`,
    actor,
    link: "/admindashboard/reports",
  });
}
