import { z } from "zod";
import { MIN_QUANTITY, normalizePhone, PHONE_RULE } from "@/app/lib/bookingRules";

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

const branchStopSchema = z.object({
  branchName: z.string().min(1, "Branch/Stop name is required").trim(),
  contactPerson: z.string().min(1, "Contact person is required").trim(),
  contactNum: phone,
  expectedTime: z.string().min(1, "Expected time is required").trim(),
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
  expectedTime: z.string().trim().optional(),
  quantity: stopQuantity,
});

// ==========================================
// MAIN ORDER SCHEMA
// ==========================================

export const createOrderSchema = z.object({
  clientID: z.string().uuid("Invalid client ID format").nullable().optional(),
  notes: z.string().optional().default(""),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  stops: z.array(branchStopSchema).min(1, "At least one stop is required"),

  // Optional so older clients that still only send the notes line keep working.
  pickups: z.array(pickupStopSchema).optional().default([]),
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
    deliverySchedule: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30")
      .optional(),
    priorityLevel: z.enum(PRIORITY_LEVELS).optional(),
    product: z.string().trim().min(1, "Product cannot be empty").max(200).optional(),
    notes: z.string().trim().max(2000, "Keep the notes under 2000 characters").optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to change.",
  });

export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
