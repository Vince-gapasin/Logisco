import cron from 'node-cron';
import { supabase } from '../supabaseClient';

// Define the threshold for inactivity (45 minutes in milliseconds)
const INACTIVITY_THRESHOLD_MS = 45 * 60 * 1000; 

export const startDwellTimeMonitor = () => {
  // Run this task every 5 minutes (Cron syntax: '*/5 * * * *')
  cron.schedule('*/5 * * * *', async () => {
    console.log('⏳ Running Dwell Time / Inactivity Check...');

    try {
      // 1. Get all dispatches that are currently "In Transit"
      const { data: activeDispatches, error: dispatchError } = await supabase
        .from('DispatchOrder')
        .select('dispatchID')
        .eq('status', 'In Transit');

      if (dispatchError) throw dispatchError;
      if (!activeDispatches || activeDispatches.length === 0) return;

      const now = new Date().getTime();

      // 2. Loop through each active dispatch to check its latest tracking ping
      for (const dispatch of activeDispatches) {
        const { data: trackingData, error: trackingError } = await supabase
          .from('DeliveryTracking')
          .select('timestamp')
          .eq('dispatchID', dispatch.dispatchID)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        // (Ignore PGRST116 which just means no rows were found yet)
        if (trackingError && trackingError.code !== 'PGRST116') {
          console.error(`Error fetching tracking for dispatch ${dispatch.dispatchID}:`, trackingError);
          continue;
        }

        // If there's tracking data, check the time difference
        if (trackingData) {
          const lastPingTime = new Date(trackingData.timestamp).getTime();
          const timeSinceLastPing = now - lastPingTime;

          // 3. If the time exceeds the 45-minute threshold, trigger an intervention log
          if (timeSinceLastPing > INACTIVITY_THRESHOLD_MS) {
            
            // 4. Check if we already logged an alert recently so we don't spam the database
            const { data: existingLog } = await supabase
              .from('DispatchInterventionLog')
              .select('logID')
              .eq('dispatchID', dispatch.dispatchID)
              .eq('reason', 'Automated Alert: Prolonged Inactivity Detected')
              .gte('timeStamp', new Date(now - INACTIVITY_THRESHOLD_MS).toISOString());

            // 5. Insert the SOS/Intervention Alert
            if (!existingLog || existingLog.length === 0) {
              await supabase.from('DispatchInterventionLog').insert([
                {
                  dispatchID: dispatch.dispatchID,
                  interventionType: 'Request Maintenance', // Default automated intervention type
                  reason: 'Automated Alert: Prolonged Inactivity Detected',
                  recoveryRemarks: 'System detected no GPS movement for over 45 minutes. Please contact driver immediately.'
                }
              ]);
              
              console.log(`🚨 Inactivity alert created for Dispatch: ${dispatch.dispatchID}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Dwell Time Monitor Error:', error);
    }
  });
};