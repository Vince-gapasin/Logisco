
export interface PickupRecord {
  // Present for pickups that came from the PickupStops table. Bookings made
  // before that table existed have no id, and the crew app falls back to the
  // single pickup line the booking notes carry.
  pickupID?: number;
  warehouse: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  pickupTime: string;
  quantity: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryDestinationRecord {
  branchID?: number;
  branch: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  deliveryTime: string;
  quantity: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryRecord {
  id: string | number;
  clientName: string;
  clientEmail?: string;
  bookingId: string;
  address: string;
  dateTime: string;
  status: string; 
  current_step?: number; 
  pickupCompletedAt?: string | null;
  scheduledDate: string;
  pickupTime: string;
  deliveryTime: string;
  pickupAddress: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
  driver: string;
  helper: string;
  helper2?: string;
  assignedVehicle: string;
  product: string;
  quantity?: string;
  priorityLevel?: string;
  notes: string;
  dispatchNote?: string; 
  pod_url?: string;      
  multiplePickups?: PickupRecord[];
  multipleDeliveries?: DeliveryDestinationRecord[];
  localUpdatedAt?: number;
  /**
   * Why this trip cannot start yet, when it cannot: somebody assigned to it has
   * not accepted. Worded by the server for whoever is reading it.
   */
  startBlockedReason?: string | null;
}

export interface RouteStop {
  title: string;
  type: "base" | "pickup" | "delivery";
  reqPod: boolean;
  /** The pickup or delivery row behind it, when this step has one. */
  data?: PickupRecord | DeliveryDestinationRecord;
}
