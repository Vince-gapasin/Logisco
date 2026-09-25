/* eslint-disable react-hooks/set-state-in-effect */
// EMPLOYEE_LOGIN_ACCESS_V1
// EMPLOYEE_COORDINATOR_READ_ONLY_V1
// EMPLOYEE_AUTOMATIC_AVAILABILITY_V5
// ==========================================
// LOGISCO - EMPLOYEE DIRECTORY
// ==========================================

"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { AVAILABILITY, MANUAL_AVAILABILITY } from "@/app/lib/enums";

import {
  Search,
  UserPlus,
  FileText,
  Filter,
  ChevronDown,
  X,
  Edit3,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  MailCheck,
  CheckCircle2,
  MoreHorizontal,
  UserCheck,
  UserX,
  Paperclip,
  HeartPulse,
} from "lucide-react";

// ==========================================
// TYPES
// ==========================================

type RoleType = "Admin" | "Coordinator" | "Mechanic" | "Driver" | "Helper";

interface UserSession {
  email: string;
  role: string;
  token: string;
  id: string;
  employeeName: string;
  route: string;
}

interface EmployeeRecord {
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

interface EmployeeFormState {
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

interface ApiEmployee {
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

interface EmployeesApiResponse {
  data: ApiEmployee[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface EmployeeApiResponse {
  message?: string;
  data: ApiEmployee;
}

interface MessageResponse {
  message: string;
}

// ==========================================
// CONFIG
// ==========================================

const ITEMS_PER_PAGE = 10;
const SESSION_KEY = "logisco_user_session";

// ==========================================
// SESSION
// ==========================================

function getAuthSession(): UserSession {
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

// ==========================================
// API EMPLOYEE -> UI EMPLOYEE
// ==========================================

function mapApiEmployee(employee: ApiEmployee): EmployeeRecord {
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

function formatDate(value?: string | null) {
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
// READ ONLY FIELD
// ==========================================

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <label className="block text-xs font-medium text-black mb-1">
        {label}
      </label>
      <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8">
        {value || "N/A"}
      </div>
    </div>
  );
}

// ==========================================
// INITIAL FORM
// ==========================================

function getInitialFormState(): EmployeeFormState {
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

// ==========================================
// EMPLOYEE MODAL
// ==========================================

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (
    formData: EmployeeFormState,
    editData?: EmployeeRecord | null,
  ) => Promise<void>;
  editData?: EmployeeRecord | null;
}

function EmployeeModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  editData,
}: EmployeeModalProps) {
  const [formData, setFormData] = useState<EmployeeFormState>(
    getInitialFormState(),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================
  // LOAD EDIT DATA
  // ==========================================

  useEffect(() => {
    if (editData) {
      setFormData({
        firstName: editData.firstName,
        middleName: editData.middleName,
        lastName: editData.lastName,
        suffix: editData.suffix,
        gender: editData.gender,
        birthdate: editData.birthdate ? editData.birthdate.split("T")[0] : "",
        address: editData.address,
        contactNumber: editData.contactNumber,
        emailAddress: editData.emailAddress,
        bloodType: editData.bloodType,
        nationality: editData.nationality || "Filipino",
        religion: editData.religion,
        role: editData.role,
        availability: editData.availability,
        dateEmployed: editData.dateEmployed
          ? editData.dateEmployed.split("T")[0]
          : "",
        driverLicenseType: editData.driverLicenseType,
        licenseNumber: editData.licenseNumber,
        licenseExpirationDate: editData.licenseExpirationDate
          ? editData.licenseExpirationDate.split("T")[0]
          : "",
        drivingExperience: editData.drivingExperience,
        healthCondition: editData.healthCondition,
        drugTestStatus: editData.drugTestStatus,
        lastMedicalCheckup: editData.lastMedicalCheckup
          ? editData.lastMedicalCheckup.split("T")[0]
          : "",
        emergencyContactPerson: editData.emergencyContactPerson,
        emergencyContactNumber: editData.emergencyContactNumber,
        relationship: editData.relationship,
        skills: editData.skills,
        certificates: null,
        remarks: editData.remarks,
      });
    } else {
      setFormData(getInitialFormState());
    }
    setErrors({});
  }, [editData, isOpen]);

  if (!isOpen) {
    return null;
  }

  // ==========================================
  // CHANGE
  // ==========================================

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target;

    if (name === "certificates" && event.target instanceof HTMLInputElement) {
      const file = event.target.files?.[0] ?? null;
      setFormData((previous) => ({
        ...previous,
        certificates: file,
      }));
    } else {
      setFormData((previous) => ({
        ...previous,
        [name]: value,
      }));
    }

    if (errors[name]) {
      setErrors((previous) => ({
        ...previous,
        [name]: "",
      }));
    }
  };

  // ==========================================
  // CLOSE
  // ==========================================

  const handleClose = () => {
    setFormData(getInitialFormState());
    setErrors({});
    onClose();
  };

  // ==========================================
  // SUBMIT
  // ==========================================

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required.";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required.";
    }

    if (!formData.role) {
      newErrors.role = "Role is required.";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required.";
    }

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = "Contact number is required.";
    }

    if (!formData.emailAddress.trim()) {
      newErrors.emailAddress = "Email address is required.";
    }

    if (!formData.healthCondition.trim()) {
      newErrors.healthCondition = "Health status is required.";
    }

    if (formData.role === "Driver") {
      if (!formData.licenseNumber.trim()) {
        newErrors.licenseNumber = "Driver's license number is required.";
      }

      if (!formData.driverLicenseType.trim()) {
        newErrors.driverLicenseType = "License type is required.";
      }

      if (!formData.licenseExpirationDate) {
        newErrors.licenseExpirationDate =
          "License expiration date is required.";
      }

      if (!formData.drivingExperience) {
        newErrors.drivingExperience = "Driving experience is required.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitSuccess(formData, editData);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // MODAL UI
  // ==========================================

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold tracking-wide">
            {editData ? "Edit Employee Record" : "New Employee Form"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 max-h-[80dvh] overflow-y-auto text-sm text-slate-900"
        >
          {/* ================================== */}
          {/* PERSONAL INFORMATION */}
          {/* ================================== */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Personal Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.firstName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Middle Name
                </label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleInputChange}
                  placeholder="Enter middle name"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.lastName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.lastName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Suffix
                </label>
                <input
                  type="text"
                  name="suffix"
                  value={formData.suffix}
                  onChange={handleInputChange}
                  placeholder="e.g. Jr., III"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Birthdate
                </label>
                <input
                  type="date"
                  name="birthdate"
                  value={formData.birthdate}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Enter residential address"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.address ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.address && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.address}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Number *
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  placeholder="Enter contact number"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.contactNumber}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="emailAddress"
                  value={formData.emailAddress}
                  onChange={handleInputChange}
                  disabled={Boolean(editData)}
                  placeholder="Enter email address"
                  className={`w-full border rounded-md px-3 py-2 text-xs font-normal placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${Boolean(editData) ? "bg-slate-100 text-slate-500 border-slate-300" : "bg-white text-black"} ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emailAddress && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.emailAddress}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Blood Type
                </label>
                <select
                  name="bloodType"
                  value={formData.bloodType}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">Select blood type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Nationality
                </label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  placeholder="Enter nationality"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Religion
                </label>
                <input
                  type="text"
                  name="religion"
                  value={formData.religion}
                  onChange={handleInputChange}
                  placeholder="Enter religion"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* ================================== */}
          {/* EMPLOYEE DETAILS */}
          {/* ================================== */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              2. Employee Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Role *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.role ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="">Select role</option>
                  <option value="Admin">Admin</option>
                  <option value="Coordinator">Coordinator</option>
                  <option value="Mechanic">Mechanic</option>
                  <option value="Driver">Driver</option>
                  <option value="Helper">Helper</option>
                </select>
                {errors.role && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">{errors.role}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Availability
                </label>
                <select
                  name="availability"
                  value={
                    MANUAL_AVAILABILITY.includes(formData.availability as (typeof MANUAL_AVAILABILITY)[number])
                      ? formData.availability
                      : AVAILABILITY.available
                  }
                  onChange={handleInputChange}
                  aria-describedby="availability-help"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                >
                  {MANUAL_AVAILABILITY.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <p
                  id="availability-help"
                  className="mt-1 text-xs text-slate-500"
                >
                  Set On Leave or Unavailable to keep them off deliveries. Booked and In Transit are shown
                  automatically from their trips.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Date Employed
                </label>
                <input
                  type="date"
                  name="dateEmployed"
                  value={formData.dateEmployed}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* ================================== */}
          {/* DRIVER */}
          {/* ================================== */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              3. Driver Information (if applicable)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Driver&apos;s License No.
                </label>
                <input
                  type="text"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                  placeholder="Enter license number"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.licenseNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.licenseNumber && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.licenseNumber}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  License Type / Restriction
                </label>
                <input
                  type="text"
                  name="driverLicenseType"
                  value={formData.driverLicenseType}
                  onChange={handleInputChange}
                  placeholder="e.g. Professional / 123"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.driverLicenseType ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.driverLicenseType && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.driverLicenseType}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  License Expiration Date
                </label>
                <input
                  type="date"
                  name="licenseExpirationDate"
                  value={formData.licenseExpirationDate}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.licenseExpirationDate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.licenseExpirationDate && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.licenseExpirationDate}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Driving Experience (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  name="drivingExperience"
                  value={formData.drivingExperience}
                  onChange={handleInputChange}
                  placeholder="Enter years of experience"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.drivingExperience ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.drivingExperience && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.drivingExperience}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ================================== */}
          {/* HEALTH */}
          {/* ================================== */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Health & Emergency Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Health Condition *
                </label>
                <select
                  name="healthCondition"
                  value={formData.healthCondition}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.healthCondition ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="">Select status</option>
                  <option value="Fit to Work">Fit to Work</option>
                  <option value="Unfit for Work">Unfit for Work</option>
                  <option value="Pending Medical Clearance">
                    Pending Medical Clearance
                  </option>
                </select>
                {errors.healthCondition && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.healthCondition}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Drug Test Status
                </label>
                <select
                  name="drugTestStatus"
                  value={formData.drugTestStatus}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">Select status</option>
                  <option value="Passed">Passed</option>
                  <option value="Failed">Failed</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Last Medical Check-up
                </label>
                <input
                  type="date"
                  name="lastMedicalCheckup"
                  value={formData.lastMedicalCheckup}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Emergency Contact Person
                </label>
                <input
                  type="text"
                  name="emergencyContactPerson"
                  value={formData.emergencyContactPerson}
                  onChange={handleInputChange}
                  placeholder="Enter contact person name"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Emergency Contact Number
                </label>
                <input
                  type="text"
                  name="emergencyContactNumber"
                  value={formData.emergencyContactNumber}
                  onChange={handleInputChange}
                  placeholder="Enter contact number"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  name="relationship"
                  value={formData.relationship}
                  onChange={handleInputChange}
                  placeholder="e.g. Spouse, Parent"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* ================================== */}
          {/* OTHER */}
          {/* ================================== */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              5. Other Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Skills / Specialization
                </label>
                <textarea
                  name="skills"
                  rows={2}
                  value={formData.skills}
                  onChange={handleInputChange}
                  placeholder="Enter skills or specializations..."
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Upload Certificates (PDF, JPG, PNG, DOCX)
                </label>
                <input
                  type="file"
                  name="certificates"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-700 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs sm:text-[10px] text-slate-500 mt-1">
                  Certificate upload is not connected yet.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Other Remarks
                </label>
                <textarea
                  name="remarks"
                  rows={2}
                  value={formData.remarks}
                  onChange={handleInputChange}
                  placeholder="Any additional remarks..."
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* BUTTONS */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
            >
              {isSubmitting && (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              )}
              {editData ? "Save Changes" : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// EMPLOYEE DETAIL
// ==========================================

interface EmployeeDetailViewProps {
  employee: EmployeeRecord;
  currentRole: string;
  onBack: () => void;
  onEdit: (employee: EmployeeRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  onToggleStatus: (employee: EmployeeRecord) => Promise<void>;
}

type EmployeeDetailTab = "overview" | "health" | "attachments";

function EmployeeDetailView({
  employee,
  currentRole,
  onBack,
  onEdit,
  onDelete,
  onActivate,
  onToggleStatus,
}: EmployeeDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] =
    useState<EmployeeDetailTab>("overview");
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentRole.toLowerCase() === "admin";
  const canEdit = isAdmin;

  const accountActivated = Boolean(employee.activation_completed_at);
  const activationCooldownMs = 15 * 60 * 1000;

  // Read lazily: calling the clock during render makes the render impure.
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!employee.activation_sent_at || accountActivated) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [employee.activation_sent_at, accountActivated]);

  const activationSentAt = employee.activation_sent_at
    ? new Date(employee.activation_sent_at).getTime()
    : null;

  const activationCooldownActive =
    !accountActivated &&
    activationSentAt !== null &&
    currentTime - activationSentAt < activationCooldownMs;

  const activationRemainingMs =
    activationCooldownActive && activationSentAt !== null
      ? activationCooldownMs - (currentTime - activationSentAt)
      : 0;

  const activationRemainingMinutes = Math.ceil(activationRemainingMs / 60000);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setIsMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // EXACT LOGIC FROM YOUR UPDATED CODE, modified only to safely close the UI modal
  const confirmDelete = async () => {
    try {
      setIsDeleting(true);

      await onDelete(employee.id);

      // Explicitly shut the modal to prevent any React state unmount warnings
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleActivation = async () => {
    try {
      setIsActivating(true);
      await onActivate(employee.id);
    } finally {
      setIsActivating(false);
    }
  };

  const confirmStatusChange = async () => {
    try {
      setIsUpdatingStatus(true);
      await onToggleStatus(employee);
      setShowStatusModal(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const employeeName = [
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.suffix,
  ]
    .filter(Boolean)
    .join(" ");

  const availabilityBadgeClass =
    employee.availability === AVAILABILITY.inTransit
      ? "bg-blue-100 text-blue-700"
      : employee.availability === AVAILABILITY.booked
        ? "bg-amber-100 text-amber-700"
        : employee.availability === AVAILABILITY.onLeave || employee.availability === AVAILABILITY.unavailable
          ? "bg-slate-200 text-slate-700"
          : "bg-emerald-100 text-emerald-700";

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] animate-fade-in">
      {/* PROFILE HEADER */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xs transition-colors hover:bg-slate-100"
            title="Back to Directory"
            aria-label="Back to Employee Directory"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-base font-bold text-blue-700 sm:h-14 sm:w-14 sm:text-lg">
              {employee.firstName ? employee.firstName[0] : "E"}
              {employee.lastName ? employee.lastName[0] : ""}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {employeeName || "Employee"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                  {employee.role}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    employee.isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {employee.isActive ? "Active" : "Inactive"}
                </span>
                {employee.isActive && (
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${availabilityBadgeClass}`}
                  >
                    {employee.availability || "Available"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {isAdmin && !accountActivated && (
            activationCooldownActive ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed"
              >
                <Loader2 className="h-4 w-4" />
                Resend in {activationRemainingMinutes} min
              </button>
            ) : (
              <button
                type="button"
                onClick={handleActivation}
                disabled={isActivating || !employee.emailAddress}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isActivating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MailCheck className="h-4 w-4" />
                )}
                {isActivating
                  ? "Sending Invite..."
                  : activationSentAt
                    ? "Resend Activation"
                    : "Allow Login"}
              </button>
            )
          )}

          {isAdmin && accountActivated && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Login Access
            </div>
          )}

          {canEdit && (
            <div ref={moreMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMoreOpen((open) => !open)}
                aria-expanded={isMoreOpen}
                aria-haspopup="menu"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
              >
                <MoreHorizontal className="h-4 w-4" />
                More
                <ChevronDown className="h-4 w-4" />
              </button>

              {isMoreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onEdit(employee);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-4 w-4 text-blue-600" />
                    Edit
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMoreOpen(false);
                      setShowStatusModal(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {employee.isActive ? (
                      <UserX className="h-4 w-4 text-amber-600" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                    )}
                    {employee.isActive ? "Disable" : "Enable"}
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMoreOpen(false);
                      setShowDeleteModal(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:px-6">
          {(
            [
              ["overview", "Overview"],
              ["health", "Health Info"],
              ["attachments", "Attachments"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 px-3 py-4 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === "overview" && (
            <div className="space-y-6 text-sm text-slate-900">
          {/* PERSONAL */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Personal Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <ReadField label="First Name" value={employee.firstName} />
              <ReadField label="Middle Name" value={employee.middleName} />
              <ReadField label="Last Name" value={employee.lastName} />
              <ReadField label="Suffix" value={employee.suffix} />
              <ReadField label="Gender" value={employee.gender} />
              <ReadField
                label="Birthdate"
                value={formatDate(employee.birthdate)}
              />
              <div className="sm:col-span-2">
                <ReadField label="Address" value={employee.address} />
              </div>
              <ReadField
                label="Contact Number"
                value={employee.contactNumber}
              />
              <ReadField label="Email Address" value={employee.emailAddress} />
              <ReadField label="Blood Type" value={employee.bloodType} />
              <ReadField label="Nationality" value={employee.nationality} />
              <ReadField label="Religion" value={employee.religion} />
            </div>
          </div>

              {/* EMPLOYMENT */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold tracking-wide text-black">
                  2. Employment Information
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ReadField label="Role" value={employee.role} />
                  <ReadField
                    label="Availability"
                    value={employee.availability}
                  />
                  <ReadField
                    label="Date Employed"
                    value={formatDate(employee.dateEmployed)}
                  />
                </div>
              </div>

              {/* DRIVER */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold tracking-wide text-black">
                  3. Driver Information (if applicable)
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <ReadField
                    label="Driver's License No."
                    value={employee.licenseNumber}
                  />
                  <ReadField
                    label="License Type / Restriction"
                    value={employee.driverLicenseType}
                  />
                  <ReadField
                    label="License Expiration Date"
                    value={formatDate(employee.licenseExpirationDate)}
                  />
                  <ReadField
                    label="Driving Experience (Years)"
                    value={
                      employee.drivingExperience
                        ? `${employee.drivingExperience} years`
                        : ""
                    }
                  />
                </div>
              </div>

              {/* OTHER */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold tracking-wide text-black">
                  4. Other Information
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <ReadField
                      label="Skills / Specialization"
                      value={employee.skills}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <ReadField label="Other Remarks" value={employee.remarks} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "health" && (
            <div className="space-y-6 text-sm text-slate-900">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 text-sm font-semibold tracking-wide text-black">
                  <HeartPulse className="h-4 w-4 text-blue-600" />
                  Health & Emergency Information
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <ReadField
                    label="Health Condition"
                    value={employee.healthCondition}
                  />
                  <ReadField
                    label="Drug Test Status"
                    value={employee.drugTestStatus}
                  />
                  <ReadField
                    label="Last Medical Check-up"
                    value={formatDate(employee.lastMedicalCheckup)}
                  />
                  <ReadField
                    label="Emergency Contact Person"
                    value={employee.emergencyContactPerson}
                  />
                  <ReadField
                    label="Emergency Contact Number"
                    value={employee.emergencyContactNumber}
                  />
                  <ReadField
                    label="Relationship"
                    value={employee.relationship}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "attachments" && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Paperclip className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Employee Attachments
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Medical documents, certificates, and other employee files will
                appear here when attachment storage is connected.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* STATUS MODAL */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
            <div
              className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                employee.isActive
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {employee.isActive ? (
                <UserX className="h-6 w-6" />
              ) : (
                <UserCheck className="h-6 w-6" />
              )}
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">
              {employee.isActive ? "Disable Employee" : "Enable Employee"}
            </h3>
            <p className="mb-6 text-sm leading-6 text-slate-600">
              {employee.isActive
                ? `Disable ${employeeName}? They will no longer be treated as an active employee.`
                : `Enable ${employeeName}? They will be restored as an active employee.`}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                disabled={isUpdatingStatus}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStatusChange}
                disabled={isUpdatingStatus}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition-colors disabled:opacity-50 ${
                  employee.isActive
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isUpdatingStatus && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {employee.isActive ? "Confirm Disable" : "Confirm Enable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Employee Record
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900">
                {employee.firstName} {employee.lastName}
              </strong>
              ? This will permanently remove the record.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md flex items-center justify-center gap-2"
              >
                {isDeleting && (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                )}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN PAGE
// ==========================================

export default function EmployeesPage() {
  const [currentSession, setCurrentSession] = useState<UserSession | null>(
    null,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeRecord | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(
    null,
  );

  const [employeeList, setEmployeeList] = useState<EmployeeRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const roles = [
    "All Roles",
    "Admin",
    "Coordinator",
    "Mechanic",
    "Driver",
    "Helper",
  ];

  // ==========================================
  // SESSION
  // ==========================================

  useEffect(() => {
    try {
      setCurrentSession(getAuthSession());
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, []);

  // Toast clearing logic
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  // ==========================================
  // FETCH EMPLOYEES
  // ==========================================

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("sortBy", "employeeName");
      params.set("sortOrder", "asc");

      if (debouncedSearchTerm) {
        params.set("search", debouncedSearchTerm);
      }
      if (selectedRole !== "All Roles") {
        params.set("role", selectedRole);
      }

      const response = await apiFetch<EmployeesApiResponse>(
        `/api/employees?${params.toString()}`,
      );

      setEmployeeList(response.data.map(mapApiEmployee));
      setTotalEmployees(response.pagination.total);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
    } catch (error) {
      console.error("Fetch employees error:", error);
      setEmployeeList([]);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, selectedRole]);

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  // ==========================================
  // GET ONE
  // ==========================================

  const handleRowClick = async (id: string) => {
    try {
      setErrorMessage("");
      const response = await apiFetch<EmployeeApiResponse>(
        `/api/employees/${id}`,
      );
      setSelectedEmployee(mapApiEmployee(response.data));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  // Refresh an open profile once per minute so the three-hour Booked window
  // and live dispatch status can change without reopening the employee.
  useEffect(() => {
    const employeeID = selectedEmployee?.id;
    if (!employeeID) return;

    const refreshAvailability = async () => {
      try {
        const response = await apiFetch<EmployeeApiResponse>(
          `/api/employees/${employeeID}`,
        );
        setSelectedEmployee(mapApiEmployee(response.data));
      } catch (error) {
        console.error("Refresh employee availability error:", error);
      }
    };

    const interval = window.setInterval(() => {
      void refreshAvailability();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [selectedEmployee?.id]);

  // ==========================================
  // CREATE / UPDATE
  // ==========================================

  const handleModalSubmit = async (
    formData: EmployeeFormState,
    editData?: EmployeeRecord | null,
  ) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      if (editData) {
        const updatePayload = {
          employeeName: `${formData.firstName} ${formData.lastName}`.trim(),
          middleName: formData.middleName || null,
          suffix: formData.suffix || null,
          role: formData.role,
          gender: formData.gender || null,
          birthdate: formData.birthdate || null,
          address: formData.address,
          contact: formData.contactNumber,
          bloodType: formData.bloodType || null,
          nationality: formData.nationality || null,
          religion: formData.religion || null,
          dateEmployed: formData.dateEmployed || null,
          driverLicenseType: formData.driverLicenseType || null,
          licenseNumber: formData.licenseNumber || null,
          licenseExpirationDate: formData.licenseExpirationDate || null,
          drivingExperience: formData.drivingExperience
            ? Number(formData.drivingExperience)
            : null,
          healthStatus: formData.healthCondition,
          drugTestStatus: formData.drugTestStatus || null,
          lastMedicalCheckup: formData.lastMedicalCheckup || null,
          emergencyContactPerson: formData.emergencyContactPerson || null,
          emergencyContactNumber: formData.emergencyContactNumber || null,
          relationship: formData.relationship || null,
          skills: formData.skills || null,
          remarks: formData.remarks || null,
          // Only what an admin set; a trip state is never sent back.
          availability: MANUAL_AVAILABILITY.includes(
            formData.availability as (typeof MANUAL_AVAILABILITY)[number],
          )
            ? formData.availability
            : AVAILABILITY.available,
        };

        const hasChanges =
          updatePayload.availability !==
            (MANUAL_AVAILABILITY.includes(editData.availability as (typeof MANUAL_AVAILABILITY)[number])
              ? editData.availability
              : AVAILABILITY.available) ||
          updatePayload.employeeName !==
            `${editData.firstName} ${editData.lastName}`.trim() ||
          updatePayload.middleName !== (editData.middleName || null) ||
          updatePayload.suffix !== (editData.suffix || null) ||
          updatePayload.role !== editData.role ||
          updatePayload.gender !== (editData.gender || null) ||
          updatePayload.birthdate !==
            (editData.birthdate ? editData.birthdate.split("T")[0] : null) ||
          updatePayload.address !== editData.address ||
          updatePayload.contact !== editData.contactNumber ||
          updatePayload.bloodType !== (editData.bloodType || null) ||
          updatePayload.nationality !== (editData.nationality || null) ||
          updatePayload.religion !== (editData.religion || null) ||
          updatePayload.dateEmployed !==
            (editData.dateEmployed
              ? editData.dateEmployed.split("T")[0]
              : null) ||
          updatePayload.driverLicenseType !==
            (editData.driverLicenseType || null) ||
          updatePayload.licenseNumber !== (editData.licenseNumber || null) ||
          updatePayload.licenseExpirationDate !==
            (editData.licenseExpirationDate
              ? editData.licenseExpirationDate.split("T")[0]
              : null) ||
          updatePayload.drivingExperience !==
            (editData.drivingExperience
              ? Number(editData.drivingExperience)
              : null) ||
          updatePayload.healthStatus !== editData.healthCondition ||
          updatePayload.drugTestStatus !== (editData.drugTestStatus || null) ||
          updatePayload.lastMedicalCheckup !==
            (editData.lastMedicalCheckup
              ? editData.lastMedicalCheckup.split("T")[0]
              : null) ||
          updatePayload.emergencyContactPerson !==
            (editData.emergencyContactPerson || null) ||
          updatePayload.emergencyContactNumber !==
            (editData.emergencyContactNumber || null) ||
          updatePayload.relationship !== (editData.relationship || null) ||
          updatePayload.skills !== (editData.skills || null) ||
          updatePayload.remarks !== (editData.remarks || null) ||
          Boolean(formData.certificates);

        if (!hasChanges) {
          setErrorMessage("No changes were made.");
          setIsModalOpen(false);
          setEditingEmployee(null);
          return;
        }

        await apiFetch<EmployeeApiResponse>(`/api/employees/${editData.id}`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        });

        if (selectedEmployee) {
          await handleRowClick(editData.id);
        }

        setSuccessMessage("Employee updated successfully.");
        setEditingEmployee(null);
      } else {
        const createPayload = {
          employeeID: crypto.randomUUID(),
          employeeName: `${formData.firstName} ${formData.lastName}`.trim(),
          middleName: formData.middleName || null,
          suffix: formData.suffix || null,
          role: formData.role,
          availability: "Available",
          healthStatus: formData.healthCondition,
          address: formData.address,
          contact: formData.contactNumber,
          emailAddress: formData.emailAddress,
          isActive: true,
          gender: formData.gender || null,
          birthdate: formData.birthdate || null,
          bloodType: formData.bloodType || null,
          nationality: formData.nationality || null,
          religion: formData.religion || null,
          dateEmployed: formData.dateEmployed || null,
          driverLicenseType: formData.driverLicenseType || null,
          licenseNumber: formData.licenseNumber || null,
          licenseExpirationDate: formData.licenseExpirationDate || null,
          drivingExperience: formData.drivingExperience
            ? Number(formData.drivingExperience)
            : null,
          drugTestStatus: formData.drugTestStatus || null,
          lastMedicalCheckup: formData.lastMedicalCheckup || null,
          emergencyContactPerson: formData.emergencyContactPerson || null,
          emergencyContactNumber: formData.emergencyContactNumber || null,
          relationship: formData.relationship || null,
          skills: formData.skills || null,
          remarks: formData.remarks || null,
        };

        await apiFetch<EmployeeApiResponse>("/api/employees", {
          method: "POST",
          body: JSON.stringify(createPayload),
        });

        setSuccessMessage(
          "Employee created successfully. You can activate the login account from the employee profile.",
        );
      }

      setIsModalOpen(false);
      await fetchEmployees();
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      throw error;
    }
  };

  // ==========================================
  // ACTIVATE ACCOUNT
  // ==========================================

  const handleActivateEmployee = async (id: string) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");
      const response = await apiFetch<MessageResponse>(
        `/api/employees/${id}/activate`,
        {
          method: "POST",
        },
      );
      setSuccessMessage(
        response.message || "Activation email sent successfully.",
      );
      await handleRowClick(id);
      await fetchEmployees();
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      throw error;
    }
  };

  // ==========================================
  // ENABLE / DISABLE EMPLOYEE
  // ==========================================

  const handleToggleEmployeeStatus = async (employee: EmployeeRecord) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      await apiFetch<EmployeeApiResponse>(`/api/employees/${employee.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !employee.isActive }),
      });

      setSuccessMessage(
        employee.isActive
          ? "Employee disabled successfully."
          : "Employee enabled successfully.",
      );

      await handleRowClick(employee.id);
      await fetchEmployees();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    }
  };

  // ==========================================
  // DELETE (Exactly matched to your updated code logic)
  // ==========================================

  const handleDeleteEmployee = async (id: string) => {
    try {
      await apiFetch<MessageResponse>(`/api/employees/${id}`, {
        method: "DELETE",
      });

      setSelectedEmployee(null);

      setSuccessMessage("Employee deleted successfully.");

      await fetchEmployees();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));

      throw error;
    }
  };

  // ==========================================
  // DROPDOWN OUTSIDE CLICK
  // ==========================================

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const renderToasts = () => {
    if (!successMessage && !errorMessage) return null;
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-100 animate-in fade-in slide-in-from-bottom-5">
        <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-slate-700">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              errorMessage ? "bg-red-500" : "bg-emerald-500"
            }`}
          >
            {errorMessage ? (
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
          {errorMessage || successMessage}
        </div>
      </div>
    );
  };

  // ==========================================
  // DETAIL
  // ==========================================

  if (selectedEmployee) {
    return (
      <>
        {renderToasts()}
        <EmployeeDetailView
          employee={selectedEmployee}
          currentRole={currentSession?.role || ""}
          onBack={() => setSelectedEmployee(null)}
          onEdit={(employee) => {
            setEditingEmployee(employee);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteEmployee}
          onActivate={handleActivateEmployee}
          onToggleStatus={handleToggleEmployeeStatus}
        />
        <EmployeeModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEmployee(null);
          }}
          onSubmitSuccess={handleModalSubmit}
          editData={editingEmployee}
        />
      </>
    );
  }

  // ==========================================
  // PAGINATION SETUP
  // ==========================================

  const startIndex =
    totalEmployees === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalEmployees);
  const currentRole = currentSession?.role?.toLowerCase() || "";
  const canCreate = currentRole === "admin";

  // ==========================================
  // DIRECTORY
  // ==========================================

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Employee Directory
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your staff listings, employee profiles, and directory
            records.
          </p>
        </div>

        {canCreate && (
          <div className="flex justify-center sm:justify-start w-full sm:w-auto">
            <button
              onClick={() => {
                setEditingEmployee(null);
                setIsModalOpen(true);
              }}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Add Employee</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* FILTERS */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            List of Employees
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <UrlSearchSync onQuery={setSearchTerm} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={
                  selectedRole === "All Roles"
                    ? "Search employees..."
                    : `Search ${selectedRole.toLowerCase()}s...`
                }
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full sm:w-auto inline-flex items-center justify-between gap-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium rounded-xl px-4 py-2.5 text-sm transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Role:{" "}
                    <strong className="text-slate-900 font-semibold">
                      {selectedRole}
                    </strong>
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white border border-slate-100 rounded-xl shadow-lg z-20 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {roles.map((role) => {
                    const isSelected = selectedRole === role;
                    return (
                      <button
                        type="button"
                        key={role}
                        onClick={() => {
                          setCurrentPage(1);
                          setSelectedRole(role);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-blue-50 text-blue-600 font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>{role}</span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto min-h-135">
          <table className="w-full text-left border-collapse md:min-w-200 table-fixed">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6 w-[45%] md:w-[25%]">Name</th>
                <th className="py-3.5 px-4 sm:px-6 w-[25%] md:w-[15%]">Role</th>
                <th className="hidden md:table-cell py-3.5 px-4 sm:px-6 w-[20%]">Address</th>
                <th className="hidden md:table-cell py-3.5 px-4 sm:px-6 w-[20%]">Contact</th>
                <th className="py-3.5 px-4 sm:px-6 w-[30%] md:w-[20%]">Account</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                      <p className="text-slate-900 font-medium text-sm">
                        Loading records...
                      </p>
                      <p className="text-slate-600 text-xs mt-1">
                        Please wait while we fetch the employee directory.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : employeeList.length > 0 ? (
                employeeList.map((employee) => (
                  <tr
                    key={employee.id}
                    onClick={() => handleRowClick(employee.id)}
                    className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-sm text-slate-800"
                    title="Click to view complete employee record"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 truncate">
                      {employee.firstName}{" "}
                      {employee.middleName ? `${employee.middleName[0]}. ` : ""}
                      {employee.lastName} {employee.suffix}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 truncate">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                        {employee.role}
                      </span>
                    </td>
                    <td
                      className="hidden md:table-cell py-3.5 px-4 sm:px-6 truncate"
                      title={employee.address}
                    >
                      {employee.address || "N/A"}
                    </td>
                    <td
                      className="hidden md:table-cell py-3.5 px-4 sm:px-6 truncate"
                      title={employee.contactNumber}
                    >
                      {employee.contactNumber || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 truncate">
                      {employee.activation_completed_at ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 whitespace-nowrap">
                          Login Access ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                          No Access
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        No records found{" "}
                        {selectedRole !== "All Roles"
                          ? `for role "${selectedRole}"`
                          : ""}
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        Staff listings and employee profiles will appear here
                        once connected to your backend database or added via the
                        form.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {startIndex} to {endIndex} of {totalEmployees} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setCurrentPage((previous) => Math.max(previous - 1, 1))
              }
              disabled={currentPage <= 1 || isLoading}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage <= 1 || isLoading
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Previous
            </button>
            <span className="mx-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((previous) => Math.min(previous + 1, totalPages))
              }
              disabled={currentPage >= totalPages || isLoading}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage >= totalPages || isLoading
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEmployee(null);
        }}
        onSubmitSuccess={handleModalSubmit}
        editData={editingEmployee}
      />

      {renderToasts()}
    </div>
  );
}
