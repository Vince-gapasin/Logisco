export interface AssignDispatchDto {
  truckID: string;
  driverID: string;
  totalCargoWeight: number;
}

export interface AssignDispatchDto {
  truckID: string;
  driverID: string;
  helper1ID?: string | null;
  helper2ID?: string | null;
  totalCargoWeight: number;
}