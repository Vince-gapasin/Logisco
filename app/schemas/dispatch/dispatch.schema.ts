import { z } from "zod";

export const assignDispatchSchema = z.object({
  truckID: z.string().uuid("Invalid Truck ID"),
  driverID: z.string().uuid("Invalid Driver ID"),
  totalCargoWeight: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "Cargo weight cannot be negative")
  ),
});