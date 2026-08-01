import express, { Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = express.Router();

/**
 * 1. GET ALL BOOKINGS
 */
router.get('/api/bookings', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('Order')
      .select('*')
      .eq('isActive', true);

    if (error) throw error;
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2. CREATE BOOKING
 */
router.post('/api/bookings', async (req: Request, res: Response) => {
  try {
    const { clientID, totalAmount, deliveryStatus } = req.body;

    if (!clientID) {
      return res.status(400).json({ error: 'clientID is required.' });
    }

    const { data, error } = await supabase
      .from('Order')
      .insert([{ 
        clientID, 
        totalAmount, 
        deliveryStatus: deliveryStatus || 'Draft',
        isActive: true 
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Booking created successfully', data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;