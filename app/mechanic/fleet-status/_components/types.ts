
import type { TruckTrip } from "@/services/truck/truckService";

export interface TruckRecord {
  id: string | number;
  truckCode?: string;
  plateNumber: string;
  truckType: string;
  truckModel: string;
  capacity: string;
  lastChecked: string;
  status: string;
  /** The booking it is on, when the fleet list sent one. */
  booking?: TruckTrip | null;
}

// What the maintenance endpoints hand back, before this screen flattens a log
// and its three phases into one record.
interface RawPhaseRow {
  phase?: string | null;
  issue?: string | null;
  remarks?: string | null;
  photoUrl?: string | null;
}
interface RawMechanicRow {
  role?: string | null;
  employeeID?: string | null;
  Employee?: { employeeName?: string | null } | null;
}
interface RawMaintenanceLog {
  id: string | number;
  truckID?: string | number;
  date?: string;
  created_at?: string;
  photoUrl?: string;
  photo_url?: string;
  statusBefore?: string;
  statusAfter?: string;
  Truck?: { plateNumber?: string; truckType?: string } | null;
  LogMechanics?: RawMechanicRow[] | null;
  LogNotes?: RawPhaseRow[] | null;
  LogPhotos?: RawPhaseRow[] | null;
}

export interface HistoryLogRecord {
  id: string | number;
  truckID?: string | number;
  plateNumber: string;
  truckType: string;
  primaryMechanicID?: string;
  mechanicName: string;
  additionalMechanicID?: string;
  additionalMechanic: string;
  issue: string;
  remarks: string;
  date: string;
  created_at?: string;
  photoUrl?: string;
  driversReport?: string;
  preliminaryRemarks?: string;
  preliminaryPhotoUrl?: string;
  additionalIssue?: string;
  progressRemarks?: string;
  progressPhotoUrl?: string;
  statusBefore?: string;
  statusAfter?: string;
  /** Whether a photo was recorded for that phase, even when its file is not loaded yet. */
  hasPreliminaryPhoto?: boolean;
  hasProgressPhoto?: boolean;
  hasFinalPhoto?: boolean;
}

export interface TruckOption {
  truckID: string | number;
  plateNumber: string;
  truckType: string;
}

export interface EmployeeOption {
  employeeID: string | number;
  employeeName: string;
  role: string;
}
