import express, { Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = express.Router();

// GET ALL ACTIVE TRUCKS
router.get('/api/trucks', async (req: Request, res: Response) => {
  try {
    const { data: trucks, error } = await supabase
      .from('Truck')
      .select('*')
      .eq('isActive', true);

    if (error) throw error;
    res.status(200).json({ data: trucks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Inside src/routes/truckRoutes.ts

// Helper function to generate a readable ID (e.g., TRK-8924)
const generateTruckCode = () => `TRK-${Math.floor(1000 + Math.random() * 9000)}`;

router.post('/api/trucks', async (req: Request, res: Response) => {
  try {
    const { plateNumber, capacity, truckType, subconID, model } = req.body;

    if (!plateNumber || !capacity || !truckType) {
      return res.status(400).json({ error: 'Plate Number, Capacity, and Truck Type are required.' });
    }

    const { data: newTruck, error } = await supabase
      .from('Truck')
      .insert([{ 
        truckCode: generateTruckCode(), // INJECT THE READABLE ID HERE
        plateNumber, 
        capacity, 
        truckType, 
        subconID: subconID || null,
        model: model || '',             
        truckStatus: 'Available', 
        isActive: true 
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Truck added successfully', data: newTruck });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// EDIT TRUCK (PUT)
router.put('/api/trucks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('Truck').update(req.body).eq('truckID', id).select().single();
    if (error) throw error;
    res.status(200).json({ message: 'Truck updated', data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SOFT DELETE TRUCK
router.delete('/api/trucks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('Truck').update({ isActive: false, truckStatus: 'Out of Service' }).eq('truckID', id);
    if (error) throw error;
    res.status(200).json({ message: 'Truck deactivated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;