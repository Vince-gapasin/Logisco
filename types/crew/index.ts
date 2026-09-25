// What /api/crew/dispatches returns: a trip as the crew screens read it.
//
// The route flattens an order, its trip and its stops into one record, so this
// is that record rather than any table. The crew dashboard keeps a fuller
// shape of its own; this is the part the calendar and the delivery history
// share, and it is what the route actually sends.

export interface CrewStopRecord {
  branchID?: number;
  branch: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  deliveryTime?: string | null;
  quantity?: string | number | null;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CrewPickupRecord {
  pickupID?: number;
  warehouse: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  pickupTime?: string | null;
  quantity?: string | number | null;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CrewDispatchRecord {
  id: string;
  bookingId: string;
  clientName: string;
  clientEmail?: string;
  address?: string;
  status: string;
  current_step?: number;
  scheduledDate?: string;
  timeWindow?: string;
  pickupTime?: string;
  deliveryTime?: string;
  pickupAddress?: string;
  dispatchNote?: string;
  multiplePickups?: CrewPickupRecord[];
  multipleDeliveries?: CrewStopRecord[];
}
