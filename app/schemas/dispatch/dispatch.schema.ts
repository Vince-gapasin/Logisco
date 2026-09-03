import { z } from "zod";

export const assignDispatchSchema = z.object({
  truckID: z.string().uuid("Invalid Truck ID"),
  driverID: z.string().uuid("Invalid Driver ID"),
  helper1ID: z.string().uuid("Invalid Helper 1 ID").optional().nullable(),
  helper2ID: z.string().uuid("Invalid Helper 2 ID").optional().nullable(),
  totalCargoWeight: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "Cargo weight cannot be negative").default(0)
  ),
});