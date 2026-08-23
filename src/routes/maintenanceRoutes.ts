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

// For History Logs
// GET ALL HISTORY LOGS
router.get('/api/HistoryLogsM', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('HistoryLogsM')
      .select(`
        id,
        "truckID", 
        "primaryMechanicID", 
        "additionalMechanicID",
        issue,
        remarks,
        date,
        Truck ( plateNumber, truckType ),
        PrimaryMechanic:Employee!primaryMechanicID ( employeeName ),
        AdditionalMechanic:Employee!additionalMechanicID ( employeeName )
      `)
      .order('date', { ascending: false });

    if (error) throw error;

    const formattedData = data.map((log: any) => ({
      id: log.id,
      
      truckID: log.truckID,
      primaryMechanicID: log.primaryMechanicID,
      additionalMechanicID: log.additionalMechanicID,
      
      plateNumber: log.Truck?.plateNumber || 'Unknown',
      truckType: log.Truck?.truckType || 'Unknown',
      mechanicName: log.PrimaryMechanic?.employeeName || 'Unknown',
      additionalMechanic: log.AdditionalMechanic?.employeeName || '',
      issue: log.issue,
      remarks: log.remarks,
      date: log.date
    }));

    res.status(200).json(formattedData);
  } catch (error: any) {
    console.error("SUPABASE ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});
// CREATE HISTORY LOG
router.post('/api/HistoryLogsM', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('HistoryLogsM')
      .insert([{
        truckID: req.body.truckID,
        primaryMechanicID: req.body.primaryMechanicID,
        additionalMechanicID: req.body.additionalMechanicID || null,
        issue: req.body.issue,
        remarks: req.body.remarks,
        date: req.body.date
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE HISTORY LOG
router.delete('/api/HistoryLogsM/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('HistoryLogsM').delete().eq('id', id);
    if (error) throw error;
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE HISTORY LOG
router.put('/api/HistoryLogsM/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    console.log(`\n--> Incoming UPDATE Request for Log ID: ${id}`);
    console.log("--> Payload received from frontend:", req.body);

    const { data, error } = await supabase
      .from('HistoryLogsM')
      .update({
        truckID: req.body.truckID,
        primaryMechanicID: req.body.primaryMechanicID,
        // Convert empty strings to null to prevent Foreign Key crashes
        additionalMechanicID: req.body.additionalMechanicID || null, 
        issue: req.body.issue,
        remarks: req.body.remarks,
        date: req.body.date
      })
      .eq('id', id)
      .select()
      .single(); // .single() forces Supabase to return the updated row

    if (error) {
      console.error("--> ❌ Supabase Update Error:", error);
      return res.status(400).json({ error: error.message });
    }

    console.log("--> ✅ Successfully updated log in Supabase!");
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("--> ❌ Express Crashed on UPDATE:", error);
    return res.status(500).json({ error: error.message });
  }
});