import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = Router();

// ==========================================
// GET ALL TRUCKS
// ==========================================
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('Truck')
      .select('*')
      .order('plateNumber', { ascending: true }); // Alphabetical by Plate

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Fetch Trucks Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// CREATE A NEW TRUCK (THE FINAL BOSS VERSION)
// ==========================================
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log("--> Incoming Truck Data:", req.body);

    const { plateNumber, truckType, truckModel, capacity, lastChecked } = req.body;

    // 1. CAPACITY FIX: Convert "5000kg" into pure 5000
    const safeCapacity = capacity ? capacity.toString() : "0";
    const numericCapacity = parseFloat(safeCapacity.replace(/[^0-9.]/g, '')) || 0;
    
    // 2. ENUM FIX: Convert "Closed Van" into "closed_van" to match your DB image!
    const formattedTruckType = truckType ? truckType.toLowerCase().replace(/ /g, '_') : "other";

    // 3. DATE FIX: Give Postgres the exact Timestamp it demands
    const formattedDate = lastChecked ? `${lastChecked} 00:00:00` : null;

    console.log("--> Data ready for Database:", {
      plateNumber: plateNumber,
      truckType: formattedTruckType,
      capacity: numericCapacity,
      lastChecked: formattedDate
    });

    // 4. Send to Supabase
    const { data, error } = await supabase
      .from('Truck')
      .insert([
        {
          plateNumber: plateNumber,
          truckType: formattedTruckType, // <--- Using the new formatted string!
          model: truckModel,
          capacity: numericCapacity,     // <--- Using the pure number!
          lastChecked: formattedDate,    // <--- Using the Timestamp!
          truckStatus: 'Available'
        }
      ])
      .select();

    if (error) {
      console.error("--> Supabase Rejected:", error);
      return res.status(400).json({ error: error.message, details: error.details });
    }

    return res.status(201).json(data[0]);
  } catch (err: any) {
    console.error("--> Express Crashed:", err);
    return res.status(500).json({ error: err.message || "Express Code Crashed" });
  }
});

export default router;