import { supabase } from "@/app/lib/supabase";
import type { Order, CreateOrderDto } from "@/types/booking";

// ==========================================
// HELPERS
// ==========================================

const generateOrderCode = (): string => {
  const timestampPart = Date.now().toString().slice(-6);
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestampPart}-${randomPart}`;
};

// ==========================================
// BOOKINGS (ORDERS) SERVICE
// ==========================================

export async function getBookings(): Promise<Order[]> {
const { data, error } = await supabase
      .from("Order")
      .select(`
        *,
        Client (*),
        OrderDetails (*),
        BranchStops (*),
        DispatchOrder (
          *,
          Truck (plateNumber, model),
          Driver:Employee!driverID (employeeName)
        )
      `)
      .order('createdAt', { ascending: false });

  if (error) {
    throw error;
  }

  return data as Order[];
}

export async function createBooking(dto: CreateOrderDto) {
  // 1. Generate Unique Identifiers
  const orderCode = generateOrderCode();
  const orderLinkToken = crypto.randomUUID(); 

  // 2. Insert the Main Order
  const { data: orderData, error: orderError } = await supabase
    .from("Order")
    .insert([
      {
        clientID: dto.clientID || null, // Allows NULL for walk-in / On-Call
        orderCode,
        orderLinkToken,
        notes: dto.notes || "",
        isActive: true,
      },
    ])
    .select()
    .single();

  if (orderError || !orderData) {
    console.error("Order Insert Error:", orderError);
    throw new Error(orderError?.message || "Failed to create main order");
  }

  const newOrderID = orderData.orderID;

  // 3. Insert the Cargo (OrderDetails)
  if (dto.items && dto.items.length > 0) {
    const formattedItems = dto.items.map((item) => ({
      orderID: newOrderID,
      productName: item.productName || "Unknown Cargo",
      productType: item.productType || "General",
      quantity: item.quantity,
      weightPerItem: item.weightPerItem || 0,
    }));

    const { error: itemsError } = await supabase
      .from("OrderDetails")
      .insert(formattedItems);

    if (itemsError) {
      console.error("OrderDetails Insert Error:", itemsError);
      // Depending on your strictness, you might want to rollback the Order here if this fails
      throw new Error("Failed to insert order items");
    }
  }

  // 4. Insert the Itinerary (BranchStops)
  if (dto.stops && dto.stops.length > 0) {
    const formattedStops = dto.stops.map((stop) => ({
      orderID: newOrderID,
      branchName: stop.branchName || "Unknown Stop",
      contactPerson: stop.contactPerson || "",
      contactNum: stop.contactNum || "",
      notes: "", 
      deliveryLat: 0,
      deliverLong: 0,
      expectedTime: stop.expectedTime || "12:00:00",
      stopStatus: "Pending",
    }));

    const { error: stopsError } = await supabase
      .from("BranchStops")
      .insert(formattedStops);

    if (stopsError) {
      console.error("BranchStops Insert Error:", stopsError);
      throw new Error("Failed to insert delivery itinerary");
    }
  }

  // Return exactly what the UI needs for the Success Modal
  return {
    message: "Order created successfully!",
    orderID: newOrderID,
    orderCode: orderCode,
    trackingToken: orderLinkToken,
  };
}