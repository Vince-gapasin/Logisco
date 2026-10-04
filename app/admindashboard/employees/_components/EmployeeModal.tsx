/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import { AVAILABILITY, MANUAL_AVAILABILITY } from "@/app/lib/enums";
import { X, Loader2 } from "lucide-react";
import type { EmployeeFormState, EmployeeRecord } from "./types";
import { getInitialFormState } from "./helpers";

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

export function EmployeeModal({
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
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.firstName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.lastName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.address ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
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
                  className={`w-full border rounded-md px-3 py-2 text-xs font-normal placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${Boolean(editData) ? "bg-slate-100 text-slate-500 border-slate-300" : "bg-white text-black"} ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.licenseNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.driverLicenseType ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.drivingExperience ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* BUTTONS */}
          <div className="flex flex-row items-center justify-end sm:justify-center gap-2 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-auto sm:w-40 py-2 sm:py-2.5 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 disabled:opacity-50 px-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-auto sm:w-40 py-2 sm:py-2.5 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 hover:opacity-95 disabled:opacity-50 px-3"
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
