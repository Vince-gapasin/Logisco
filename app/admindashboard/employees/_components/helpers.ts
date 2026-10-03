import { AVAILABILITY, MANUAL_AVAILABILITY } from "@/app/lib/enums";
import type {
  ApiEmployee,
  EmployeeFormState,
  EmployeeRecord,
  UserSession,
} from "./types";

const SESSION_KEY = "logisco_user_session";

// ==========================================
// SESSION
// ==========================================

export function getAuthSession(): UserSession {
  const savedSession =
    localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);

  if (!savedSession) {
    throw new Error("Authentication session not found. Please log in again.");
  }

  try {
    const session = JSON.parse(savedSession) as UserSession;

    if (!session.token) {
      throw new Error("Authentication token not found.");
    }

    return session;
  } catch {
    throw new Error("Invalid authentication session. Please log in again.");
  }
}

// ==========================================
// API FETCH HELPER
// ==========================================


// ==========================================
// ERROR HELPER
// ==========================================

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

// ==========================================
// API EMPLOYEE -> UI EMPLOYEE
// ==========================================

export function mapApiEmployee(employee: ApiEmployee): EmployeeRecord {
  const nameParts =
    employee.employeeName?.trim().split(/\s+/).filter(Boolean) ?? [];

  const firstName = nameParts[0] || "Unknown";

  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  return {
    id: employee.employeeID,
    firstName,
    middleName: employee.middleName || "",
    lastName,
    suffix: employee.suffix || "",
    role: employee.role,
    // Booked or In Transit describes their trip, not a choice: the field
    // offers only what an admin can set.
    availability: MANUAL_AVAILABILITY.includes(
      (employee.availability ?? "") as (typeof MANUAL_AVAILABILITY)[number],
    )
      ? employee.availability
      : AVAILABILITY.available,
    gender: employee.gender || "",
    birthdate: employee.birthdate || "",
    address: employee.address || "",
    contactNumber: employee.contact || "",
    emailAddress: employee.emailAddress || "",
    bloodType: employee.bloodType || "",
    nationality: employee.nationality || "",
    religion: employee.religion || "",
    dateEmployed: employee.dateEmployed || "",
    driverLicenseType: employee.driverLicenseType || "",
    licenseNumber: employee.licenseNumber || "",
    licenseExpirationDate: employee.licenseExpirationDate || "",
    drivingExperience:
      employee.drivingExperience !== null
        ? String(employee.drivingExperience)
        : "",
    healthCondition: employee.healthStatus || "",
    drugTestStatus: employee.drugTestStatus || "",
    lastMedicalCheckup: employee.lastMedicalCheckup || "",
    emergencyContactPerson: employee.emergencyContactPerson || "",
    emergencyContactNumber: employee.emergencyContactNumber || "",
    relationship: employee.relationship || "",
    skills: employee.skills || "",
    remarks: employee.remarks || "",
    authId: employee.auth_id,
    isActive: employee.isActive === true,
    activation_sent_at: employee.activation_sent_at,
    activation_completed_at: employee.activation_completed_at,
  };
}

// ==========================================
// DATE FORMATTER
// ==========================================

export function formatDate(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

// ==========================================
// INITIAL FORM
// ==========================================

export function getInitialFormState(): EmployeeFormState {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    gender: "",
    birthdate: "",
    address: "",
    contactNumber: "",
    emailAddress: "",
    bloodType: "",
    nationality: "Filipino",
    religion: "",
    role: "",
    availability: "Available",
    dateEmployed: "",
    driverLicenseType: "",
    licenseNumber: "",
    licenseExpirationDate: "",
    drivingExperience: "",
    healthCondition: "",
    drugTestStatus: "",
    lastMedicalCheckup: "",
    emergencyContactPerson: "",
    emergencyContactNumber: "",
    relationship: "",
    skills: "",
    certificates: null,
    remarks: "",
  };
}
