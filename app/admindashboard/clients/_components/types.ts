import type {
  BranchRow,
  ClientRow,
  SubContractorRow,
  WarehouseRow,
} from "@/types/database";

// ==========================================
// TYPES & DTOs
// ==========================================

export type TabType = "Clients" | "Partners";

export interface PickupAddress {
  // Set for a warehouse the client already has; absent on a new row.
  warehouseID?: string;
  warehouseName: string;
  warehouseAddress: string;
  contactPerson: string;
  contactNumber: string;
}

export interface DeliveryAddress {
  branchID?: string;
  branchName: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
}

export interface ClientRecord {
  id: string | number;
  name: string;
  status: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress?: string;
  businessAddress?: string;
  pickupAddresses?: PickupAddress[];
  deliveryAddresses?: DeliveryAddress[];
}

export interface PartnerRecord {
  id: string | number;
  name: string;
  status: string;
  contractType: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  businessAddress: string;
}

export type UnifiedRecord = ClientRecord | PartnerRecord;

// A client with the addresses it can be collected from and delivered to.
interface ClientWithAddresses extends Partial<ClientRow> {
  Warehouse?: Partial<WarehouseRow>[];
  Branch?: Partial<BranchRow>[];
}

export interface ClientsResponse {
  data: ClientWithAddresses[];
}

export interface PartnersResponse {
  data: Partial<SubContractorRow>[];
}
