export type TruckType = 
  | "Closed Van" | "Wing Van" | "Dry Van" | "Refrigerated Truck"
  | "Boom Truck" | "Flatbed Truck" | "Dump Truck" | "Trailer Truck"
  | "Tanker Truck" | "Pickup Truck" | "Others";

export type TruckStatus = "Available" | "In Use" | "Maintenance" | "Out of Service";

export interface Truck {
  truckID: string;
  subconID: string | null;
  truckCode: string;
  plateNumber: string;
  model: string;
  capacity: number;
  truckType: TruckType;
  truckStatus: TruckStatus;
  lastChecked: string | null;
  isActive: boolean;
}