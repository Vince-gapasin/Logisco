// ==========================================
// LOGISCO - MECHANIC FLEET STATUS PAGE
// ==========================================
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Truck,
  FileText,
  X,
  ArrowLeft,
  Edit3,
  Trash2,
  AlertTriangle,
  ChevronDown,
  History as HistoryIcon,
  Wrench,
  Upload,
  Loader2,
  ClipboardCheck,
} from "lucide-react";
import axios from "axios";

export interface TruckRecord {
  id: string | number;
  plateNumber: string;
  truckType: string;
  truckModel: string;
  capacity: string;
  lastChecked: string;
  status: string;
}

export interface HistoryLogRecord {
  id: string | number;
  truckID?: string | number;
  plateNumber: string;
  truckType: string;
  primaryMechanicID?: string;
  mechanicName: string;
  additionalMechanicID?: string;
  additionalMechanic: string;
  issue: string;
  remarks: string;
  date: string;
  photoUrl?: string;
  driversReport?: string;
  preliminaryRemarks?: string;
  preliminaryPhotoUrl?: string;
  additionalIssue?: string;
  progressRemarks?: string;
  progressPhotoUrl?: string;
}

export interface TruckOption {
  truckID: string | number;
  plateNumber: string;
  truckType: string;
}

export interface EmployeeOption {
  employeeID: string | number;
  employeeName: string;
  role: string;
}

// Utility mapper to maintain consistent color designs across elements
const getStatusStyles = (status: string) => {
  switch (status) {
    case "Available":
      return {
        bgLight: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
        tabActive: "bg-emerald-600 text-white shadow-md shadow-emerald-600/10",
        btn: "bg-emerald-300 text-emerald-900 border-emerald-900/80",
        modalIcon: "bg-emerald-100 text-emerald-600",
        modalBtn: "bg-emerald-600 hover:bg-emerald-700",
        badgeBg: "bg-blue-500",
        pill: "bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
      };
    case "Already Booked":
      return {
        bgLight: "bg-indigo-50 text-indigo-700 border-indigo-200/50",
        tabActive: "bg-indigo-600 text-white shadow-md shadow-indigo-600/10",
        btn: "bg-indigo-300 text-indigo-900 border-indigo-900/80",
        modalIcon: "bg-indigo-100 text-indigo-600",
        modalBtn: "bg-indigo-600 hover:bg-indigo-700",
        badgeBg: "bg-indigo-500",
        pill: "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600",
      };
    case "On Delivery":
      return {
        bgLight: "bg-blue-50 text-blue-700 border-blue-200/50",
        tabActive: "bg-blue-600 text-white shadow-md shadow-blue-600/10",
        btn: "bg-blue-300 text-blue-900 border-blue-900/80",
        modalIcon: "bg-blue-100 text-blue-600",
        modalBtn: "bg-blue-600 hover:bg-blue-700",
        badgeBg: "bg-blue-500",
        pill: "bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
      };
    case "On Maintenance":
      return {
        bgLight: "bg-amber-50 text-amber-700 border-amber-200/50",
        tabActive: "bg-amber-600 text-white shadow-md shadow-amber-600/10",
        btn: "bg-amber-300 text-amber-900 border-amber-900/80",
        modalIcon: "bg-amber-100 text-amber-600",
        modalBtn: "bg-amber-600 hover:bg-amber-700",
        badgeBg: "bg-amber-500",
        pill: "bg-amber-600 hover:bg-amber-700 text-white border-amber-600",
      };
    case "Out of Service":
      return {
        bgLight: "bg-rose-50 text-rose-700 border-rose-200/50",
        tabActive: "bg-rose-600 text-white shadow-md shadow-rose-600/10",
        btn: "bg-rose-300 text-rose-900 border-rose-900/80",
        modalIcon: "bg-rose-100 text-rose-600",
        modalBtn: "bg-rose-600 hover:bg-rose-700",
        badgeBg: "bg-rose-500",
        pill: "bg-rose-600 hover:bg-rose-700 text-white border-rose-600",
      };
    default:
      return {
        bgLight: "bg-slate-50 text-slate-700 border-slate-200/50",
        tabActive: "bg-slate-900 text-white shadow-md",
        btn: "bg-slate-300 text-slate-900 border-slate-900/80",
        modalIcon: "bg-slate-100 text-slate-600",
        modalBtn: "bg-slate-600 hover:bg-slate-700",
        badgeBg: "bg-slate-500",
        pill: "bg-slate-600 hover:bg-slate-700 text-white border-slate-600",
      };
  }
};

// Utility mapper to format timestamptz for display only
const formatDisplayDate = (dateString: string) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch (error) {
    return dateString;
  }
};

// ==========================================
// TRUCK MODAL COMPONENT (Add / Edit)
// ==========================================
interface TruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: TruckRecord) => void;
  editData?: TruckRecord | null;
}

function TruckModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  editData,
}: TruckModalProps) {
  const initialTruckState = {
    plateNumber: "",
    truckType: "",
    truckModel: "",
    capacity: "",
    lastChecked: "",
  };

  const [formData, setFormData] = useState(initialTruckState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (editData) {
      setFormData({
        plateNumber: editData.plateNumber || "",
        truckType: editData.truckType || "",
        truckModel: editData.truckModel || "",
        capacity: editData.capacity ? String(editData.capacity) : "",
        lastChecked: editData.lastChecked
          ? editData.lastChecked.split("T")[0]
          : "",
      });
    } else {
      setFormData(initialTruckState);
    }
  }, [editData, isOpen]);

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
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
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
    if (!formData.lastChecked) {
      newErrors.lastChecked = "Last checked date is required.";
    } else if (formData.lastChecked > today) {
      newErrors.lastChecked = "Date cannot be in the future.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const updatedRecord: TruckRecord = {
      id: editData ? editData.id : Date.now(),
      plateNumber: formData.plateNumber.trim(),
      truckType: formData.truckType,
      truckModel: formData.truckModel.trim(),
      capacity: formData.capacity.trim(),
      lastChecked: formData.lastChecked,
      status: editData ? editData.status : "Available",
    };

    onSubmitSuccess(updatedRecord);
    handleCloseModal();
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
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900"
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
                  onChange={handleInputChange as any}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.plateNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.plateNumber && (
                  <p className="text-red-500 text-[11px] mt-1">
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
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.truckType ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"}`}
                  >
                    <span
                      className={
                        formData.truckType ? "text-black" : "text-slate-400"
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
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${formData.truckType === opt ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.truckType && (
                  <p className="text-red-500 text-[11px] mt-1">
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
                  onChange={handleInputChange as any}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckModel ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.truckModel && (
                  <p className="text-red-500 text-[11px] mt-1">
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
                  placeholder="e.g., 5 Tons or 5000 kg"
                  value={formData.capacity}
                  onChange={handleInputChange as any}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.capacity ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.capacity && (
                  <p className="text-red-500 text-[11px] mt-1">
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
                  onChange={handleInputChange as any}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.lastChecked ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.lastChecked && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.lastChecked}
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
              className="w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              {editData ? "Save Changes" : "Add Truck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// LOG MAINTENANCE MODAL COMPONENT (Source of Truth Format)
// ==========================================
interface LogMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (formData: any) => void;
  editData?: HistoryLogRecord | null;
  trucksOptions: TruckOption[];
  mechanicsOptions: EmployeeOption[];
  preselectedTruckId?: string | number | null;
  formType?: "inspection" | "update" | "log";
}

function LogMaintenanceModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  editData,
  trucksOptions,
  mechanicsOptions,
  preselectedTruckId,
  formType = "log",
}: LogMaintenanceModalProps) {
  const initialFormState = {
    date: "",
    truckID: "",
    primaryMechanicID: "",
    additionalMechanicID: "",
    issue: "",
    remarks: "",
    photoUrl: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isTruckDropdownOpen, setIsTruckDropdownOpen] = useState(false);
  const [isPrimaryDropdownOpen, setIsPrimaryDropdownOpen] = useState(false);
  const [isAdditionalDropdownOpen, setIsAdditionalDropdownOpen] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (editData) {
      setFormData({
        date: editData.date ? editData.date.split("T")[0] : "",
        truckID: editData.truckID ? String(editData.truckID) : "",
        primaryMechanicID: editData.primaryMechanicID
          ? String(editData.primaryMechanicID)
          : "",
        additionalMechanicID: editData.additionalMechanicID
          ? String(editData.additionalMechanicID)
          : "",
        issue: editData.issue || "",
        remarks: editData.remarks || "",
        photoUrl: editData.photoUrl || "",
      });
    } else if (isOpen) {
      setFormData({
        ...initialFormState,
        date: today,
        truckID: preselectedTruckId ? String(preselectedTruckId) : "",
      });
    }
  }, [editData, isOpen, preselectedTruckId]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialFormState);
    setErrors({});
    setIsTruckDropdownOpen(false);
    setIsPrimaryDropdownOpen(false);
    setIsAdditionalDropdownOpen(false);
    onClose();
  };

  const handleInputChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | { target: { name: string; value: string } },
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.date) {
      newErrors.date = "Date is required.";
    } else if (formData.date > today) {
      newErrors.date = "Future dates are not allowed.";
    }

    if (!formData.truckID) newErrors.truckID = "Truck selection is required.";
    if (!formData.primaryMechanicID)
      newErrors.primaryMechanicID = "Primary mechanic is required.";
    if (!formData.issue.trim()) {
      newErrors.issue =
        formType === "inspection"
          ? "Issue to fix is required."
          : formType === "update"
            ? "Additional issue is required."
            : "Work performed is required.";
    }

    if (
      formData.additionalMechanicID &&
      formData.additionalMechanicID === formData.primaryMechanicID
    ) {
      newErrors.additionalMechanicID = "Cannot select the same mechanic twice.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmitSuccess(formData);
  };

  const availableAdditionalMechanics = mechanicsOptions.filter(
    (emp) => String(emp.employeeID) !== String(formData.primaryMechanicID),
  );

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {editData
              ? "Edit Maintenance Log"
              : formType === "inspection"
                ? "Maintenance Inspection Form"
                : formType === "update"
                  ? "Maintenance Update Form"
                  : "Maintenance Log Form"}
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
          {/* Section 1: Record Details */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Record Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  max={today}
                  value={formData.date}
                  onChange={handleInputChange as any}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                    errors.date
                      ? "border-red-500 bg-red-50/20"
                      : "border-slate-300"
                  }`}
                />
                {errors.date && (
                  <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Select Truck *
                </label>
                <div
                  className={`relative w-full ${isTruckDropdownOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isTruckDropdownOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsTruckDropdownOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!!preselectedTruckId}
                    onClick={() => setIsTruckDropdownOpen(!isTruckDropdownOpen)}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${
                      errors.truckID
                        ? "border-red-500 bg-red-50/20 text-black"
                        : "border-slate-300 text-black"
                    } ${preselectedTruckId ? "opacity-75 cursor-not-allowed bg-slate-50" : ""}`}
                  >
                    <span
                      className={
                        formData.truckID
                          ? "text-black truncate pr-2"
                          : "text-slate-400"
                      }
                    >
                      {formData.truckID
                        ? trucksOptions.find(
                            (t) =>
                              String(t.truckID) === String(formData.truckID),
                          )
                          ? `${trucksOptions.find((t) => String(t.truckID) === String(formData.truckID))?.plateNumber} — ${trucksOptions.find((t) => String(t.truckID) === String(formData.truckID))?.truckType}`
                          : editData?.plateNumber + " — " + editData?.truckType
                        : "Choose a truck..."}
                    </span>
                    {!preselectedTruckId && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isTruckDropdownOpen ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>
                  {isTruckDropdownOpen && !preselectedTruckId && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 text-left">
                      {trucksOptions.map((truck) => (
                        <button
                          key={truck.truckID}
                          type="button"
                          onClick={() => {
                            handleInputChange({
                              target: {
                                name: "truckID",
                                value: String(truck.truckID),
                              },
                            });
                            setIsTruckDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                            String(formData.truckID) === String(truck.truckID)
                              ? "bg-blue-50/50 text-blue-700 font-medium"
                              : "text-slate-700"
                          }`}
                        >
                          {truck.plateNumber} — {truck.truckType}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.truckID && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.truckID}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Primary Mechanic *
                </label>
                <div
                  className={`relative w-full ${isPrimaryDropdownOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isPrimaryDropdownOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsPrimaryDropdownOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setIsPrimaryDropdownOpen(!isPrimaryDropdownOpen)
                    }
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${
                      errors.primaryMechanicID
                        ? "border-red-500 bg-red-50/20 text-black"
                        : "border-slate-300 text-black"
                    }`}
                  >
                    <span
                      className={
                        formData.primaryMechanicID
                          ? "text-black truncate pr-2"
                          : "text-slate-400"
                      }
                    >
                      {formData.primaryMechanicID
                        ? mechanicsOptions.find(
                            (m) =>
                              String(m.employeeID) ===
                              String(formData.primaryMechanicID),
                          )?.employeeName || editData?.mechanicName
                        : "Choose mechanic..."}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isPrimaryDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isPrimaryDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 text-left">
                      {mechanicsOptions.map((emp) => (
                        <button
                          key={emp.employeeID}
                          type="button"
                          onClick={() => {
                            handleInputChange({
                              target: {
                                name: "primaryMechanicID",
                                value: String(emp.employeeID),
                              },
                            });
                            if (
                              String(formData.additionalMechanicID) ===
                              String(emp.employeeID)
                            ) {
                              handleInputChange({
                                target: {
                                  name: "additionalMechanicID",
                                  value: "",
                                },
                              });
                            }
                            setIsPrimaryDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                            String(formData.primaryMechanicID) ===
                            String(emp.employeeID)
                              ? "bg-blue-50/50 text-blue-700 font-medium"
                              : "text-slate-700"
                          }`}
                        >
                          {emp.employeeName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.primaryMechanicID && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.primaryMechanicID}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Additional Mechanic (Optional)
                </label>
                <div
                  className={`relative w-full ${isAdditionalDropdownOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isAdditionalDropdownOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAdditionalDropdownOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!formData.primaryMechanicID}
                    onClick={() =>
                      setIsAdditionalDropdownOpen(!isAdditionalDropdownOpen)
                    }
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${
                      errors.additionalMechanicID
                        ? "border-red-500 bg-red-50/20 text-black"
                        : "border-slate-300 text-black"
                    } ${!formData.primaryMechanicID ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}`}
                  >
                    <span
                      className={
                        formData.additionalMechanicID
                          ? "text-black truncate pr-2"
                          : "text-slate-400"
                      }
                    >
                      {formData.additionalMechanicID
                        ? mechanicsOptions.find(
                            (m) =>
                              String(m.employeeID) ===
                              String(formData.additionalMechanicID),
                          )?.employeeName || editData?.additionalMechanic
                        : "Select Mechanic..."}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isAdditionalDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isAdditionalDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          handleInputChange({
                            target: { name: "additionalMechanicID", value: "" },
                          });
                          setIsAdditionalDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${!formData.additionalMechanicID ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
                      >
                        None
                      </button>
                      {availableAdditionalMechanics.map((emp) => (
                        <button
                          key={emp.employeeID}
                          type="button"
                          onClick={() => {
                            handleInputChange({
                              target: {
                                name: "additionalMechanicID",
                                value: String(emp.employeeID),
                              },
                            });
                            setIsAdditionalDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                            String(formData.additionalMechanicID) ===
                            String(emp.employeeID)
                              ? "bg-blue-50/50 text-blue-700 font-medium"
                              : "text-slate-700"
                          }`}
                        >
                          {emp.employeeName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.additionalMechanicID && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.additionalMechanicID}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Maintenance Information */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              2. Maintenance Information
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  {formType === "inspection"
                    ? "Issue To Fix *"
                    : formType === "update"
                      ? "Additional Issue *"
                      : "Work Performed *"}
                </label>
                <textarea
                  name="issue"
                  rows={3}
                  placeholder={
                    formType === "inspection"
                      ? "Describe the reported issue or items that require fixing..."
                      : formType === "update"
                        ? "Describe maintenance progress, additional issues, or work in progress..."
                        : "Describe the completed maintenance work and truck condition..."
                  }
                  value={formData.issue}
                  onChange={handleInputChange as any}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                    errors.issue
                      ? "border-red-500 bg-red-50/20"
                      : "border-slate-300"
                  }`}
                />
                {errors.issue && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.issue}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  {formType === "update"
                    ? "Additional Remarks (Optional)"
                    : "Remarks (Optional)"}
                </label>
                <textarea
                  name="remarks"
                  rows={5}
                  placeholder="Any additional notes, future recommendations, or observations..."
                  value={formData.remarks}
                  onChange={handleInputChange as any}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Photo Evidence */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              3. {editData ? "Photo Evidence" : "Upload Photo Evidence"}
            </div>
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                {editData
                  ? "Update Maintenance Photo"
                  : "Upload Maintenance Photo (Optional)"}
              </label>
              {!editData && (
                <p className="text-[11px] text-slate-500 mb-2">
                  {formType === "inspection"
                    ? "Upload photos showing the truck's condition and identified issue before maintenance."
                    : formType === "update"
                      ? "Upload photos showing the maintenance work in progress."
                      : "Upload photos showing the truck's condition after maintenance."}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-300 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />{" "}
                  {formData.photoUrl ? "Change File" : "Choose File"}
                </button>
                <span className="text-xs text-slate-500 truncate max-w-xs">
                  {formData.photoUrl
                    ? "Photo attached successfully"
                    : "No file chosen"}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              {formData.photoUrl && (
                <div className="mt-3 relative w-24 h-24 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                  <img
                    src={formData.photoUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCloseModal}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 cursor-pointer"
            >
              {editData ? "Save Changes" : "Save Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// HISTORY LOG DETAIL VIEW (Source of Truth)
// ==========================================
interface LogDetailViewProps {
  log: HistoryLogRecord;
  onBack: () => void;
  onEdit: (logRecord: HistoryLogRecord) => void;
  onDelete: (id: string | number) => void;
}

function LogDetailView({ log, onBack, onEdit, onDelete }: LogDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to History Logs"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Maintenance Log Details
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Complete maintenance record and remarks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onEdit(log)}
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Log</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold border border-blue-100">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {log.plateNumber}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-slate-600 text-sm">
                <Truck className="w-4 h-4" />
                <span>{log.truckType}</span>
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-500 font-medium">
              Date of Maintenance
            </div>
            <div className="text-base font-semibold text-slate-900 mt-0.5">
              {new Date(log.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Record Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Plate Number
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {log.plateNumber}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Truck
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {log.truckType}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Date
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {log.date ? log.date.split("T")[0] : "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Primary Mechanic
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {log.mechanicName}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Additional Mechanic
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {log.additionalMechanic || "None"}
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              2. Maintenance Information
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Work Performed
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-16 whitespace-pre-wrap">
                  {log.issue}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Remarks
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-24 whitespace-pre-wrap">
                  {log.remarks || "No additional remarks."}
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              3. Photo Evidence
            </div>
            {log.photoUrl ? (
              <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                <img
                  src={log.photoUrl}
                  alt="Maintenance Evidence"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-2">
                No photo evidence attached to this record.
              </div>
            )}
          </div>

          {/* Section 4: Preliminary Notes */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              Preliminary Notes (Before Maintenance)
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Driver's Report / Observed Vehicle Issues
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-16 whitespace-pre-wrap">
                  {log.driversReport || "No preliminary symptoms reported."}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Remarks
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-16 whitespace-pre-wrap">
                  {log.preliminaryRemarks || "No preliminary remarks."}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-2">
                  Picture Taken Before Maintenance
                </label>
                {log.preliminaryPhotoUrl ? (
                  <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                    <img
                      src={log.preliminaryPhotoUrl}
                      alt="Before Maintenance"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 border border-dashed border-slate-300 rounded-md bg-slate-50 w-fit">
                    No photo evidence attached before maintenance.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Progress Notes */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              Progress Notes (During Maintenance)
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Additional Issue
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-16 whitespace-pre-wrap">
                  {log.additionalIssue || "No additional issues logged."}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Additional Remarks
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-16 whitespace-pre-wrap">
                  {log.progressRemarks || "No progress remarks."}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-2">
                  Picture Taken During Maintenance
                </label>
                {log.progressPhotoUrl ? (
                  <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                    <img
                      src={log.progressPhotoUrl}
                      alt="During Maintenance"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic p-3 border border-dashed border-slate-300 rounded-md bg-slate-50 w-fit">
                    No photo evidence attached during maintenance.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Maintenance Log
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              Are you sure you want to delete this record for{" "}
              <strong className="text-slate-900">{log.plateNumber}</strong>?
              This will permanently remove the log from the list.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(log.id);
                  setShowDeleteModal(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md cursor-pointer"
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
// TRUCK SPECIFIC HISTORY VIEW (Matches History Log Page)
// ==========================================
interface TruckSpecificHistoryViewProps {
  truck: TruckRecord;
  logs: HistoryLogRecord[];
  onBack: () => void;
  onSelectLog: (log: HistoryLogRecord) => void;
  onEditLog: (log: HistoryLogRecord) => void;
  onDeleteLog: (id: string | number) => void;
}

function TruckSpecificHistoryView({
  truck,
  logs,
  onBack,
  onSelectLog,
  onEditLog,
  onDeleteLog,
}: TruckSpecificHistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter logs strictly for this truck (by ID or Plate Number)
  const truckLogs = logs.filter(
    (l) =>
      String(l.truckID) === String(truck.id) ||
      String(l.plateNumber).toLowerCase() ===
        String(truck.plateNumber).toLowerCase(),
  );

  const filteredLogs = truckLogs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.plateNumber?.toLowerCase().includes(searchLower) ||
      log.truckType?.toLowerCase().includes(searchLower) ||
      log.mechanicName?.toLowerCase().includes(searchLower) ||
      log.additionalMechanic?.toLowerCase().includes(searchLower) ||
      log.issue?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen relative animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to Truck Details"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              History Logs — {truck.plateNumber}
            </h1>
            <p className="text-xs sm:text-sm text-slate-700 mt-1">
              View and manage past maintenance and repair records for this
              specific truck.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">
              Maintenance Records ({truck.plateNumber})
            </h2>
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search mechanic, issue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto px-4 sm:px-6">
          <table className="w-full max-w-5xl mx-auto text-left border-collapse table-fixed my-2">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-1/4 text-left">Date</th>
                <th className="py-3.5 px-4 w-1/4 text-left">Plate Number</th>
                <th className="py-3.5 px-4 w-1/4 text-left">
                  Status Before Change
                </th>
                <th className="py-3.5 px-4 w-1/4 text-right">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        No history logs found
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Try adjusting your search query or add a new maintenance
                        log to see it here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => onSelectLog(log)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    title="Click to view complete maintenance log"
                  >
                    <td className="py-4 px-4 w-1/4 text-left align-top sm:align-middle">
                      <div className="text-sm font-medium text-slate-800">
                        {new Date(log.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-4 w-1/4 text-left align-top sm:align-middle">
                      <div className="font-semibold text-slate-900 truncate">
                        {log.plateNumber}
                        <span className="text-xs text-slate-500 font-normal ml-1 sm:ml-2">
                          — {log.truckType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 max-w-md sm:max-w-lg">
                        <div className="font-medium text-slate-700">
                          {log.mechanicName}{" "}
                          {log.additionalMechanic
                            ? `& ${log.additionalMechanic}`
                            : ""}
                        </div>
                        <div className="mt-0.5 truncate">{log.issue}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 w-1/4 text-left align-top sm:align-middle">
                      <span className="text-xs text-slate-400">—</span>
                    </td>
                    <td className="py-4 px-4 w-1/4 text-right align-top sm:align-middle">
                      <span className="text-xs text-slate-400">—</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {filteredLogs.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length}{" "}
            entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage === 1
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
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
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TRUCK INFORMATION DETAIL VIEW
// ==========================================
interface TruckDetailViewProps {
  truck: TruckRecord;
  logs: HistoryLogRecord[];
  onBack: () => void;
  onEdit: (truckRecord: TruckRecord) => void;
  onDelete: (id: string | number) => void;
  onUpdateStatusClick: () => void;
  onHistoryClick: () => void;
  onLogMaintenanceClick: () => void;
}

function TruckDetailView({
  truck,
  logs,
  onBack,
  onEdit,
  onDelete,
  onUpdateStatusClick,
  onHistoryClick,
  onLogMaintenanceClick,
}: TruckDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const styles = getStatusStyles(truck.status);

  const canLogMaintenance =
    truck.status === "On Maintenance" || truck.status === "Out of Service";

  // Find the latest maintenance log/form info for this truck to check if forms have been filled up
  const truckLogs = logs.filter(
    (l) =>
      String(l.truckID) === String(truck.id) ||
      String(l.plateNumber).toLowerCase() ===
        String(truck.plateNumber).toLowerCase(),
  );
  const latestLog = truckLogs[truckLogs.length - 1];

  // Frontend logic flags
  const isOnMaintenanceOrOOS =
    truck.status === "On Maintenance" || truck.status === "Out of Service";

  const isInspectionFilled = !!(
    latestLog &&
    (latestLog.driversReport ||
      latestLog.preliminaryRemarks ||
      latestLog.preliminaryPhotoUrl ||
      latestLog.issue)
  );

  const isUpdateFilled = !!(
    latestLog &&
    (latestLog.additionalIssue ||
      latestLog.progressRemarks ||
      latestLog.progressPhotoUrl)
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to Fleet Status"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Truck Information Record
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Complete truck diagnostics and specifications.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={onUpdateStatusClick}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            <span>Update Status</span>
          </button>
          <button
            onClick={() => onEdit(truck)}
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Truck</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold border border-blue-100">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {truck.plateNumber}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles.bgLight.split(" border")[0]}`}
                >
                  {truck.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {truck.truckType}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canLogMaintenance && (
              <button
                onClick={onLogMaintenanceClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-semibold transition-colors border border-amber-200 cursor-pointer"
              >
                <Wrench className="w-4 h-4" /> Maintenance Update Form
              </button>
            )}
            <button
              onClick={onHistoryClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors border border-slate-300 cursor-pointer"
            >
              <HistoryIcon className="w-4 h-4" /> History
            </button>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Truck Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Plate Number
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {truck.plateNumber || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Truck
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {truck.truckType || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Truck Model
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {truck.truckModel || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Capacity
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {truck.capacity || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Last Checked
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                  {formatDisplayDate(truck.lastChecked) || "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Preliminary Notes (Before Maintenance) - Displayed only if On Maintenance / Out of Service AND Inspection Form filled */}
          {isOnMaintenanceOrOOS && isInspectionFilled && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs animate-fade-in">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                Preliminary Notes (Before Maintenance)
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Driver's Report / Observed Vehicle Issues
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-16 whitespace-pre-wrap">
                    {latestLog?.driversReport ||
                      latestLog?.issue ||
                      "No preliminary symptoms reported."}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Remarks
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-16 whitespace-pre-wrap">
                    {latestLog?.preliminaryRemarks ||
                      latestLog?.remarks ||
                      "No preliminary remarks."}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-2">
                    Picture Taken Before Maintenance
                  </label>
                  {latestLog?.preliminaryPhotoUrl || latestLog?.photoUrl ? (
                    <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                      <img
                        src={
                          latestLog?.preliminaryPhotoUrl || latestLog?.photoUrl
                        }
                        alt="Before Maintenance"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic p-3 border border-dashed border-slate-300 rounded-md bg-slate-50 w-fit">
                      No photo evidence attached before maintenance.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Progress Notes (During Maintenance) - Displayed only if On Maintenance / Out of Service AND Update Form filled */}
          {isOnMaintenanceOrOOS && isUpdateFilled && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs animate-fade-in">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                Progress Notes (During Maintenance)
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Additional Issue
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-16 whitespace-pre-wrap">
                    {latestLog?.additionalIssue ||
                      "No additional issues logged."}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Additional Remarks
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-16 whitespace-pre-wrap">
                    {latestLog?.progressRemarks || "No progress remarks."}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-2">
                    Picture Taken During Maintenance
                  </label>
                  {latestLog?.progressPhotoUrl ? (
                    <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                      <img
                        src={latestLog?.progressPhotoUrl}
                        alt="During Maintenance"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic p-3 border border-dashed border-slate-300 rounded-md bg-slate-50 w-fit">
                      No photo evidence attached during maintenance.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Truck Record
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900">{truck.plateNumber}</strong>?
              This will permanently remove the record from the list.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(truck.id);
                  setShowDeleteModal(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md cursor-pointer"
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
// MECHANIC FLEET STATUS PAGE (MAIN)
// ==========================================
interface MechanicFleetStatusProps {
  isOpen?: boolean;
  setIsopen?: (open: boolean) => void;
}

export default function MechanicFleetStatusPage({
  isOpen,
  setIsopen,
}: MechanicFleetStatusProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<
    | "All"
    | "On Maintenance"
    | "Available"
    | "Already Booked"
    | "On Delivery"
    | "Out of Service"
  >("All");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);

  // === STATUS SELECTION MODAL ===
  const [showStatusSelectModal, setShowStatusSelectModal] = useState(false);
  const [statusConfirmTruck, setStatusConfirmTruck] =
    useState<TruckRecord | null>(null);
  const [pendingStatusTarget, setPendingStatusTarget] = useState<string>("");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showMaintenanceToAvailableModal, setShowMaintenanceToAvailableModal] =
    useState(false);

  // === HISTORY & LOG MAINTENANCE MODAL STATES ===
  const [showTruckHistoryView, setShowTruckHistoryView] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] =
    useState<HistoryLogRecord | null>(null);
  const [editingHistoryRecord, setEditingHistoryRecord] =
    useState<HistoryLogRecord | null>(null);
  const [showLogMaintenanceModal, setShowLogMaintenanceModal] = useState(false);
  const [maintenanceFormType, setMaintenanceFormType] = useState<
    "inspection" | "update" | "log"
  >("log");

  // === TOAST NOTIFICATION STATE ===
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // === PAGINATION STATES ===
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  const [fleetList, setFleetList] = useState<TruckRecord[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<HistoryLogRecord[]>(
    [],
  );
  const [mechanicsOptions, setMechanicsOptions] = useState<EmployeeOption[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const API_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  // === 1. FETCH DATA FROM BACKEND ===
  useEffect(() => {
    fetchTrucks();
    fetchLogs();
    fetchMechanics();
  }, []);

  const fetchTrucks = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/trucks`);
      const data = response.data.data || response.data;

      const mappedData = data.map((truck: any) => ({
        id: truck.truckID || truck.truckid || truck.id,
        plateNumber: truck.plateNumber || truck.platenumber,
        truckType: truck.truckType || truck.trucktype,
        truckModel: truck.model || truck.truckModel,
        capacity: String(truck.capacity),
        lastChecked: truck.lastChecked || truck.lastchecked,
        status: truck.truckStatus || truck.truckstatus || "Available",
      }));

      setFleetList(mappedData || []);
    } catch (error) {
      console.error("Error fetching trucks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/HistoryLogsM`);
      const result = response.data;
      if (Array.isArray(result)) {
        setMaintenanceLogs(result);
      } else if (result && Array.isArray(result.data)) {
        setMaintenanceLogs(result.data);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const fetchMechanics = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/employees?role=Mechanic`);
      const empData = res.data.data || res.data;
      setMechanicsOptions(empData || []);
    } catch (error) {
      console.error("Error fetching mechanics:", error);
    }
  };

  // === 2. UPDATE STATUS HELPER ===
  const executeStatusUpdate = async (
    truckRecord: TruckRecord,
    newStatus: string,
  ) => {
    const fullPayload = {
      plateNumber: truckRecord.plateNumber,
      truckType: truckRecord.truckType,
      truckModel: truckRecord.truckModel,
      capacity: truckRecord.capacity,
      lastChecked: truckRecord.lastChecked,
      status: newStatus,
    };

    try {
      const response = await axios.put(
        `${API_URL}/api/trucks/${truckRecord.id}`,
        fullPayload,
      );
      if (response.status === 200 || response.status === 201) {
        setFleetList((prev) =>
          prev.map((truck) =>
            String(truck.id) === String(truckRecord.id)
              ? { ...truck, status: newStatus }
              : truck,
          ),
        );
        if (
          selectedTruck &&
          String(selectedTruck.id) === String(truckRecord.id)
        ) {
          setSelectedTruck((prev) =>
            prev ? { ...prev, status: newStatus } : null,
          );
        }
        setToastMessage("Status updated successfully.");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status on server.");
    }
  };

  const handleSelectStatusOption = (statusOption: string) => {
    if (!statusConfirmTruck) return;

    if (statusConfirmTruck.status === statusOption) {
      setShowStatusSelectModal(false);
      setStatusConfirmTruck(null);
      return;
    }

    setPendingStatusTarget(statusOption);
    setShowStatusSelectModal(false);

    if (
      (statusConfirmTruck.status === "On Maintenance" ||
        statusConfirmTruck.status === "Out of Service") &&
      statusOption === "Available"
    ) {
      setShowMaintenanceToAvailableModal(true);
      return;
    }

    setShowConfirmationModal(true);
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusConfirmTruck || !pendingStatusTarget) return;

    const wasAvailable = statusConfirmTruck.status === "Available";
    const targetIsMaintenanceOrOOS =
      pendingStatusTarget === "On Maintenance" ||
      pendingStatusTarget === "Out of Service";

    if (wasAvailable && targetIsMaintenanceOrOOS) {
      setShowConfirmationModal(false);
      setMaintenanceFormType("inspection");
      setShowLogMaintenanceModal(true);
      return;
    }

    await executeStatusUpdate(statusConfirmTruck, pendingStatusTarget);
    setShowConfirmationModal(false);
    setStatusConfirmTruck(null);
    setPendingStatusTarget("");
  };

  // === 3. ADD OR EDIT TRUCK ===
  const handleModalSubmit = async (record: TruckRecord) => {
    try {
      if (editingTruck) {
        const originalDate = editingTruck.lastChecked
          ? editingTruck.lastChecked.split("T")[0]
          : "";
        const isChanged =
          record.plateNumber !==
            String(editingTruck.plateNumber || "").trim() ||
          record.truckType !== editingTruck.truckType ||
          record.truckModel !== String(editingTruck.truckModel || "").trim() ||
          record.capacity !== String(editingTruck.capacity || "").trim() ||
          record.lastChecked !== originalDate;

        if (!isChanged) {
          setToastMessage("No changes were made.");
          setEditingTruck(null);
          setIsModalOpen(false);
          return;
        }
      }

      const dbPayload = {
        plateNumber: record.plateNumber,
        truckType: record.truckType,
        truckModel: record.truckModel,
        capacity: record.capacity,
        lastChecked: record.lastChecked,
        status: record.status,
      };

      if (editingTruck) {
        const response = await axios.put(
          `${API_URL}/api/trucks/${record.id}`,
          dbPayload,
        );
        if (response.status === 200 || response.status === 201) {
          setFleetList((prev) =>
            prev.map((t) => (String(t.id) === String(record.id) ? record : t)),
          );
          if (selectedTruck && String(selectedTruck.id) === String(record.id))
            setSelectedTruck(record);
          setToastMessage("Changes saved successfully.");
        }
      } else {
        const response = await axios.post(`${API_URL}/api/trucks`, dbPayload);
        const savedDbRecord = response.data;
        const newTruck: TruckRecord = {
          id: savedDbRecord.truckID || savedDbRecord.id || Date.now(),
          plateNumber: savedDbRecord.plateNumber,
          truckType: savedDbRecord.truckType,
          truckModel: savedDbRecord.model || savedDbRecord.truckModel,
          capacity: String(savedDbRecord.capacity),
          lastChecked: savedDbRecord.lastChecked,
          status:
            savedDbRecord.truckStatus || savedDbRecord.status || "Available",
        };
        setFleetList((prev) => [newTruck, ...prev]);
        setToastMessage("Truck added successfully.");
      }
    } catch (error) {
      console.error("Error saving truck:", error);
      alert("Error saving truck details.");
    }

    setEditingTruck(null);
    setIsModalOpen(false);
  };

  // === 4. DELETE TRUCK ===
  const handleDeleteTruck = async (id: string | number) => {
    try {
      await axios.delete(`${API_URL}/api/trucks/${id}`);
      setFleetList((prev) => prev.filter((t) => String(t.id) !== String(id)));
      setSelectedTruck(null);
      setToastMessage("Truck deleted successfully.");
    } catch (error) {
      console.error("Error deleting truck:", error);
      alert("Error deleting truck.");
    }
  };

  // === 5. LOG MAINTENANCE SUBMISSION & EDIT/DELETE FOR HISTORY LOGS ===
  const handleMaintenanceLogSubmit = async (formData: any) => {
    try {
      if (editingHistoryRecord) {
        const response = await axios.put(
          `${API_URL}/api/HistoryLogsM/${editingHistoryRecord.id}`,
          formData,
        );
        if (response.status === 200 || response.status === 201) {
          await fetchLogs();
          if (selectedHistoryRecord?.id === editingHistoryRecord.id) {
            const updatedRes = await axios.get(`${API_URL}/api/HistoryLogsM`);
            const allLogs = updatedRes.data.data || updatedRes.data;
            const currentRec = allLogs.find(
              (l: any) => String(l.id) === String(editingHistoryRecord.id),
            );
            if (currentRec) setSelectedHistoryRecord(currentRec);
          }
          setToastMessage("Changes saved successfully.");
        }
      } else {
        const response = await axios.post(
          `${API_URL}/api/HistoryLogsM`,
          formData,
        );
        if (response.status === 200 || response.status === 201) {
          await fetchLogs();
          setToastMessage("Maintenance log saved successfully.");

          if (
            maintenanceFormType === "inspection" &&
            statusConfirmTruck &&
            pendingStatusTarget
          ) {
            await executeStatusUpdate(statusConfirmTruck, pendingStatusTarget);
          } else if (
            maintenanceFormType === "log" &&
            statusConfirmTruck &&
            pendingStatusTarget === "Available"
          ) {
            await executeStatusUpdate(statusConfirmTruck, "Available");
          }

          setStatusConfirmTruck(null);
          setPendingStatusTarget("");
        }
      }
    } catch (error) {
      console.error("Error saving maintenance log:", error);
      alert("Error saving maintenance log to server.");
    } finally {
      setEditingHistoryRecord(null);
      setShowLogMaintenanceModal(false);
    }
  };

  const handleDeleteHistoryLog = async (id: string | number) => {
    try {
      await axios.delete(`${API_URL}/api/HistoryLogsM/${id}`);

      setMaintenanceLogs((prev) =>
        prev.filter((log) => String(log.id) !== String(id)),
      );

      setSelectedHistoryRecord(null);
      setToastMessage("Deleted successfully.");
    } catch (error) {
      console.error("Error deleting log:", error);
      alert("Error deleting maintenance log.");
    }
  };

  const totalCount = fleetList.length;
  const operationalCount = fleetList.filter(
    (t) => t.status === "Available",
  ).length;
  const alreadyBookedCount = fleetList.filter(
    (t) => t.status === "Already Booked",
  ).length;
  const deliveryCount = fleetList.filter(
    (t) => t.status === "On Delivery",
  ).length;
  const maintenanceCount = fleetList.filter(
    (t) => t.status === "On Maintenance",
  ).length;
  const outOfServiceCount = fleetList.filter(
    (t) => t.status === "Out of Service",
  ).length;

  const filteredFleet = fleetList.filter((truck) => {
    const matchesSearch =
      truck.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.truckType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab =
      selectedFilter === "All" ||
      truck.status.toLowerCase() === selectedFilter.toLowerCase();
    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredFleet.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFleet = filteredFleet.slice(startIndex, endIndex);

  const trucksOptionsForModal = fleetList.map((t) => ({
    truckID: t.id,
    plateNumber: t.plateNumber,
    truckType: t.truckType,
  }));

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen relative">
      {selectedHistoryRecord ? (
        <LogDetailView
          log={selectedHistoryRecord}
          onBack={() => setSelectedHistoryRecord(null)}
          onEdit={(logRecord) => {
            setEditingHistoryRecord(logRecord);
            setMaintenanceFormType("log");
            setShowLogMaintenanceModal(true);
          }}
          onDelete={handleDeleteHistoryLog}
        />
      ) : showTruckHistoryView && selectedTruck ? (
        <TruckSpecificHistoryView
          truck={selectedTruck}
          logs={maintenanceLogs}
          onBack={() => {
            setShowTruckHistoryView(false);
          }}
          onSelectLog={(log) => setSelectedHistoryRecord(log)}
          onEditLog={(log) => {
            setEditingHistoryRecord(log);
            setMaintenanceFormType("log");
            setShowLogMaintenanceModal(true);
          }}
          onDeleteLog={handleDeleteHistoryLog}
        />
      ) : selectedTruck ? (
        <TruckDetailView
          truck={selectedTruck}
          logs={maintenanceLogs}
          onBack={() => setSelectedTruck(null)}
          onEdit={(truckRecord) => {
            setEditingTruck(truckRecord);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteTruck}
          onUpdateStatusClick={() => {
            setStatusConfirmTruck(selectedTruck);
            setPendingStatusTarget("");
            setShowStatusSelectModal(true);
          }}
          onHistoryClick={() => setShowTruckHistoryView(true)}
          onLogMaintenanceClick={() => {
            setStatusConfirmTruck(selectedTruck);
            setPendingStatusTarget("");
            setMaintenanceFormType("update");
            setShowLogMaintenanceModal(true);
          }}
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Fleet Status (Mechanic Portal)
              </h1>
              <p className="text-xs sm:text-sm text-slate-700 mt-1">
                Monitor truck diagnostic health, asset availability, and
                maintenance conditions.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingTruck(null);
                setIsModalOpen(true);
              }}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-all duration-200 whitespace-nowrap self-start sm:self-auto cursor-pointer"
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>Add Truck</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                <button
                  onClick={() => setSelectedFilter("All")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFilter === "All"
                      ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  onClick={() => setSelectedFilter("On Maintenance")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFilter === "On Maintenance"
                      ? getStatusStyles("On Maintenance").tabActive
                      : getStatusStyles("On Maintenance").bgLight
                  }`}
                >
                  On Maintenance ({maintenanceCount})
                </button>
                <button
                  onClick={() => setSelectedFilter("Available")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFilter === "Available"
                      ? getStatusStyles("Available").tabActive
                      : getStatusStyles("Available").bgLight
                  }`}
                >
                  Available ({operationalCount})
                </button>
                <button
                  onClick={() => setSelectedFilter("Already Booked")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFilter === "Already Booked"
                      ? getStatusStyles("Already Booked").tabActive
                      : getStatusStyles("Already Booked").bgLight
                  }`}
                >
                  Already Booked ({alreadyBookedCount})
                </button>
                <button
                  onClick={() => setSelectedFilter("On Delivery")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFilter === "On Delivery"
                      ? getStatusStyles("On Delivery").tabActive
                      : getStatusStyles("On Delivery").bgLight
                  }`}
                >
                  On Delivery ({deliveryCount})
                </button>
                <button
                  onClick={() => setSelectedFilter("Out of Service")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFilter === "Out of Service"
                      ? getStatusStyles("Out of Service").tabActive
                      : getStatusStyles("Out of Service").bgLight
                  }`}
                >
                  Out of Service ({outOfServiceCount})
                </button>
              </div>

              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by Plate No or Type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto relative z-10 pb-32 min-h-75">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 w-1/2 text-left">
                      Plate Number
                    </th>
                    <th className="py-3.5 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 w-1/2 text-right">
                      Current Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="py-16 sm:py-20 text-center font-medium text-slate-500"
                      >
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                        Loading fleet records...
                      </td>
                    </tr>
                  ) : paginatedFleet.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-16 sm:py-20 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                            <FileText className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-semibold text-slate-800">
                            No fleet records found
                          </p>
                          <p className="text-slate-500 text-xs mt-1">
                            Try adjusting your search query or filter selection
                            to view existing assets.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedFleet.map((truck, index) => {
                      const currentStyles = getStatusStyles(truck.status);

                      return (
                        <tr
                          key={truck.id || `truck-row-${index}`}
                          onClick={() => setSelectedTruck(truck)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                          title="Click to view complete truck record"
                        >
                          <td className="py-4 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 text-left">
                            <div className="font-medium text-slate-900 truncate">
                              {truck.plateNumber}
                              <span className="text-xs text-slate-500 font-normal ml-1 sm:ml-2">
                                — {truck.truckType}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Last Checked:{" "}
                              {formatDisplayDate(truck.lastChecked)}
                            </div>
                          </td>
                          <td className="py-4 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 text-right">
                            <div className="relative inline-block text-right z-10">
                              <div
                                className={`w-36 h-8 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md border shadow-xs ${currentStyles.btn}`}
                              >
                                <span>{truck.status}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
              <span>
                Showing {filteredFleet.length === 0 ? 0 : startIndex + 1} to{" "}
                {Math.min(endIndex, filteredFleet.length)} of{" "}
                {filteredFleet.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                    currentPage === 1
                      ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                      : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
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
                      : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showStatusSelectModal && statusConfirmTruck && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Update Status
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Current Status:{" "}
              <strong className="text-slate-800">
                {statusConfirmTruck.status}
              </strong>
            </p>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Select new status for vehicle{" "}
              <strong className="text-slate-900">
                {statusConfirmTruck.plateNumber}
              </strong>
              :
            </p>

            <div className="space-y-2 mb-6">
              {[
                { label: "Available", dotColor: "bg-blue-500" },
                { label: "On Maintenance", dotColor: "bg-amber-500" },
                { label: "Out of Service", dotColor: "bg-rose-500" },
              ].map(({ label, dotColor }) => {
                const isCurrent = statusConfirmTruck.status === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSelectStatusOption(label)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${
                      isCurrent
                        ? "bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-slate-400/30"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${dotColor}`}
                      />
                      {label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowStatusSelectModal(false);
                  setStatusConfirmTruck(null);
                  setPendingStatusTarget("");
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmationModal && statusConfirmTruck && pendingStatusTarget && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${getStatusStyles(pendingStatusTarget).modalIcon}`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Confirm Status Change
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              Are you sure you want to change this truck's status to{" "}
              <span className="font-semibold text-slate-900">
                {pendingStatusTarget}
              </span>
              ?
              <br />
              <span className="text-[11px] block mt-2 text-slate-500">
                Target Vehicle:{" "}
                <strong>{statusConfirmTruck.plateNumber}</strong> (
                {statusConfirmTruck.truckType})
              </span>
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmationModal(false);
                  setStatusConfirmTruck(null);
                  setPendingStatusTarget("");
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                className={`flex-1 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md cursor-pointer ${getStatusStyles(pendingStatusTarget).modalBtn}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showMaintenanceToAvailableModal && selectedTruck && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Complete Maintenance First
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              This truck is currently{" "}
              <strong className="text-slate-800">{selectedTruck.status}</strong>
              . To change its status to Available, you must complete and save
              the maintenance log first. Continue?
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowMaintenanceToAvailableModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMaintenanceToAvailableModal(false);
                  setMaintenanceFormType("log");
                  setShowLogMaintenanceModal(true);
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <TruckModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTruck(null);
        }}
        onSubmitSuccess={handleModalSubmit}
        editData={editingTruck}
      />

      <LogMaintenanceModal
        isOpen={showLogMaintenanceModal}
        onClose={() => {
          setShowLogMaintenanceModal(false);
          setEditingHistoryRecord(null);
          setStatusConfirmTruck(null);
          setPendingStatusTarget("");
        }}
        onSubmitSuccess={handleMaintenanceLogSubmit}
        editData={editingHistoryRecord}
        trucksOptions={trucksOptionsForModal}
        mechanicsOptions={mechanicsOptions}
        preselectedTruckId={statusConfirmTruck?.id || selectedTruck?.id}
        formType={maintenanceFormType}
      />

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-100 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-slate-700">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${toastMessage === "No changes were made." ? "bg-blue-500" : "bg-emerald-500"}`}
            >
              {toastMessage === "No changes were made." ? (
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
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
