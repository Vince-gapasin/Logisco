export type TruckType = 
  | "Closed Van" | "Wing Van" | "Dry Van" | "Refrigerated Truck"
  | "Boom Truck" | "Flatbed Truck" | "Dump Truck" | "Trailer Truck"
  | "Tanker Truck" | "Pickup Truck" | "Others";

export type TruckStatus = "Available" | "On Maintenance" | "On Delivery" | "Out of Service";

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
  /** What it burns. Null means nobody has recorded it, not that it is diesel. */
  fuelTypeID: string | null;
  /** Joined from FuelType when the fleet is read, for display. */
  fuelType?: { name: string; unit: string } | null;
}