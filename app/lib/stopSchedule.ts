// When each stop on a booking is due: a date and a time, checked as one.
//
// WHY THIS EXISTS
//
// A stop used to carry a time of day and nothing else, and the date lived once
// on the order. Every stop's day was guessed from the order of the times - a
// stop earlier on the clock than the one before it was "the next morning" -
// and the guess could only stretch across one midnight. Bookings run for up to
// a week, which that could not write down, and a typo (03:05 for 15:05) passed
// as an overnight run nobody meant.
//
// Each stop now has its own date. Nothing is guessed for a new booking: a stop
// with no date of its own is on the same day as the stop before it, and one
// earlier on the clock than that stop is an error the coordinator resolves by
// choosing the next day on purpose.
//
// The guess survives in one place only, legacyStopDates, for bookings stored
// before stops had dates - so they keep meaning what they always meant.
//
// One set of rules, imported by the booking form and the server alike, so a
// schedule the form accepts is one the server accepts, in the same words.

import {
  addDays,
  isRealDate,
  isTooFarAhead,
  isValidClockTime,
  PAST_TIME_RULE,
  stopTimeHasPassed,
  TOO_FAR_RULE,
} from "@/app/lib/bookingRules";
import { buildItinerary, clockMinutes } from "@/app/lib/deliveryFeasibility";
import { todayInManila } from "@/app/lib/datetime";

/** A booking runs on at most this many calendar days: Day 1 to Day 7. */
export const MAX_RUN_DAYS = 7;

export const RUN_TOO_LONG_RULE = `More than ${MAX_RUN_DAYS} days from the first stop`;
export const SAME_TIME_RULE = "Same time as the stop before it";
export const EARLIER_RULE = "Earlier than the stop before it";
export const EARLIER_SAME_DAY_RULE = `${EARLIER_RULE} - set it to the next day if that is right`;
export const BOOKING_DATE_RULE = "The first stop is on the booking's date";
export const NO_DATE_RULE = "That date does not exist";
export const PAST_DATE_RULE = "That date has already passed";

export interface ScheduledStop {
  /** YYYY-MM-DD, or empty for "the same day as the stop before it". */
  date?: string | null;
  /** HH:mm (or HH:mm:ss). Its format is checked by the field rules, not here. */
  time?: string | null;
}

export interface StopIssue {
  /** Position in route order: pickups first, then deliveries. */
  index: number;
  field: "date" | "time";
  message: string;
}

export interface StopSchedule {
  /** Each stop's date, filled in where it was left to follow the stop before. */
  dates: string[];
  /**
   * Each stop as minutes since the epoch, or null when its date or time is not
   * readable. The drive check measures real gaps from these.
   */
  moments: (number | null)[];
  /** The day the booking is for: always the first stop's. */
  bookingDate: string | null;
  issues: StopIssue[];
}

const blank = (value: string | null | undefined) => !(value ?? "").trim();

/** A stop's date and time as minutes since the epoch, read in Manila. */
export function stopMoment(date: string, time: string): number | null {
  if (!isRealDate(date) || !isValidClockTime(time)) return null;
  const clock = time.trim().slice(0, 5);
  // +08:00 all year: the Philippines has kept no daylight saving since 1978.
  const at = Date.parse(`${date.trim()}T${clock}:00+08:00`);
  return Number.isNaN(at) ? null : Math.round(at / 60_000);
}

/**
 * Each stop's date: its own, or else the date of the stop before it. The first
 * stop falls back to the booking's date. Nothing rolls to the next day here -
 * that is a choice, not a guess.
 */
export function resolveStopDates(stops: ScheduledStop[], bookingDate?: string | null): string[] {
  const dates: string[] = [];
  stops.forEach((stop, index) => {
    const own = (stop.date ?? "").trim();
    const previous = index === 0 ? (bookingDate ?? "").trim() : dates[index - 1];
    dates.push(own || previous);
  });
  return dates;
}

/**
 * Every rule about when a booking's stops are due, in route order.
 *
 * 1. Each date is on the calendar, not gone, and not a year out.
 * 2. Each stop comes strictly after the one before it - the same minute is two
 *    places at once, and earlier is either a typo or the next day, which has to
 *    be said rather than assumed.
 * 3. The first stop is not already behind the clock.
 * 4. The whole run fits in MAX_RUN_DAYS calendar days.
 * 5. The first stop is on the booking's date, when a booking date is given.
 *
 * Issues are reported on the field that has to change. A stop whose date or
 * time cannot be read is left to the field rules and skipped here, so one bad
 * cell does not make its neighbours read as wrong.
 */
export function checkStopSchedule(
  stops: ScheduledStop[],
  options: { bookingDate?: string | null; now?: Date } = {},
): StopSchedule {
  const now = options.now ?? new Date();
  const today = todayInManila(now);
  const dates = resolveStopDates(stops, options.bookingDate);
  const issues: StopIssue[] = [];
  const flagged = new Set<string>();
  const flag = (index: number, field: StopIssue["field"], message: string) => {
    const key = `${index}:${field}`;
    if (flagged.has(key)) return;
    flagged.add(key);
    issues.push({ index, field, message });
  };

  // 1. The dates themselves. Only a stop's own date is reported: one that
  // follows the stop before it is that stop's problem, not a second one.
  dates.forEach((date, index) => {
    if (blank(stops[index].date) && index > 0) return;
    if (blank(date)) return;
    if (!isRealDate(date)) flag(index, "date", NO_DATE_RULE);
    else if (date < today) flag(index, "date", PAST_DATE_RULE);
    else if (isTooFarAhead(date, today)) flag(index, "date", TOO_FAR_RULE);
  });

  // 5. The booking's date is the first stop's. Given both, they must agree.
  const firstOwn = (stops[0]?.date ?? "").trim();
  const booking = (options.bookingDate ?? "").trim();
  if (firstOwn && booking && firstOwn !== booking) flag(0, "date", BOOKING_DATE_RULE);

  const moments = stops.map((stop, index) =>
    flagged.has(`${index}:date`) ? null : stopMoment(dates[index], stop.time ?? ""),
  );

  // 2. Each stop against the latest stop before it that could be read. The
  // latest, not merely the last: after one stop typed too early, the next is
  // still measured against where the run really was, so a single typo is
  // reported once rather than on every stop that follows it.
  let latest = -1;
  moments.forEach((moment, index) => {
    if (moment === null) return;
    if (latest !== -1) {
      const before = moments[latest] as number;
      if (moment === before) flag(index, "time", SAME_TIME_RULE);
      else if (moment < before) {
        flag(index, "time", dates[index] === dates[latest] ? EARLIER_SAME_DAY_RULE : EARLIER_RULE);
      }
    }
    if (latest === -1 || moment > (moments[latest] as number)) latest = index;
  });

  // 3. The first stop, when it can be read and is not already flagged.
  const first = moments.findIndex((moment) => moment !== null);
  if (first === 0 && !flagged.has("0:time") && stopTimeHasPassed(dates[0], stops[0].time ?? "", now)) {
    flag(0, "time", PAST_TIME_RULE);
  }

  // 4. The run, from the first stop's day to each later stop's. The first stop
  // past the limit is reported; the ones after it follow from it.
  const startDay = dates[0];
  if (isRealDate(startDay)) {
    const lastDay = addDays(startDay, MAX_RUN_DAYS - 1);
    const beyond = dates.findIndex((date, index) => index > 0 && isRealDate(date) && date > lastDay);
    if (beyond !== -1) flag(beyond, "date", RUN_TOO_LONG_RULE);
  }

  return {
    dates,
    moments,
    bookingDate: isRealDate(startDay) ? startDay : null,
    issues,
  };
}

/**
 * The schedule of a booking as it is submitted, dated or not.
 *
 * A submission whose stops carry dates is held to every rule as it stands.
 * One with no dates at all - the booking form before it had a date on each
 * row, or anything else written for that contract - is read the way it always
 * was: the booking's date, a day later each time the clock goes backwards. Its
 * dates are filled in from that reading, so every booking stores a date on
 * every stop from now on, and "dated" says which of the two it was: only a
 * dated schedule hands its moments to the drive check, so an undated one keeps
 * the old reading there too, including its refusal of a second midnight.
 *
 * In an undated submission the dates were never typed, so nothing is reported
 * against them - a bad booking date is the booking date's own error.
 */
export function scheduleForBooking(
  stops: ScheduledStop[],
  bookingDate: string,
  now: Date = new Date(),
): StopSchedule & { dated: boolean } {
  const dated = stops.some((stop) => !blank(stop.date));
  if (dated) return { ...checkStopSchedule(stops, { bookingDate, now }), dated };

  const legacy = isRealDate(bookingDate) ? legacyStopDates(bookingDate, stops.map((stop) => stop.time)) : [];
  const filled = stops.map((stop, index) => ({ ...stop, date: legacy[index] ?? "" }));
  const schedule = checkStopSchedule(filled, { bookingDate, now });
  return { ...schedule, issues: schedule.issues.filter((issue) => issue.field === "time"), dated };
}

/**
 * Each stop's date for a booking stored before stops had dates: the order's
 * date, rolling forward a day each time a stop is earlier on the clock than
 * the one before it - the reading those bookings were made under.
 *
 * Without this, everything that judges a stop by when it was due (punctuality,
 * stall alerts) read a 03:00 drop on an overnight run as due at 03:00 on the
 * first day, a full day before it was.
 */
export function legacyStopDates(bookingDate: string, times: (string | null | undefined)[]): string[] {
  // A stop with no readable time takes the clock of the stop before it, so it
  // stays on that stop's day rather than starting one of its own.
  const clock: number[] = [];
  times.forEach((time, index) => {
    const minutes = clockMinutes(time);
    clock.push(minutes ?? (index > 0 ? clock[index - 1] : 0));
  });
  const { absolute } = buildItinerary(clock);
  return absolute.map((minutes) => addDays(bookingDate, Math.floor(minutes / (24 * 60))));
}

export interface RouteStopRow {
  expectedTime?: string | null;
  expectedDate?: string | null;
  sequence?: number | null;
}

/**
 * The day each delivery stop on one booking is due, by branchID: its own date
 * when it has one, else read off the whole route - pickups first, both halves
 * in sequence - the way that booking was made.
 *
 * The pickups matter even though only the deliveries are returned. On an
 * older overnight booking the midnight falls between them: a 21:00 collection
 * and a 03:00 drop put the drop on the second day, and read without the
 * collection it would land on the first, a full day early.
 */
export function routeDueDates<Id>(
  orderDate: string,
  pickups: RouteStopRow[],
  branches: (RouteStopRow & { branchID: Id })[],
): Map<Id, string> {
  const inSequence = <Row extends RouteStopRow>(rows: Row[]) =>
    [...rows].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const orderedPickups = inSequence(pickups);
  const orderedBranches = inSequence(branches);
  const dates = effectiveStopDates(
    orderDate,
    [...orderedPickups, ...orderedBranches].map((stop) => ({ date: stop.expectedDate, time: stop.expectedTime })),
  );
  return new Map(orderedBranches.map((stop, index) => [stop.branchID, dates[orderedPickups.length + index]]));
}

/**
 * The date each stop is due, however it was stored: its own date when it has
 * one, else the order's date read the way that booking was made. Partly dated
 * stops - written halfway - follow the stop before them.
 */
export function effectiveStopDates(
  bookingDate: string,
  stops: { date?: string | null; time?: string | null }[],
): string[] {
  if (stops.every((stop) => blank(stop.date))) {
    return legacyStopDates(bookingDate, stops.map((stop) => stop.time));
  }
  return resolveStopDates(stops, bookingDate);
}
