// Rules the booking forms and the server both apply, so a number the form
// accepts is one the server accepts.

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
