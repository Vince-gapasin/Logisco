import express, { Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = express.Router();

// GET ALL ACTIVE SUBCONTRACTORS
router.get('/api/subcontractors', async (req: Request, res: Response) => {
  try {
    const { data: subcontractors, error } = await supabase
      .from('SubContractor')
      .select('*');

    if (error) throw error;
    res.status(200).json({ data: subcontractors });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ADD A NEW SUBCONTRACTOR
router.post('/api/subcontractors', async (req: Request, res: Response) => {
  try {
    const { companyName, contactPerson, contactNumber } = req.body;

    if (!companyName || !contactPerson) {
      return res.status(400).json({ error: 'Company Name and Contact Person are required.' });
    }

    const { data: newSubcontractor, error } = await supabase
      .from('SubContractor')
      .insert([{ 
        companyName, 
        contactName: contactPerson, // Maps JSON to DB 'contactName'
        contactNumber 
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Subcontractor added successfully', data: newSubcontractor });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;