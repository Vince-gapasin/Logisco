import { z } from "zod";

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
  contactNum: z.string().min(1, "Contact number is required").trim(),
  expectedTime: z.string().min(1, "Expected time is required").trim(),

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
  contactNum: z.string().trim().optional(),
  expectedTime: z.string().trim().optional(),
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