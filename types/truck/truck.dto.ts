import type { TruckType, TruckStatus } from "./truck.model";

export interface CreateTruckDto {
  plateNumber: string;
  truckType: TruckType;
  model?: string;
  capacity: number;
  lastChecked?: string | null;
  truckStatus?: TruckStatus;
  subconID?: string | null;
}

export type UpdateTruckDto = Partial<CreateTruckDto>;