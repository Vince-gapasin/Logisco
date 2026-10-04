"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronDown, Loader2 } from "lucide-react";
import type { TruckRecord } from "./types";
import { formatInputDate } from "./dates";

// ==========================================
// TRUCK MODAL (ADD/EDIT FLEET)
// ==========================================
interface TruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: TruckRecord) => void;
  editData?: TruckRecord | null;
  existingFleet: TruckRecord[];
  isSaving?: boolean;
}

export function TruckModal({ isOpen, onClose, onSubmitSuccess, editData, existingFleet, isSaving }: TruckModalProps) {
  const initialTruckState = {
    truckCode: "",
    plateNumber: "",
    truckType: "",
    truckModel: "",
    capacity: "",
    lastChecked: "",
  };

  const [formData, setFormData] = useState(initialTruckState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // 1. Convert to state
  const [today, setToday] = useState("");

  // 2. Calculate the local date only on the client
  useEffect(() => {
    // Read on the client only: the server's today and the browser's can differ
    // by a day, and a date input compared against the wrong one rejects a
    // perfectly good date.
    const offset = new Date().getTimezoneOffset() * 60000;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date(Date.now() - offset).toISOString().split("T")[0]);
  }, []);

  // Seeded from the record this was opened with.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (editData) {
      setFormData({
        truckCode: editData.truckCode || "",
        plateNumber: editData.plateNumber || "",
        truckType: editData.truckType || "",
        truckModel: editData.truckModel || "",
        capacity: editData.capacity ? String(editData.capacity) : "",
        lastChecked: editData.lastChecked
          ? formatInputDate(editData.lastChecked)
          : "",
      });
    } else {
      setFormData(initialTruckState);
    }
    setErrors({});
  }, [editData, isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialTruckState);
    setErrors({});
    setIsTypeDropdownOpen(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.plateNumber.trim())
      newErrors.plateNumber = "Plate number is required.";
    if (!formData.truckType) newErrors.truckType = "Type of truck is required.";
    if (!formData.truckModel.trim())
      newErrors.truckModel = "Truck model is required.";
    if (!String(formData.capacity).trim())
      newErrors.capacity = "Capacity is required.";
    if (!formData.lastChecked)
      newErrors.lastChecked = "Last checked date is required.";
    else if (formData.lastChecked > today)
      newErrors.lastChecked = "Date cannot be in the future.";

    // --- NEW: Duplicate Plate Number Validation ---
    if (formData.plateNumber.trim()) {
      const cleanInputPlate = formData.plateNumber
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
      const isDuplicate = existingFleet.some((t) => {
        const cleanExistingPlate = String(t.plateNumber || "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase();
        // Ensure we don't flag the truck as a duplicate of itself during an edit
        return (
          cleanExistingPlate === cleanInputPlate &&
          String(t.id) !== String(editData?.id)
        );
      });

      if (isDuplicate) {
        newErrors.plateNumber = "This truck is already on record.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Auto-generate a truck code if one doesn't exist (e.g., TRK-ABC1234)
    const cleanPlateNumber = formData.plateNumber
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const generatedTruckCode = formData.truckCode || `TRK-${cleanPlateNumber}`;

    const updatedRecord: TruckRecord = {
      id: editData ? editData.id : Date.now(),
      truckCode: generatedTruckCode,
      plateNumber: formData.plateNumber.trim(),
      truckType: formData.truckType,
      truckModel: formData.truckModel.trim(),
      capacity: String(formData.capacity).trim(),
      lastChecked: formData.lastChecked,
      status: editData ? editData.status : "Available",
    };

    // The page closes this once the save has gone through. Closing here, before
    // it had, threw away what was typed whenever the save was refused.
    onSubmitSuccess(updatedRecord);
  };

  const TRUCK_TYPES = [
    "Closed Van",
    "Wing Van",
    "Dry Van",
    "Refrigerated Truck",
    "Boom Truck",
    "Flatbed Truck",
    "Dump Truck",
    "Trailer Truck",
    "Tanker Truck",
    "Pickup Truck",
    "Other",
  ];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {editData ? "Edit Truck Record" : "New Truck Form"}
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 max-h-[80dvh] overflow-y-auto text-sm text-slate-900"
        >
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Truck Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Plate Number *
                </label>
                <input
                  type="text"
                  name="plateNumber"
                  placeholder="e.g., ABC-1234"
                  value={formData.plateNumber}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.plateNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.plateNumber && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.plateNumber}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Truck *
                </label>
                <div
                  className={`relative w-full ${isTypeDropdownOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isTypeDropdownOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsTypeDropdownOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                    className={`min-h-tap md:min-h-0 w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.truckType ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"}`}
                  >
                    <span
                      className={
                        formData.truckType ? "text-black" : "text-slate-500"
                      }
                    >
                      {formData.truckType || "Select truck type"}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isTypeDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isTypeDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto text-left">
                      {TRUCK_TYPES.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            handleInputChange({
                              target: { name: "truckType", value: opt },
                            });
                            setIsTypeDropdownOpen(false);
                          }}
                          className={`min-h-tap md:min-h-0 inline-flex items-center justify-start w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${formData.truckType === opt ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.truckType && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.truckType}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Truck Model *
                </label>
                <input
                  type="text"
                  name="truckModel"
                  placeholder="e.g., Isuzu NPR / Fuso Canter"
                  value={formData.truckModel}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckModel ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.truckModel && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.truckModel}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Capacity *
                </label>
                <input
                  type="text"
                  name="capacity"
                  placeholder="e.g., 5000 kg"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.capacity ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.capacity && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.capacity}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Last Checked (MM/DD/YYYY) *
                </label>
                <input
                  type="date"
                  name="lastChecked"
                  max={today}
                  value={formData.lastChecked}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.lastChecked ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.lastChecked && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.lastChecked}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-row items-center justify-end sm:justify-center gap-2 sm:gap-4 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleCloseModal} style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }} className="w-auto sm:w-40 py-2 sm:py-2.5 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 cursor-pointer px-3">Cancel</button>
            <button type="submit" disabled={isSaving} style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }} className={`w-auto sm:w-40 py-2 sm:py-2.5 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center cursor-pointer px-3 ${isSaving ? "opacity-70 cursor-not-allowed" : "hover:opacity-95"} px-3 sm:px-4`}>
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : editData ? "Save Changes" : "Add Truck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
