
// ==========================================
// TYPES
// ==========================================

type RoleType = "Admin" | "Coordinator" | "Mechanic" | "Driver" | "Helper";

export interface UserSession {
  email: string;
  role: string;
  token: string;
  id: string;
  employeeName: string;
  route: string;
}

export interface EmployeeRecord {
  id: string;

  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;

  role: RoleType;
  availability: string;

  gender: string;
  birthdate: string;

  address: string;
  contactNumber: string;
  emailAddress: string;

  bloodType: string;
  nationality: string;
  religion: string;

  dateEmployed: string;

  driverLicenseType: string;
  licenseNumber: string;
  licenseExpirationDate: string;
  drivingExperience: string;

  healthCondition: string;
  drugTestStatus: string;
  lastMedicalCheckup: string;

  emergencyContactPerson: string;
  emergencyContactNumber: string;
  relationship: string;

  skills: string;
  remarks: string;

  isActive: boolean;
  authId: string | null;
  activation_sent_at?: string | null;
  activation_completed_at?: string | null;
}

export interface EmployeeFormState {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;

  gender: string;
  birthdate: string;

  address: string;
  contactNumber: string;
  emailAddress: string;

  bloodType: string;
  nationality: string;
  religion: string;

  role: RoleType | "";
  availability: string;

  dateEmployed: string;

  driverLicenseType: string;
  licenseNumber: string;
  licenseExpirationDate: string;
  drivingExperience: string;

  healthCondition: string;
  drugTestStatus: string;
  lastMedicalCheckup: string;

  emergencyContactPerson: string;
  emergencyContactNumber: string;
  relationship: string;

  skills: string;
  certificates: File | null;
  remarks: string;
}

export interface ApiEmployee {
  employeeID: string;
  employeeCode: string | null;

  employeeName: string;

  role: RoleType;
  availability: string;
  healthStatus: string;

  address: string;
  contact: string;

  auth_id: string | null;
  isActive: boolean | null;
  activation_sent_at?: string | null;
  activation_completed_at?: string | null;

  birthdate: string | null;
  middleName: string | null;
  suffix: string | null;
  gender: string | null;

  emailAddress: string | null;

  bloodType: string | null;
  nationality: string | null;
  religion: string | null;

  dateEmployed: string | null;

  driverLicenseType: string | null;
  licenseNumber: string | null;
  licenseExpirationDate: string | null;
  drivingExperience: number | null;

  drugTestStatus: string | null;
  lastMedicalCheckup: string | null;

  emergencyContactPerson: string | null;
  emergencyContactNumber: string | null;
  relationship: string | null;

  skills: string | null;
  remarks: string | null;
}

export interface EmployeesApiResponse {
  data: ApiEmployee[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EmployeeApiResponse {
  message?: string;
  data: ApiEmployee;
}

export interface MessageResponse {
  message: string;
}
