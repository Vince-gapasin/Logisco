import express, { Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = express.Router();

// LOG NEW MAINTENANCE RECORD
router.post('/api/maintenance', async (req: Request, res: Response) => {
  try {
    const { truckID, mechanicID, issueDescription, status } = req.body;

    if (!truckID || !issueDescription) {
      return res.status(400).json({ error: 'Truck ID and Issue Description are required.' });
    }

    // 1. Log the maintenance issue
    const { data: record, error } = await supabase
      .from('Maintenance')
      .insert([{ truckID, mechanicID, issueDescription, status: status || 'Pending' }])
      .select()
      .single();

    if (error) throw error;

    // 2. Automatically update the Truck's status to "On Maintenance"
    await supabase.from('Truck').update({ truckStatus: 'On Maintenance' }).eq('truckID', truckID);

    res.status(201).json({ message: 'Maintenance logged and truck status updated', data: record });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET ALL MAINTENANCE LOGS
router.get('/api/maintenance', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('Maintenance').select('*');
    if (error) throw error;
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;