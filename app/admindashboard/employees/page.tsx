/* eslint-disable react-hooks/set-state-in-effect */
// ==========================================
// LOGISCO - EMPLOYEE DIRECTORY
// ==========================================

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

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

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const session = getAuthSession();

  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${session.token}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let result: unknown = null;

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    result = await response.json();
  }

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "message" in result
        ? String(
            (
              result as {
                message: unknown;
              }
            ).message,
          )
        : `Request failed with status ${response.status}`;

    if (response.status === 401) {
      localStorage.removeItem(SESSION_KEY);

      sessionStorage.removeItem(SESSION_KEY);
    }

    throw new Error(message);
  }

  return result as T;
}

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

    availability: employee.availability || "",

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

  // Custom Dropdown
  const [isGenderOpen, setIsGenderOpen] = useState(false);
  const [isBloodTypeOpen, setIsBloodTypeOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [isDrugTestOpen, setIsDrugTestOpen] = useState(false);

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
    event:
      | React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
      | { target: { name: string; value: any } },
  ) => {
    const { name, value } = event.target as HTMLInputElement;

    if (name === "certificates" && (event.target as HTMLInputElement).files) {
      const file = (event.target as HTMLInputElement).files?.[0] ?? null;

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
    setIsGenderOpen(false);
    setIsBloodTypeOpen(false);
    setIsRoleOpen(false);
    setIsDrugTestOpen(false);
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

    if (!formData.availability.trim()) {
      newErrors.availability = "Availability is required.";
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
          className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900"
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
                  <p className="text-red-500 text-[11px] mt-1">
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
                  <p className="text-red-500 text-[11px] mt-1">
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

              {/* Gender Custom Dropdown */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Gender
                </label>
                <div
                  className={`relative w-full ${isGenderOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isGenderOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsGenderOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setIsGenderOpen(!isGenderOpen)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 text-black transition-all"
                  >
                    <span
                      className={
                        formData.gender ? "text-black" : "text-slate-400"
                      }
                    >
                      {formData.gender || "Select gender"}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
                        isGenderOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isGenderOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto text-left">
                      {["Male", "Female", "Prefer not to say"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            handleInputChange({
                              target: { name: "gender", value: opt },
                            });
                            setIsGenderOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                            formData.gender === opt
                              ? "bg-blue-50/50 text-blue-700 font-medium"
                              : "text-slate-700"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  <p className="text-red-500 text-[11px] mt-1">
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
                  <p className="text-red-500 text-[11px] mt-1">
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
                  placeholder="Enter email"
                  className={`w-full border rounded-md px-3 py-2 text-xs font-normal placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                    Boolean(editData)
                      ? "bg-slate-100 text-slate-500 border-slate-300"
                      : errors.emailAddress
                        ? "bg-red-50/20 border-red-500 text-black"
                        : "bg-white border-slate-300 text-black"
                  }`}
                />
                {errors.emailAddress && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.emailAddress}
                  </p>
                )}
              </div>

              {/* Blood Type Custom Dropdown */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Blood Type
                </label>
                <div
                  className={`relative w-full ${isBloodTypeOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isBloodTypeOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsBloodTypeOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setIsBloodTypeOpen(!isBloodTypeOpen)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 text-black transition-all"
                  >
                    <span
                      className={
                        formData.bloodType ? "text-black" : "text-slate-400"
                      }
                    >
                      {formData.bloodType || "Select blood type"}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
                        isBloodTypeOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isBloodTypeOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto text-left">
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                        (opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              handleInputChange({
                                target: { name: "bloodType", value: opt },
                              });
                              setIsBloodTypeOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                              formData.bloodType === opt
                                ? "bg-blue-50/50 text-blue-700 font-medium"
                                : "text-slate-700"
                            }`}
                          >
                            {opt}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
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
              {/* Role Custom Dropdown */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Role *
                </label>
                <div
                  className={`relative w-full ${isRoleOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isRoleOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsRoleOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setIsRoleOpen(!isRoleOpen)}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${
                      errors.role
                        ? "border-red-500 bg-red-50/20 text-black"
                        : "border-slate-300 text-black"
                    }`}
                  >
                    <span
                      className={
                        formData.role ? "text-black" : "text-slate-400"
                      }
                    >
                      {formData.role || "Select role"}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
                        isRoleOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isRoleOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto text-left">
                      {[
                        "Admin",
                        "Coordinator",
                        "Mechanic",
                        "Driver",
                        "Helper",
                      ].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            handleInputChange({
                              target: { name: "role", value: opt },
                            });
                            setIsRoleOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                            formData.role === opt
                              ? "bg-blue-50/50 text-blue-700 font-medium"
                              : "text-slate-700"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.role && (
                  <p className="text-red-500 text-[11px] mt-1">{errors.role}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Availability *
                </label>

                <input
                  type="text"
                  name="availability"
                  value={formData.availability}
                  onChange={handleInputChange}
                  placeholder="e.g. Available, On Leave"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.availability ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />

                {errors.availability && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.availability}
                  </p>
                )}
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
              3. Driver Information
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
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.licenseNumber}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  License Type
                </label>

                <input
                  type="text"
                  name="driverLicenseType"
                  value={formData.driverLicenseType}
                  onChange={handleInputChange}
                  placeholder="e.g. Professional / Restriction codes"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.driverLicenseType ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.driverLicenseType && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.driverLicenseType}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  License Expiration
                </label>

                <input
                  type="date"
                  name="licenseExpirationDate"
                  value={formData.licenseExpirationDate}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.licenseExpirationDate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.licenseExpirationDate && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.licenseExpirationDate}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Driving Experience
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
                  <p className="text-red-500 text-[11px] mt-1">
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
                  Health Status *
                </label>

                <input
                  type="text"
                  name="healthCondition"
                  value={formData.healthCondition}
                  onChange={handleInputChange}
                  placeholder="e.g. Fit to Work"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.healthCondition ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />

                {errors.healthCondition && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.healthCondition}
                  </p>
                )}
              </div>

              {/* Drug Test Status Custom Dropdown */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Drug Test Status
                </label>
                <div
                  className={`relative w-full ${isDrugTestOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isDrugTestOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsDrugTestOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDrugTestOpen(!isDrugTestOpen)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 text-black transition-all"
                  >
                    <span
                      className={
                        formData.drugTestStatus
                          ? "text-black"
                          : "text-slate-400"
                      }
                    >
                      {formData.drugTestStatus || "Select status"}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
                        isDrugTestOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isDrugTestOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto text-left">
                      {["Passed", "Failed", "Pending"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            handleInputChange({
                              target: { name: "drugTestStatus", value: opt },
                            });
                            setIsDrugTestOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                            formData.drugTestStatus === opt
                              ? "bg-blue-50/50 text-blue-700 font-medium"
                              : "text-slate-700"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  placeholder="Enter contact person"
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
                  placeholder="Enter emergency number"
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
                  placeholder="e.g. Spouse, Parent, Sibling"
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
                  Upload Certificates
                </label>

                <input
                  type="file"
                  name="certificates"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-700 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />

                <p className="text-[10px] text-slate-500 mt-1">
                  Certificate upload is not connected yet.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Remarks
                </label>

                <textarea
                  name="remarks"
                  rows={2}
                  value={formData.remarks}
                  onChange={handleInputChange}
                  placeholder="Add any additional remarks..."
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* BUTTONS */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 bg-blue-700 hover:bg-black text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}

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
}

function EmployeeDetailView({
  employee,
  currentRole,
  onBack,
  onEdit,
  onDelete,
  onActivate,
}: EmployeeDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  const [isActivating, setIsActivating] = useState(false);

  const isAdmin = currentRole.toLowerCase() === "admin";

  const canEdit = ["admin", "coordinator"].includes(currentRole.toLowerCase());

  const accountActivated = Boolean(employee.isActive);

  const activationCooldownMs = 0 * 60 * 1000; //set 15

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!employee.activation_sent_at || employee.isActive) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [employee.activation_sent_at, employee.isActive]);

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

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);

      await onDelete(employee.id);
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

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
            title="Back to Directory"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Employee Information Record
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Complete employee profile and account management.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* ACTIVATE ACCOUNT */}
          {isAdmin &&
            (accountActivated ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-default shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                Account Activated
              </button>
            ) : activationCooldownActive ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-500 border border-slate-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-not-allowed shadow-md"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Resend in {activationRemainingMinutes} min
              </button>
            ) : (
              <button
                type="button"
                onClick={handleActivation}
                disabled={isActivating || !employee.emailAddress}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isActivating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MailCheck className="w-4 h-4" />
                )}

                {isActivating
                  ? "Sending Invite..."
                  : activationSentAt
                    ? "Resend Activation"
                    : "Activate Account"}
              </button>
            ))}

          {/* EDIT */}
          {canEdit && (
            <button
              onClick={() => onEdit(employee)}
              className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Employee</span>
            </button>
          )}

          {/* DELETE */}
          {isAdmin && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        {/* PROFILE SUMMARY */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold border border-blue-100">
              {employee.firstName ? employee.firstName[0] : "E"}

              {employee.lastName ? employee.lastName[0] : ""}
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {employee.firstName} {employee.middleName} {employee.lastName}{" "}
                {employee.suffix}
              </h2>

              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {employee.role}
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    employee.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {employee.isActive ? "Active" : "Inactive"}
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    accountActivated
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {accountActivated
                    ? "Login Account Activated"
                    : "Login Account Not Activated"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PERSONAL */}
        <div className="space-y-6 text-sm text-slate-900">
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

          {/* EMPLOYEE */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              2. Employee Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ReadField label="Role" value={employee.role} />

              <ReadField label="Availability" value={employee.availability} />

              <ReadField
                label="Date Employed"
                value={formatDate(employee.dateEmployed)}
              />
            </div>
          </div>

          {/* DRIVER */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              3. Driver Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <ReadField label="License No." value={employee.licenseNumber} />

              <ReadField
                label="License Type"
                value={employee.driverLicenseType}
              />

              <ReadField
                label="Expiration"
                value={formatDate(employee.licenseExpirationDate)}
              />

              <ReadField
                label="Experience"
                value={
                  employee.drivingExperience
                    ? `${employee.drivingExperience} years`
                    : ""
                }
              />
            </div>
          </div>

          {/* HEALTH */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Health & Emergency Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <ReadField
                label="Health Status"
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
                label="Emergency Contact"
                value={employee.emergencyContactPerson}
              />

              <ReadField
                label="Emergency Number"
                value={employee.emergencyContactNumber}
              />

              <ReadField label="Relationship" value={employee.relationship} />
            </div>
          </div>

          {/* OTHER */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              5. Other Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <ReadField
                  label="Skills / Specialization"
                  value={employee.skills}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Certificates Record
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  No certificate uploaded or available
                </div>
              </div>

              <ReadField label="Remarks" value={employee.remarks} />
            </div>
          </div>
        </div>
      </div>

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

            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900">
                {employee.firstName} {employee.lastName}
              </strong>
              ? This action is permanent.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
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

  const [selectedRole, setSelectedRole] = useState("All Roles");

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  // Exact state restored from original updated code
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
  // TOAST AUTO-HIDE LOGIC
  // ==========================================
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  // ==========================================
  // TOAST RENDERER
  // ==========================================
  const renderToast = () => {
    if (!successMessage && !errorMessage) return null;
    const isError = !!errorMessage;
    const message = errorMessage || successMessage;
    const isNoChanges = message === "No changes were made.";

    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-100 animate-in fade-in slide-in-from-bottom-5">
        <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-slate-700">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              isError
                ? "bg-red-500"
                : isNoChanges
                  ? "bg-blue-500"
                  : "bg-emerald-500"
            }`}
          >
            {isNoChanges ? (
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : isError ? (
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
          {message}
        </div>
      </div>
    );
  };

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

      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
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
  }, [currentPage, searchTerm, selectedRole]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchEmployees();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [fetchEmployees]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole]);

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

      // ======================================
      // CHECK IF NO CHANGES WERE MADE
      // ======================================
      if (editData) {
        const originalBirthdate = editData.birthdate
          ? editData.birthdate.split("T")[0]
          : "";
        const originalDateEmployed = editData.dateEmployed
          ? editData.dateEmployed.split("T")[0]
          : "";
        const originalLicenseExp = editData.licenseExpirationDate
          ? editData.licenseExpirationDate.split("T")[0]
          : "";
        const originalMedCheck = editData.lastMedicalCheckup
          ? editData.lastMedicalCheckup.split("T")[0]
          : "";

        const isChanged =
          formData.firstName !== editData.firstName ||
          formData.middleName !== editData.middleName ||
          formData.lastName !== editData.lastName ||
          formData.suffix !== (editData.suffix || "") ||
          formData.role !== editData.role ||
          formData.availability !== editData.availability ||
          formData.gender !== (editData.gender || "") ||
          formData.birthdate !== originalBirthdate ||
          formData.address !== editData.address ||
          formData.contactNumber !== editData.contactNumber ||
          formData.emailAddress !== editData.emailAddress ||
          formData.bloodType !== (editData.bloodType || "") ||
          formData.nationality !== (editData.nationality || "Filipino") ||
          formData.religion !== (editData.religion || "") ||
          formData.dateEmployed !== originalDateEmployed ||
          formData.driverLicenseType !== (editData.driverLicenseType || "") ||
          formData.licenseNumber !== (editData.licenseNumber || "") ||
          formData.licenseExpirationDate !== originalLicenseExp ||
          String(formData.drivingExperience || "") !==
            String(editData.drivingExperience || "") ||
          formData.healthCondition !== editData.healthCondition ||
          formData.drugTestStatus !== (editData.drugTestStatus || "") ||
          formData.lastMedicalCheckup !== originalMedCheck ||
          formData.emergencyContactPerson !==
            (editData.emergencyContactPerson || "") ||
          formData.emergencyContactNumber !==
            (editData.emergencyContactNumber || "") ||
          formData.relationship !== (editData.relationship || "") ||
          formData.skills !== (editData.skills || "") ||
          formData.remarks !== (editData.remarks || "") ||
          Boolean(formData.certificates);

        if (!isChanged) {
          setSuccessMessage("No changes were made.");
          setEditingEmployee(null);
          setIsModalOpen(false);
          return;
        }
      }

      // ======================================
      // UPDATE
      // ======================================

      if (editData) {
        const updatePayload = {
          employeeName: `${formData.firstName} ${formData.lastName}`.trim(),

          middleName: formData.middleName || null,

          suffix: formData.suffix || null,

          role: formData.role,

          availability: formData.availability,

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
        };

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
        // ======================================
        // CREATE
        // NO PASSWORD
        // ======================================

        const createPayload = {
          employeeID: crypto.randomUUID(),

          employeeName: `${formData.firstName} ${formData.lastName}`.trim(),

          middleName: formData.middleName || null,

          suffix: formData.suffix || null,

          role: formData.role,

          availability: formData.availability,

          healthStatus: formData.healthCondition,

          address: formData.address,

          contact: formData.contactNumber,

          emailAddress: formData.emailAddress,

          // Account is not activated yet
          isActive: false,

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

      // Refresh employee profile
      await handleRowClick(id);

      await fetchEmployees();
    } catch (error) {
      const message = getErrorMessage(error);

      setErrorMessage(message);

      throw error;
    }
  };

  // ==========================================
  // DELETE
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
  // DETAIL
  // ==========================================

  if (selectedEmployee) {
    return (
      <>
        {renderToast()}

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
  // PAGINATION
  // ==========================================

  const startIndex =
    totalEmployees === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;

  const endIndex = Math.min(
    currentPage * ITEMS_PER_PAGE,

    totalEmployees,
  );

  const currentRole = currentSession?.role?.toLowerCase() || "";

  const canCreate = ["admin", "coordinator"].includes(currentRole);

  // ==========================================
  // DIRECTORY
  // ==========================================

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen relative">
      {renderToast()}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Employee Directory
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manage staff profiles and employee accounts.
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
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={
                  selectedRole === "All Roles"
                    ? "Search employees..."
                    : `Search ${selectedRole.toLowerCase()}s...`
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
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
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white border border-slate-100 rounded-xl shadow-lg z-20 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {roles.map((role) => {
                    const isSelected = selectedRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-200 table-fixed">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6 w-[25%]">Name</th>

                <th className="py-3.5 px-4 sm:px-6 w-[15%]">Role</th>

                <th className="py-3.5 px-4 sm:px-6 w-[20%]">Address</th>

                <th className="py-3.5 px-4 sm:px-6 w-[20%]">Contact</th>

                <th className="py-3.5 px-4 sm:px-6 w-[20%]">Account</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
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
                      className="py-3.5 px-4 sm:px-6 truncate"
                      title={employee.address}
                    >
                      {employee.address || "N/A"}
                    </td>

                    <td
                      className="py-3.5 px-4 sm:px-6 truncate"
                      title={employee.contactNumber}
                    >
                      {employee.contactNumber || "N/A"}
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 truncate">
                      {employee.isActive ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 whitespace-nowrap">
                          Activated
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                          Not Activated
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

            <span className="mx-1">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() =>
                setCurrentPage((previous) => Math.min(previous + 1, totalPages))
              }
              disabled={
                currentPage >= totalPages || totalPages === 0 || isLoading
              }
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage >= totalPages || totalPages === 0 || isLoading
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
    </div>
  );
}
