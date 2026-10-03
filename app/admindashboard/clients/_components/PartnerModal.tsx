/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { normalizePhone, PHONE_RULE } from "@/app/lib/bookingRules";
import { X, ChevronDown } from "lucide-react";
import type { PartnerRecord } from "./types";

// ==========================================
// 2. PARTNER MODAL
// ==========================================

interface PartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saves it. Resolves false when the save was refused, so the form stays open. */
  onSubmitSuccess: (record: PartnerRecord) => Promise<boolean>;
  editData?: PartnerRecord | null;
}

export function PartnerModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  editData,
}: PartnerModalProps) {
  const initialPartnerState = {
    name: "",
    contractType: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
  };

  const [formData, setFormData] = useState(initialPartnerState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isContractDropdownOpen, setIsContractDropdownOpen] = useState(false);

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name || "",
        contractType: editData.contractType || "",
        contactPerson: editData.contactPerson || "",
        contactNumber: editData.contactNumber || "",
        emailAddress: editData.emailAddress || "",
        businessAddress: editData.businessAddress || "",
      });
    } else {
      setFormData(initialPartnerState);
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialPartnerState);
    setErrors({});
    setIsContractDropdownOpen(false);
    onClose();
  };

  const handleInputChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
      | { target: { name: string; value: string } },
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim())
      newErrors.name = "Owner Name/Company name is required.";
    if (!formData.contractType.trim())
      newErrors.contractType = "Type of contract is required.";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required.";
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = "Contact number is required.";
    else if (!normalizePhone(formData.contactNumber))
      newErrors.contactNumber = PHONE_RULE;
    if (!formData.emailAddress.trim())
      newErrors.emailAddress = "Email address is required.";
    if (!formData.businessAddress.trim())
      newErrors.businessAddress = "Business address is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: PartnerRecord = {
      id: editData ? editData.id : Date.now(),
      name: formData.name,
      status: editData ? editData.status : "Active",
      contractType: formData.contractType,
      contactPerson: formData.contactPerson,
      contactNumber: normalizePhone(formData.contactNumber) ?? formData.contactNumber,
      emailAddress: formData.emailAddress,
      businessAddress: formData.businessAddress,
    };

    // Closed once it has saved, not before.
    if (!(await onSubmitSuccess(newRecord))) return;
    setFormData(initialPartnerState);
    setErrors({});
    setIsContractDropdownOpen(false);
    onClose();
  };

  const CONTRACT_TYPES = ["Regular", "On-Call", "Seasonal"];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {editData ? "Edit Partner" : "Add New Partner"}
          </h2>
          <button
            onClick={handleCloseModal}
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 text-sm text-slate-900"
        >
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              Partner & Contract Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Owner/Company Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter company or owner name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.name ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Contract
                </label>
                <div
                  className={`relative w-full ${isContractDropdownOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isContractDropdownOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsContractDropdownOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setIsContractDropdownOpen(!isContractDropdownOpen)
                    }
                    className={`min-h-tap md:min-h-0 w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.contractType ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"}`}
                  >
                    <span
                      className={
                        formData.contractType ? "text-black" : "text-slate-500"
                      }
                    >
                      {formData.contractType || "Select type of contract"}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isContractDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isContractDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 text-left">
                      {CONTRACT_TYPES.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            handleInputChange({
                              target: { name: "contractType", value: opt },
                            });
                            setIsContractDropdownOpen(false);
                          }}
                          className={`min-h-tap md:min-h-0 inline-flex items-center justify-start w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${formData.contractType === opt ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.contractType && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.contractType}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  placeholder="Enter contact person"
                  value={formData.contactPerson}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactPerson ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactPerson && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.contactPerson}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  placeholder="Enter contact number"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.contactNumber}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="emailAddress"
                  placeholder="Enter email address"
                  value={formData.emailAddress}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emailAddress && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.emailAddress}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Business Address
                </label>
                <input
                  type="text"
                  name="businessAddress"
                  placeholder="Enter business address"
                  value={formData.businessAddress}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.businessAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.businessAddress && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.businessAddress}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCloseModal}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              {editData ? "Save Changes" : "Add partner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
