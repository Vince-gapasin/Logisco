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

export interface TruckRecord {
  id: string | number;
  truckCode?: string;
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
  created_at?: string;
  photoUrl?: string;
  driversReport?: string;
  preliminaryRemarks?: string;
  preliminaryPhotoUrl?: string;
  additionalIssue?: string;
  progressRemarks?: string;
  progressPhotoUrl?: string;
  statusBefore?: string;
  statusAfter?: string;
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

const formatDisplayDate = (dateString: string) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  } catch (error) {
    return dateString;
  }
};

// ==========================================
// TRUCK MODAL (ADD/EDIT FLEET)
// ==========================================
interface TruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: TruckRecord) => void;
  editData?: TruckRecord | null;
}

function TruckModal({ isOpen, onClose, onSubmitSuccess, editData }: TruckModalProps) {
  const initialTruckState = {
   truckCode: "", plateNumber: "", truckType: "", truckModel: "", capacity: "", lastChecked: "",
  };

  const [formData, setFormData] = useState(initialTruckState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
 
  // 1. Convert to state
  const [today, setToday] = useState("");

  // 2. Calculate the local date only on the client
  useEffect(() => {
    const offset = new Date().getTimezoneOffset() * 60000;
    setToday(new Date(Date.now() - offset).toISOString().split("T")[0]);
  }, []);
  
  useEffect(() => {
    if (editData) {
      setFormData({
        truckCode: editData.truckCode || "",
        plateNumber: editData.plateNumber || "",
        truckType: editData.truckType || "",
        truckModel: editData.truckModel || "",
        capacity: editData.capacity ? String(editData.capacity) : "",
        lastChecked: editData.lastChecked ? editData.lastChecked.split("T")[0] : "",
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.plateNumber.trim()) newErrors.plateNumber = "Plate number is required.";
    if (!formData.truckType) newErrors.truckType = "Type of truck is required.";
    if (!formData.truckModel.trim()) newErrors.truckModel = "Truck model is required.";
    if (!String(formData.capacity).trim()) newErrors.capacity = "Capacity is required.";
    if (!formData.lastChecked) newErrors.lastChecked = "Last checked date is required.";
    else if (formData.lastChecked > today) newErrors.lastChecked = "Date cannot be in the future.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Auto-generate a truck code if one doesn't exist (e.g., TRK-ABC1234)
    const cleanPlateNumber = formData.plateNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
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

    onSubmitSuccess(updatedRecord);
    handleCloseModal();
  };

  const TRUCK_TYPES = ["Closed Van", "Wing Van", "Dry Van", "Refrigerated Truck", "Boom Truck", "Flatbed Truck", "Dump Truck", "Trailer Truck", "Tanker Truck", "Pickup Truck", "Other"];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">{editData ? "Edit Truck Record" : "New Truck Form"}</h2>
          <button type="button" onClick={handleCloseModal} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">1. Truck Information</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">Plate Number *</label>
                <input type="text" name="plateNumber" placeholder="e.g., ABC-1234" value={formData.plateNumber} onChange={handleInputChange as any} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.plateNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.plateNumber && <p className="text-red-500 text-[11px] mt-1">{errors.plateNumber}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Type of Truck *</label>
                <div className={`relative w-full ${isTypeDropdownOpen ? "z-70" : "z-10"}`} onClick={(e) => e.stopPropagation()}>
                  {isTypeDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setIsTypeDropdownOpen(false)} />}
                  <button type="button" onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.truckType ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"}`}>
                    <span className={formData.truckType ? "text-black" : "text-slate-400"}>{formData.truckType || "Select truck type"}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isTypeDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isTypeDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto text-left">
                      {TRUCK_TYPES.map((opt) => (
                        <button key={opt} type="button" onClick={() => { handleInputChange({ target: { name: "truckType", value: opt } }); setIsTypeDropdownOpen(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${formData.truckType === opt ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.truckType && <p className="text-red-500 text-[11px] mt-1">{errors.truckType}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Truck Model *</label>
                <input type="text" name="truckModel" placeholder="e.g., Isuzu NPR / Fuso Canter" value={formData.truckModel} onChange={handleInputChange as any} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckModel ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.truckModel && <p className="text-red-500 text-[11px] mt-1">{errors.truckModel}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Capacity *</label>
                <input type="text" name="capacity" placeholder="e.g., 5 Tons or 5000 kg" value={formData.capacity} onChange={handleInputChange as any} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.capacity ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.capacity && <p className="text-red-500 text-[11px] mt-1">{errors.capacity}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">Last Checked (MM/DD/YYYY) *</label>
                <input type="date" name="lastChecked" max={today} value={formData.lastChecked} onChange={handleInputChange as any} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.lastChecked ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.lastChecked && <p className="text-red-500 text-[11px] mt-1">{errors.lastChecked}</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleCloseModal} style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }} className="w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 cursor-pointer">Cancel</button>
            <button type="submit" style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }} className="w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 cursor-pointer">{editData ? "Save Changes" : "Add Truck"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// LOG MAINTENANCE MODAL (ADD/EDIT LOGS)
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

function LogMaintenanceModal({ isOpen, onClose, onSubmitSuccess, editData, trucksOptions, mechanicsOptions, preselectedTruckId, formType = "log" }: LogMaintenanceModalProps) {
  const initialFormState = {
    date: "", truckID: "", primaryMechanicID: "", additionalMechanicID: "",
    issue: "", remarks: "", photoUrl: "", driversReport: "", preliminaryRemarks: "",
    preliminaryPhotoUrl: "", additionalIssue: "", progressRemarks: "", progressPhotoUrl: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isTruckDropdownOpen, setIsTruckDropdownOpen] = useState(false);
  const [isPrimaryDropdownOpen, setIsPrimaryDropdownOpen] = useState(false);
  const [isAdditionalDropdownOpen, setIsAdditionalDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Convert to state
  const [today, setToday] = useState("");

  // 2. Calculate the local date only on the client
  useEffect(() => {
    const offset = new Date().getTimezoneOffset() * 60000;
    setToday(new Date(Date.now() - offset).toISOString().split("T")[0]);
  }, []);

  const fieldMapping = {
    inspection: { issue: "driversReport", remarks: "preliminaryRemarks", photo: "preliminaryPhotoUrl" },
    update: { issue: "additionalIssue", remarks: "progressRemarks", photo: "progressPhotoUrl" },
    log: { issue: "issue", remarks: "remarks", photo: "photoUrl" },
  };
  const activeFields = fieldMapping[formType] || fieldMapping.log;

  // 3. Add `today` to the dependency array and ensure it exists before setting form state
  useEffect(() => {
    if (editData) {
      setFormData({
        date: editData.date ? editData.date.split("T")[0] : "",
        truckID: editData.truckID ? String(editData.truckID) : "",
        primaryMechanicID: editData.primaryMechanicID ? String(editData.primaryMechanicID) : "",
        additionalMechanicID: editData.additionalMechanicID ? String(editData.additionalMechanicID) : "",
        issue: editData.issue || "",
        remarks: editData.remarks || "",
        photoUrl: editData.photoUrl || "",
        driversReport: editData.driversReport || "",
        preliminaryRemarks: editData.preliminaryRemarks || "",
        preliminaryPhotoUrl: editData.preliminaryPhotoUrl || "",
        additionalIssue: editData.additionalIssue || "",
        progressRemarks: editData.progressRemarks || "",
        progressPhotoUrl: editData.progressPhotoUrl || "",
      });
    } else if (isOpen && today) { 
      setFormData({ ...initialFormState, date: today, truckID: preselectedTruckId ? String(preselectedTruckId) : "" });
    }
  }, [editData, isOpen, preselectedTruckId, today]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialFormState);
    setErrors({});
    setIsTruckDropdownOpen(false);
    setIsPrimaryDropdownOpen(false);
    setIsAdditionalDropdownOpen(false);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData((prev) => ({ ...prev, [activeFields.photo]: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = "Date is required.";
    else if (formData.date > today) newErrors.date = "Future dates are not allowed.";
    if (!formData.truckID) newErrors.truckID = "Truck selection is required.";
    if (!formData.primaryMechanicID) newErrors.primaryMechanicID = "Primary mechanic is required.";

    const issueValue = String((formData as any)[activeFields.issue] || "").trim();
    if (!issueValue) {
      newErrors[activeFields.issue] = formType === "inspection" ? "Issue to fix is required." : formType === "update" ? "Additional issue is required." : "Work performed is required.";
    }

    if (formData.additionalMechanicID && formData.additionalMechanicID === formData.primaryMechanicID) {
      newErrors.additionalMechanicID = "Cannot select the same mechanic twice.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmitSuccess(formData);
  };

  const availableAdditionalMechanics = mechanicsOptions.filter((emp) => String(emp.employeeID) !== String(formData.primaryMechanicID));

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {formType === "inspection" ? "Maintenance Inspection Form" : formType === "update" ? "Maintenance Update Form" : editData ? "Edit Maintenance Log" : "Maintenance Log Form"}
          </h2>
          <button type="button" onClick={handleCloseModal} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">1. Record Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">Date *</label>
                <input
                  type="date"
                  name="date"
                  max={today}
                  value={formData.date}
                  onChange={handleInputChange as any}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.date ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.date && <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Select Truck *</label>
                <div className={`relative w-full ${isTruckDropdownOpen ? "z-70" : "z-10"}`} onClick={(e) => e.stopPropagation()}>
                  {isTruckDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setIsTruckDropdownOpen(false)} />}
                  <button
                    type="button"
                    disabled={!!preselectedTruckId}
                    onClick={() => setIsTruckDropdownOpen(!isTruckDropdownOpen)}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.truckID ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"} ${preselectedTruckId ? "opacity-75 cursor-not-allowed bg-slate-50" : ""}`}
                  >
                    <span className={formData.truckID ? "text-black truncate pr-2" : "text-slate-400"}>
                      {formData.truckID
                        ? trucksOptions.find((t) => String(t.truckID) === String(formData.truckID))
                          ? `${trucksOptions.find((t) => String(t.truckID) === String(formData.truckID))?.plateNumber} — ${trucksOptions.find((t) => String(t.truckID) === String(formData.truckID))?.truckType}`
                          : editData?.plateNumber + " — " + editData?.truckType
                        : "Choose a truck..."}
                    </span>
                    {!preselectedTruckId && <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isTruckDropdownOpen ? "rotate-180" : ""}`} />}
                  </button>
                  {isTruckDropdownOpen && !preselectedTruckId && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto text-left">
                      {trucksOptions.map((truck) => (
                        <button
                          key={truck.truckID}
                          type="button"
                          onClick={() => {
                            handleInputChange({ target: { name: "truckID", value: String(truck.truckID) } });
                            setIsTruckDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${String(formData.truckID) === String(truck.truckID) ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
                        >
                          {truck.plateNumber} — {truck.truckType}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.truckID && <p className="text-red-500 text-[11px] mt-1">{errors.truckID}</p>}
              </div>

              {/* Primary Mechanic */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">Primary Mechanic *</label>
                <div className="relative">
                  <select
                    name="primaryMechanicID"
                    value={formData.primaryMechanicID || ""}
                    onChange={(e) => {
                      handleInputChange(e);
                      // Clear additional mechanic if it matches the newly selected primary
                      if (String(formData.additionalMechanicID) === String(e.target.value)) {
                        handleInputChange({ target: { name: "additionalMechanicID", value: "" } });
                      }
                    }}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 appearance-none cursor-pointer ${errors.primaryMechanicID ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  >
                    <option value="" disabled>Choose mechanic...</option>
                    {mechanicsOptions.map((mech) => (
                      <option key={mech.employeeID} value={String(mech.employeeID)}>
                        {mech.employeeName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {errors.primaryMechanicID && <p className="text-red-500 text-[11px] mt-1">{errors.primaryMechanicID}</p>}
              </div>

              {/* Additional Mechanic */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">Additional Mechanic (Optional)</label>
                <div className="relative">
                  <select
                    name="additionalMechanicID"
                    value={formData.additionalMechanicID || ""}
                    onChange={handleInputChange as any}
                    disabled={!formData.primaryMechanicID}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 appearance-none ${!formData.primaryMechanicID ? "opacity-60 cursor-not-allowed bg-slate-50" : "cursor-pointer"} ${errors.additionalMechanicID ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  >
                    <option value="">Select Mechanic...</option>
                    {mechanicsOptions
                      .filter((emp) => String(emp.employeeID) !== String(formData.primaryMechanicID))
                      .map((mech) => (
                        <option key={mech.employeeID} value={String(mech.employeeID)}>
                          {mech.employeeName}
                        </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {errors.additionalMechanicID && <p className="text-red-500 text-[11px] mt-1">{errors.additionalMechanicID}</p>}
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
                  {formType === "inspection" ? "Issue To Fix *" : formType === "update" ? "Additional Issue *" : "Work Performed *"}
                </label>
                <textarea
                  name={activeFields.issue}
                  rows={3}
                  placeholder={
                    formType === "inspection"
                      ? "Describe the reported issue or items that require fixing..."
                      : formType === "update"
                        ? "Describe maintenance progress, additional issues, or work in progress..."
                        : "Describe the completed maintenance work and truck condition..."
                  }
                  value={(formData as any)[activeFields.issue]}
                  onChange={handleInputChange as any}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors[activeFields.issue] ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors[activeFields.issue] && <p className="text-red-500 text-[11px] mt-1">{errors[activeFields.issue]}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  {formType === "update" ? "Additional Remarks (Optional)" : "Remarks (Optional)"}
                </label>
                <textarea
                  name={activeFields.remarks}
                  rows={5}
                  placeholder="Any additional notes, future recommendations, or observations..."
                  value={(formData as any)[activeFields.remarks]}
                  onChange={handleInputChange as any}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              3. {editData ? "Photo Evidence" : "Upload Photo Evidence"}
            </div>
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                {editData ? "Update Maintenance Photo" : "Upload Maintenance Photo (Optional)"}
              </label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-300 cursor-pointer"
                >
                  <Upload className="w-4 h-4" /> {(formData as any)[activeFields.photo] ? "Change File" : "Choose File"}
                </button>
                <span className="text-xs text-slate-500 truncate max-w-xs">
                  {(formData as any)[activeFields.photo] ? "Photo attached successfully" : "No file chosen"}
                </span>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
              {(formData as any)[activeFields.photo] && (
                <div className="mt-3 relative w-24 h-24 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                  <img src={(formData as any)[activeFields.photo]} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleCloseModal} style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }} className="w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 cursor-pointer">Cancel</button>
            <button type="submit" style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }} className="w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 cursor-pointer">{editData ? "Save Changes" : "Save Log"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// HISTORY LOG DETAIL VIEW (Displays consolidated maintenance cycle)
// ==========================================
interface LogDetailViewProps {
  log: HistoryLogRecord;
  truckLogs: HistoryLogRecord[];
  onBack: () => void;
  onEdit: (logRecord: HistoryLogRecord) => void;
  onDelete: (id: string | number) => void;
}

function LogDetailView({ log, truckLogs, onBack, onEdit, onDelete }: LogDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // --- CONSOLIDATION LOGIC: Find all logs in this specific maintenance cycle ---
  const isMaintenance = (status?: string) => status === "On Maintenance" || status === "Out of Service";
  
  // The global truckLogs is already perfectly sorted Newest-First. 
  // We simply .reverse() it to get Chronological order (Oldest-First) to walk the cycle properly.
  // We CANNOT use Number(a.id) here because UUIDs result in NaN and scramble the array!
  const sorted = [...(truckLogs || [])].reverse(); 
  const clickedIdx = sorted.findIndex(l => String(l.id) === String(log.id));

  // Walk backwards to find the start of the cycle
  let startIdx = clickedIdx !== -1 ? clickedIdx : 0;
  while (startIdx > 0 && isMaintenance(sorted[startIdx].statusBefore)) {
      startIdx--;
  }

  // Walk forwards to find the end of the cycle
  let endIdx = clickedIdx !== -1 ? clickedIdx : 0;
  while (endIdx < sorted.length - 1 && isMaintenance(sorted[endIdx].statusAfter)) {
      endIdx++;
  }

  // Extract the full cycle and categorize the forms
  const cycleLogs = clickedIdx !== -1 ? sorted.slice(startIdx, endIdx + 1) : [log];
  
  const preliminaryLogs = cycleLogs.filter((l) => l.driversReport || l.preliminaryRemarks || l.preliminaryPhotoUrl);
  const progressLogs = cycleLogs.filter((l) => l.additionalIssue || l.progressRemarks || l.progressPhotoUrl);
  const finalLogs = cycleLogs.filter((l) => l.issue || l.remarks || l.photoUrl);

  // --- MERGE PROGRESS UPDATES (SECTION 3) INTO SINGLE CONSOLIDATED BLOCKS ---
  // Explicitly sort by exact timestamp (Newest-First) to prevent any array scrambling
  const sortedProgressLogs = [...progressLogs].sort((a, b) => {
    const timeA = new Date(a.created_at || a.date).getTime();
    const timeB = new Date(b.created_at || b.date).getTime();
    return timeB - timeA;
  });

  const combinedIssues = sortedProgressLogs
    .filter(u => u.additionalIssue)
    .map((u, idx, arr) => `Update #${arr.length - idx} [${formatDisplayDate(u.date)} - ${u.mechanicName || 'Mechanic'}]:\n${u.additionalIssue}`)
    .join('\n\n');

  const combinedRemarks = sortedProgressLogs
    .filter(u => u.progressRemarks)
    .map((u, idx, arr) => `Update #${arr.length - idx} [${formatDisplayDate(u.date)} - ${u.mechanicName || 'Mechanic'}]:\n${u.progressRemarks}`)
    .join('\n\n');

  const combinedPhotos = sortedProgressLogs
    .map(u => u.progressPhotoUrl)
    .filter(Boolean);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"> Maintenance Record</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">Showing all logs related to this maintenance cycle.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onEdit(log)} className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer">
            <Edit3 className="w-4 h-4" /><span>Edit This Row</span>
          </button>
          <button onClick={() => setShowDeleteModal(true)} className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer">
            <Trash2 className="w-4 h-4" /><span>Delete This Row</span>
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold border border-blue-100"><ClipboardCheck className="w-8 h-8" /></div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">{log.plateNumber}</h2>
              <div className="flex items-center gap-2 mt-1 text-slate-600 text-sm"><Truck className="w-4 h-4" /><span>{log.truckType}</span></div>
            </div>
          </div>
        </div>
        
        <div className="space-y-6 text-sm text-slate-900">
          
          {/* 1. Basic Information (Clicked Row) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">1. Selected Record Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-black mb-1">Plate Number</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{log.plateNumber}</div></div>
              <div><label className="block text-xs font-medium text-black mb-1">Type of Truck</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{log.truckType}</div></div>
              <div><label className="block text-xs font-medium text-black mb-1">Date</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{log.date ? log.date.split("T")[0] : "N/A"}</div></div>
              <div><label className="block text-xs font-medium text-black mb-1">Primary Mechanic</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{log.mechanicName || "N/A"}</div></div>
              <div className="sm:col-span-2"><label className="block text-xs font-medium text-black mb-1">Additional Mechanic</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{log.additionalMechanic || "None"}</div></div>
            </div>
          </div>

          {/* 2. Preliminary Inspection Section */}
          {preliminaryLogs.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                2. Preliminary Inspection
              </div>
              <div className="space-y-6">
                {preliminaryLogs.map((pLog, idx) => (
                  <div key={pLog.id} className={idx !== 0 ? "pt-6 border-t border-slate-100" : ""}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Issue to Fix / Driver's Report</label>
                        <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">{pLog.driversReport || "N/A"}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Preliminary Remarks</label>
                        <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">{pLog.preliminaryRemarks || "None"}</div>
                      </div>
                      {pLog.preliminaryPhotoUrl && (
                        <div className="sm:col-span-2 mt-2">
                          <label className="block text-xs font-medium text-black mb-1">Photo Evidence</label>
                          <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                            <img src={pLog.preliminaryPhotoUrl} alt="Preliminary Evidence" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Maintenance Progress Section (CONSOLIDATED) */}
          {progressLogs.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex items-center justify-between">
                <span>3. Maintenance Progress </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Additional Issues</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">
                    {combinedIssues || "N/A"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1"> Progress Remarks</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">
                    {combinedRemarks || "None"}
                  </div>
                </div>
                {combinedPhotos.length > 0 && (
                  <div className="sm:col-span-2 mt-2">
                    <label className="block text-xs font-medium text-black mb-1">Photo Evidence ({combinedPhotos.length})</label>
                    <div className="flex flex-wrap gap-3">
                      {combinedPhotos.map((url, idx) => (
                        <div key={idx} className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                          <img src={url as string} alt={`Progress Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Final Maintenance Log Section */}
          {finalLogs.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                4. Final Maintenance Log
              </div>
              <div className="space-y-6">
                {finalLogs.map((fLog, idx) => (
                  <div key={fLog.id} className={idx !== 0 ? "pt-6 border-t border-slate-100" : ""}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Work Performed</label>
                        <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">{fLog.issue || "N/A"}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-1">Final Remarks</label>
                        <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">{fLog.remarks || "None"}</div>
                      </div>
                      {fLog.photoUrl && (
                        <div className="sm:col-span-2 mt-2">
                          <label className="block text-xs font-medium text-black mb-1">Photo Evidence</label>
                          <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                            <img src={fLog.photoUrl} alt="Final Evidence" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
      {showDeleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Maintenance Log</h3>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer">Cancel</button>
              <button onClick={() => { onDelete(log.id); setShowDeleteModal(false); }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md cursor-pointer">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// TRUCK SPECIFIC HISTORY VIEW (Displays list of logs for 1 truck)
// ==========================================
interface TruckSpecificHistoryViewProps {
  truck: TruckRecord;
  logs: HistoryLogRecord[];
  onBack: () => void;
  onSelectLog: (log: HistoryLogRecord) => void;
  onEditLog: (log: HistoryLogRecord) => void;
  onDeleteLog: (id: string | number) => void;
}

function TruckSpecificHistoryView({ truck, logs, onBack, onSelectLog }: TruckSpecificHistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 1. Filter logs for this truck (Already safely sorted newest-to-oldest globally)
  const truckLogs = logs.filter((l) => 
    String(l.truckID) === String(truck.id) || 
    String(l.plateNumber).toLowerCase() === String(truck.plateNumber).toLowerCase()
  );

  const filteredLogs = truckLogs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.plateNumber?.toLowerCase().includes(searchLower) ||
      log.truckType?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);


  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen relative animate-fade-in">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">History Logs — {truck.plateNumber}</h1>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto px-4 sm:px-6">
          <table className="w-full max-w-5xl mx-auto text-left border-collapse table-fixed my-2">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-1/4 text-left">Date</th>
                <th className="py-3.5 px-4 w-1/4 text-left">Plate Number</th>
                <th className="py-3.5 px-4 w-1/4 text-left">Status Before Change</th>
                <th className="py-3.5 px-4 w-1/4 text-right">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 sm:py-20 text-center">
                    <div className="text-slate-500">No logs found for this truck.</div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} onClick={() => onSelectLog(log)} className="hover:bg-slate-50/80 cursor-pointer transition-colors">
                    <td className="py-4 px-4 w-1/4 text-left align-middle font-medium text-slate-800">
                      {formatDisplayDate(log.date)}
                    </td>
                    <td className="py-4 px-4 w-1/4 text-left align-middle">
                      <div className="font-bold text-slate-900">
                        {log.plateNumber} <span className="font-normal text-slate-500">— {log.truckType}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{log.mechanicName || "Mechanic"}</div>
                    </td>
                    <td className="py-4 px-4 w-1/4 text-left align-middle">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getStatusStyles(log.statusBefore || "").bgLight}`}>
                        {log.statusBefore || "N/A"}
                      </span>
                    </td>
                    <td className="py-4 px-4 w-1/4 text-right align-middle">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${getStatusStyles(log.statusAfter || "").bgLight}`}>
                        {log.statusAfter || "N/A"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Previous</button>
            <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Next</button>
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
  onDelete: () => void;
  onUpdateStatusClick: () => void;
  onHistoryClick: () => void;
  onLogMaintenanceClick: () => void;
}

function TruckDetailView({ truck, logs, onBack, onEdit, onDelete, onUpdateStatusClick, onHistoryClick, onLogMaintenanceClick }: TruckDetailViewProps) {
  const styles = getStatusStyles(truck.status);
  
  // Only true if the truck is actively broken down or being worked on
  const isUnderMaintenance = truck.status === "On Maintenance" || truck.status === "Out of Service";

  // 1. Isolate logs for this truck (Already safely sorted newest-to-oldest globally)
  const sortedTruckLogs = logs.filter((l) => String(l.truckID) === String(truck.id));
    
  // 2. Isolate the newest log that contains preliminary inspection data
  const prelimIndex = sortedTruckLogs.findIndex(l => l.driversReport || l.preliminaryRemarks || l.preliminaryPhotoUrl);
  const latestPreliminaryLog = prelimIndex !== -1 ? sortedTruckLogs[prelimIndex] : null;

  // 3. Extract all logs belonging to the current maintenance cycle
  const currentCycleLogs = prelimIndex !== -1 ? sortedTruckLogs.slice(0, prelimIndex + 1) : sortedTruckLogs;
  
 // 4. Isolate all progress updates in this cycle and sort Newest-First explicitly
  const progressUpdates = currentCycleLogs
    .filter(l => l.additionalIssue || l.progressRemarks || l.progressPhotoUrl)
    .sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || a.date).getTime();
      const timeB = new Date(b.created_at || b.date).getTime();
      return timeB - timeA;
    });

  // 5. Combine all update data into consolidated strings (Newest at top, dynamically numbered)
  const combinedIssues = progressUpdates
    .filter(u => u.additionalIssue)
    .map((u, idx, arr) => `Update #${arr.length - idx} [${formatDisplayDate(u.date)} - ${u.mechanicName || 'Mechanic'}]:\n${u.additionalIssue}`)
    .join('\n\n');

  const combinedRemarks = progressUpdates
    .filter(u => u.progressRemarks)
    .map((u, idx, arr) => `Update #${arr.length - idx} [${formatDisplayDate(u.date)} - ${u.mechanicName || 'Mechanic'}]:\n${u.progressRemarks}`)
    .join('\n\n');

  const combinedPhotos = progressUpdates
    .map(u => u.progressPhotoUrl)
    .filter(Boolean);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <button onClick={onBack} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button onClick={onUpdateStatusClick} className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"><span>Update Status</span></button>
          <button onClick={() => onEdit(truck)} className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"><Edit3 className="w-4 h-4" /><span>Edit Truck</span></button>
          <button onClick={onDelete} className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /><span>Delete</span></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold border border-blue-100"><Truck className="w-8 h-8" /></div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">{truck.plateNumber}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles.bgLight.split(" border")[0]}`}>{truck.status}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{truck.truckType}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isUnderMaintenance && (
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
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">1. Truck Information</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-black mb-1">Plate Number</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{truck.plateNumber || "N/A"}</div></div>
              <div><label className="block text-xs font-medium text-black mb-1">Type of Truck</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{truck.truckType || "N/A"}</div></div>
              <div><label className="block text-xs font-medium text-black mb-1">Truck Model</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{truck.truckModel || "N/A"}</div></div>
              <div><label className="block text-xs font-medium text-black mb-1">Capacity</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{truck.capacity || "N/A"}</div></div>
              <div><label className="block text-xs font-medium text-black mb-1">Last Checked</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{formatDisplayDate(truck.lastChecked) || "N/A"}</div></div>
            </div>
          </div>

          {/* Section 2: Preliminary Inspection - Hides when not under maintenance */}
          {isUnderMaintenance && latestPreliminaryLog && (latestPreliminaryLog.driversReport || latestPreliminaryLog.preliminaryRemarks) && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                2. Latest Preliminary Inspection
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Issue to Fix / Driver's Report</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">
                    {latestPreliminaryLog.driversReport || "N/A"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Preliminary Remarks</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">
                    {latestPreliminaryLog.preliminaryRemarks || "None"}
                  </div>
                </div>
                {latestPreliminaryLog.preliminaryPhotoUrl && (
                  <div className="sm:col-span-2 mt-2">
                    <label className="block text-xs font-medium text-black mb-1">Photo Evidence</label>
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                      <img src={latestPreliminaryLog.preliminaryPhotoUrl} alt="Preliminary Evidence" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Consolidated Maintenance Progress Updates - Hides when not under maintenance */}
          {isUnderMaintenance && progressUpdates.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs mt-6">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex items-center justify-between">
                <span>3. Maintenance Progress Updates (Consolidated)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Consolidated Additional Issues</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">
                    {combinedIssues || "N/A"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Consolidated Progress Remarks</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[2.5rem] whitespace-pre-wrap">
                    {combinedRemarks || "N/A"}
                  </div>
                </div>
                {combinedPhotos.length > 0 && (
                  <div className="sm:col-span-2 mt-2">
                    <label className="block text-xs font-medium text-black mb-1">Photo Evidence ({combinedPhotos.length})</label>
                    <div className="flex flex-wrap gap-3">
                      {combinedPhotos.map((url, idx) => (
                        <div key={idx} className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                          <img src={url as string} alt={`Progress Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
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

export default function MechanicFleetStatusPage({ isOpen, setIsopen }: MechanicFleetStatusProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"All" | "On Maintenance" | "Available" | "Already Booked" | "On Delivery" | "Out of Service">("All");

  const [truckToDelete, setTruckToDelete] = useState<string | number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);

  const [showStatusSelectModal, setShowStatusSelectModal] = useState(false);
  const [statusConfirmTruck, setStatusConfirmTruck] = useState<TruckRecord | null>(null);
  const [pendingStatusTarget, setPendingStatusTarget] = useState<string>("");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // States to manage History and Maintenance modals
  const [showTruckHistoryView, setShowTruckHistoryView] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<HistoryLogRecord | null>(null);
  const [editingHistoryRecord, setEditingHistoryRecord] = useState<HistoryLogRecord | null>(null);
  const [showLogMaintenanceModal, setShowLogMaintenanceModal] = useState(false);
  const [maintenanceFormType, setMaintenanceFormType] = useState<"inspection" | "update" | "log">("log");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  useEffect(() => { 
    if (toastMessage) { 
        const timer = setTimeout(() => setToastMessage(null), 3000); 
        return () => clearTimeout(timer); 
    } 
  }, [toastMessage]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedFilter]);

  const [fleetList, setFleetList] = useState<TruckRecord[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<HistoryLogRecord[]>([]);
  const [mechanicsOptions, setMechanicsOptions] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTrucks();
    fetchLogs();
    fetchMechanics();
  }, []);

  const fetchTrucks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/fleet-status`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      
      const payload = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
      const mappedData: TruckRecord[] = payload.map((truck: any) => ({
        id: truck.truckID || truck.id,
        plateNumber: truck.plateNumber,
        truckType: truck.truckType,
        truckModel: truck.model || truck.truckModel,
        capacity: String(truck.capacity),
        lastChecked: truck.lastChecked,
        status: truck.truckStatus || truck.status || "Available",
      }));
      
      // Forces highest ID (newest) to the top and resolves the TS (a, b) error
      const sortedData = mappedData.sort((a: TruckRecord, b: TruckRecord) => Number(b.id) - Number(a.id));
      
      setFleetList(sortedData);
    } catch (error) { 
      console.error("Error fetching trucks:", error); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch(`/api/historyLogsM?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const rawLogs = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];

      const mappedLogs = rawLogs.map((log: any) => {
        const primaryMech = log.LogMechanics?.find((m: any) => m.role === 'Primary');
        const addMech = log.LogMechanics?.find((m: any) => m.role === 'Additional');
        const prelimNote = log.LogNotes?.find((n: any) => n.phase === 'Preliminary');
        const progNote = log.LogNotes?.find((n: any) => n.phase === 'Progress');
        const finalNote = log.LogNotes?.find((n: any) => n.phase === 'Final');
        const prelimPhoto = log.LogPhotos?.find((p: any) => p.phase === 'Preliminary');
        const progPhoto = log.LogPhotos?.find((p: any) => p.phase === 'Progress');
        const finalPhoto = log.LogPhotos?.find((p: any) => p.phase === 'Final');

        return {
          id: log.id,
          truckID: log.truckID,
          date: log.date,
          createdAt: log.created_at || log.createdAt || log.date,
          plateNumber: log.plateNumber || log.Truck?.plateNumber || "N/A",
          truckType: log.truckType || log.Truck?.truckType || "N/A",
          statusBefore: log.statusBefore || "N/A",
          statusAfter: log.statusAfter || "N/A",
          primaryMechanicID: primaryMech?.employeeID,
          additionalMechanicID: addMech?.employeeID,
          driversReport: prelimNote?.issue || log.driversReport,
          preliminaryRemarks: prelimNote?.remarks || log.preliminaryRemarks,
          preliminaryPhotoUrl: prelimPhoto?.photoUrl || log.preliminaryPhotoUrl,
          additionalIssue: progNote?.issue || log.additionalIssue,
          progressRemarks: progNote?.remarks || log.progressRemarks,
          progressPhotoUrl: progPhoto?.photoUrl || log.progressPhotoUrl,
          issue: finalNote?.issue || log.issue,
          remarks: finalNote?.remarks || log.remarks,
          photoUrl: finalPhoto?.photoUrl || log.photoUrl,
        };
      });

      // GLOBALLY SORT ALL LOGS: Guarantee newest-first order safely.
      const sortedAllLogs = mappedLogs.sort((a: any, b: any) => {
        // 1. Sort by precise database timestamp first
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
          return timeB - timeA; 
        }
        
        // 2. Structural Tie-Breaker for exact millisecond ties:
        // Final Logs (3) sort above Progress Updates (2), which sort above Preliminary (1)
        const getPhaseWeight = (log: any) => {
          if (log.issue || (log.remarks && !log.progressRemarks && !log.preliminaryRemarks)) return 3;
          if (log.additionalIssue || log.progressRemarks || log.progressPhotoUrl) return 2;
          if (log.driversReport || log.preliminaryRemarks || log.preliminaryPhotoUrl) return 1;
          return 0;
        };
        
        return getPhaseWeight(b) - getPhaseWeight(a);
      });

      setMaintenanceLogs(sortedAllLogs);
    } catch (error) { 
      console.error("Error fetching logs:", error); 
    }
  };


  const fetchMechanics = async () => {
    try {
      // 1. Pass page/limit to satisfy employeeQuerySchema
      // 2. credentials: "include" ensures Next.js auth cookies reach requireAuth()
      const response = await fetch(`/api/employees?page=1&limit=100`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include", 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      // Your backend explicitly wraps the array in a "data" property
      const employees = result.data || [];
      
      const mappedMechanics: EmployeeOption[] = employees
        .filter((emp: any) => emp.role && emp.role.toLowerCase().includes("mechanic"))
        .map((emp: any) => ({
          employeeID: emp.id || emp.employeeID || emp.employeeid, 
          employeeName: emp.employeeName || emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
          role: emp.role
        }));

      setMechanicsOptions(mappedMechanics);
    } catch (error) {
      console.error("CRITICAL ERROR FETCHING MECHANICS:", error);
      // Leave dropdown empty instead of showing fake data
      setMechanicsOptions([]); 
    }
  };

  const executeStatusUpdate = async (truckRecord: TruckRecord, newStatus: string) => {
    // Grabs the local date in YYYY-MM-DD format, ignoring UTC shifts
    const offset = new Date().getTimezoneOffset() * 60000;
    const today = new Date(Date.now() - offset).toISOString().split("T")[0];
    
    // Inject the new status AND the fresh lastChecked date into the payload
    const fullPayload = { ...truckRecord, status: newStatus, lastChecked: today };
    
    try {
      const response = await fetch(`/api/fleet-status/${truckRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPayload),
      });
      
      if (response.ok) {
        // Update the frontend list with both the new status and the new date
        setFleetList((prev) => 
          prev.map((truck) => 
            String(truck.id) === String(truckRecord.id) 
              ? { ...truck, status: newStatus, lastChecked: today } 
              : truck
          )
        );
        
        // Update the detailed view if the truck is currently selected
        if (selectedTruck && String(selectedTruck.id) === String(truckRecord.id)) { 
          setSelectedTruck((prev) => prev ? { ...prev, status: newStatus, lastChecked: today } : null); 
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
    if (statusConfirmTruck.status === statusOption) { setShowStatusSelectModal(false); setStatusConfirmTruck(null); return; }
    setPendingStatusTarget(statusOption);
    setShowStatusSelectModal(false);
    setShowConfirmationModal(true);
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusConfirmTruck || !pendingStatusTarget) return;
    
    setShowConfirmationModal(false); 

    const currentStatus = statusConfirmTruck.status;
    const targetStatus = pendingStatusTarget;
    
    // 1. Transitioning BETWEEN "On Maintenance" and "Out of Service"
    if (
      (currentStatus === "On Maintenance" && targetStatus === "Out of Service") ||
      (currentStatus === "Out of Service" && targetStatus === "On Maintenance")
    ) {
      setMaintenanceFormType("update");
      setEditingHistoryRecord(null); // Creates a new progress row in the same cycle
      setShowLogMaintenanceModal(true);
    } 
    // 2. Transitioning to "Available" (Final Log)
    else if (targetStatus === "Available") {
      setMaintenanceFormType("log");
      setEditingHistoryRecord(null); 
      setShowLogMaintenanceModal(true);
    } 
    // 3. Entering Maintenance from a normal status (Preliminary Inspection)
    else if (targetStatus === "On Maintenance" || targetStatus === "Out of Service") {
      setMaintenanceFormType("inspection");
      setEditingHistoryRecord(null); 
      setShowLogMaintenanceModal(true);
    } 
    // 4. Standard status updates (e.g., to On Delivery)
    else {
      await executeStatusUpdate(statusConfirmTruck, targetStatus);
      setStatusConfirmTruck(null); 
      setPendingStatusTarget("");
    }
  };

  const handleModalSubmit = async (record: TruckRecord) => {
    try {
      const url = editingTruck ? `/api/fleet-status/${record.id}` : `/api/fleet-status`;
      const method = editingTruck ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      
      if (response.ok) {
        const savedData = await response.json();
        if (editingTruck) {
          setFleetList((prev) => prev.map((t) => (String(t.id) === String(record.id) ? record : t)));
          if (selectedTruck && String(selectedTruck.id) === String(record.id)) setSelectedTruck(record);
        } else {
          const newTruck: TruckRecord = { ...record, id: savedData.truckID || savedData.id };
          setFleetList((prev) => [newTruck, ...prev]);
        }
        setToastMessage(editingTruck ? "Changes saved successfully." : "Truck added successfully.");
      } else {
        alert("Failed to save truck. Check your server connection.");
      }
    } catch (error) { 
      console.error("Error saving truck:", error); 
      alert("Error saving truck details."); 
    }
    setEditingTruck(null); 
    setIsModalOpen(false);
  };

  const handleDeleteTruck = async (id: string | number) => {
    try {
      const response = await fetch(`/api/fleet-status/${id}`, { method: "DELETE" });
      if (response.ok) {
        setFleetList((prev) => prev.filter((t) => String(t.id) !== String(id))); 
        setSelectedTruck(null); 
        setToastMessage("Truck deleted successfully.");
      }
    } catch (error) { console.error("Error deleting truck:", error); alert("Error deleting truck."); }
  };

  const handleMaintenanceLogSubmit = async (formData: any) => {
    try {
      const finalPayload = {
        ...formData,
        statusBefore: editingHistoryRecord ? editingHistoryRecord.statusBefore : (statusConfirmTruck?.status || selectedTruck?.status || "Available"),
        statusAfter: pendingStatusTarget 
          ? pendingStatusTarget 
          : (editingHistoryRecord ? editingHistoryRecord.statusAfter : (selectedTruck?.status || "Available")),
      };

      const url = editingHistoryRecord ? `/api/historyLogsM/${editingHistoryRecord.id}` : `/api/historyLogsM`;
      const method = editingHistoryRecord ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload)
      });
      
      if (response.ok) {
        await fetchLogs();
        setToastMessage(editingHistoryRecord ? "Changes saved successfully." : "Maintenance log saved successfully.");
        
        // EXECUTE DELAYED STATUS UPDATE: Update the truck unconditionally if a target is set
        if (statusConfirmTruck && pendingStatusTarget) {
          await executeStatusUpdate(statusConfirmTruck, pendingStatusTarget);
        }
      } else {
        alert("Failed to save maintenance log.");
      }
    } catch (error) { 
      console.error("Error saving maintenance log:", error); 
    } finally { 
      // Cleanup all states when the modal closes
      setEditingHistoryRecord(null); 
      setShowLogMaintenanceModal(false); 
      setStatusConfirmTruck(null);
      setPendingStatusTarget("");
    }
  };

  const handleDeleteHistoryLog = async (id: string | number) => {
    try {
      await fetch(`/api/historyLogsM/${id}`, { method: "DELETE" });
      setMaintenanceLogs((prev) => prev.filter((log) => String(log.id) !== String(id))); 
      setSelectedHistoryRecord(null); 
      setToastMessage("Deleted successfully.");
    } catch (error) { 
      console.error("Error deleting log:", error); 
    }
  };

  const totalCount = fleetList.length;
  const operationalCount = fleetList.filter((t) => t.status === "Available").length;
  const alreadyBookedCount = fleetList.filter((t) => t.status === "Already Booked").length;
  const deliveryCount = fleetList.filter((t) => t.status === "On Delivery").length;
  const maintenanceCount = fleetList.filter((t) => t.status === "On Maintenance").length;
  const outOfServiceCount = fleetList.filter((t) => t.status === "Out of Service").length;

  const filteredFleet = fleetList.filter((truck) => {
    const matchesSearch = truck.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) || truck.truckType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = selectedFilter === "All" || truck.status.toLowerCase() === selectedFilter.toLowerCase();
    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredFleet.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFleet = filteredFleet.slice(startIndex, endIndex);

  const trucksOptionsForModal = fleetList.map((t) => ({ truckID: t.id, plateNumber: t.plateNumber, truckType: t.truckType }));

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen relative">
      {/* View Routing Logic */}
      {/* View Routing Logic */}
      {selectedHistoryRecord ? (
        <LogDetailView
          log={selectedHistoryRecord}
          // Pass the filtered logs so the component can consolidate them
          truckLogs={maintenanceLogs.filter((l) => String(l.truckID) === String(selectedHistoryRecord.truckID))}
          onBack={() => setSelectedHistoryRecord(null)}
          onEdit={(logRecord) => {
            setEditingHistoryRecord(logRecord);
            // Auto-detect the correct form type to open based on the fields of the specific row you clicked edit on
            if (logRecord.driversReport || logRecord.preliminaryRemarks) {
              setMaintenanceFormType("inspection");
            } else if (logRecord.additionalIssue || logRecord.progressRemarks) {
              setMaintenanceFormType("update");
            } else {
              setMaintenanceFormType("log");
            }
            setShowLogMaintenanceModal(true);
          }}
          onDelete={handleDeleteHistoryLog}
        />
      ) : showTruckHistoryView && selectedTruck ? (
        <TruckSpecificHistoryView
          truck={selectedTruck}
          logs={maintenanceLogs}
          onBack={() => setShowTruckHistoryView(false)}
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
          onEdit={(truckRecord) => { setEditingTruck(truckRecord); setIsModalOpen(true); }}
          onDelete={() => setTruckToDelete(selectedTruck.id)}
          onUpdateStatusClick={() => { setStatusConfirmTruck(selectedTruck); setPendingStatusTarget(""); setShowStatusSelectModal(true); }}
          onHistoryClick={() => setShowTruckHistoryView(true)}
          onLogMaintenanceClick={() => {
            setStatusConfirmTruck(selectedTruck);
            setPendingStatusTarget("");
            setMaintenanceFormType("update");
            setEditingHistoryRecord(null); // Force a NEW row for the progress update
            setShowLogMaintenanceModal(true);
          }}
        />
      ) : (
        
        <>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Fleet Status (Mechanic Portal)</h1>
              <p className="text-xs sm:text-sm text-slate-700 mt-1">Monitor truck diagnostic health, asset availability, and maintenance conditions.</p>
            </div>
            <button onClick={() => { setEditingTruck(null); setIsModalOpen(true); }} className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-all duration-200 cursor-pointer">
              <Truck className="w-4 h-4 shrink-0" /><span>Add Truck</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                <button onClick={() => setSelectedFilter("All")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "All" ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"}`}>All ({totalCount})</button>
                <button onClick={() => setSelectedFilter("On Maintenance")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "On Maintenance" ? getStatusStyles("On Maintenance").tabActive : getStatusStyles("On Maintenance").bgLight}`}>On Maintenance ({maintenanceCount})</button>
                <button onClick={() => setSelectedFilter("Available")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "Available" ? getStatusStyles("Available").tabActive : getStatusStyles("Available").bgLight}`}>Available ({operationalCount})</button>
                <button onClick={() => setSelectedFilter("Already Booked")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "Already Booked" ? getStatusStyles("Already Booked").tabActive : getStatusStyles("Already Booked").bgLight}`}>Already Booked ({alreadyBookedCount})</button>
                <button onClick={() => setSelectedFilter("On Delivery")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "On Delivery" ? getStatusStyles("On Delivery").tabActive : getStatusStyles("On Delivery").bgLight}`}>On Delivery ({deliveryCount})</button>
                <button onClick={() => setSelectedFilter("Out of Service")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "Out of Service" ? getStatusStyles("Out of Service").tabActive : getStatusStyles("Out of Service").bgLight}`}>Out of Service ({outOfServiceCount})</button>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input type="text" placeholder="Search by Plate No or Type..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
              </div>
            </div>

            <div className="overflow-x-auto relative z-10 pb-32 min-h-75">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 w-1/2 text-left">Plate Number</th>
                    <th className="py-3.5 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 w-1/2 text-right">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={2} className="py-16 sm:py-20 text-center font-medium text-slate-500">
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
                          <p className="text-sm font-semibold text-slate-800">No fleet records found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedFleet.map((truck, index) => {
                      const currentStyles = getStatusStyles(truck.status);
                      return (
                        <tr key={truck.id || `truck-row-${index}`} onClick={() => setSelectedTruck(truck)} className="hover:bg-slate-50/80 cursor-pointer transition-colors" title="Click to view complete truck record">
                          <td className="py-4 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 text-left">
                            <div className="font-medium text-slate-900 truncate">
                              {truck.plateNumber}<span className="text-xs text-slate-500 font-normal ml-1 sm:ml-2">— {truck.truckType}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">Last Checked: {formatDisplayDate(truck.lastChecked)}</div>
                          </td>
                          <td className="py-4 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 text-right">
                            <div className="relative inline-block text-right z-10">
                              <div className={`w-36 h-8 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md border shadow-xs ${currentStyles.btn}`}>
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
              <span>Showing {filteredFleet.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredFleet.length)} of {filteredFleet.length} entries</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Previous</button>
                <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Next</button>
              </div>
            </div>
          </div>
        </>
      )}

      {showStatusSelectModal && statusConfirmTruck && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4"><Truck className="w-6 h-6" /></div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Update Status</h3>
            <p className="text-xs text-slate-500 mb-3">Current Status: <strong className="text-slate-800">{statusConfirmTruck.status}</strong></p>
            <div className="space-y-2 mb-6">
              {[{ label: "Available", dotColor: "bg-blue-500" }, { label: "On Maintenance", dotColor: "bg-amber-500" }, { label: "Out of Service", dotColor: "bg-rose-500" }].map(({ label, dotColor }) => {
                const isCurrent = statusConfirmTruck.status === label;
                return (
                  <button key={label} type="button" onClick={() => handleSelectStatusOption(label)} className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${isCurrent ? "bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-slate-400/30" : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"}`}>
                    <span className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />{label}</span>
                    {isCurrent && <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">Current</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { setShowStatusSelectModal(false); setStatusConfirmTruck(null); setPendingStatusTarget(""); }} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmationModal && statusConfirmTruck && pendingStatusTarget && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${getStatusStyles(pendingStatusTarget).modalIcon}`}><AlertTriangle className="w-6 h-6" /></div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Status Change</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">Are you sure you want to change this truck's status to <span className="font-semibold text-slate-900">{pendingStatusTarget}</span>?</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { setShowConfirmationModal(false); setStatusConfirmTruck(null); setPendingStatusTarget(""); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer">Cancel</button>
              <button type="button" onClick={handleConfirmStatusToggle} className={`flex-1 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md cursor-pointer ${getStatusStyles(pendingStatusTarget).modalBtn}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <TruckModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTruck(null); }} onSubmitSuccess={handleModalSubmit} editData={editingTruck} />

      <LogMaintenanceModal
        isOpen={showLogMaintenanceModal}
        onClose={() => { setShowLogMaintenanceModal(false); setEditingHistoryRecord(null); setStatusConfirmTruck(null); setPendingStatusTarget(""); }}
        onSubmitSuccess={handleMaintenanceLogSubmit}
        editData={editingHistoryRecord}
        trucksOptions={trucksOptionsForModal}
        mechanicsOptions={mechanicsOptions}
        preselectedTruckId={statusConfirmTruck?.id || selectedTruck?.id}
        formType={maintenanceFormType}
      />

      {truckToDelete && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Truck Record</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              Are you sure you want to delete this truck? This action is permanent and cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setTruckToDelete(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={() => { handleDeleteTruck(truckToDelete); setTruckToDelete(null); }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md cursor-pointer">
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-100 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-slate-700">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${toastMessage === "No changes were made." ? "bg-blue-500" : "bg-emerald-500"}`}>
              {toastMessage === "No changes were made." ? <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> : <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}