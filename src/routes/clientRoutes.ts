import express, { Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = express.Router();

// GET ALL ACTIVE CLIENTS
router.get('/api/clients', async (req: Request, res: Response) => {
  try {
    const { data: clients, error } = await supabase
      .from('Client')
      .select('*')
      .eq('isActive', true);

    if (error) throw error;
    res.status(200).json({ data: clients });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Inside src/routes/clientRoutes.ts

// Helper function to generate a readable ID (e.g., CLI-3091)
const generateClientCode = () => `CLI-${Math.floor(1000 + Math.random() * 9000)}`;

router.post('/api/clients', async (req: Request, res: Response) => {
  try {
    const { clientName, contactPerson, contactNumber, address, contractStart, contractEnd, businessAdd, emailAdd } = req.body;

    if (!clientName || !contactPerson) {
      return res.status(400).json({ error: 'Client Name and Contact Person are required.' });
    }

    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);

    const { data: newClient, error } = await supabase
      .from('Client')
      .insert([{ 
        clientCode: generateClientCode(), // INJECT THE READABLE ID HERE
        company: clientName,             
        contactName: contactPerson,      
        contact: contactNumber,          
        branchLoc: address,              
        businessAdd: businessAdd || '',  
        emailAdd: emailAdd || '',        
        contractType: 'Regular',         
        status: 'Active',                
        contractStart: contractStart || today.toISOString().split('T')[0],
        contractEnd: contractEnd || nextYear.toISOString().split('T')[0],
        isActive: true 
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Client added successfully', data: newClient });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// EDIT CLIENT (PUT)
router.put('/api/clients/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('Client').update(req.body).eq('clientID', id).select().single();
    if (error) throw error;
    res.status(200).json({ message: 'Client updated', data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SOFT DELETE CLIENT
router.delete('/api/clients/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('Client').update({ isActive: false, status: 'Inactive' }).eq('clientID', id);
    if (error) throw error;
    res.status(200).json({ message: 'Client deactivated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;