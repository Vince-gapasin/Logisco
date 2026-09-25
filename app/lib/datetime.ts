// Times as people read them here: "8:00 AM", not "08:00".
//
// The database keeps 24-hour times, and so does anything that sorts or
// positions by them (the calendars compare "08:00" with "14:30", and a time
// input only accepts 24-hour). Only what is shown passes through here.

const TIME_PATTERN = /^(\d{1,2}):(\d{2})/;

// Every time this system shows is a time in the Philippines, and half of them
// are rendered by a server in UTC - the tracking email, the client's tracking
// page, a booking's history. Left to the machine's own zone, a delivery made
// at 1:05 PM reached the client's inbox as 5:05 AM. The zone is stated, so it
// reads the same wherever it was rendered.
const ZONE = "Asia/Manila";

/**
 * "08:00", "08:00:00" or a full timestamp as "8:00 AM". Anything it cannot
 * read is handed back untouched, so a stray value never becomes "Invalid
 * Date" on a screen.
 */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";

  const clock = TIME_PATTERN.exec(value.trim());
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = clock[2];
    if (hours > 23 || Number(minutes) > 59) return value;
    const period = hours < 12 ? "AM" : "PM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${minutes} ${period}`;
  }

  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) return value;
  return stamp.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: ZONE });
}

/** A date and time together: "22 Sep 2026, 8:00 AM". */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) return value;
  return stamp.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE });
}
