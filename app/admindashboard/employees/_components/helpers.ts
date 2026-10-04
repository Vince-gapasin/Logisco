import { AVAILABILITY, MANUAL_AVAILABILITY } from "@/app/lib/enums";
import { formatDate as formatSharedDate } from "@/app/lib/datetime";
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
  // The first and last names as they were typed. Splitting employeeName on its
  // first space - which is all there was before they had columns - turned a
  // first name of two words into part of the last name. Kept only as the
  // fallback for a record saved before then.
  const nameParts =
    employee.employeeName?.trim().split(/\s+/).filter(Boolean) ?? [];
  const hasStoredNames = Boolean(employee.firstName?.trim() || employee.lastName?.trim());

  const firstName = hasStoredNames
    ? employee.firstName?.trim() || ""
    : nameParts[0] || "Unknown";

  const lastName = hasStoredNames
    ? employee.lastName?.trim() || ""
    : nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

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
    return "Not recorded";
  }
  return formatSharedDate(value);
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
