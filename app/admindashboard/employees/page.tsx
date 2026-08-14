// ==========================================
// EMPLOYEE DIRECTORY MANAGEMENT PAGE
// ==========================================
"use client";

import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import axios from "axios";

type RoleType = "Admin" | "Coordinator" | "Mechanic" | "Driver" | "Helper";

interface EmployeeRecord {
  id: string | number;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix?: string;
  role: RoleType;
  gender: string;
  birthdate: string;
  address: string;
  contactNumber: string;
  emailAddress: string;
  bloodType: string;
  nationality: string;
  religion: string;
  dateEmployed: string;
  // Driver specific
  driverLicenseType?: string;
  licenseNumber?: string;
  licenseExpirationDate?: string;
  drivingExperience?: string;
  // Health & Emergency
  healthCondition: string;
  drugTestStatus: string;
  lastMedicalCheckup: string;
  emergencyContactPerson: string;
  emergencyContactNumber: string;
  relationship: string;
  // Other Info
  skills: string;
  certificates?: File | null;
  remarks: string;
  status: string;
}

// ==========================================
// EMPLOYEE MODAL COMPONENT (Add / Edit)
// ==========================================

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: EmployeeRecord) => void;
  editData?: EmployeeRecord | null;
}

function EmployeeModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  editData,
}: EmployeeModalProps) {
  const initialFormState = {
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
    role: "" as RoleType | "",
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
    certificates: null as File | null,
    remarks: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-populate form if editData is provided
  useEffect(() => {
    if (editData) {
      setFormData({
        firstName: editData.firstName || "",
        middleName: editData.middleName || "",
        lastName: editData.lastName || "",
        suffix: editData.suffix || "",
        gender: editData.gender || "",
        birthdate: editData.birthdate ? editData.birthdate.split("T")[0] : "",
        address: editData.address || "",
        contactNumber: editData.contactNumber || "",
        emailAddress: editData.emailAddress || "",
        bloodType: editData.bloodType || "",
        nationality: editData.nationality || "Filipino",
        religion: editData.religion || "",
        role: editData.role || "",
        dateEmployed: editData.dateEmployed
          ? editData.dateEmployed.split("T")[0]
          : "",
        driverLicenseType: editData.driverLicenseType || "",
        licenseNumber: editData.licenseNumber || "",
        licenseExpirationDate: editData.licenseExpirationDate
          ? editData.licenseExpirationDate.split("T")[0]
          : "",
        drivingExperience: editData.drivingExperience || "",
        healthCondition: editData.healthCondition || "",
        drugTestStatus: editData.drugTestStatus || "",
        lastMedicalCheckup: editData.lastMedicalCheckup
          ? editData.lastMedicalCheckup.split("T")[0]
          : "",
        emergencyContactPerson: editData.emergencyContactPerson || "",
        emergencyContactNumber: editData.emergencyContactNumber || "",
        relationship: editData.relationship || "",
        skills: editData.skills || "",
        certificates: null,
        remarks: editData.remarks || "",
      });
    } else {
      setFormData(initialFormState);
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialFormState);
    setErrors({});
    onClose();
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, files } = e.target as HTMLInputElement;
    if (name === "certificates" && files) {
      setFormData((prev) => ({ ...prev, certificates: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required.";
    if (!formData.middleName.trim())
      newErrors.middleName = "Middle name is required.";
    if (!formData.lastName.trim())
      newErrors.lastName = "Last name is required.";
    if (!formData.role) newErrors.role = "Role is required.";
    if (!formData.address.trim()) newErrors.address = "Address is required.";
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = "Contact number is required.";
    if (!formData.emailAddress.trim())
      newErrors.emailAddress = "Email address is required.";
    if (!formData.healthCondition.trim())
      newErrors.healthCondition = "Health condition is required.";

    if (formData.role === "Driver") {
      if (!formData.licenseNumber.trim())
        newErrors.licenseNumber = "Driver's license number is required.";
      if (!formData.driverLicenseType.trim())
        newErrors.driverLicenseType = "License type / restriction is required.";
      if (!formData.licenseExpirationDate)
        newErrors.licenseExpirationDate =
          "License expiration date is required.";
      if (!formData.drivingExperience.toString().trim())
        newErrors.drivingExperience = "Driving experience is required.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const updatedRecord: EmployeeRecord = {
      id: editData ? editData.id : Date.now(),
      ...formData,
      role: formData.role as RoleType,
      status: "Active",
    };

    onSubmitSuccess(updatedRecord);
    setFormData(initialFormState);
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {editData ? "Edit Employee Record" : "New Employee Form"}
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900"
        >
          {/* 1. Personal Information */}
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
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={handleInputChange}
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
                  placeholder="Enter middle name"
                  value={formData.middleName}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.middleName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.middleName && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.middleName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={handleInputChange}
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
                  Suffix (optional)
                </label>
                <input
                  type="text"
                  name="suffix"
                  placeholder="e.g. Jr., III"
                  value={formData.suffix}
                  onChange={handleInputChange}
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
                  <option value="" disabled>
                    Select gender
                  </option>
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
                  placeholder="Enter residential address"
                  value={formData.address}
                  onChange={handleInputChange}
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
                  placeholder="Enter contact number"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
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
                  placeholder="Enter email address"
                  value={formData.emailAddress}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emailAddress && (
                  <p className="text-red-500 text-[11px] mt-1">
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
                  <option value="" disabled>
                    Select blood type
                  </option>
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
                  placeholder="Enter nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
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
                  placeholder="Enter religion"
                  value={formData.religion}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* 2. Employee Details */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              2. Employee Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <option value="" disabled>
                    Select role
                  </option>
                  <option value="Admin">Admin</option>
                  <option value="Coordinator">Coordinator</option>
                  <option value="Mechanic">Mechanic</option>
                  <option value="Driver">Driver</option>
                  <option value="Helper">Helper</option>
                </select>
                {errors.role && (
                  <p className="text-red-500 text-[11px] mt-1">{errors.role}</p>
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

          {/* 3. Driver Information (if applicable) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              3. Driver Information (if applicable)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Driver's License No.
                </label>
                <input
                  type="text"
                  name="licenseNumber"
                  placeholder="Enter driver's license number"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
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
                  License Type / Restriction
                </label>
                <input
                  type="text"
                  name="driverLicenseType"
                  placeholder="e.g. Professional / 123"
                  value={formData.driverLicenseType}
                  onChange={handleInputChange}
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
                  <p className="text-red-500 text-[11px] mt-1">
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
                  name="drivingExperience"
                  placeholder="Enter years of experience"
                  value={formData.drivingExperience}
                  onChange={handleInputChange}
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

          {/* 4. Health & Emergency Information */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Health & Emergency Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Health Condition *
                </label>
                <input
                  type="text"
                  name="healthCondition"
                  placeholder="e.g. Fit to work / Allergies"
                  value={formData.healthCondition}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.healthCondition ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.healthCondition && (
                  <p className="text-red-500 text-[11px] mt-1">
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
                  <option value="" disabled>
                    Select status
                  </option>
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
                  placeholder="Enter contact person name"
                  value={formData.emergencyContactPerson}
                  onChange={handleInputChange}
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
                  placeholder="Enter contact number"
                  value={formData.emergencyContactNumber}
                  onChange={handleInputChange}
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
                  placeholder="e.g. Spouse, Parent"
                  value={formData.relationship}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* 5. Other Information */}
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
                  placeholder="Enter skills or specializations..."
                  value={formData.skills}
                  onChange={handleInputChange}
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
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Other Remarks
                </label>
                <textarea
                  name="remarks"
                  rows={2}
                  placeholder="Any additional remarks..."
                  value={formData.remarks}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCloseModal}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              {editData ? "Save Changes" : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// EMPLOYEE INFORMATION DETAIL VIEW
// ==========================================

interface EmployeeDetailViewProps {
  employee: EmployeeRecord;
  onBack: () => void;
  onEdit: (emp: EmployeeRecord) => void;
  onDelete: (id: string | number) => void;
}

function EmployeeDetailView({
  employee,
  onBack,
  onEdit,
  onDelete,
}: EmployeeDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen animate-fade-in">
      {/* Header with Back button and Action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
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
              Complete profile retrieved directly from Supabase database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onEdit(employee)}
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Employee</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Container mimicking Add Employee Form layout structure */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        {/* Profile Summary Header Bar */}
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
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {employee.role}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  {employee.status || "Active"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Read-only Form Layout matching Add Employee Form */}
        <div className="space-y-6 text-sm text-slate-900">
          {/* 1. Personal Information */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Personal Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  First Name
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.firstName || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Middle Name
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.middleName || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Last Name
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.lastName || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Suffix (optional)
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.suffix || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Gender
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.gender || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Birthdate
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.birthdate
                    ? new Date(employee.birthdate).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Address
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.address || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Number
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.contactNumber || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.emailAddress || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Blood Type
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.bloodType || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Nationality
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.nationality || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Religion
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.religion || "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Employee Details */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              2. Employee Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Role
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.role || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Date Employed
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.dateEmployed
                    ? new Date(employee.dateEmployed).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Driver Information */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              3. Driver Information (if applicable)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Driver's License No.
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.licenseNumber || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  License Type / Restriction
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.driverLicenseType || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  License Expiration Date
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.licenseExpirationDate
                    ? new Date(
                        employee.licenseExpirationDate,
                      ).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Driving Experience (Years)
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.drivingExperience
                    ? `${employee.drivingExperience} years`
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Health & Emergency Information */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Health & Emergency Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Health Condition
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.healthCondition || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Drug Test Status
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.drugTestStatus || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Last Medical Check-up
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.lastMedicalCheckup
                    ? new Date(employee.lastMedicalCheckup).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Emergency Contact Person
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.emergencyContactPerson || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Emergency Contact Number
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.emergencyContactNumber || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Relationship
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {employee.relationship || "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Other Information */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              5. Other Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Skills / Specialization
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-12">
                  {employee.skills || "No skills specified."}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Certificates Record
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  No certificate uploaded or available
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Other Remarks
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-12">
                  {employee.remarks || "No additional remarks."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
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
              ? This will permanently remove the record from Supabase.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(employee.id);
                  setShowDeleteModal(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md"
              >
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
// EMPLOYEES DIRECTORY MAIN COMPONENT
// ==========================================

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Loading state added here
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeRecord | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(
    null,
  );
  const [employeeList, setEmployeeList] = useState<EmployeeRecord[]>([]);

  // === Pagination States ===
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination to page 1 whenever the user searches or filters
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole]);

  // ==========================================
  // LIVE DATABASE CONNECTION (AXIOS)
  // ==========================================
  const fetchEmployees = async () => {
    setIsLoading(true); // Start Loading
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
      const response = await axios.get(`${API_URL}/api/employees`);

      const liveData = response.data.map((emp: any) => {
        const nameParts = emp.employeeName
          ? emp.employeeName.split(" ")
          : ["Unknown"];
        const fName = nameParts[0];
        const lName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        return {
          id: emp.employeeID,
          firstName: fName,
          middleName: emp.middleName || "",
          lastName: lName,
          suffix: emp.suffix || "",
          role: emp.role,
          address: emp.address || "No address provided",
          contactNumber: emp.contact || "No contact",
          healthCondition: emp.healthStatus || "Fit to Work",
          status: emp.isActive ? "Active" : "Inactive",

          gender: emp.gender || "N/A",
          birthdate: emp.birthdate || "",
          emailAddress: emp.emailAddress || "",
          bloodType: emp.bloodType || "",
          nationality: emp.nationality || "Filipino",
          religion: emp.religion || "",
          dateEmployed: emp.dateEmployed || "",
          driverLicenseType: emp.driverLicenseType || "",
          licenseNumber: emp.licenseNumber || "",
          licenseExpirationDate: emp.licenseExpirationDate || "",
          drivingExperience: emp.drivingExperience || "",
          drugTestStatus: emp.drugTestStatus || "Pending",
          lastMedicalCheckup: emp.lastMedicalCheckup || "",
          emergencyContactPerson: emp.emergencyContactPerson || "",
          emergencyContactNumber: emp.emergencyContactNumber || "",
          relationship: emp.relationship || "",
          skills: emp.skills || "",
          remarks: emp.remarks || "",
        };
      });

      setEmployeeList(liveData);
    } catch (error) {
      console.error("Failed to fetch employees from backend:", error);
    } finally {
      setIsLoading(false); // End Loading
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleRowClick = async (id: string | number) => {
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

      // ✅ 1. FETCH EXACT RECORD FROM DATABASE
      const response = await axios.get(`${API_URL}/api/employees/${id}`);
      const emp = response.data;

      const nameParts = emp.employeeName
        ? emp.employeeName.split(" ")
        : ["Unknown"];
      const fName = nameParts[0];
      const lName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      // ✅ 2. MAP ONLY TO SPECIFIC DATA STORED IN DATABASE (No local hardcoded fallbacks besides standard 'N/A' empty states)
      const fullRecord: EmployeeRecord = {
        id: emp.employeeID,
        firstName: fName,
        middleName: emp.middleName || "",
        lastName: lName,
        suffix: emp.suffix || "",
        role: emp.role,
        gender: emp.gender || "",
        birthdate: emp.birthdate || "",
        address: emp.address || "",
        contactNumber: emp.contact || "",
        emailAddress: emp.emailAddress || "",
        bloodType: emp.bloodType || "",
        nationality: emp.nationality || "",
        religion: emp.religion || "",
        dateEmployed: emp.dateEmployed || "",
        driverLicenseType: emp.driverLicenseType || "",
        licenseNumber: emp.licenseNumber || "",
        licenseExpirationDate: emp.licenseExpirationDate || "",
        drivingExperience: emp.drivingExperience || "",
        healthCondition: emp.healthStatus || "",
        drugTestStatus: emp.drugTestStatus || "",
        lastMedicalCheckup: emp.lastMedicalCheckup || "",
        emergencyContactPerson: emp.emergencyContactPerson || "",
        emergencyContactNumber: emp.emergencyContactNumber || "",
        relationship: emp.relationship || "",
        skills: emp.skills || "",
        remarks: emp.remarks || "",
        status: emp.isActive ? "Active" : "Inactive",
      };

      // ✅ 3. PASS LIVE RECORD TO DETAIL VIEW
      setSelectedEmployee(fullRecord);
    } catch (error) {
      console.error(
        "Failed to fetch complete employee record from Supabase:",
        error,
      );
      // Fallback only if the network fails so UI doesn't crash completely
      const localEmp = employeeList.find((e) => e.id === id);
      if (localEmp) setSelectedEmployee(localEmp);
    }
  };

  const dropdownRef = useRef<HTMLDivElement>(null);

  const roles = [
    "All Roles",
    "Admin",
    "Coordinator",
    "Mechanic",
    "Driver",
    "Helper",
  ];

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

  const handleModalSubmit = async (record: EmployeeRecord) => {
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

      if (editingEmployee) {
        // 1. Update Existing
        await axios.put(`${API_URL}/api/employees/${record.id}`, record);
        setEditingEmployee(null);
      } else {
        // 2. Add New
        await axios.post(`${API_URL}/api/employees`, record);
      }

      // Refresh list to stay synced
      await fetchEmployees();
      setIsModalOpen(false);

      if (selectedEmployee) {
        // If we were looking at the detail page, refresh it
        await handleRowClick(record.id);
      }
    } catch (error) {
      console.error("Failed to save employee to backend:", error);
      alert(
        "Error saving employee to database. Check your frontend console (F12).",
      );
    }
  };

  const handleDeleteEmployee = async (id: string | number) => {
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
      await axios.delete(`${API_URL}/api/employees/${id}`);

      setSelectedEmployee(null);
      await fetchEmployees();
    } catch (error) {
      console.error("Failed to delete employee from Supabase:", error);
      alert("Error deleting employee. Please try again.");
    }
  };

  // 1. Filter the entire list first
  const filteredEmployees = employeeList.filter((emp) => {
    const matchesSearch =
      emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.contactNumber.includes(searchTerm);
    const matchesRole =
      selectedRole === "All Roles" || emp.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  // 2. Pagination Math based on filtered results
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // 3. Slice exactly 10 entries for the current page
  const currentEmployees = filteredEmployees.slice(startIndex, endIndex);

  // === RENDER DETAIL VIEW IF AN EMPLOYEE IS SELECTED ===
  if (selectedEmployee) {
    return (
      <>
        <EmployeeDetailView
          employee={selectedEmployee}
          onBack={() => setSelectedEmployee(null)}
          onEdit={(emp) => {
            setEditingEmployee(emp);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteEmployee}
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

  // === RENDER MAIN DIRECTORY LIST ===
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Employee Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manage your staff listings, employee profiles, and directory
            records.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex justify-center sm:justify-start w-full sm:w-auto">
          <button
            onClick={() => {
              setEditingEmployee(null);
              setIsModalOpen(true);
            }}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Main Content Container Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            List of Employees
          </h2>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  selectedRole === "All Roles"
                    ? "Search employees..."
                    : `Search ${selectedRole.toLowerCase()}s...`
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full sm:w-auto inline-flex items-center justify-between gap-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium rounded-xl px-4 py-2.5 text-sm transition-all duration-200"
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
                          setSelectedRole(role);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-200 table-fixed">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6 w-[25%]">Name</th>
                <th className="py-3.5 px-4 sm:px-6 w-[15%]">Role</th>
                <th className="py-3.5 px-4 sm:px-6 w-[25%]">Address</th>
                <th className="py-3.5 px-4 sm:px-6 w-[20%]">Contact Number</th>
                <th className="py-3.5 px-4 sm:px-6 w-[15%]">Status</th>
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
              ) : currentEmployees.length > 0 ? (
                currentEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => handleRowClick(emp.id)}
                    className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-sm text-slate-800"
                    title="Click to view complete employee record"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 truncate">
                      {emp.firstName}{" "}
                      {emp.middleName ? `${emp.middleName[0]}. ` : ""}
                      {emp.lastName} {emp.suffix}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 truncate">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                        {emp.role}
                      </span>
                    </td>
                    <td
                      className="py-3.5 px-4 sm:px-6 truncate"
                      title={emp.address}
                    >
                      {emp.address}
                    </td>
                    <td
                      className="py-3.5 px-4 sm:px-6 truncate"
                      title={emp.contactNumber}
                    >
                      {emp.contactNumber}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 truncate">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
                        {emp.healthCondition}
                      </span>
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

        {/* Updated Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {filteredEmployees.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredEmployees.length)} of{" "}
            {filteredEmployees.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage === 1
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Previous
            </button>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage === totalPages || totalPages === 0
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50"
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
