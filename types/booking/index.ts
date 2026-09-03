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
  orderID?: string;
  branchName: string;
  contactPerson: string;
  contactNum: string;
  notes?: string;
  deliveryLat?: number;
  deliverLong?: number;
  expectedTime: string;
  stopStatus?: string;
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
}

export interface CreateOrderDto {
  clientID?: string | null;
  notes?: string;
  items: CreateOrderItemDto[];
  stops: CreateBranchStopDto[];
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