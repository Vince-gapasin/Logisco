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
});

// ==========================================
// MAIN ORDER SCHEMA
// ==========================================

export const createOrderSchema = z.object({
  clientID: z.string().uuid("Invalid client ID format").nullable().optional(),
  notes: z.string().optional().default(""),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  stops: z.array(branchStopSchema).min(1, "At least one stop is required"),
});