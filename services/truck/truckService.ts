import { supabase } from "@/app/lib/supabase";
import type { Truck, CreateTruckDto, UpdateTruckDto } from "@/types/truck";

const TABLE = "Truck";

// ==========================================
// HELPER: GENERATE TRUCK CODE
// ==========================================
const generateTruckCode = (plateNumber: string): string => {
  const cleanPlate = plateNumber.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `TRK-${cleanPlate}`;
};

// ==========================================
// GET ALL ACTIVE TRUCKS
// ==========================================
export async function getTrucks(): Promise<Truck[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("isActive", true)
    .order("plateNumber", { ascending: true });

  if (error) {
    throw error;
  }

  return data as Truck[];
}

// ==========================================
// GET SINGLE TRUCK
// ==========================================
export async function getTruckById(id: string): Promise<Truck | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("truckID", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Truck | null;
}

// ==========================================
// CREATE TRUCK
// ==========================================
export async function createTruck(truck: CreateTruckDto): Promise<Truck> {
  const truckCode = truck.subconID 
    ? `SUB-${generateTruckCode(truck.plateNumber)}` // Optional: differentiate subcon trucks
    : generateTruckCode(truck.plateNumber);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...truck,
      truckCode,
      isActive: true,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Truck;
}

// ==========================================
// UPDATE TRUCK
// ==========================================
export async function updateTruck(
  id: string,
  truck: UpdateTruckDto
): Promise<Truck | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(truck)
    .eq("truckID", id)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Truck | null;
}

// ==========================================
// SOFT DELETE TRUCK
// ==========================================
export async function deleteTruck(id: string): Promise<Truck | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      isActive: false,
      truckStatus: "Out of Service",
    })
    .eq("truckID", id)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Truck | null;
}