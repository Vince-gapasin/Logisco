// Whether the thing that watches the trucks is itself still running.
//
// WHY THIS EXISTS
//
// The stall ladder - 15, 30, 45, 120, 360 - is sent by one scheduled POST and
// by nothing else. The fleet board's GET recomputes the same verdicts on every
// poll but deliberately notifies nobody, so if the schedule stops, the board
// goes on colouring quiet trips amber and not one alert is sent.
//
// That failure has now happened twice, in two different ways:
//
//   GitHub Actions honoured "*/10 * * * *" at a median of 277 minutes on a free
//   public repository. Measured over three days, fourteen consecutive gaps.
//
//   pg_cron replaced it and fired exactly on the ten, for days, into a 401. The
//   secret in Supabase Vault was a nineteen-character fragment where a
//   forty-three character secret belonged. Every rung had been written, tested
//   and deployed; not one had ever run in production.
//
// Both times the only symptom was silence, and silence is what a fleet with no
// stalled trucks looks like. Nobody can tell those apart by looking.
//
// WHY IT IS NOT ANOTHER SCHEDULE
//
// A second scheduler watching the first is two things that can die quietly
// instead of one. What is reliably running is the office's own browser, which
// polls the board every thirty seconds - so the board asks how long ago the
// checker last ran and says so when the answer is too long. No new moving part,
// and no notification sent from a GET, which was split apart on purpose.
//
// The other half is the checker owning up: when it comes back after a gap it
// says how long it was away. That needs no extra trigger, because by definition
// it is running when it says it - and it tells the office which window to
// distrust, which is the part that actually matters.

/**
 * How long since the last run before the checker counts as down.
 *
 * The schedule is every ten minutes, so this is two missed ticks and a little
 * slack for a slow run. Tighter would cry wolf over one dropped request;
 * looser and half an hour of missed rungs would pass unremarked.
 */
export const CHECKER_OVERDUE_AFTER_MIN = 25;

export interface CheckerHealth {
  /** Whole minutes since the last completed run, or null if it has never run. */
  ranMinutesAgo: number | null;
  /** Long enough that alerts are being missed. */
  overdue: boolean;
  /** Nothing has ever been recorded, which is not the same as being late. */
  neverRun: boolean;
}

export function checkerHealth(lastRunAt: string | null, now = new Date()): CheckerHealth {
  if (!lastRunAt) return { ranMinutesAgo: null, overdue: false, neverRun: true };

  const at = new Date(lastRunAt).getTime();
  if (Number.isNaN(at)) return { ranMinutesAgo: null, overdue: false, neverRun: true };

  // A clock ahead of ours would otherwise read as fresh forever.
  const ranMinutesAgo = Math.max(0, Math.floor((now.getTime() - at) / 60_000));

  return {
    ranMinutesAgo,
    overdue: ranMinutesAgo >= CHECKER_OVERDUE_AFTER_MIN,
    neverRun: false,
  };
}

/** A length of time as somebody would say it. */
function describe(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * What the fleet board says when the checker has gone quiet.
 *
 * On the board rather than in the feed, because the feed is filled by the very
 * thing that has stopped. It names the consequence rather than the fault: a
 * coordinator does not need to know what pg_cron is, they need to know that the
 * amber trips in front of them are not going to alert anybody.
 */
export function checkerWarning(health: CheckerHealth): string | null {
  if (health.neverRun) {
    return (
      "Stall alerts have never run. Quiet trucks will show here and nobody will be notified " +
      "about them."
    );
  }

  if (!health.overdue || health.ranMinutesAgo === null) return null;

  return (
    `Stall alerts are not running - the last check was ${describe(health.ranMinutesAgo)} ago. ` +
    `Quiet trucks still show here, but nobody is being notified about them.`
  );
}

/**
 * The office being told the checker has stopped, in the notification feed.
 *
 * The board already says it, but only to somebody looking at the board - and
 * the thing that has stopped is precisely what would otherwise put this in the
 * feed. So the read raises it, which is a rule this file otherwise avoids:
 * reading a page should not notify anybody. The exception earns itself here
 * because the alternative is the failure staying invisible, which is the whole
 * reason this file exists. It is said once a day, not once a poll.
 */
export function checkerDownAlert(health: CheckerHealth): { title: string; body: string } | null {
  if (health.neverRun) {
    return {
      title: "Stall alerts have never run",
      body:
        "Nothing is watching for trucks that have gone quiet. They will show on the fleet board " +
        "and nobody will be notified about them.",
    };
  }

  if (!health.overdue || health.ranMinutesAgo === null) return null;

  return {
    title: `Stall alerts stopped ${describe(health.ranMinutesAgo)} ago`,
    body:
      `The check that notifies about quiet trucks last ran ${describe(health.ranMinutesAgo)} ago. ` +
      `Until it runs again, a truck going quiet will colour the fleet board and reach nobody.`,
  };
}

/** One per day, so a board left open does not say it every thirty seconds. */
export function checkerDownDedupeKey(now: Date): string {
  return `checker-down:${now.toISOString().slice(0, 10)}`;
}

/**
 * The checker owning up, once it is back.
 *
 * Deliberately says which window to distrust. "It is working now" is no use to
 * somebody deciding whether a delivery that ran quiet at four o'clock was
 * chased; "nothing was sent between four and seven" is.
 */
export function checkerRecoveredAlert(downForMinutes: number): { title: string; body: string } {
  return {
    title: `Stall alerts were down for ${describe(downForMinutes)}`,
    body:
      `The check that notifies about quiet trucks did not run for ${describe(downForMinutes)} ` +
      `and has just started again. Any trip that went quiet in that time was not alerted on. ` +
      `Worth a look at the fleet board before relying on it.`,
  };
}

/** One key per gap, so a recovery is announced once and not on every run after. */
export function checkerRecoveredDedupeKey(lastRunAt: string): string {
  return `checker-recovered:${lastRunAt}`;
}
