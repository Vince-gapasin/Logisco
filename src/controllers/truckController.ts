import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = Router();

// ==========================================
// 🛠️ HELPER: THE DATA SANITIZER
// ==========================================
const sanitizeTruckData = (body: any, isUpdate: boolean = false) => {
  const { plateNumber, truckType, truckModel, capacity, lastChecked, status, truckCode } = body;

  const safePlate = plateNumber ? String(plateNumber).trim() : "UNKNOWN";
  const safeCapacity = capacity ? String(capacity) : "0";
  const numericCapacity = parseFloat(safeCapacity.replace(/[^0-9.]/g, '')) || 0;
  const formattedDate = lastChecked ? `${String(lastChecked).trim()} 00:00:00` : null;

  let dbTruckType = truckType ? String(truckType).trim() : "Others";
  if (dbTruckType === "Other") dbTruckType = "Others";

  let dbStatus = status ? String(status).trim() : "Available";
  if (dbStatus === "Operational") dbStatus = "Available";

  // 🚀 Auto-generate Truck Code only if it's missing!
  const generatedCode = truckCode ? String(truckCode) : `TRK-${safePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`;

  const finalPayload: any = {
    plateNumber: safePlate,
    truckType: dbTruckType,
    model: truckModel ? String(truckModel).trim() : "", 
    capacity: numericCapacity,
    lastChecked: formattedDate, 
    truckStatus: dbStatus
  };

  // Only assign a new truckCode if we are creating a new truck, or if one doesn't exist
  if (!isUpdate || truckCode) {
     finalPayload.truckCode = generatedCode;
  }

  return finalPayload;
};

// ==========================================
// 1. GET ALL TRUCKS
// ==========================================
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { data, error } = await supabase.from('Truck').select('*').order('plateNumber', { ascending: true });
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// 2. CREATE A NEW TRUCK (POST)
// ==========================================
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log(`\n[EXPRESS] 🟢 Incoming POST Request...`);
    const cleanData = sanitizeTruckData(req.body, false); // false = This is a new record
    
    const { data, error } = await supabase.from('Truck').insert([cleanData]).select();

    if (error) {
      console.error("[EXPRESS] ❌ Supabase Rejected POST:", error);
      return res.status(400).json({ error: error.message, details: error.details });
    }
    return res.status(201).json(data[0]);
  } catch (err: any) {
    console.error("[EXPRESS] ❌ Crashed on POST:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. GET SINGLE TRUCK
// ==========================================
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { data, error } = await supabase.from('Truck').select('*').eq('truckID', req.params.id).single();
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. UPDATE EXISTING TRUCK (PUT) -> THIS FIXES THE 404!
// ==========================================
router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log(`\n[EXPRESS] 🟡 Incoming PUT Request for ID: ${req.params.id}`);
    const cleanData = sanitizeTruckData(req.body, true); // true = This is an update

    const { data, error } = await supabase
      .from('Truck')
      .update(cleanData)
      .eq('truckID', req.params.id)
      .select();

    if (error) {
      console.error("[EXPRESS] ❌ Supabase Rejected PUT:", error);
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    console.log(`[EXPRESS] ✅ Update Successful!`);
    return res.status(200).json(data ? data[0] : {});
  } catch (err: any) {
    console.error("[EXPRESS] ❌ Crashed on PUT:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. DELETE TRUCK
// ==========================================
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log(`\n[EXPRESS] 🔴 Incoming DELETE Request for ID: ${req.params.id}`);
    const { data, error } = await supabase.from('Truck').delete().eq('truckID', req.params.id).select();
    if (error) throw error;
    return res.status(200).json({ message: "Deleted", deletedRecord: data[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;