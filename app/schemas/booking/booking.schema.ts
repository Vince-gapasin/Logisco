import { z } from "zod";
import { todayInManila } from "@/app/lib/datetime";
import {
  CLOCK_RULE,
  findAddressClashes,
  isQuarterHour,
  isRealDate,
  isTooFarAhead,
  isValidClockTime,
  MIN_QUANTITY,
  normalizePhone,
  PHONE_RULE,
  QUARTER_HOUR_RULE,
  TOO_FAR_RULE,
} from "@/app/lib/bookingRules";
import { scheduleForBooking } from "@/app/lib/stopSchedule";

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
  // Read back off the calendar: Date.parse took 2026-02-30 as 2 March.
  .refine(isRealDate, "That date does not exist");

// Seconds are allowed because the database returns "08:00:00" and an edit
// round-trips what it was given. The rule itself lives in bookingRules, so the
// booking form and this schema cannot drift apart about what a time is.
// Stop times are only ever set here, on a new booking, so the quarter-hour rule
// cannot catch an older booking's 08:10 - nothing sends it back.
const clockTime = z
  .string()
  .trim()
  .refine(isValidClockTime, CLOCK_RULE)
  .refine((value) => !isValidClockTime(value) || isQuarterHour(value), QUARTER_HOUR_RULE);

// Required on both kinds of stop. They were optional here while the booking
// form required them, so anything that skipped the form could send a stop with
// no address - one that is never placed on the map, never routed, and so skips
// the drive check that is the only thing standing between the itinerary and a
// promise the truck cannot keep.
const address = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(500, `Keep the ${label.toLowerCase()} under 500 characters`);

// The day a stop is due. Optional, and blank means "the same day as the stop
// before it" - so a single-day booking never has to say it. Its sense (a real
// day, not gone, in order, within a week) is checked across the whole route
// below, where the stops before it are known.
const stopDate = z.string().trim().max(10, "Use a date like 2026-10-05").optional();

/** Refuses a day that has already gone, read in Manila rather than in UTC. */
const notInThePast = (value: string) => value >= todayInManila();
const PAST_MESSAGE = "That date has already passed";
const notTooFar = (value: string) => !isTooFarAhead(value, todayInManila());

/** A day a delivery can be booked for: real, not gone, and not a year out. */
const bookableDate = isoDate.refine(notInThePast, PAST_MESSAGE).refine(notTooFar, TOO_FAR_RULE);

const branchStopSchema = z.object({
  branchName: z.string().min(1, "Branch/Stop name is required").trim(),
  contactPerson: z.string().min(1, "Contact person is required").trim(),
  contactNum: phone,
  expectedTime: clockTime,
  expectedDate: stopDate,
  quantity: stopQuantity,

  // Geocoded on the server so the stop can be shown on the map and routed.
  deliveryAddress: address("Delivery address"),
});

// A pickup the crew must collect from before delivering. The booking form
// has always collected a list of these; they used to be flattened into one
// line of Order.notes, so everything past the first was lost.
const pickupStopSchema = z.object({
  warehouseID: z.string().uuid().nullable().optional(),
  warehouseName: z.string().min(1, "Warehouse name is required").trim(),
  pickupAddress: address("Pickup address"),
  contactPerson: z.string().trim().optional(),
  contactNum: z.union([z.literal(""), phone]).optional(),
  // Required, as the form requires it. While it was optional here, one pickup without a
  // time made the whole itinerary unreadable and every check on it - the order
  // of the stops, the second midnight, the drive - was skipped in silence.
  expectedTime: clockTime,
  expectedDate: stopDate,
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
  deliverySchedule: bookableDate,

  notes: z.string().optional().default(""),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  stops: z.array(branchStopSchema).min(1, "At least one stop is required"),

  // Optional so older clients that still only send the notes line keep working.
  pickups: z.array(pickupStopSchema).optional().default([]),

  // Sent on the second try, once the coordinator has been told the crew may
  // run late and chose to book it as it stands.
  acknowledgeTightSchedule: z.boolean().optional().default(false),
}).superRefine((order, ctx) => {
  // The same address twice, or a pickup that is also a delivery. Checked by the
  // form, from this same function, and now here too, so it holds for anything
  // that posts here.
  for (const clash of findAddressClashes(
    order.pickups.map((pickup) => ({ address: pickup.pickupAddress })),
    order.stops.map((stop) => ({ address: stop.deliveryAddress })),
  )) {
    ctx.addIssue({
      code: "custom",
      message: clash.message,
      path: clash.section === "pickup" ? ["pickups", clash.index, "pickupAddress"] : ["stops", clash.index, "deliveryAddress"],
    });
  }

  // When each stop is due, in the order the truck drives them: collections
  // first, then drops. The same rule the booking form applies, from the same
  // function - each stop strictly after the one before it, the first not
  // already gone, the run within a week, the first stop on the booking's date.
  // A submission with no stop dates is read the way it always was.
  const pickupCount = order.pickups.length;
  const { issues } = scheduleForBooking(
    [
      ...order.pickups.map((pickup) => ({ date: pickup.expectedDate, time: pickup.expectedTime })),
      ...order.stops.map((stop) => ({ date: stop.expectedDate, time: stop.expectedTime })),
    ],
    order.deliverySchedule,
  );
  for (const issue of issues) {
    const field = issue.field === "date" ? "expectedDate" : "expectedTime";
    ctx.addIssue({
      code: "custom",
      message: issue.message,
      path: issue.index < pickupCount ? ["pickups", issue.index, field] : ["stops", issue.index - pickupCount, field],
    });
  }
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
    deliverySchedule: bookableDate.optional(),
    priorityLevel: z.enum(PRIORITY_LEVELS).optional(),
    product: z.string().trim().min(1, "Product cannot be empty").max(200).optional(),
    notes: z.string().trim().max(2000, "Keep the notes under 2000 characters").optional(),
    // Sent on the second try, once the coordinator moving a booking to today
    // has been told the crew may not make its times and chose to keep them.
    acknowledgeTightSchedule: z.boolean().optional(),
  })
  // The acknowledgement is not a change on its own.
  .refine(
    (value) =>
      Object.entries(value).some(([key, field]) => key !== "acknowledgeTightSchedule" && field !== undefined),
    { message: "Nothing to change." },
  );

export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
