// ==========================================
// ADMIN FLEET STATUS PAGE & TRUCK MODAL
// ==========================================
"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Truck,
  FileText,
  X,
  ArrowLeft,
  Edit3,
  Trash2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  History as HistoryIcon,
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
      };
    case "Already Booked":
      return {
        bgLight: "bg-indigo-50 text-indigo-700 border-indigo-200/50",
        tabActive: "bg-indigo-600 text-white shadow-md shadow-indigo-600/10",
        btn: "bg-indigo-300 text-indigo-900 border-indigo-900/80",
        modalIcon: "bg-indigo-100 text-indigo-600",
        modalBtn: "bg-indigo-600 hover:bg-indigo-700",
      };
    case "On Maintenance":
      return {
        bgLight: "bg-amber-50 text-amber-700 border-amber-200/50",
        tabActive: "bg-amber-600 text-white shadow-md shadow-amber-600/10",
        btn: "bg-amber-300 text-amber-900 border-amber-900/80",
        modalIcon: "bg-amber-100 text-amber-600",
        modalBtn: "bg-amber-600 hover:bg-amber-700",
      };
    case "On Delivery":
      return {
        bgLight: "bg-blue-50 text-blue-700 border-blue-200/50",
        tabActive: "bg-blue-600 text-white shadow-md shadow-blue-600/10",
        btn: "bg-blue-300 text-blue-900 border-blue-900/80",
        modalIcon: "bg-blue-100 text-blue-600",
        modalBtn: "bg-blue-600 hover:bg-blue-700",
      };
    case "Out of Service":
      return {
        bgLight: "bg-rose-50 text-rose-700 border-rose-200/50",
        tabActive: "bg-rose-600 text-white shadow-md shadow-rose-600/10",
        btn: "bg-rose-300 text-rose-900 border-rose-900/80",
        modalIcon: "bg-rose-100 text-rose-600",
        modalBtn: "bg-rose-600 hover:bg-rose-700",
      };
    default:
      return {
        bgLight: "bg-slate-50 text-slate-700 border-slate-200/50",
        tabActive: "bg-slate-900 text-white shadow-md",
        btn: "bg-slate-300 text-slate-900 border-slate-900/80",
        modalIcon: "bg-slate-100 text-slate-600",
        modalBtn: "bg-slate-600 hover:bg-slate-700",
      };
  }
};

// Utility mapper to format timestamptz for display only (prevents local timezone shifts)
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
    setFormData(initialTruckState);
    setErrors({});
    setIsTypeDropdownOpen(false);
    onClose();
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
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${
                      errors.truckType
                        ? "border-red-500 bg-red-50/20 text-black"
                        : "border-slate-300 text-black"
                    }`}
                  >
                    <span
                      className={
                        formData.truckType ? "text-black" : "text-slate-400"
                      }
                    >
                      {formData.truckType || "Select truck type"}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${
                        isTypeDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isTypeDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 text-left">
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
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                            formData.truckType === opt
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
                  placeholder="e.g., 5000"
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
                  Last Checked (MM/DD/YYYY)
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
// HISTORY LOG DETAIL VIEW
// ==========================================
interface LogDetailViewProps {
  log: HistoryLogRecord;
  onBack: () => void;
}

function LogDetailView({ log, onBack }: LogDetailViewProps) {
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
    </div>
  );
}

// ==========================================
// TRUCK SPECIFIC HISTORY VIEW
// ==========================================
interface TruckSpecificHistoryViewProps {
  truck: TruckRecord;
  logs: HistoryLogRecord[];
  onBack: () => void;
  onSelectLog: (log: HistoryLogRecord) => void;
}

function TruckSpecificHistoryView({
  truck,
  logs,
  onBack,
  onSelectLog,
}: TruckSpecificHistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
              View past maintenance and repair records for this specific truck.
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
                        Try adjusting your search query or check back later.
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
  onHistoryClick: () => void;
}

function TruckDetailView({
  truck,
  logs,
  onBack,
  onEdit,
  onDelete,
  onHistoryClick,
}: TruckDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const styles = getStatusStyles(truck.status);

  const truckLogs = logs.filter(
    (l) =>
      String(l.truckID) === String(truck.id) ||
      String(l.plateNumber).toLowerCase() ===
        String(truck.plateNumber).toLowerCase(),
  );
  const latestLog = truckLogs[truckLogs.length - 1];

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
              Complete truck details retrieved directly from the database.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
              {/* Plate Number and Status Container */}
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
              {/* Truck Type Container */}
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {truck.truckType}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
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
              This will permanently remove the record from the database.
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
// FLEET STATUS MAIN PAGE
// ==========================================
export default function FleetStatusPage() {
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
  const [truckList, setTruckList] = useState<TruckRecord[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<HistoryLogRecord[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  // === HISTORY VIEW STATES ===
  const [showTruckHistoryView, setShowTruckHistoryView] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] =
    useState<HistoryLogRecord | null>(null);

  // === TOAST NOTIFICATION STATE ===
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  // ==========================================
  // LIVE DATABASE CONNECTION (FETCH DATA)
  // ==========================================
  useEffect(() => {
    fetchTrucks();
    fetchLogs();
  }, []);

  const fetchTrucks = async () => {
    setIsLoading(true);
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await axios.get(`${API_URL}/api/trucks`);

      const backendData = response.data.data || response.data;
      let liveData: TruckRecord[] = [];

      if (Array.isArray(backendData)) {
        liveData = backendData.map((dbTruck: any) => ({
          id: dbTruck.truckID || crypto.randomUUID(),
          plateNumber: dbTruck.plateNumber || "N/A",
          truckType: dbTruck.truckType || "N/A",
          truckModel: dbTruck.model || "N/A",
          capacity: dbTruck.capacity ? String(dbTruck.capacity) : "",
          lastChecked: dbTruck.lastChecked
            ? dbTruck.lastChecked.split("T")[0]
            : "",
          status: dbTruck.truckStatus || "Available",
        }));
      }

      setTruckList(liveData);
    } catch (error) {
      console.error("Failed to fetch trucks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
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

  const handleRowClick = async (id: string | number) => {
    try {
      const localTruck = truckList.find((t) => t.id === id);
      if (localTruck) {
        setSelectedTruck(localTruck);
      }
    } catch (error) {
      console.error("Failed to fetch complete truck record:", error);
    }
  };

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

      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

      // 🚀 ALIGN PAYLOAD WITH DATABASE SCHEMA COLUMNS
      const payload = {
        plateNumber: record.plateNumber,
        truckType: record.truckType,
        model: record.truckModel,
        capacity: Number(record.capacity) || 0,
        lastChecked: record.lastChecked
          ? new Date(record.lastChecked).toISOString()
          : new Date().toISOString(),
        truckStatus: record.status,
      };

      if (editingTruck) {
        if (!record.id) {
          alert("🚨 Bug Caught: The Truck ID is missing! Cannot update.");
          return;
        }

        await axios.put(`${API_URL}/api/trucks/${record.id}`, payload);

        setTruckList((prev) =>
          prev.map((t) => (t.id === record.id ? record : t)),
        );
        if (selectedTruck && selectedTruck.id === record.id) {
          setSelectedTruck(record);
        }
        setToastMessage("Changes saved successfully.");
      } else {
        const response = await axios.post(`${API_URL}/api/trucks`, payload);

        const dbTruck = response.data;
        const uiRecord: TruckRecord = {
          ...record,
          id: dbTruck?.truckID || dbTruck?.id || Date.now(),
        };
        setTruckList((prev) => [uiRecord, ...prev]);
        setToastMessage("Truck added successfully.");
      }
    } catch (error: any) {
      console.error("Failed to save truck:", error);
      const serverMsg =
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.message;
      alert(`🚨 FAILED 🚨\n\nReason: ${serverMsg}`);
    }

    setEditingTruck(null);
    setIsModalOpen(false);
  };

  const handleDeleteTruck = async (id: string | number) => {
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

      await axios.delete(`${API_URL}/api/trucks/${id}`);

      setTruckList((prev) => prev.filter((t) => t.id !== id));
      setSelectedTruck(null);
      setToastMessage("Truck deleted successfully.");
    } catch (error) {
      console.error("Failed to delete truck:", error);
      alert("Error deleting truck. Please try again.");
    }
  };

  // Category counts
  const totalCount = truckList.length;
  const operationalCount = truckList.filter(
    (t) => t.status === "Available",
  ).length;
  const maintenanceCount = truckList.filter(
    (t) => t.status === "On Maintenance",
  ).length;
  const alreadyBookedCount = truckList.filter(
    (t) => t.status === "Already Booked",
  ).length;
  const deliveryCount = truckList.filter(
    (t) => t.status === "On Delivery",
  ).length;
  const outOfServiceCount = truckList.filter(
    (t) => t.status === "Out of Service",
  ).length;

  const filteredTrucks = truckList.filter((truck) => {
    const matchesSearch =
      truck.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.truckType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab =
      selectedFilter === "All" ||
      truck.status.toLowerCase() === selectedFilter.toLowerCase();
    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredTrucks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTrucks = filteredTrucks.slice(startIndex, endIndex);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen relative">
      {/* ================= CONDITIONAL VIEWS ================= */}
      {selectedHistoryRecord ? (
        <LogDetailView
          log={selectedHistoryRecord}
          onBack={() => setSelectedHistoryRecord(null)}
        />
      ) : showTruckHistoryView && selectedTruck ? (
        <TruckSpecificHistoryView
          truck={selectedTruck}
          logs={maintenanceLogs}
          onBack={() => setShowTruckHistoryView(false)}
          onSelectLog={(log) => setSelectedHistoryRecord(log)}
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
          onHistoryClick={() => setShowTruckHistoryView(true)}
        />
      ) : (
        <>
          {/* === MAIN FLEET STATUS LIST VIEW === */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Fleet Status (Admin Portal)
              </h1>
              <p className="text-xs sm:text-sm text-slate-700 mt-1">
                Monitor and manage fleet availability, maintenance logs, and
                truck asset statuses.
              </p>
            </div>

            <div className="flex justify-center sm:justify-start w-full sm:w-auto">
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
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Search & Filter Bar Container */}
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
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                      <td colSpan={2} className="py-16 sm:py-20 text-center">
                        <div className="flex flex-col items-center justify-center px-4">
                          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                          <p className="text-slate-900 font-medium text-sm">
                            Loading trucks...
                          </p>
                          <p className="text-slate-500 text-xs mt-1">
                            Please wait while we sync with the database.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : currentTrucks.length > 0 ? (
                    currentTrucks.map((truck, index) => {
                      const currentStyles = getStatusStyles(truck.status);

                      return (
                        <tr
                          key={truck.id || index}
                          onClick={() => handleRowClick(truck.id)}
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
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-16 sm:py-20 text-center">
                        <div className="flex flex-col items-center justify-center px-4 max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                            <FileText className="w-6 h-6" />
                          </div>
                          <p className="text-slate-900 font-medium text-sm">
                            No trucks found
                          </p>
                          <p className="text-slate-600 text-xs mt-1 max-w-sm">
                            Try adjusting your search query or filter selection
                            to view existing assets.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
              <span>
                Showing {filteredTrucks.length === 0 ? 0 : startIndex + 1} to{" "}
                {Math.min(endIndex, filteredTrucks.length)} of{" "}
                {filteredTrucks.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1 || isLoading}
                  className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                    currentPage === 1 || isLoading
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
                  disabled={
                    currentPage === totalPages || totalPages === 0 || isLoading
                  }
                  className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                    currentPage === totalPages || totalPages === 0 || isLoading
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

      {/* ================= GLOBAL TRUCK MODAL (ADD/EDIT) ================= */}
      <TruckModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTruck(null);
        }}
        onSubmitSuccess={handleModalSubmit}
        editData={editingTruck}
      />

      {/* ================= SUCCESS/INFO NOTIFICATION TOAST ================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-100 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-slate-700">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                toastMessage === "No changes were made."
                  ? "bg-blue-500"
                  : "bg-emerald-500"
              }`}
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
