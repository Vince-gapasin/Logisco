// ==========================================
// EMPLOYEE DIRECTORY MANAGEMENT PAGE
// ==========================================
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, UserPlus, FileText, Filter, ChevronDown, X } from "lucide-react";

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
  region: string;
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
// EMPLOYEE MODAL COMPONENT
// ==========================================

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: EmployeeRecord) => void;
}

function EmployeeModal({ isOpen, onClose, onSubmitSuccess }: EmployeeModalProps) {
  const [formData, setFormData] = useState({
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
    region: "",
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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

    // Validate all required fields and dropdowns
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!formData.middleName.trim()) newErrors.middleName = "Middle name is required.";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required.";
    if (!formData.gender) newErrors.gender = "Gender is required.";
    if (!formData.birthdate) newErrors.birthdate = "Birthdate is required.";
    if (!formData.address.trim()) newErrors.address = "Address is required.";
    if (!formData.contactNumber.trim()) newErrors.contactNumber = "Contact number is required.";
    if (!formData.emailAddress.trim()) newErrors.emailAddress = "Email address is required.";
    if (!formData.bloodType) newErrors.bloodType = "Blood type is required.";
    if (!formData.nationality.trim()) newErrors.nationality = "Nationality is required.";
    if (!formData.region.trim()) newErrors.region = "Region is required.";
    if (!formData.role) newErrors.role = "Role is required.";
    if (!formData.dateEmployed) newErrors.dateEmployed = "Date employed is required.";

    // Conditional driver validation
    if (formData.role === "Driver") {
      if (!formData.driverLicenseType.trim()) newErrors.driverLicenseType = "Driver license type is required.";
      if (!formData.licenseNumber.trim()) newErrors.licenseNumber = "License number is required.";
      if (!formData.licenseExpirationDate) newErrors.licenseExpirationDate = "License expiration date is required.";
      if (!formData.drivingExperience.toString().trim()) newErrors.drivingExperience = "Driving experience is required.";
    }

    if (!formData.healthCondition.trim()) newErrors.healthCondition = "Health condition is required.";
    if (!formData.drugTestStatus) newErrors.drugTestStatus = "Drug test status is required.";
    if (!formData.lastMedicalCheckup) newErrors.lastMedicalCheckup = "Last medical check-up date is required.";
    if (!formData.emergencyContactPerson.trim()) newErrors.emergencyContactPerson = "Emergency contact person is required.";
    if (!formData.emergencyContactNumber.trim()) newErrors.emergencyContactNumber = "Emergency contact number is required.";
    if (!formData.relationship.trim()) newErrors.relationship = "Relationship is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: EmployeeRecord = {
      id: Date.now(),
      ...formData,
      role: formData.role as RoleType,
      status: "Active",
    };

    onSubmitSuccess(newRecord);
    setFormData({
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
      region: "",
      role: "",
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
    });
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto">
        
        {/* MODAL TITLE BANNER */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            New Employee Form
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900">
          
          {/* 1. PERSONAL INFORMATION */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Personal Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.firstName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.firstName && <p className="text-red-500 text-[11px] mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  placeholder="Enter middle name"
                  value={formData.middleName}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.middleName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.middleName && <p className="text-red-500 text-[11px] mt-1">{errors.middleName}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.lastName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.lastName && <p className="text-red-500 text-[11px] mt-1">{errors.lastName}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Suffix (optional)</label>
                <input
                  type="text"
                  name="suffix"
                  placeholder="e.g. Jr., III"
                  value={formData.suffix}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.gender ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                {errors.gender && <p className="text-red-500 text-[11px] mt-1">{errors.gender}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Birthdate</label>
                <input
                  type="date"
                  name="birthdate"
                  value={formData.birthdate}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.birthdate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.birthdate && <p className="text-red-500 text-[11px] mt-1">{errors.birthdate}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">Address</label>
                <input
                  type="text"
                  name="address"
                  placeholder="Enter residential address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.address ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.address && <p className="text-red-500 text-[11px] mt-1">{errors.address}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Contact Number</label>
                <input
                  type="text"
                  name="contactNumber"
                  placeholder="Enter contact number"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactNumber && <p className="text-red-500 text-[11px] mt-1">{errors.contactNumber}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Email Address</label>
                <input
                  type="email"
                  name="emailAddress"
                  placeholder="Enter email address"
                  value={formData.emailAddress}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emailAddress && <p className="text-red-500 text-[11px] mt-1">{errors.emailAddress}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Blood Type</label>
                <select
                  name="bloodType"
                  value={formData.bloodType}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.bloodType ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>Select blood type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
                {errors.bloodType && <p className="text-red-500 text-[11px] mt-1">{errors.bloodType}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Nationality</label>
                <input
                  type="text"
                  name="nationality"
                  placeholder="Enter nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.nationality ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.nationality && <p className="text-red-500 text-[11px] mt-1">{errors.nationality}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Region</label>
                <input
                  type="text"
                  name="region"
                  placeholder="Enter region / province"
                  value={formData.region}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.region ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.region && <p className="text-red-500 text-[11px] mt-1">{errors.region}</p>}
              </div>
            </div>
          </div>

          {/* 2. EMPLOYEE DETAILS */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              2. Employee Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.role ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>Select role</option>
                  <option value="Admin">Admin</option>
                  <option value="Coordinator">Coordinator</option>
                  <option value="Mechanic">Mechanic</option>
                  <option value="Driver">Driver</option>
                  <option value="Helper">Helper</option>
                </select>
                {errors.role && <p className="text-red-500 text-[11px] mt-1">{errors.role}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Date Employed</label>
                <input
                  type="date"
                  name="dateEmployed"
                  value={formData.dateEmployed}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.dateEmployed ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.dateEmployed && <p className="text-red-500 text-[11px] mt-1">{errors.dateEmployed}</p>}
              </div>
            </div>
          </div>

          {/* 3. DRIVER INFORMATION (Conditional) */}
          {formData.role === "Driver" && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                3. Driver Information
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Driver License Type</label>
                  <input
                    type="text"
                    name="driverLicenseType"
                    placeholder="e.g. Professional (Rest 1, 2, 3)"
                    value={formData.driverLicenseType}
                    onChange={handleInputChange}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.driverLicenseType ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.driverLicenseType && <p className="text-red-500 text-[11px] mt-1">{errors.driverLicenseType}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">License Number</label>
                  <input
                    type="text"
                    name="licenseNumber"
                    placeholder="Enter license number"
                    value={formData.licenseNumber}
                    onChange={handleInputChange}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.licenseNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.licenseNumber && <p className="text-red-500 text-[11px] mt-1">{errors.licenseNumber}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">License Expiration Date</label>
                  <input
                    type="date"
                    name="licenseExpirationDate"
                    value={formData.licenseExpirationDate}
                    onChange={handleInputChange}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.licenseExpirationDate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.licenseExpirationDate && <p className="text-red-500 text-[11px] mt-1">{errors.licenseExpirationDate}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Driving Experience (Years)</label>
                  <input
                    type="number"
                    name="drivingExperience"
                    placeholder="e.g. 5"
                    value={formData.drivingExperience}
                    onChange={handleInputChange}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.drivingExperience ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.drivingExperience && <p className="text-red-500 text-[11px] mt-1">{errors.drivingExperience}</p>}
                </div>
              </div>
            </div>
          )}

          {/* 4. HEALTH & EMERGENCY INFORMATION */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Health & Emergency Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">Health Condition</label>
                <input
                  type="text"
                  name="healthCondition"
                  placeholder="e.g. Fit to work / Allergies"
                  value={formData.healthCondition}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.healthCondition ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.healthCondition && <p className="text-red-500 text-[11px] mt-1">{errors.healthCondition}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Drug Test Status</label>
                <select
                  name="drugTestStatus"
                  value={formData.drugTestStatus}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.drugTestStatus ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>Select status</option>
                  <option value="Passed">Passed</option>
                  <option value="Failed">Failed</option>
                  <option value="Pending">Pending</option>
                </select>
                {errors.drugTestStatus && <p className="text-red-500 text-[11px] mt-1">{errors.drugTestStatus}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Last Medical Check-up</label>
                <input
                  type="date"
                  name="lastMedicalCheckup"
                  value={formData.lastMedicalCheckup}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.lastMedicalCheckup ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.lastMedicalCheckup && <p className="text-red-500 text-[11px] mt-1">{errors.lastMedicalCheckup}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Emergency Contact Person</label>
                <input
                  type="text"
                  name="emergencyContactPerson"
                  placeholder="Enter contact person name"
                  value={formData.emergencyContactPerson}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emergencyContactPerson ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emergencyContactPerson && <p className="text-red-500 text-[11px] mt-1">{errors.emergencyContactPerson}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Emergency Contact Number</label>
                <input
                  type="text"
                  name="emergencyContactNumber"
                  placeholder="Enter contact number"
                  value={formData.emergencyContactNumber}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emergencyContactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emergencyContactNumber && <p className="text-red-500 text-[11px] mt-1">{errors.emergencyContactNumber}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Relationship</label>
                <input
                  type="text"
                  name="relationship"
                  placeholder="e.g. Spouse, Parent"
                  value={formData.relationship}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.relationship ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.relationship && <p className="text-red-500 text-[11px] mt-1">{errors.relationship}</p>}
              </div>
            </div>
          </div>

          {/* 5. OTHER INFORMATION */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              5. Other Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">Skills / Specialization</label>
                <textarea
                  name="skills"
                  rows={2}
                  placeholder="Enter skills or specializations..."
                  value={formData.skills}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Upload Certificates (PDF, JPG, PNG, DOCX)</label>
                <input
                  type="file"
                  name="certificates"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-700 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Other Remarks</label>
                <textarea
                  name="remarks"
                  rows={2}
                  placeholder="Any additional remarks..."
                  value={formData.remarks}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* MODAL ACTION BUTTONS */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-32 py-2 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-32 py-2 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Add Employee
            </button>
          </div>

        </form>
      </div>
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

  const [employeeList, setEmployeeList] = useState<EmployeeRecord[]>([]);

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

  const handleModalSubmit = (newRecord: EmployeeRecord) => {
    setEmployeeList((prev) => [newRecord, ...prev]);
  };

  const filteredEmployees = employeeList.filter((emp) => {
    const matchesSearch =
      emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.contactNumber.includes(searchTerm);
    const matchesRole = selectedRole === "All Roles" || emp.role === selectedRole;
    return matchesSearch && matchesRole;
  });

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

        <button
          onClick={() => setIsModalOpen(true)}
          style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white font-semibold rounded-xl px-5 py-2.5 shadow-sm transition-all duration-200 text-sm whitespace-nowrap hover:opacity-95"
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span>Add Employee</span>
        </button>
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
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Name</th>
                <th className="py-3.5 px-4 sm:px-6">Role</th>
                <th className="py-3.5 px-4 sm:px-6">Address</th>
                <th className="py-3.5 px-4 sm:px-6">Contact Number</th>
                <th className="py-3.5 px-4 sm:px-6">Health Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-sm text-slate-800">
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                      {emp.firstName} {emp.middleName ? `${emp.middleName[0]}. ` : ""}{emp.lastName} {emp.suffix}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">{emp.address}</td>
                    <td className="py-3.5 px-4 sm:px-6">{emp.contactNumber}</td>
                    <td className="py-3.5 px-4 sm:px-6">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
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
                        Staff listings and employee profiles will appear here once
                        connected to your backend database or added via the form.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>Showing {filteredEmployees.length} entries</span>
          <div className="flex items-center gap-2">
            <button
              disabled
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmitSuccess={handleModalSubmit}
      />
    </div>
  );
}