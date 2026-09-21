// ==========================================
// MODELS (Matches Supabase Schema)
// ==========================================

export interface OrderItem {
  orderDetailID?: string;
  orderID?: string;
  productName: string;
  productType: string;
  quantity: number;
  weightPerItem: number;
}

export interface BranchStop {
  stopID?: string;
  branchID?: number;
  orderID?: string;
  dispatchID?: string | null;
  branchName: string;
  deliveryAddress?: string | null;
  contactPerson: string;
  contactNum: string;
  notes?: string;
  deliveryLat?: number;
  deliverLong?: number;
  expectedTime: string;
  sequence?: number | null;
  stopStatus?: string;
  arrivedAt?: string | null;
  completedAt?: string | null;
}

// The collection half of the itinerary. Until the PickupStops table existed
// this was a line of prose inside Order.notes and everything after the first
// pickup was thrown away on save.
export interface PickupStop {
  pickupID?: number;
  orderID?: string;
  dispatchID?: string | null;
  warehouseID?: string | null;
  warehouseName: string;
  pickupAddress?: string | null;
  contactPerson?: string | null;
  contactNum?: string | null;
  expectedTime?: string | null;
  pickupLat?: number | null;
  pickupLong?: number | null;
  sequence?: number | null;
  stopStatus?: string;
  arrivedAt?: string | null;
  completedAt?: string | null;
}

export interface Order {
  orderID: string;
  clientID: string | null;
  orderCode: string;
  orderLinkToken: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  driverConfirmed?: boolean;
  helperConfirmed?: boolean;
  // Relational joins
  Client?: { company: string };
  OrderDetails?: OrderItem[];
  BranchStops?: BranchStop[];
  PickupStops?: PickupStop[];
}

// ==========================================
// DATA TRANSFER OBJECTS (DTOs for POST)
// ==========================================

export interface CreateOrderItemDto {
  productName: string;
  productType?: string;
  quantity: number;
  weightPerItem?: number;
}

export interface CreateBranchStopDto {
  branchName: string;
  contactPerson: string;
  contactNum: string;
  expectedTime: string;
  deliveryAddress?: string;
  quantity?: number;
}

export interface CreatePickupStopDto {
  warehouseID?: string | null;
  warehouseName: string;
  pickupAddress?: string;
  contactPerson?: string;
  contactNum?: string;
  expectedTime?: string;
  quantity?: number;
}

export interface CreateOrderDto {
  clientID?: string | null;
  notes?: string;
  items: CreateOrderItemDto[];
  stops: CreateBranchStopDto[];
  pickups?: CreatePickupStopDto[];
}

// ==========================================
// RESPONSE FORMATS
// ==========================================

export interface OrderResponse {
  message: string;
  orderID: string;
  orderCode: string;
  trackingToken: string;
}

export interface OrdersResponse {
  data: Order[];
}