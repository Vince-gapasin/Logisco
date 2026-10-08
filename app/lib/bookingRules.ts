// Rules the booking forms and the server both apply, so a number the form
// accepts is one the server accepts.

import { minutesUntil } from "@/app/lib/datetime";

// ------------------------------------------------------------------ phones

export const PHONE_RULE = "Use an 11-digit mobile number starting with 09, e.g. 09171234567.";

/**
 * A Philippine mobile number as 11 digits (09XXXXXXXXX), or null if it is not
 * one. Spaces, dashes, dots and brackets are ignored, and the international
 * form (+63 9XX…, 63 9XX…) is converted, since people type both.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw || /[^\d\s\-().+]/.test(raw)) return null;

  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("639")) digits = `0${digits.slice(2)}`;
  return /^09\d{9}$/.test(digits) ? digits : null;
}

export function isValidPhone(value: string | null | undefined): boolean {
  return normalizePhone(value) !== null;
}

/** Keeps what a phone box can hold: digits, spaces, dashes, brackets and a leading +. */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d\s\-()+]/g, "").slice(0, 17);
}

// ---------------------------------------------------------------- quantity

// A clock on a stop, checked the same way on the form and at the server.
//
// Defined once because the two used to disagree: the form asked only whether
// the field had anything in it, and the server asked nothing at all - so a
// time was whatever reached it, and the only real check was the browser's own
// <input type="time">.
export const CLOCK_RULE = "Needs a valid time";
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function isValidClockTime(value: string | null | undefined): boolean {
  return CLOCK_PATTERN.test((value ?? "").trim());
}

// New schedules are booked on the quarter hour - :00, :15, :30, :45 - which is
// all the time picker offers. Checked separately from CLOCK_RULE so a booking
// made before the rule, at 08:10, is still a valid time wherever it is read.
export const QUARTER_HOUR_RULE = "Pick :00, :15, :30 or :45";
export const QUARTER_MINUTES = [0, 15, 30, 45] as const;

export function isQuarterHour(value: string | null | undefined): boolean {
  if (!isValidClockTime(value)) return false;
  const [, m, s = "00"] = (value ?? "").trim().split(":");
  return Number(m) % 15 === 0 && s === "00";
}

// A booking for today whose first stop is already behind the clock.
//
// The server did refuse this, but only from inside the drive check, which
// needs every address found on the map and a route back from the map service.
// An address that failed to geocode skipped the whole check, so 06:00 booked at
// two in the afternoon went through as "times not checked". It is a fact about
// the clock, not the road, and is checked without either.
//
// Only the first stop in route order: a later stop earlier than now is read as
// the next morning, an overnight run, not as a time that has gone.
export const PAST_TIME_RULE = "That time has already passed";

export function stopTimeHasPassed(dateIso: string, clock: string, now = new Date()): boolean {
  const minutes = minutesUntil(dateIso, clock, now);
  return minutes !== null && minutes < 0;
}

export const MIN_QUANTITY = 1;

/** Keeps a quantity box to whole, positive numbers while typing. */
export function sanitizeQuantityInput(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits === "0" ? "" : digits.slice(0, 7);
}

export function parseQuantity(value: string | number | null | undefined): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isInteger(n) && n >= MIN_QUANTITY ? n : null;
}

// --------------------------------------------------------------- addresses

/** Two addresses written slightly differently still compare equal. */
export function addressKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface AddressRow {
  name?: string | null;
  address?: string | null;
}

export interface AddressClash {
  section: "pickup" | "delivery";
  index: number;
  message: string;
}

/**
 * Rows that repeat an address: twice in the same section, or a pickup that is
 * also a delivery. Each clash names the earlier row it repeats. Blank
 * addresses are left to the required-field check.
 */
export function findAddressClashes(pickups: AddressRow[], deliveries: AddressRow[]): AddressClash[] {
  const seen = new Map<string, { section: "pickup" | "delivery"; index: number }>();
  const clashes: AddressClash[] = [];
  const label = (section: "pickup" | "delivery", index: number) =>
    `${section === "pickup" ? "pickup" : "delivery"} ${index + 1}`;

  const walk = (rows: AddressRow[], section: "pickup" | "delivery") => {
    rows.forEach((row, index) => {
      const key = addressKey(row.address);
      if (!key) return;
      const first = seen.get(key);
      if (first) {
        clashes.push({
          section,
          index,
          message:
            first.section === section
              ? `Same address as ${label(first.section, first.index)}.`
              : `Already used as ${label(first.section, first.index)}. A ${section === "pickup" ? "pickup" : "delivery"} cannot also be a ${first.section}.`,
        });
      } else {
        seen.set(key, { section, index });
      }
    });
  };

  walk(pickups, "pickup");
  walk(deliveries, "delivery");
  return clashes;
}
