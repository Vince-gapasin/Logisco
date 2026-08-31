export interface Employee {
  employeeID: string;
  employeeCode: string | null;
  employeeName: string;
  role: string;
  availability: string;
  healthStatus: string;
  address: string;
  contact: string;
  auth_id: string | null;
  isActive: boolean | null;
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

