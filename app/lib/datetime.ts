// Times as people read them here: "8:00 AM", not "08:00".
//
// The database keeps 24-hour times, and so does anything that sorts or
// positions by them (the calendars compare "08:00" with "14:30", and a time
// input only accepts 24-hour). Only what is shown passes through here.

const TIME_PATTERN = /^(\d{1,2}):(\d{2})/;

// Already been through here. Formatting twice used to be silently destructive:
// "2:30 PM" matches the 24-hour pattern as hour 2, so a second pass turned an
// afternoon delivery into a morning one. Anything that has already been made
// readable is left alone, so a value passed through by one layer and formatted
// again by the next survives it.
const ALREADY_READABLE = /\d\s*(AM|PM)$/i;

// Every time this system shows is a time in the Philippines, and half of them
// are rendered by a server in UTC - the tracking email, the client's tracking
// page, a booking's history. Left to the machine's own zone, a delivery made
// at 1:05 PM reached the client's inbox as 5:05 AM. The zone is stated, so it
// reads the same wherever it was rendered.
const ZONE = "Asia/Manila";

// A full date and time with no zone on the end: "2026-10-06 05:09:19.53" or
// "2026-10-06T05:09:19". The audit trail's "timestamp" column is a timestamp
// without time zone, filled by now() on a database that runs in UTC, so it
// comes back as UTC with nothing saying so. A browser reads a bare time as its
// own local time: a trip started at 1:09 PM showed the client 5:09 AM.
const ZONELESS_STAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** A stored timestamp as the instant it is, a zoneless one read as UTC. */
function toInstant(value: string): Date {
  return new Date(ZONELESS_STAMP.test(value) ? `${value.replace(" ", "T")}Z` : value);
}

/**
 * "08:00", "08:00:00" or a full timestamp as "8:00 AM". Anything it cannot
 * read is handed back untouched, so a stray value never becomes "Invalid
 * Date" on a screen.
 */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (ALREADY_READABLE.test(trimmed)) return trimmed;

  const clock = TIME_PATTERN.exec(trimmed);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = clock[2];
    if (hours > 23 || Number(minutes) > 59) return value;
    const period = hours < 12 ? "AM" : "PM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${minutes} ${period}`;
  }

  const stamp = toInstant(trimmed);
  if (Number.isNaN(stamp.getTime())) return value;
  return stamp.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: ZONE });
}

/**
 * A date on its own: "Sep 22, 2026". The one way dates read on every screen -
 * they used to come as "2026-09-22", "September 22, 2026" and "9/22/2026"
 * depending on the page. A plain YYYY-MM-DD is read as that calendar day, not
 * shifted by a time zone.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const stamp = dayOnly ? new Date(Date.UTC(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]), 12)) : toInstant(trimmed);
  if (Number.isNaN(stamp.getTime())) return value;
  return stamp.toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: ZONE });
}

/** A date and time together: "Sep 22, 2026, 8:00 AM". */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const stamp = toInstant(value.trim());
  if (Number.isNaN(stamp.getTime())) return value;
  return stamp.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE });
}

/**
 * Today, where the trucks are.
 *
 * A booking is refused for being in the past, and "the past" has to be read in
 * Manila: this runs on a server in UTC, where at half past midnight local it is
 * still yesterday afternoon. Judged against that, every booking made after
 * eight in the evening would be a booking for tomorrow, and every booking for
 * today after midnight would be refused as past.
 *
 * en-CA because it is the locale that formats a date as YYYY-MM-DD, which is
 * what the column holds and what sorts correctly as a string.
 */
export function todayInManila(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * How long until a stop, in whole minutes, read in Manila.
 *
 * Both halves of the answer live in different places - the day on the order,
 * the clock on the stop - and the sum has to be read where the trucks are. A
 * server in UTC comparing "now" against "08:00 on the 5th" is eight hours out,
 * which is the difference between a delivery that can be reached and one that
 * cannot.
 *
 * Negative when the time has already gone, so the caller can tell "in forty
 * minutes" from "forty minutes ago".
 */
export function minutesUntil(
  dateIso: string,
  clock: string,
  now = new Date(),
): number | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso.trim());
  const time = /^([01]\d|2[0-3]):([0-5]\d)/.exec(clock.trim());
  if (!date || !time) return null;

  // The stop, as an instant, by saying which offset it is written in. +08:00 is
  // fixed all year here: the Philippines has kept no daylight saving since 1978.
  const at = Date.parse(`${dateIso}T${time[1]}:${time[2]}:00+08:00`);
  if (Number.isNaN(at)) return null;

  return Math.round((at - now.getTime()) / 60_000);
}
