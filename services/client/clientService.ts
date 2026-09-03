import { supabase } from "@/app/lib/supabase";
import type {
  Client,
  SubContractor,
  CreateClientDto,
  CreatePartnerDto,
} from "@/types/client";

// ==========================================
// HELPERS
// ==========================================

const generateClientCode = (): string => {
  return `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
};

const getContractDates = () => {
  const today = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(today.getFullYear() + 1);

  return {
    contractStart: today.toISOString().split("T")[0],
    contractEnd: nextYear.toISOString().split("T")[0],
  };
};

// ==========================================
// CLIENTS (GET & CREATE)
// ==========================================

export async function getClients(): Promise<Client[]> {
  // Fetch active clients along with their nested Warehouses and Branches
  const { data, error } = await supabase
    .from("Client")
    .select("*, Warehouse(*), Branch(*)")
    .eq("isActive", true)
    .order("company", { ascending: true });

  if (error) {
    throw error;
  }

  return data as Client[];
}

export async function createClient(dto: CreateClientDto): Promise<Client> {
  const { contractStart, contractEnd } = getContractDates();

  // 1. Insert the Client Record
  const { data: newClient, error: clientError } = await supabase
    .from("Client")
    .insert([
      {
        clientCode: generateClientCode(),
        company: dto.name,
        contactName: dto.contactName,
        contact: dto.contactNumber,
        businessAdd: dto.businessAddress,
        emailAdd: dto.emailAddress,
        contractType: "Regular",
        status: "Active",
        contractStart,
        contractEnd,
        isActive: true,
      },
    ])
    .select()
    .single();

  if (clientError || !newClient) {
    throw clientError || new Error("Failed to create client");
  }

  const clientId = newClient.clientID;

  // 2. Insert Pickup Addresses (Warehouses)
  if (dto.pickupAddresses && dto.pickupAddresses.length > 0) {
    const warehousePayload = dto.pickupAddresses.map((p) => ({
      clientID: clientId,
      whName: p.warehouseName,
      warehouseLoc: p.warehouseAddress,
      contactPerson: p.contactPerson,
      contactNum: p.contactNumber,
    }));

    const { error: whError } = await supabase
      .from("Warehouse")
      .insert(warehousePayload);

    if (whError) console.error("Failed to insert warehouses:", whError);
  }

  // 3. Insert Delivery Addresses (Branches)
  if (dto.deliveryAddresses && dto.deliveryAddresses.length > 0) {
    const branchPayload = dto.deliveryAddresses.map((d) => ({
      clientID: clientId,
      branchName: d.branchName,
      deliveryAddress: d.deliveryAddress,
      contactPerson: d.contactPerson,
      contactNumber: d.contactNumber,
    }));

    const { error: brError } = await supabase
      .from("Branch")
      .insert(branchPayload);

    if (brError) console.error("Failed to insert branches:", brError);
  }

  return newClient as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from("Client")
    .update({ isActive: false, status: "Inactive" })
    .eq("clientID", id);

  if (error) {
    throw error;
  }
}

// ==========================================
// PARTNERS / SUBCONTRACTORS (GET & CREATE)
// ==========================================

export async function getPartners(): Promise<SubContractor[]> {
  const { data, error } = await supabase
    .from("SubContractor")
    .select("*")
    .eq("isActive", true)
    .order("companyName", { ascending: true });

  if (error) {
    throw error;
  }

  return data as SubContractor[];
}

export async function createPartner(
  dto: CreatePartnerDto
): Promise<SubContractor> {
  const { data, error } = await supabase
    .from("SubContractor")
    .insert([
      {
        companyName: dto.name,
        contactName: dto.contactPerson,
        contactNumber: dto.contactNumber,
        contractType: dto.contractType,
        emailAddress: dto.emailAddress,
        businessAddress: dto.businessAddress,
        isActive: true,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as SubContractor;
}

export async function deletePartner(id: string): Promise<void> {
  const { error } = await supabase
    .from("SubContractor")
    .update({ isActive: false })
    .eq("subConID", id);

  if (error) {
    throw error;
  }
}

export async function updateClient(id: string, dto: Partial<CreateClientDto>): Promise<Client> {
  // Map frontend keys to database columns
  const payload = {
    company: dto.name,
    contactName: dto.contactName,
    contact: dto.contactNumber,
    emailAdd: dto.emailAddress,
    businessAdd: dto.businessAddress,
  };

  // Remove undefined fields so we only update what was actually sent
  Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

  const { data, error } = await supabase
    .from("Client")
    .update(payload)
    .eq("clientID", id)
    .select()
    .single();

  if (error) throw error;
  return data as Client;
}

export async function updatePartner(id: string, dto: Partial<CreatePartnerDto>): Promise<SubContractor> {
  const payload = {
    companyName: dto.name,
    contractType: dto.contractType,
    contactName: dto.contactPerson,
    contactNumber: dto.contactNumber,
    emailAddress: dto.emailAddress,
    businessAddress: dto.businessAddress,
  };

  Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

  const { data, error } = await supabase
    .from("SubContractor")
    .update(payload)
    .eq("subConID", id)
    .select()
    .single();

  if (error) throw error;
  return data as SubContractor;
}