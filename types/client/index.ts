// ==========================================
// MODELS (Matches Supabase Schema)
// ==========================================

export type ClientStatus = "Active" | "Inactive" | "Pending";
export type ContractType = "Regular" | "On-Call" | "Seasonal";

export interface Warehouse {
  warehouseID: string;
  clientID: string;
  whName: string;
  warehouseLoc: string;
  contactPerson: string;
  contactNum: string;
}

export interface Branch {
  branchID: string;
  clientID: string;
  branchName: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
}

export interface Client {
  clientID: string;
  clientCode: string | null;
  company: string;
  contractType: ContractType;
  status: ClientStatus;
  contactName: string;
  contact: string;
  businessAdd: string;
  emailAdd: string;
  contractStart: string;
  contractEnd: string;
  auth_id: string | null;
  isActive: boolean;
}

export interface SubContractor {
  subConID: string;
  companyName: string;
  contactName: string;
  contactNumber: string;
  contractType: ContractType;
  emailAddress: string;
  businessAddress: string;
  isActive: boolean;
}
// ==========================================
// DATA TRANSFER OBJECTS (DTOs)
// ==========================================

export interface CreateWarehouseDto {
  warehouseName: string;      // Changed from whName
  warehouseAddress: string;   // Changed from warehouseLoc
  contactPerson: string;
  contactNumber: string;      // Changed from contactNum
}

export interface CreateBranchDto {
  branchName: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
}

export interface CreateClientDto {
  name: string; 
  contactName: string;
  contactNumber: string; 
  emailAddress: string; 
  businessAddress: string; 
  pickupAddresses?: CreateWarehouseDto[];
  deliveryAddresses?: CreateBranchDto[];
}

export interface CreatePartnerDto {
  name: string; 
  contactPerson: string; 
  contactNumber: string;
  emailAddress: string;
  businessAddress: string;
  contractType: ContractType;
}

// ==========================================
// RESPONSE FORMATS
// ==========================================

export interface ClientResponse {
  message?: string;
  data: Client;
}

export interface ClientsResponse {
  data: Client[];
}

export interface PartnerResponse {
  message?: string;
  data: SubContractor;
}

export interface PartnersResponse {
  data: SubContractor[];
}