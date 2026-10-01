import type { TruckType, TruckStatus } from "./truck.model";

export interface CreateTruckDto {
  plateNumber: string;
  truckType: TruckType;
  model?: string;
  capacity: number;
  lastChecked?: string | null;
  truckStatus?: TruckStatus;
  subconID?: string | null;
  /** What it burns. Null means nobody has recorded it, not that it is diesel. */
  fuelTypeID?: string | null;
}

export type UpdateTruckDto = Partial<CreateTruckDto>;