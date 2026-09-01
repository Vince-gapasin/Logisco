import { z } from "zod";

const validTruckTypes = [
  "Closed Van", "Wing Van", "Dry Van", "Refrigerated Truck",
  "Boom Truck", "Flatbed Truck", "Dump Truck", "Trailer Truck",
  "Tanker Truck", "Pickup Truck", "Others"
] as const;

export const createTruckSchema = z.object({
  plateNumber: z.string().min(1, "Plate number is required").trim(),
  
  truckType: z.preprocess(
    (val) => (val === "Other" ? "Others" : val),
    z.enum(validTruckTypes, {
      message: "Invalid truck type",
    })
  ),
  
  model: z.string().trim().default(""),
  
  // Replicates parseFloat(safeCapacity.replace(/[^0-9.]/g, ''))
  capacity: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        const parsed = parseFloat(val.replace(/[^0-9.]/g, ""));
        return isNaN(parsed) ? 0 : parsed;
      }
      return val;
    },
    z.number().min(0, "Capacity cannot be negative")
  ),
  
  lastChecked: z.string().nullable().optional(),
  
  truckStatus: z.preprocess(
    (val) => (val === "Operational" ? "Available" : val),
    z.enum(["Available", "In Use", "Maintenance", "Out of Service"]).default("Available")
  ),
  
  subconID: z.string().uuid("Invalid Subcontractor ID").nullable().optional(),
});

export const updateTruckSchema = createTruckSchema.partial();