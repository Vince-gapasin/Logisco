import { z } from "zod";
import { normalizePhone, PHONE_RULE } from "@/app/lib/bookingRules";

// Stored as 09XXXXXXXXX, the same rule the booking forms apply.
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

// ==========================================
// WAREHOUSE (PICKUP) & BRANCH (DELIVERY)
// ==========================================

const warehouseSchema = z.object({
  // Present when editing a warehouse the client already has.
  warehouseID: z.string().uuid().optional(),
  warehouseName: z.string().min(1, "Warehouse name is required").trim(),
  warehouseAddress: z.string().min(1, "Warehouse address is required").trim(),
  contactPerson: z.string().min(1, "Contact person is required").trim(),
  contactNumber: phone,
});

const branchSchema = z.object({
  branchID: z.string().uuid().optional(),
  branchName: z.string().min(1, "Branch name is required").trim(),
  deliveryAddress: z.string().min(1, "Delivery address is required").trim(),
  contactPerson: z.string().min(1, "Contact person is required").trim(),
  contactNumber: phone,
});

// ==========================================
// CLIENT SCHEMA
// ==========================================

export const createClientSchema = z.object({
  name: z.string().min(1, "Company name is required").trim(),
  contactName: z.string().min(1, "Contact name is required").trim(),
  contactNumber: phone,
  emailAddress: z.string().email("Invalid email format").trim(),
  businessAddress: z.string().min(1, "Business address is required").trim(),
  
  pickupAddresses: z.array(warehouseSchema).optional().default([]),
  deliveryAddresses: z.array(branchSchema).optional().default([]),
});

// ==========================================
// PARTNER / SUBCONTRACTOR SCHEMA
// ==========================================

export const createPartnerSchema = z.object({
  name: z.string().min(1, "Company/Owner name is required").trim(),
  contractType: z.enum(["Regular", "On-Call", "Seasonal"], { 
    message: "Invalid contract type" 
  }),
  contactPerson: z.string().min(1, "Contact person is required").trim(),
  contactNumber: phone,
  emailAddress: z.string().email("Invalid email format").trim(),
  businessAddress: z.string().min(1, "Business address is required").trim(),
});

// ==========================================
// UPDATE SCHEMAS
// ==========================================

// Addresses have no default here: an update that leaves them out (a status
// change) must not be read as "remove every warehouse and branch".
export const updateClientSchema = createClientSchema
  .omit({ pickupAddresses: true, deliveryAddresses: true })
  .partial()
  .extend({
    pickupAddresses: z.array(warehouseSchema).optional(),
    deliveryAddresses: z.array(branchSchema).optional(),
  });
export const updatePartnerSchema = createPartnerSchema.partial();