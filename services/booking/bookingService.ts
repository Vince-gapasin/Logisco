import { supabase } from "@/app/lib/supabase";
import { geocodeAddresses } from "@/services/geo/geocodingService";
import { DELIVERY_STATUS, STOP_STATUS } from "@/app/lib/enums";
import { releaseDispatchResources } from "@/services/dispatch/dispatchService";
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

// Only the columns the booking screens actually read. Selecting "*" across
// four nested relations pulled every column of every related row - including
// the customer tracking token - on every page load.
const BOOKING_COLUMNS = `
  orderID,
  orderCode,
  notes,
  createdAt,
  isActive,
  clientID,
  Client ( clientID, company, contactName, contact, emailAdd, businessAdd ),
  OrderDetails ( itemID, productName, productType, quantity, weightPerItem ),
  BranchStops ( branchID, branchName, contactPerson, contactNum, expectedTime, stopStatus, deliveryLat, deliverLong, dispatchID ),
  DispatchOrder (
    dispatchID,
    dispatchCode,
    status,
    current_step,
    completedAt,
    dispatchNote,
    rejectionreason,
    truckID,
    driverID,
    Truck ( plateNumber, model ),
    Driver:Employee!driverID ( employeeName ),
    DispatchHelper ( helperID, status, declinereason, Helper:Employee!helperID ( employeeName ) )
  )
`;

// Dispatch statuses behind each booking screen, so the database does the
// filtering instead of every screen downloading every order.
const STAGE_STATUSES: Record<string, string[]> = {
  "awaiting-crew": ["Pending", "Assigned"],
  departing: ["Pending", "Assigned", "Accepted"],
  "in-transit": ["In Transit"],
  completed: ["Completed", "Delivered", "Returned"],
  "foul-trip": ["Foul Trip"],
  cancelled: ["Cancelled"],
};

const DEFAULT_STAGE_LIMIT = 300;

export interface BookingQuery {
  /** A key of STAGE_STATUSES, "unassigned", or undefined for every order. */
  stage?: string;
  limit?: number;
}

// Orders with no dispatch yet, or whose only dispatches were rejected.
// Resolved in two cheap steps: ids first, then the full rows for those ids.
async function getUnassignedBookings(limit: number): Promise<Order[]> {
  const { data: candidates, error } = await supabase
    .from("Order")
    .select("orderID, createdAt, DispatchOrder ( status )")
    .eq("isActive", true)
    .order("createdAt", { ascending: false });

  if (error) throw error;

  const orderIDs = (candidates ?? [])
    .filter((order: any) => {
      const dispatches: any[] = Array.isArray(order.DispatchOrder) ? order.DispatchOrder : [];
      return dispatches.every((dispatch) => dispatch?.status === DELIVERY_STATUS.rejected);
    })
    .slice(0, limit)
    .map((order: any) => order.orderID);

  if (orderIDs.length === 0) return [];

  const { data, error: rowsError } = await supabase
    .from("Order")
    .select(BOOKING_COLUMNS)
    .in("orderID", orderIDs)
    .order("createdAt", { ascending: false });

  if (rowsError) throw rowsError;
  return (data ?? []) as unknown as Order[];
}

export async function getBookings(query: BookingQuery = {}): Promise<Order[]> {
  const limit = query.limit && query.limit > 0 ? query.limit : DEFAULT_STAGE_LIMIT;

  if (query.stage === "unassigned") {
    return getUnassignedBookings(limit);
  }

  // A stage maps to dispatch statuses: an inner join keeps only matching orders.
  const statuses = query.stage ? STAGE_STATUSES[query.stage] : undefined;
  if (statuses) {
    const { data, error } = await supabase
      .from("Order")
      .select(BOOKING_COLUMNS.replace("DispatchOrder (", "DispatchOrder!inner ("))
      .eq("isActive", true)
      .in("DispatchOrder.status", statuses)
      .order("createdAt", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as unknown as Order[];
  }

  // No stage: every order, paged. Used by the dashboard and reports, which
  // aggregate across all history.
  const batchSize = 1000;
  let start = 0;
  const allBookings: Order[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("Order")
      .select(BOOKING_COLUMNS)
      .order("createdAt", { ascending: false })
      .range(start, start + batchSize - 1);

    if (error) {
      throw error;
    }

    const batch = (data ?? []) as unknown as Order[];
    allBookings.push(...batch);

    if (batch.length < batchSize) {
      break;
    }

    start += batchSize;
  }

  return allBookings;
}

// supabase-js has no transactions: if a later insert fails, remove what was
// already written so a half-created order never shows up in the queues.
async function rollbackOrder(orderID: string) {
  await supabase.from("BranchStops").delete().eq("orderID", orderID);
  await supabase.from("OrderDetails").delete().eq("orderID", orderID);
  const { error } = await supabase.from("Order").delete().eq("orderID", orderID);
  if (error) console.error("Order rollback failed:", error.message);
}

// ==========================================
// SINGLE BOOKING
// ==========================================
export async function getBookingById(orderID: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("Order")
    .select(
      `*, Client (*), OrderDetails (*), BranchStops (*),
        DispatchOrder ( *, Truck ( plateNumber, model ),
          Driver:Employee!driverID ( employeeName, contact ),
          DispatchHelper ( helperID, status, Helper:Employee!helperID ( employeeName ) ) )`,
    )
    .eq("orderID", orderID)
    .maybeSingle();

  if (error) throw error;
  return (data as Order) ?? null;
}

// ==========================================
// CANCEL BOOKING
// ==========================================
// Deactivates the order and rejects any dispatch that has not left yet,
// returning the truck and crew to the pool. A trip that is already on the
// road cannot be cancelled here - that is an emergency/foul trip.
export async function cancelBooking(orderID: string, reason: string) {
  const { data: order, error } = await supabase
    .from("Order")
    .select("orderID, isActive, DispatchOrder ( dispatchID, status )")
    .eq("orderID", orderID)
    .maybeSingle();

  if (error) throw new Error(`Supabase Order Error: ${error.message}`);
  if (!order) throw new Error("Booking not found");

  const dispatches = ((order.DispatchOrder as any[]) ?? []).filter(Boolean);
  const running = dispatches.find((d) => [DELIVERY_STATUS.inTransit, DELIVERY_STATUS.completed].includes(d.status));

  if (running) {
    throw new Error(
      running.status === DELIVERY_STATUS.completed
        ? "This booking is already completed and cannot be cancelled."
        : "This delivery is already on the road. Use the foul trip flow instead.",
    );
  }

  for (const dispatch of dispatches) {
    if ([DELIVERY_STATUS.rejected, DELIVERY_STATUS.foulTrip].includes(dispatch.status)) continue;

    const { error: dispatchError } = await supabase
      .from("DispatchOrder")
      .update({ status: DELIVERY_STATUS.rejected, rejectionreason: reason })
      .eq("dispatchID", dispatch.dispatchID);

    if (dispatchError) throw new Error(`Failed to cancel dispatch: ${dispatchError.message}`);

    await releaseDispatchResources(dispatch.dispatchID);
  }

  const { error: orderError } = await supabase
    .from("Order")
    .update({ isActive: false })
    .eq("orderID", orderID);

  if (orderError) throw new Error(`Failed to cancel booking: ${orderError.message}`);

  return { orderID, cancelledDispatches: dispatches.length };
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
      await rollbackOrder(newOrderID);
      throw new Error("Failed to insert order items");
    }
  }

  // 4. Insert the Itinerary (BranchStops)
  if (dto.stops && dto.stops.length > 0) {
    // Resolve stop addresses to coordinates so the stop can be drawn on the
    // live map and the customer tracking page. Best-effort: stops without a
    // usable address keep the 0/0 placeholder and simply are not plotted.
    const coordinatesByAddress = await geocodeAddresses(
      dto.stops.map((stop) => stop.deliveryAddress || "").filter(Boolean),
    );

    const formattedStops = dto.stops.map((stop) => {
      const coordinates = stop.deliveryAddress
        ? coordinatesByAddress.get(stop.deliveryAddress.trim())
        : undefined;

      return {
        orderID: newOrderID,
        branchName: stop.branchName || "Unknown Stop",
        contactPerson: stop.contactPerson || "",
        contactNum: stop.contactNum || "",
        notes: "",
        deliveryLat: coordinates?.latitude ?? 0,
        deliverLong: coordinates?.longitude ?? 0,
        expectedTime: stop.expectedTime || "12:00:00",
        stopStatus: STOP_STATUS.pending,
      };
    });

    const { error: stopsError } = await supabase
      .from("BranchStops")
      .insert(formattedStops);

    if (stopsError) {
      console.error("BranchStops Insert Error:", stopsError);
      await rollbackOrder(newOrderID);
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