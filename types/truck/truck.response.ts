import type { Truck } from "./truck.model";

export interface TruckResponse {
  message?: string;
  data: Truck;
}

export interface TrucksResponse {
  data: Truck[];
}