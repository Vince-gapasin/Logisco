import express, { Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = express.Router();

/**
 * 1. GET ALL ACTIVE STAFF
 * Requirement: Inactive staff members must not appear in the assignment list.
 */
router.get('/api/staff', async (req: Request, res: Response) => {
  try {
    const { data: staff, error } = await supabase
      .from('Employee')
      .select('*')
      .eq('isActive', true); // Fetch only active staff

    if (error) throw error;
    res.status(200).json({ data: staff });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2. ADD NEW STAFF
 * Requirement: Required fields must not be left blank.
 */
router.post('/api/staff', async (req: Request, res: Response) => {
  try {
    const { employeeName, role, availability, healthStatus, address, contact } = req.body;

    // VALIDATION: Reject incomplete data
    if (!employeeName || !role || !contact || !availability || !healthStatus) {
      return res.status(400).json({ error: 'Name, Role, Contact, Availability, and Health Status are required.' });
    }

    const { data: newStaff, error } = await supabase
      .from('Employee')
      .insert([{ 
        employeeName, 
        role, 
        availability, 
        healthStatus, 
        address, 
        contact, 
        isActive: true 
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Staff added successfully', data: newStaff });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 3. EDIT STAFF DETAILS
 */
router.put('/api/staff/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: updatedStaff, error } = await supabase
      .from('Employee')
      .update(updates)
      .eq('employeeID', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ message: 'Staff updated successfully', data: updatedStaff });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 4. DEACTIVATE STAFF (Soft Delete)
 * Requirement: Staff records with transaction history should only be deactivated.
 */
router.delete('/api/staff/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // We update 'isActive' to false instead of deleting the row
    const { error } = await supabase
      .from('Employee')
      .update({ isActive: false })
      .eq('employeeID', id);

    if (error) throw error;

    res.status(200).json({ message: 'Staff deactivated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;