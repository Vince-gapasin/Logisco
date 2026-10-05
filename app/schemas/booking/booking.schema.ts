import { z } from "zod";
import { todayInManila } from "@/app/lib/datetime";
import {
  CLOCK_RULE,
  isValidClockTime,
  MIN_QUANTITY,
  normalizePhone,
  PHONE_RULE,
} from "@/app/lib/bookingRules";

// Stored as 09XXXXXXXXX whatever spacing or +63 form was typed.
const phone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: PHONE_RULE });
      return z.NEVER;
    }
    return normalized;
  });

// How many units are collected or dropped at one stop.
const stopQuantity = z.coerce
  .number()
  .int("Quantity must be a whole number")
  .min(MIN_QUANTITY, `Quantity must be at least ${MIN_QUANTITY}`)
  .optional();

// ==========================================
// ORDER ITEMS & STOPS
// ==========================================

const orderItemSchema = z.object({
  productName: z.string().min(1, "Product name is required").trim(),
  productType: z.string().optional().default("General"),
  quantity: z.preprocess(
    (val) => Number(val),
    z.number().min(1, "Quantity must be at least 1")
  ),
  weightPerItem: z.preprocess(
    (val) => Number(val),
    z.number().default(0)
  ),
});

// A date and a clock time, checked rather than taken on trust.
//
// Both of these were strings the server accepted as they came. expectedTime was
// z.string().min(1), so "banana" was a valid delivery time, and the booking
// form's own <input type="time"> was the only thing enforcing a clock - which
// holds for the form and for nothing else that posts here. The schedule was not
// a field at all: it arrived inside the notes blob and was scraped back out
// with a regex that quietly produced null when it did not match, so a booking
// with an unreadable date was stored with no date and simply never appeared on
// the calendar.
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-05")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00`)), "That date does not exist");

// Seconds are allowed because the database returns "08:00:00" and an edit
// round-trips what it was given. The rule itself lives in bookingRules, so the
// booking form and this schema cannot drift apart about what a time is.
const clockTime = z.string().trim().refine(isValidClockTime, CLOCK_RULE);

/** Refuses a day that has already gone, read in Manila rather than in UTC. */
const notInThePast = (value: string) => value >= todayInManila();
const PAST_MESSAGE = "That date has already passed";

const branchStopSchema = z.object({
  branchName: z.string().min(1, "Branch/Stop name is required").trim(),
  contactPerson: z.string().min(1, "Contact person is required").trim(),
  contactNum: phone,
  expectedTime: clockTime,
  quantity: stopQuantity,

  // Optional: geocoded on the server so the stop can be shown on the map.
  deliveryAddress: z.string().trim().optional(),
});

// A pickup the crew must collect from before delivering. The booking form
// has always collected a list of these; they used to be flattened into one
// line of Order.notes, so everything past the first was lost.
const pickupStopSchema = z.object({
  warehouseID: z.string().uuid().nullable().optional(),
  warehouseName: z.string().min(1, "Warehouse name is required").trim(),
  pickupAddress: z.string().trim().optional(),
  contactPerson: z.string().trim().optional(),
  contactNum: z.union([z.literal(""), phone]).optional(),
  expectedTime: z.union([z.literal(""), clockTime]).optional(),
  quantity: stopQuantity,
});

// ==========================================
// MAIN ORDER SCHEMA
// ==========================================

export const createOrderSchema = z.object({
  clientID: z.string().uuid("Invalid client ID format").nullable().optional(),

  // The day the delivery is for. A real field now, so the server decides
  // whether it is a date and whether it has passed, instead of reading
  // whatever the browser happened to write into the notes.
  deliverySchedule: isoDate.refine(notInThePast, PAST_MESSAGE),

  notes: z.string().optional().default(""),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  stops: z.array(branchStopSchema).min(1, "At least one stop is required"),

  // Optional so older clients that still only send the notes line keep working.
  pickups: z.array(pickupStopSchema).optional().default([]),

  // Sent on the second try, once the coordinator has been told the crew may
  // run late and chose to book it as it stands.
  acknowledgeTightSchedule: z.boolean().optional().default(false),
});
// ==========================================
// EDITING A BOOKING AFTER IT IS MADE
// ==========================================
// Only what belongs to the booking itself. A client's contact details and
// addresses belong to the client record and are edited under Clients &
// Partners, so changing one booking never quietly rewrites another.

export const PRIORITY_LEVELS = ["Standard", "Urgent", "High Priority"] as const;

export const updateOrderSchema = z
  .object({
    // Rescheduling is the other way a booking gets a date, and it was checked
    // for shape but not for sense - a delivery could be moved into last year.
    deliverySchedule: isoDate.refine(notInThePast, PAST_MESSAGE).optional(),
    priorityLevel: z.enum(PRIORITY_LEVELS).optional(),
    product: z.string().trim().min(1, "Product cannot be empty").max(200).optional(),
    notes: z.string().trim().max(2000, "Keep the notes under 2000 characters").optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to change.",
  });

export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
