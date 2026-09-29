// When a truck has been silent long enough to be worth saying something about.
//
// Kept apart from the database so the rules can be read and tested on their
// own: what counts as stalled, at which point, what to say, and to whom.
//
// WHAT THIS CAN HONESTLY DETECT
//
// The crew app posts a position every fifteen metres of movement and at no
// other time, so all of these arrive as exactly the same thing - nothing:
//
//   the truck has stopped
//   Android killed the app to save battery
//   the driver swiped it away
//   the phone lost signal, or its battery died
//
// The alarm cannot tell them apart, and the last three are collectively more
// likely than the first. So the wording names both possibilities and asks for
// both to be checked, rather than sending somebody to look for a broken truck.
// It used to say "call the driver, or report a foul trip", which is the right
// advice for the one cause it cannot actually distinguish.
//
// Guessing the cause from the last reported speed was considered and dropped:
// speed is null on about nine pings in ten, so the guess would be "unknown"
// almost always and confidently wrong the rest of the time. The honest fix is a
// heartbeat - the app reporting every few minutes whether or not it has moved -
// which separates "stopped" from "out of contact" properly. That needs a new
// build of the app.

/**
 * The rungs, in minutes of silence.
 *
 * It used to stop at 45, which meant a truck missing for two days produced one
 * notification and then nothing, because the highest rung had already been
 * said. The upper rungs widen so that a long silence keeps being raised without
 * becoming a drumbeat.
 */
export const STALL_THRESHOLDS_MIN = [15, 30, 45, 120, 360] as const;
export type StallThreshold = (typeof STALL_THRESHOLDS_MIN)[number];

/**
 * Past this, a trip is not a stalled truck any more.
 *
 * A day of silence on a trip still marked In Transit almost always means the
 * delivery finished and nobody closed it. Chasing it as an emergency is wrong,
 * and it would otherwise sit in every check for ever. It gets its own, calmer
 * alert asking somebody to close the trip.
 */
export const LEFT_OPEN_AFTER_MIN = 24 * 60;

/**
 * How close to one of its own stops counts as being at it.
 *
 * Loading and unloading routinely take longer than the first threshold, so a
 * truck sitting at a stop on its own itinerary is doing its job, not stuck.
 */
export const AT_STOP_METRES = 200;

/**
 * How long being at one of its own stops excuses the silence.
 *
 * It used to excuse it for ever, which meant a truck that started a delivery and
 * never left the depot was invisible: the depot is a pickup stop on its own
 * itinerary, so every rung was suppressed and nobody was told anything at any
 * point. A driver who ignored the check-in prompt left the trip in total silence.
 *
 * An hour, which is what a "loading" check-in buys - the same judgement about how
 * long a stop can reasonably take, applied to a crew who have said nothing rather
 * than to one who has. Past it the ladder runs as normal, and the wording says the
 * truck is at a stop rather than implying it has broken down on a road somewhere.
 */
export const AT_STOP_GRACE_MIN = 60;

/**
 * How near a stop's promised time counts as putting it at risk.
 *
 * The ladder on its own only knows how long a truck has been quiet. It cannot
 * tell fifteen minutes with a whole afternoon of slack from fifteen minutes on a
 * delivery that was due twenty minutes ago, and those want different answers.
 *
 * So a stall that threatens a time the office promised is escalated early: the
 * fifteen-minute rung, which normally tells nobody, notifies the office, and
 * thirty goes straight to urgent. The point is to act while acting still helps,
 * rather than waiting for the forty-five minute rung to say the same thing about
 * a delivery that is already late.
 */
export const STOP_AT_RISK_MIN = 30;

/**
 * How long the office saying "I have dealt with this" quietens the ladder.
 *
 * The forty-five minute rung tells the office to call the driver and then has no
 * idea whether anybody did. So it kept escalating at somebody who had already
 * picked up the phone, and the two-hour rung said the same thing again to a
 * person who had solved it an hour earlier. An alarm that cannot be answered is
 * one people learn to ignore.
 *
 * An hour, the same as a crew saying they are in traffic, and for the same
 * reason: it buys time, it does not end the matter. A trip that is still silent
 * an hour after somebody said they had handled it has not been handled.
 */
export const OFFICE_RESPONSE_QUIETENS_MIN = 60;

/**
 * How long without a word from the app before contact counts as lost.
 *
 * The heartbeat is every few minutes, so this is several heartbeats' grace - a
 * phone briefly out of signal on a mountain road has not been lost.
 */
export const CONTACT_LOST_MIN = 10;

/**
 * The statuses worth watching.
 *
 * It used to be In Transit alone, so a trip that sat in In Warehouse for four
 * hours was invisible - and a loading problem is exactly the sort of thing the
 * office wants to hear about. Both of the added statuses normally sit at one of
 * the trip's own stops, which the at-stop rule already leaves alone, so what this
 * actually catches is a truck that is loading or arriving somewhere it has no
 * business being.
 *
 * Accepted and Start Delivery are left out on purpose: nothing has set off yet,
 * so there is no movement to be missing.
 */
export const WATCHED_STATUSES = ["In Transit", "In Warehouse", "Arrived"] as const;

/**
 * What a crew can say when asked why they have gone quiet.
 *
 * Two of them are not excuses at all - they are the crew telling us something is
 * wrong, which should make the alarm louder rather than quieter.
 */
export const CHECK_IN_STATES = [
  "on_break",
  "traffic",
  "waiting",
  "loading",
  "vehicle_problem",
  "need_help",
] as const;

export type CheckInState = (typeof CHECK_IN_STATES)[number];

export function isCheckInState(value: unknown): value is CheckInState {
  return typeof value === "string" && (CHECK_IN_STATES as readonly string[]).includes(value);
}

/**
 * How long each answer buys before the silence is raised again.
 *
 * A break gets ninety minutes because Article 85 of the Labor Code requires at
 * least sixty uninterrupted minutes for a meal, and a driver who has to justify
 * their lunch twice is a driver who stops answering. The rest get an hour, which
 * is long enough to clear a gate or a jam.
 *
 * Nothing buys silence for good. "I am in traffic" ninety minutes ago is not an
 * answer about now, and a trip that has genuinely gone wrong after a legitimate
 * stop must still be able to raise itself.
 */
export const CHECK_IN_QUIETENS_MIN: Record<CheckInState, number> = {
  on_break: 90,
  traffic: 60,
  waiting: 60,
  loading: 60,
  // Not excuses. These bring the alarm forward rather than putting it off.
  vehicle_problem: 0,
  need_help: 0,
};

/** The two answers that are a call for help, not an explanation. */
export function isCallForHelp(state: CheckInState): boolean {
  return CHECK_IN_QUIETENS_MIN[state] === 0;
}

/** What the crew said, and when. */
export interface CrewCheckIn {
  state: CheckInState;
  at: string;
}

export interface StallInput {
  /** When the truck last actually moved (FleetLocations.moved_at). */
  lastReportedAt: string | null;
  /**
   * When the app last spoke at all (FleetLocations.updated_at), which a
   * heartbeat refreshes whether or not the truck moved.
   *
   * Omitted, or equal to lastReportedAt, means there are no heartbeats to go on
   * - which is the case for any app build before them - and the cause of a
   * silence then honestly reads as unknown.
   */
  lastContactAt?: string | null;
  /**
   * When the crew last told us something: arrived at a stop, or finished one.
   *
   * The starting gun for the threshold. Movement alone is a poor baseline - the
   * app reports it only when the truck rolls, so a legitimate hour of unloading
   * and a breakdown produce the same silence, and the only way to tell them apart
   * was to guess from how near a stop the truck happened to be. A crew who have
   * said "I am here" and then "I am done" have told us which it is.
   *
   * The clock runs from whichever is later, this or the last movement, so
   * finishing a stop restarts it even if the truck has not pulled away yet.
   */
  lastCrewUpdateAt?: string | null;
  /**
   * The crew have said they are at a stop and have not said they are finished.
   *
   * They are working. Nothing is counted against them - up to the point where it
   * starts costing a promised delivery time, which stopAtRisk decides, because
   * "I am unloading" cannot be allowed to mean "do not ask me again".
   */
  atDeclaredStop?: boolean;
  /** The trip's status. Only a trip on the road can stall. */
  status: string;
  /** Metres to the nearest stop on this trip, done or not, when both are known. */
  metresToNearestStop: number | null;
  /** The crew's most recent answer about this trip, if they have given one. */
  checkIn?: CrewCheckIn | null;
  /**
   * When somebody in the office last said they had acted on this silence.
   *
   * Recorded when a coordinator answers the alert - having reached the crew, or
   * having decided it is a foul trip. Quietens the ladder the way a crew answer
   * does, so the office is not chased about something they have already picked
   * up, and only for as long.
   */
  officeRespondedAt?: string | null;
  /**
   * Whether a stop's promised time is already threatened by this delay.
   *
   * Only used to decide whether being at a stop still excuses the silence. It
   * does, while the delivery is comfortable: loading takes time and an hour of it
   * is nobody's business. It stops excusing anything the moment that hour is
   * costing a time the office promised somebody - at which point standing at a
   * stop is not the reason to say nothing, it is the reason to say something.
   */
  stopAtRisk?: boolean;
  now?: Date;
}

/**
 * What the silence most likely is.
 *
 * "stopped" is only claimed when the app is still talking to us while the truck
 * has not moved, which is the one case we can be sure about.
 */
export type StallCause = "stopped" | "out of contact" | "unknown";

export interface StallVerdict {
  stalled: boolean;
  /** Whether the truck stopped, the phone did, or we cannot tell. */
  cause: StallCause;
  /**
   * Standing at one of its own stops. Excuses everything for the first hour;
   * after that it is still worth saying, because where a truck is stuck changes
   * what the office should do about it.
   */
  atStop: boolean;
  /** Minutes since the app last spoke at all, when that is known. */
  outOfContactFor: number;
  /** Whole minutes since the last position, when there is one. */
  silentFor: number;
  /** The highest threshold passed, or null when none has been. */
  threshold: StallThreshold | null;
  /** Why nothing is being raised, for a screen that wants to explain itself. */
  reason:
    | "on the road"
    | "not on the road"
    | "never reported"
    | "at a stop"
    | "reporting"
    | "left open"
    | "crew answered"
    | "office answered"
    | "crew asked for help";
}

/**
 * A length of time as somebody would say it.
 *
 * The title used to name the threshold rather than the silence, so a truck that
 * had been quiet for 1,407 minutes was announced as "silent for 45 minutes"
 * while the body underneath gave the real figure. Whatever is shown, it is the
 * truth about this trip.
 */
export function describeSilence(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.round(minutes / 60);
  if (minutes < LEFT_OPEN_AFTER_MIN) return `${hours} hour${hours === 1 ? "" : "s"}`;

  // Rounded, not floored: a trip quiet for 2,701 minutes is nearly two days
  // gone, and calling that "1 day" is the same understatement this replaced.
  const days = Math.max(1, Math.round(minutes / LEFT_OPEN_AFTER_MIN));
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Whether this trip has gone quiet, and for how long.
 *
 * A trip that has never reported is not treated as stalled: it has not
 * started, or the crew app has never had the chance to speak. That is worth
 * knowing and is not this alarm.
 */
export function assessStall({
  lastReportedAt,
  lastContactAt = null,
  lastCrewUpdateAt = null,
  atDeclaredStop = false,
  status,
  metresToNearestStop,
  checkIn = null,
  officeRespondedAt = null,
  stopAtRisk = false,
  now = new Date(),
}: StallInput): StallVerdict {
  const minutesSince = (moment: string | null): number | null => {
    if (!moment) return null;
    const at = new Date(moment).getTime();
    if (Number.isNaN(at)) return null;
    // A clock ahead of ours would otherwise read as fresh forever.
    return Math.max(0, Math.floor((now.getTime() - at) / 60_000));
  };

  const contactSilence = minutesSince(lastContactAt);

  const quiet = (
    reason: StallVerdict["reason"],
    silentFor = 0,
    atStop = false,
  ): StallVerdict => ({
    stalled: false,
    cause: "unknown",
    atStop,
    outOfContactFor: contactSilence ?? silentFor,
    silentFor,
    threshold: null,
    reason,
  });

  if (!(WATCHED_STATUSES as readonly string[]).includes(status)) return quiet("not on the road");
  if (!lastReportedAt) return quiet("never reported");

  const reportedAt = new Date(lastReportedAt).getTime();
  if (Number.isNaN(reportedAt)) return quiet("never reported");

  // Two clocks, because they answer different questions.
  //
  // movementSilence is how long since the truck rolled. It decides the cause,
  // against how long since the app last spoke.
  //
  // silentFor is how long since anything counted as progress - the truck moving,
  // or the crew saying where they are. It drives the rungs, because a crew who
  // have just finished a stop have told us the trip is alive whether or not the
  // wheels have turned yet, and starting the threshold from the last GPS
  // movement instead punished them for standing still while they signed for it.
  //
  // A clock ahead of ours would otherwise read as fresh forever.
  const movementSilence = Math.max(0, Math.floor((now.getTime() - reportedAt) / 60_000));

  const crewUpdateAt = lastCrewUpdateAt ? new Date(lastCrewUpdateAt).getTime() : Number.NaN;
  const progressAt = Number.isFinite(crewUpdateAt)
    ? Math.max(reportedAt, crewUpdateAt)
    : reportedAt;
  const silentFor = Math.max(0, Math.floor((now.getTime() - progressAt) / 60_000));

  // The crew have said they are at a stop and not said they are done. They are
  // working, and nothing is counted against them - until it starts costing a time
  // somebody promised, because "I am unloading" must not come to mean "do not ask
  // me again". Same rule as the GPS guess below, applied to a better signal.
  if (atDeclaredStop && !stopAtRisk) {
    return quiet("at a stop", silentFor, true);
  }

  // Sitting at one of its own stops is loading, not trouble. Every stop counts,
  // not only the ones still to come: a crew doing paperwork where they have
  // just delivered are where they are supposed to be.
  //
  // For an hour. Past that it stops being an explanation - a truck that has been
  // at the same stop for two hours without a word is not loading any more, and
  // excusing it for ever is how a delivery that never left the depot went
  // unmentioned by anybody.
  // And not at all once the delay is costing a delivery. Being at a stop is an
  // explanation for a truck that is not holding anybody up; it is not one for a
  // truck whose next drop was due twenty minutes ago. Without this the grace
  // period was a hole the early escalation could not reach through: a truck that
  // started a delivery and sat at the depot while its first promised time slid
  // past got nothing at all for a full hour.
  const atStop = metresToNearestStop !== null && metresToNearestStop <= AT_STOP_METRES;
  const grace = stopAtRisk ? 0 : AT_STOP_GRACE_MIN;
  if (atStop && silentFor < grace) {
    return quiet("at a stop", silentFor, true);
  }

  // A day of silence is a trip nobody closed, not a truck in trouble.
  if (silentFor >= LEFT_OPEN_AFTER_MIN) return quiet("left open", silentFor, atStop);

  const passed = [...STALL_THRESHOLDS_MIN].reverse().find((minutes) => silentFor >= minutes) ?? null;

  // Why it has gone quiet, as far as anybody can tell.
  //
  // Only one case is certain: the app is still talking to us and the truck has
  // not moved. Without heartbeats the two timestamps move together, so there is
  // nothing to compare and the cause stays unknown - which is the honest reading
  // for any app build that does not send them.
  // Contact must be genuinely fresher than movement for there to be anything to
  // compare. When the two timestamps march together there were no heartbeats,
  // and "the app has gone silent" is then the same statement as "the truck has
  // not moved" - true of both, evidence of neither.
  // Against movement, not against progress. A crew update makes the trip fresh
  // for the purposes of the ladder but says nothing about whether the phone is
  // still talking to us, and comparing contact against it would call a truck
  // "stopped" on the strength of a tap.
  const heartbeats = contactSilence !== null && contactSilence < movementSilence;
  const cause: StallCause = !heartbeats
    ? "unknown"
    : contactSilence < CONTACT_LOST_MIN
      ? "stopped"
      : "out of contact";

  // What the crew told us, if they told us anything since they went quiet.
  //
  // Only an answer newer than the last position counts. One from before the
  // truck last moved was about an earlier silence, and letting it speak for this
  // one would hand a driver a way to pre-authorise the rest of the day.
  const answeredAt = checkIn ? new Date(checkIn.at).getTime() : Number.NaN;
  const answered =
    checkIn && Number.isFinite(answeredAt) && answeredAt >= reportedAt
      ? { state: checkIn.state, minutesAgo: Math.max(0, Math.floor((now.getTime() - answeredAt) / 60_000)) }
      : null;

  if (answered) {
    // "The truck has a problem" and "I need help" are not excuses. They go
    // straight to the top rung, whatever the clock says - the crew know
    // something the clock does not.
    if (isCallForHelp(answered.state)) {
      return {
        stalled: true,
        cause,
        atStop,
        outOfContactFor: contactSilence ?? silentFor,
        silentFor,
        threshold: STALL_THRESHOLDS_MIN[STALL_THRESHOLDS_MIN.length - 1],
        reason: "crew asked for help",
      };
    }

    if (answered.minutesAgo < CHECK_IN_QUIETENS_MIN[answered.state]) {
      return quiet("crew answered", silentFor, atStop);
    }
  }

  // The office said they had it in hand. Checked after the crew's own answer, so
  // a crew calling for help is never quietened by a coordinator who ticked this
  // off beforehand - what somebody on the truck says outranks what the office
  // assumed.
  //
  // Only an answer newer than the silence counts, for the same reason a crew
  // answer has to be: one from before the truck last moved was about an earlier
  // silence, and letting it speak for this one would hand the office a way to
  // pre-authorise the rest of the day.
  const respondedAt = officeRespondedAt ? new Date(officeRespondedAt).getTime() : Number.NaN;
  if (Number.isFinite(respondedAt) && respondedAt >= progressAt) {
    const sinceResponse = Math.max(0, Math.floor((now.getTime() - respondedAt) / 60_000));
    if (sinceResponse < OFFICE_RESPONSE_QUIETENS_MIN) {
      return quiet("office answered", silentFor, atStop);
    }
  }

  if (!passed) return quiet("reporting", silentFor, atStop);

  return {
    stalled: true,
    cause,
    atStop,
    outOfContactFor: contactSilence ?? silentFor,
    silentFor,
    threshold: passed,
    reason: "on the road",
  };
}

export interface StallMessage {
  title: string;
  body: string;
}

export interface StallAlert {
  severity: "info" | "action" | "urgent";
  /** Whether the office should be pushed, or only shown it on the board. */
  notifyOffice: boolean;
  /** What the office is told. */
  office: StallMessage;
  /**
   * What the crew are told, when they are told anything.
   *
   * Written separately because they used to receive the office's message word
   * for word: at forty-five minutes the driver was advised to "call the driver,
   * or report a foul trip", and at thirty they were informed that "the crew
   * have been asked to confirm they are alright".
   */
  crew: StallMessage | null;
}

/**
 * What the silence is, in the office's words.
 *
 * With heartbeats there is usually something definite to say. Without them - any
 * app build before they existed - the honest answer is that the two causes look
 * identical, and the wording says so rather than guessing.
 */
function describeCause(label: string, silentFor: number, cause: StallCause = "unknown"): string {
  if (cause === "stopped") {
    return (
      `${label} has not moved for ${describeSilence(silentFor)}. ` +
      `The app is still reporting, so the truck itself has stopped.`
    );
  }

  if (cause === "out of contact") {
    return (
      `${label} has not reported for ${describeSilence(silentFor)} and the app has gone silent too. ` +
      `The phone may be off, out of signal or out of battery - the truck may be fine.`
    );
  }

  return (
    `${label} has not reported its position for ${describeSilence(silentFor)}. ` +
    `Either the truck has stopped or the app has lost contact - the two look the same from here.`
  );
}

const CREW_TITLE = "Are you alright?";

function askTheCrew(silentFor: number): StallMessage {
  return {
    title: CREW_TITLE,
    body:
      `We have not had your position for ${describeSilence(silentFor)}. ` +
      `If you are held up, waiting, or the truck has a problem, tell your coordinator so we can stop chasing it.`,
  };
}

/**
 * What each threshold is worth saying, and to whom.
 *
 * Fifteen minutes tells nobody. Most quarter-hour stops are traffic, a queue
 * at a gate, or a driver eating, and an alarm that cries wolf three times a
 * day is one nobody reads by Friday. It colours the trip on the board, where
 * somebody watching will see it, and goes no further.
 */
export interface StallContext {
  /** Standing at one of its own stops, past the hour that excuses it. */
  atStop?: boolean;
  /**
   * The next stop whose promised time this delay threatens.
   *
   * minutesLate is positive once the time has passed and negative while it is
   * still ahead, so -10 reads as "due in ten minutes".
   */
  atRisk?: { stopName: string; minutesLate: number } | null;
  /**
   * Whether anybody in the office has answered this silence yet.
   *
   * Past the rung that asks them to call the driver, "nobody has answered this"
   * is the most important thing on the alert - it is the difference between a
   * problem being worked and a problem being watched.
   */
  answered?: boolean;
}

/** How a threatened delivery time reads, in one clause. */
function describeRisk(atRisk: NonNullable<StallContext["atRisk"]>): string {
  const { stopName, minutesLate } = atRisk;
  if (minutesLate > 0) {
    return `${stopName} was due ${describeSilence(minutesLate)} ago.`;
  }
  const until = Math.abs(minutesLate);
  if (until === 0) return `${stopName} is due now.`;
  return `${stopName} is due in ${describeSilence(until)}.`;
}

export function stallAlert(
  threshold: StallThreshold,
  tripLabel: string,
  silentFor: number,
  cause: StallCause = "unknown",
  context: StallContext = {},
): StallAlert {
  const { atStop = false, atRisk = null, answered = false } = context;

  // Where it is stuck changes what the office should do about it, so it is said
  // rather than left to be inferred from a map.
  const quiet = atStop
    ? `${describeCause(tripLabel, silentFor, cause)} It is parked at one of its own stops.`
    : describeCause(tripLabel, silentFor, cause);
  const forHowLong = describeSilence(silentFor);
  const risk = atRisk ? ` ${describeRisk(atRisk)}` : "";

  if (threshold === 15) {
    // Fifteen minutes normally tells nobody. It tells the office when the delay
    // is already eating a time somebody promised a customer - which is the whole
    // point of knowing about it at fifteen rather than at forty-five.
    if (atRisk) {
      return {
        severity: "action",
        notifyOffice: true,
        office: {
          title: `Quiet ${forHowLong} with a delivery due`,
          body:
            `${quiet}${risk} Reach the crew now, while there is still time to do something about it.`,
        },
        crew: askTheCrew(silentFor),
      };
    }

    return {
      severity: "info",
      notifyOffice: false,
      office: { title: "Truck has gone quiet", body: quiet },
      crew: null,
    };
  }

  if (threshold === 30) {
    return {
      // Already threatening a promise: this is not a thing to get round to.
      severity: atRisk ? "urgent" : "action",
      notifyOffice: true,
      office: {
        title: atRisk ? `No position for ${forHowLong}, delivery at risk` : `No position for ${forHowLong}`,
        body: `${quiet}${risk} The crew have been asked to get in touch.`,
      },
      crew: askTheCrew(silentFor),
    };
  }

  if (threshold === 45) {
    return {
      severity: "urgent",
      notifyOffice: true,
      office: {
        title: `Silent for ${forHowLong}`,
        body:
          (cause === "stopped"
            ? `${quiet} Call the driver and find out why they are stopped.`
            : `${quiet} Call the driver. If you cannot reach them, treat it as a possible breakdown; ` +
              `if you reach them and all is well, the app may need restarting.`) +
          risk +
          // The rung that asks for a decision says so, and says what happens if
          // it does not get one. It used to advise a phone call and then have no
          // idea whether anybody made it.
          ` Mark it handled once you have reached them, or end the trip from the` +
          ` in-transit feed. Until one of those, this will keep coming back.`,
      },
      crew: askTheCrew(silentFor),
    };
  }

  if (threshold === 120) {
    return {
      severity: "urgent",
      notifyOffice: true,
      office: {
        title: `Still nothing after ${forHowLong}`,
        body:
          `${quiet} Nobody has heard from this trip in ${forHowLong}.` +
          (answered ? "" : " Nobody in the office has answered it either.") +
          ` If the driver cannot be reached, report a foul trip so a replacement can be arranged.` +
          risk,
      },
      crew: askTheCrew(silentFor),
    };
  }

  return {
    severity: "urgent",
    notifyOffice: true,
    office: {
      title: `No contact for ${forHowLong}`,
      body:
        `${quiet} This has gone on for ${forHowLong}.` +
        (answered ? "" : " Nobody in the office has answered it at any point.") +
        ` Either report a foul trip, or close the trip if the delivery is in fact finished.`,
    },
    crew: askTheCrew(silentFor),
  };
}

/** How each answer reads on a screen. */
export const CHECK_IN_LABELS: Record<CheckInState, string> = {
  on_break: "On a break",
  traffic: "Stuck in traffic",
  waiting: "Waiting to be received",
  loading: "Loading or unloading",
  vehicle_problem: "Truck has a problem",
  need_help: "Needs help",
};

/**
 * The crew have told us something is wrong.
 *
 * Louder than any rung the clock would have reached, and it names who said it,
 * because this is the one case where somebody on the truck has actually spoken.
 */
export function crewHelpAlert(tripLabel: string, state: CheckInState, silentFor: number): StallMessage {
  const urgent = state === "need_help";

  return {
    title: urgent ? "Crew have asked for help" : "Crew report a problem with the truck",
    body:
      `${tripLabel}: the crew reported "${CHECK_IN_LABELS[state]}" after ${describeSilence(silentFor)} ` +
      `without a position. ${urgent ? "Call them now." : "Call them, and arrange a mechanic or a replacement truck."}`,
  };
}

/**
 * A trip that says it is on the road and has never reported a position.
 *
 * assessStall calls this "never reported" and stays quiet about it, which was
 * right when the status was ambiguous: a trip could sit in a watched status
 * before anybody set off. It is not right once the crew have said they have
 * departed. Nothing arriving then means the app is not working - permission
 * refused, the plugin failed, the phone in a drawer - and that is a worse
 * situation than a truck that has stopped, because there is no position to go
 * and look at.
 *
 * Not a stall, and deliberately not urgent: nothing is known to be wrong with
 * the truck. It is a "your tracking is not on" message, and the fix is usually a
 * phone call and a restart.
 */
export function neverReportedAlert(tripLabel: string): StallMessage {
  return {
    title: "No tracking on a trip that has set off",
    body:
      `${tripLabel} is marked as on the road but the crew app has never sent a position, ` +
      `so there is nothing to follow. Call the crew and have them reopen the app and allow ` +
      `location access. Until then this delivery cannot be tracked by anybody, including the client.`,
  };
}

/** One key per trip per day: a standing reminder, not a drumbeat. */
export function neverReportedDedupeKey(dispatchID: string, now: Date): string {
  return `no-tracking:${dispatchID}:${now.toISOString().slice(0, 10)}`;
}

/**
 * A trip still on the road a day later, which is almost always one that
 * finished without anybody closing it.
 *
 * Deliberately not urgent and deliberately not a stall: it is a tidying job,
 * and dressing it as an emergency is how people learn to ignore emergencies.
 */
export function leftOpenAlert(tripLabel: string, silentFor: number): StallMessage {
  return {
    title: "Trip still marked on the road",
    body:
      `${tripLabel} has been In Transit with no position for ${describeSilence(silentFor)}. ` +
      `If it was delivered, close it; if it was not, report a foul trip. Until then it stays on the fleet board.`,
  };
}

/**
 * One key per trip, per threshold, per silence, per audience.
 *
 * The last reported time is in it on purpose: the same trip going quiet again
 * tomorrow is a new thing to say, while the same silence checked every ten
 * minutes for an hour is not. The audience is in it because the office and the
 * crew are told different things and neither should silence the other.
 */
export function stallDedupeKey(
  dispatchID: string,
  threshold: StallThreshold,
  lastReportedAt: string,
  audience: "office" | "crew" = "office",
): string {
  return `stalled:${dispatchID}:${threshold}:${lastReportedAt}:${audience}`;
}

/** One key per trip per answer, so every new cry for help is heard. */
export function crewHelpDedupeKey(dispatchID: string, checkInAt: string): string {
  return `crew-help:${dispatchID}:${checkInAt}`;
}

/**
 * One key per trip per day for the tidying alert, so it is a daily reminder
 * rather than one notification that scrolls away and is never seen again.
 */
export function leftOpenDedupeKey(dispatchID: string, now: Date): string {
  return `left-open:${dispatchID}:${now.toISOString().slice(0, 10)}`;
}
