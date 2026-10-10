// What a truck record has to make sense of, checked the same way by the truck
// form and the server.
//
// Capacity was free text and the form asked only that it was filled in. The
// server then stripped everything but digits and dots, so "-5" became a 5 kg
// truck, "0" a truck that carries nothing, and "abc" came back as "Capacity
// is required" to someone who had typed something. Plates were stored as
// typed - "qat 9999" beside every NKA-7536 - and the truck type was whatever
// was sent.

import { isRealDate } from "@/app/lib/bookingRules";

export const TRUCK_TYPES = [
  "Closed Van",
  "Wing Van",
  "Dry Van",
  "Refrigerated Truck",
  "Boom Truck",
  "Flatbed Truck",
  "Dump Truck",
  "Trailer Truck",
  "Tanker Truck",
  "Pickup Truck",
  "Other",
] as const;

// "Others" is what older records hold; it means "Other".
const ACCEPTED_TYPES = new Set<string>([...TRUCK_TYPES, "Others"]);

export const CAPACITY_RULE = "Capacity in kilograms, more than 0 - like 5000 or 5,000 kg.";
export const PLATE_RULE = "Use a plate number like ABC-1234.";
export const TRUCK_TYPE_RULE = "Choose a type of truck from the list.";
export const LAST_CHECKED_RULE = "Use a real date that has already happened.";

/** The heaviest load the system will take as a capacity, in kilograms. */
const MAX_CAPACITY_KG = 100_000;

/**
 * Kilograms from what was typed - "5000", "5,000 kg", "5000kg" - or null when
 * it is not a capacity: nothing, a negative, zero, or not a number at all.
 */
export function parseCapacity(value: unknown): number | null {
  if (typeof value === "number") return value > 0 && value <= MAX_CAPACITY_KG ? value : null;
  const text = String(value ?? "").trim().toLowerCase().replace(/,/g, "");
  const match = /^(\d+(?:\.\d+)?)\s*(kg|kgs|kilos?|kilograms?)?$/.exec(text);
  if (!match) return null;
  const kg = Number(match[1]);
  return kg > 0 && kg <= MAX_CAPACITY_KG ? kg : null;
}

/**
 * A plate in the fleet's own form: capitals, and letters and digits joined by
 * a hyphen - "qat 9999" and "QAT9999" both become "QAT-9999". Anything that is
 * not that pattern is left in capitals, trimmed, for isValidPlate to judge.
 */
export function normalizePlate(value: string | null | undefined): string {
  const text = String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const standard = /^([A-Z]{2,3})[\s-]*(\d{3,4})$/.exec(text);
  return standard ? `${standard[1]}-${standard[2]}` : text;
}

/** Letters, digits, a hyphen or a space; at least one letter and one digit; 4 to 12 long. */
export function isValidPlate(value: string | null | undefined): boolean {
  const plate = normalizePlate(value);
  return /^[A-Z0-9][A-Z0-9 -]{2,10}[A-Z0-9]$/.test(plate) && /[A-Z]/.test(plate) && /\d/.test(plate);
}

export function isTruckType(value: unknown): boolean {
  return typeof value === "string" && ACCEPTED_TYPES.has(value);
}

/** A last-checked date that exists and is not after today. */
export function isValidLastChecked(value: string | null | undefined, today: string): boolean {
  const day = String(value ?? "").slice(0, 10);
  return isRealDate(day) && day <= today;
}
