import { supabase } from "@/app/lib/supabase";
import { TRUCK_STATUS } from "@/app/lib/enums";
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
      truckStatus: TRUCK_STATUS.outOfService,
    })
    .eq("truckID", id)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Truck | null;
}
// ==========================================
// FLEET-STATUS PAYLOAD MAPPING
// ==========================================
// The fleet-status UIs send { truckModel, status, capacity: "10 tons" };
// older callers send DB column names { model, truckStatus }. Accept both
// and only pass known columns through (no mass-assignment).

const TRUCK_STATUSES = ["Available", "On Maintenance", "On Delivery", "Out of Service"] as const;

export function toTruckPayload(body: Record<string, unknown>): UpdateTruckDto & { truckCode?: string } {
  const payload: UpdateTruckDto & { truckCode?: string } = {};

  if (typeof body.truckCode === "string" && body.truckCode.trim()) payload.truckCode = body.truckCode.trim();
  if (typeof body.plateNumber === "string") payload.plateNumber = body.plateNumber.trim();
  if (typeof body.truckType === "string") payload.truckType = body.truckType as UpdateTruckDto["truckType"];

  const model = body.truckModel ?? body.model;
  if (typeof model === "string") payload.model = model;

  if (body.capacity !== undefined && body.capacity !== null && body.capacity !== "") {
    const capacity = parseFloat(String(body.capacity).replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(capacity)) payload.capacity = capacity;
  }

  if (body.lastChecked !== undefined) {
    payload.lastChecked = body.lastChecked ? String(body.lastChecked) : null;
  }

  const status = body.status ?? body.truckStatus;
  if (typeof status === "string" && status) payload.truckStatus = status as UpdateTruckDto["truckStatus"];

  return payload;
}

export function validateTruckPayload(payload: UpdateTruckDto, isCreate: boolean): string | null {
  if (isCreate) {
    if (!payload.plateNumber) return "Plate number is required";
    if (!payload.truckType) return "Truck type is required";
    if (payload.capacity === undefined) return "Capacity is required";
  }
  if (payload.capacity !== undefined && payload.capacity < 0) return "Capacity cannot be negative";
  if (payload.truckStatus && !TRUCK_STATUSES.includes(payload.truckStatus)) return "Invalid truck status";
  return null;
}

export async function getFleet(): Promise<Truck[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("isActive", true)
    .order("lastChecked", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data as Truck[];
}

export async function createFleetTruck(payload: UpdateTruckDto & { truckCode?: string }): Promise<Truck> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...payload,
      truckCode: payload.truckCode || generateTruckCode(payload.plateNumber ?? ""),
      truckStatus: payload.truckStatus ?? TRUCK_STATUS.available,
      isActive: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Truck;
}
