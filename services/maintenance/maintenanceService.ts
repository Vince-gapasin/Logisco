import { supabase } from "@/app/lib/supabase";

// --- ACTIVE MAINTENANCE ---
export async function createMaintenanceRecord(payload: any) {
  const { truckID, mechanicID, issueDescription, status } = payload;
  
  if (!truckID || !issueDescription) {
    throw new Error("Truck ID and Issue Description are required.");
  }

  // 1. Log the maintenance issue
  const { data: record, error } = await supabase
    .from("Maintenance")
    .insert([{ truckID, mechanicID, issueDescription, status: status || "Pending" }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 2. Lock the Truck (Remove from Dispatch availability)
  await supabase.from("Truck").update({ truckStatus: "On Maintenance" }).eq("truckID", truckID);

  return record;
}

export async function getAllActiveMaintenance() {
  const { data, error } = await supabase.from("Maintenance").select("*");
  if (error) throw new Error(error.message);
  return data;
}

// --- HISTORY LOGS ---
export async function getHistoryLogs() {
  const { data, error } = await supabase
    .from("HistoryLogsM")
    .select(`
      id, truckID, primaryMechanicID, additionalMechanicID, issue, remarks, date,
      Truck ( plateNumber, truckType ),
      PrimaryMechanic:Employee!primaryMechanicID ( employeeName ),
      AdditionalMechanic:Employee!additionalMechanicID ( employeeName )
    `)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);

  return data.map((log: any) => ({
    id: log.id,
    truckID: log.truckID,
    primaryMechanicID: log.primaryMechanicID,
    additionalMechanicID: log.additionalMechanicID,
    plateNumber: log.Truck?.plateNumber || "Unknown",
    truckType: log.Truck?.truckType || "Unknown",
    mechanicName: log.PrimaryMechanic?.employeeName || "Unknown",
    additionalMechanic: log.AdditionalMechanic?.employeeName || "",
    issue: log.issue,
    remarks: log.remarks,
    date: log.date
  }));
}

export async function createHistoryLog(payload: any) {
  const { data, error } = await supabase
    .from("HistoryLogsM")
    .insert([{
      truckID: payload.truckID,
      primaryMechanicID: payload.primaryMechanicID,
      additionalMechanicID: payload.additionalMechanicID || null,
      issue: payload.issue,
      remarks: payload.remarks,
      date: payload.date
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateHistoryLog(id: string, payload: any) {
  const { data, error } = await supabase
    .from("HistoryLogsM")
    .update({
      truckID: payload.truckID,
      primaryMechanicID: payload.primaryMechanicID,
      additionalMechanicID: payload.additionalMechanicID || null,
      issue: payload.issue,
      remarks: payload.remarks,
      date: payload.date
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteHistoryLog(id: string) {
  const { error } = await supabase.from("HistoryLogsM").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}