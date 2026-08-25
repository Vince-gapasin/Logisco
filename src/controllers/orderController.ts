import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient';
import crypto from 'crypto'; 

const router = Router();

// ==========================================
// 1. GET ALL ORDERS (With Items & Stops)
// ==========================================
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('Order')
      .select(`
        *,
        Client (company),
        OrderDetails (*),
        BranchStops (*)
      `)
      .eq('isActive', true)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. CREATE A NEW ORDER (The Triple-Insert)
// ==========================================
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log(`\n[EXPRESS] 🟢 Incoming ORDER POST Request...`);
    const { clientID, notes, items, stops } = req.body;

    // --- A. Generate Unique Identifiers ---
    const orderCode = `ORD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const orderLinkToken = crypto.randomUUID(); 

    // --- B. Insert the Main Order ---
    const { data: orderData, error: orderError } = await supabase
      .from('Order')
      .insert([{ 
        clientID: clientID || null, // 🚀 Allow NULL for ad-hoc On-Call Customers!
        orderCode, 
        orderLinkToken, 
        notes: notes || "" 
      }])
      .select();

    if (orderError) throw orderError;
    const newOrder = orderData[0];
    console.log(`[EXPRESS] ✅ Main Order Created: ${orderCode}`);

    // --- C. Insert the Cargo (OrderDetails) ---
    if (items && items.length > 0) {
      const formattedItems = items.map((item: any) => ({
        orderID: newOrder.orderID,
        productName: item.productName || "Unknown Cargo",
        productType: item.productType || "General",
        quantity: Number(item.quantity) || 1,
        weightPerItem: Number(item.weightPerItem) || 0
      }));

      const { error: itemsError } = await supabase.from('OrderDetails').insert(formattedItems);
      if (itemsError) throw itemsError;
      console.log(`[EXPRESS] ✅ Cargo Items Added!`);
    }

    // --- D. Insert the Itinerary (BranchStops) ---
    if (stops && stops.length > 0) {
      const formattedStops = stops.map((stop: any) => ({
        orderID: newOrder.orderID,
        branchName: stop.branchName || "Unknown Stop",
        contactPerson: stop.contactPerson || "",
        contactNum: stop.contactNum || "",
        notes: stop.notes || "",
        deliveryLat: Number(stop.deliveryLat) || 0,
        deliverLong: Number(stop.deliverLong) || 0,
        expectedTime: stop.expectedTime || "12:00:00",
        stopStatus: "Pending"
      }));

      const { error: stopsError } = await supabase.from('BranchStops').insert(formattedStops);
      if (stopsError) throw stopsError;
      console.log(`[EXPRESS] ✅ Itinerary Stops Added!`);
    }

    return res.status(201).json({
      message: "Order created successfully!",
      orderID: newOrder.orderID,
      orderCode: newOrder.orderCode,
      trackingToken: newOrder.orderLinkToken
    });

  } catch (err: any) {
    console.error("[EXPRESS] ❌ Order Creation Failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;