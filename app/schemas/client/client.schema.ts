import { z } from "zod";

// ==========================================
// WAREHOUSE (PICKUP) & BRANCH (DELIVERY)
// ==========================================

const warehouseSchema = z.object({
  warehouseName: z.string().min(1, "Warehouse name is required").trim(),
  warehouseAddress: z.string().min(1, "Warehouse address is required").trim(),
  contactPerson: z.string().min(1, "Contact person is required").trim(),
  contactNumber: z.string().min(1, "Contact number is required").trim(),
});

const branchSchema = z.object({
  branchName: z.string().min(1, "Branch name is required").trim(),
  deliveryAddress: z.string().min(1, "Delivery address is required").trim(),
  contactPerson: z.string().min(1, "Contact person is required").trim(),
  contactNumber: z.string().min(1, "Contact number is required").trim(),
});

// ==========================================
// CLIENT SCHEMA
// ==========================================

export const createClientSchema = z.object({
  name: z.string().min(1, "Company name is required").trim(),
  contactName: z.string().min(1, "Contact name is required").trim(),
  contactNumber: z.string().min(1, "Contact number is required").trim(),
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
  contactNumber: z.string().min(1, "Contact number is required").trim(),
  emailAddress: z.string().email("Invalid email format").trim(),
  businessAddress: z.string().min(1, "Business address is required").trim(),
});

// ==========================================
// UPDATE SCHEMAS
// ==========================================

export const updateClientSchema = createClientSchema.partial();
export const updatePartnerSchema = createPartnerSchema.partial();