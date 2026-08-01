import express, { Request, Response } from 'express';
import { supabase } from '../supabaseClient';

const router = express.Router();

/**
 * ASSIGN CREW & TRUCK TO DISPATCH
 * Enforces Requirements 4, 5, and 8: Capacity, Availability, and Overlapping limits.
 */
router.post('/api/dispatch/:dispatchID/assign', async (req: Request, res: Response) => {
  try {
    const { dispatchID } = req.params;
    const { truckID, driverID, totalCargoWeight } = req.body;

    // ---------------------------------------------------------
    // 1. VALIDATE TRUCK STATUS & CAPACITY
    // ---------------------------------------------------------
    const { data: truck, error: truckErr } = await supabase
      .from('Truck')
      .select('capacity, truckStatus, isActive')
      .eq('truckID', truckID)
      .single();

    if (truckErr || !truck) return res.status(404).json({ error: 'Truck not found.' });
    
    if (!truck.isActive || truck.truckStatus !== 'Available') {
      return res.status(400).json({ error: 'Selected truck is inactive or currently unavailable.' });
    }

    if (totalCargoWeight > truck.capacity) {
      return res.status(400).json({ 
        error: `Cargo weight (${totalCargoWeight}kg) exceeds truck capacity (${truck.capacity}kg).` 
      });
    }

    // ---------------------------------------------------------
    // 2. VALIDATE DRIVER STATUS & OVERLAPPING SCHEDULES
    // ---------------------------------------------------------
    const { data: driver, error: driverErr } = await supabase
      .from('Employee')
      .select('availability, isActive, role')
      .eq('employeeID', driverID)
      .single();

    if (driverErr || !driver) return res.status(404).json({ error: 'Driver not found.' });

    if (!driver.isActive || driver.role !== 'Driver') {
      return res.status(400).json({ error: 'Selected employee is not an active driver.' });
    }

    if (driver.availability !== 'Available') {
      return res.status(400).json({ error: 'Driver is currently on another delivery or unavailable.' });
    }

    // ---------------------------------------------------------
    // 3. EXECUTE ASSIGNMENT & UPDATE STATUSES
    // ---------------------------------------------------------
    
    // Update Dispatch Order
    const { data: dispatch, error: assignErr } = await supabase
      .from('DispatchOrder')
      .update({ 
        truckID, 
        driverID, 
        status: 'Assigned' // Moves workflow forward
      })
      .eq('dispatchID', dispatchID)
      .select()
      .single();

    if (assignErr) throw assignErr;

    // Lock the Truck and Driver so they can't be assigned elsewhere
    await supabase.from('Truck').update({ truckStatus: 'On Delivery' }).eq('truckID', truckID);
    await supabase.from('Employee').update({ availability: 'On Delivery' }).eq('employeeID', driverID);

    // Because of the database triggers we made earlier, all of this is automatically logged to the AuditTrail!
    res.status(200).json({ message: 'Crew and Truck successfully assigned.', data: dispatch });

  } catch (error: any) {
    console.error('Assignment Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * COMPLETE DISPATCH & FREE UP RESOURCES
 * Automatically changes Truck and Staff statuses back to 'Available'
 */
router.post('/api/dispatch/:id/complete', async (req: Request, res: Response) => {
  try {
    const dispatchID = req.params.id;

    // 1. Fetch the Dispatch record to find out which Truck and Driver were assigned
    const { data: dispatchRecord, error: fetchError } = await supabase
      .from('DispatchOrder')
      .select('truckID, driverID')
      .eq('dispatchID', dispatchID)
      .single();

    if (fetchError || !dispatchRecord) {
      return res.status(404).json({ error: 'Dispatch Order not found.' });
    }

    // 2. Mark the Dispatch Order as "Completed"
    const { error: dispatchError } = await supabase
      .from('DispatchOrder')
      .update({ status: 'Completed' })
      .eq('dispatchID', dispatchID);

    if (dispatchError) throw dispatchError;

    // 3. Free up the Truck (Set back to "Available")
    if (dispatchRecord.truckID) {
      await supabase
        .from('Truck')
        .update({ truckStatus: 'Available' })
        .eq('truckID', dispatchRecord.truckID);
    }

    // 4. Free up the Driver (Set back to "Available")
    if (dispatchRecord.driverID) {
      await supabase
        .from('Employee')
        .update({ availability: 'Available' })
        .eq('employeeID', dispatchRecord.driverID);
    }

    // Note: If you have helpers assigned in DispatchHelper, you would run a 
    // similar update query here to set their availability back to 'Available'.

    res.status(200).json({ message: 'Delivery completed! Truck and Driver are now Available.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;