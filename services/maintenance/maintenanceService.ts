import { supabase } from "@/app/lib/supabase";

// --- ACTIVE MAINTENANCE ---
// Maintenance columns: truckID, mechID, remark, maintenanceDate.
export async function createMaintenanceRecord(payload: any) {
  const truckID = payload.truckID;
  const mechID = payload.mechID ?? payload.mechanicID ?? null;
  const remark = payload.remark ?? payload.issueDescription;

  if (!truckID || !remark) {
    throw new Error("Truck ID and Issue Description are required.");
  }

  // 1. Log the maintenance issue
  const { data: record, error } = await supabase
    .from("Maintenance")
    .insert([{ truckID, mechID, remark }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 2. Lock the Truck (Remove from Dispatch availability)
  const { error: truckError } = await supabase
    .from("Truck")
    .update({ truckStatus: "On Maintenance" })
    .eq("truckID", truckID);

  if (truckError) throw new Error(truckError.message);

  return record;
}

export async function getAllActiveMaintenance() {
  const { data, error } = await supabase
    .from("Maintenance")
    .select("*")
    .order("maintenanceDate", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

// --- HISTORY LOGS ---
// HistoryLogsM stores mechanics, notes and photos in child tables; the
// history-logs service is the single implementation of that model.
export {
  getHistoryLogs,
  createHistoryLog,
  updateHistoryLog,
  deleteHistoryLog,
} from "@/services/history-logs/historyLogsService";
