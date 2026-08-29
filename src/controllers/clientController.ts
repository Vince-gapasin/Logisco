import { Router, Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = Router();

// ==========================================
// 1. GET ALL CLIENTS (With Locations)
// ==========================================
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    // 🚀 FIX: Fetch Client + Joined Warehouse + Joined Branch arrays!
    const { data, error } = await supabase
      .from('Client')
      .select('*, Warehouse(*), Branch(*)')
      .eq('isActive', true)
      .order('company', { ascending: true });

    if (error) throw error;
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. CREATE A NEW CLIENT
// ==========================================
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { company, contractType, status, contactName, contact, businessAdd, emailAdd } = req.body;
    
    // Format perfectly for Postgres 'date' columns (YYYY-MM-DD)
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);

    const { data, error } = await supabase
      .from('Client')
      .insert([{ 
        company, 
        contractType: contractType || 'Regular', 
        status: status || 'Active', 
        contactName, 
        contact, 
        businessAdd, 
        emailAdd,
        contractStart: today.toISOString().split('T')[0],
        contractEnd: nextYear.toISOString().split('T')[0]
      }])
      .select();

    if (error) throw error;
    return res.status(201).json(data[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. UPDATE A CLIENT
// ==========================================
router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('Client')
      .update(updates)
      .eq('clientID', id)
      .select();

    if (error) throw error;
    return res.status(200).json(data[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. SOFT DELETE CLIENT
// ==========================================
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('Client')
      .update({ isActive: false })
      .eq('clientID', id);

    if (error) throw error;
    return res.status(200).json({ message: 'Client deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. ADD WAREHOUSE (PICKUP)
// ==========================================
router.post('/:id/warehouses', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { whName, warehouseLoc, contactPerson, contactNum } = req.body;
    
    const { data, error } = await supabase
      .from('Warehouse')
      .insert([{ clientID: id, whName, warehouseLoc, contactPerson, contactNum }])
      .select();

    if (error) throw error;
    return res.status(201).json(data[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. ADD BRANCH (DELIVERY)
// ==========================================
router.post('/:id/branches', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { branchName, deliveryAddress, contactPerson, contactNumber } = req.body;
    
    const { data, error } = await supabase
      .from('Branch')
      .insert([{ clientID: id, branchName, deliveryAddress, contactPerson, contactNumber }])
      .select();

    if (error) throw error;
    return res.status(201).json(data[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;