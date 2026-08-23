// ==========================================
// LOGISCO - MECHANIC HISTORY LOGS PAGE
// ==========================================
"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  FileText,
  X,
  Wrench,
  ClipboardCheck,
  ArrowLeft,
  Edit3,
  Trash2,
  AlertTriangle,
  Truck,
} from "lucide-react";

// ==========================================
// INTERFACES & TYPES
// ==========================================

export interface HistoryLogRecord {
  id: string; // Changed to string for UUID
  truckID?: string;
  plateNumber: string;
  truckType: string;
  primaryMechanicID?: string;
  mechanicName: string;
  additionalMechanicID?: string;
  additionalMechanic: string;
  issue: string;
  remarks: string;
  date: string;
}

// DEFINE TYPES FOR DROPDOWNS
export interface TruckOption {
  truckID: string;
  plateNumber: string;
  truckType: string;
}

export interface EmployeeOption {
  employeeID: string;
  employeeName: string;
  role: string;
}

// ==========================================
// LOG MAINTENANCE MODAL (Add / Edit Form)
// ==========================================
interface LogMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (formData: any) => void;
  editData?: HistoryLogRecord | null;
  trucksOptions: TruckOption[];
  mechanicsOptions: EmployeeOption[];
}

function LogMaintenanceModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  editData,
  trucksOptions,
  mechanicsOptions,
}: LogMaintenanceModalProps) {
  const initialFormState = {
    date: "",
    truckID: "",
    primaryMechanicID: "",
    additionalMechanicID: "",
    issue: "",
    remarks: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editData) {
      setFormData({
        date: editData.date || "",
        truckID: editData.truckID || "",
        primaryMechanicID: editData.primaryMechanicID || "",
        additionalMechanicID: editData.additionalMechanicID || "",
        issue: editData.issue || "",
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
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = "Date is required.";
    if (!formData.truckID) newErrors.truckID = "Truck selection is required.";
    if (!formData.primaryMechanicID)
      newErrors.primaryMechanicID = "Primary mechanic is required.";
    if (!formData.issue.trim())
      newErrors.issue = "Issue / work performed is required.";

    // Validation: Prevent choosing the same mechanic twice
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

    // Submit the raw form data (IDs) to the parent to handle the API call
    onSubmitSuccess(formData);
    setFormData(initialFormState);
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {editData ? "Edit Maintenance Log" : "Maintenance Log Form"}
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
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
                  value={formData.date}
                  onChange={handleInputChange}
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
                <select
                  name="truckID"
                  value={formData.truckID}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                    errors.truckID
                      ? "border-red-500 bg-red-50/20"
                      : "border-slate-300"
                  }`}
                >
                  <option value="" disabled>
                    Choose a truck...
                  </option>
                  {trucksOptions.map((truck) => (
                    <option key={truck.truckID} value={truck.truckID}>
                      {truck.plateNumber} — {truck.truckType}
                    </option>
                  ))}
                  {editData &&
                    editData.truckID &&
                    !trucksOptions.some((t) => t.truckID === editData.truckID) && (
                      <option value={editData.truckID}>
                        {editData.plateNumber} — {editData.truckType}
                      </option>
                    )}
                </select>
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
                <select
                  name="primaryMechanicID"
                  value={formData.primaryMechanicID}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                    errors.primaryMechanicID
                      ? "border-red-500 bg-red-50/20"
                      : "border-slate-300"
                  }`}
                >
                  <option value="" disabled>
                    Choose mechanic...
                  </option>
                  {mechanicsOptions.map((emp) => (
                    <option key={emp.employeeID} value={emp.employeeID}>
                      {emp.employeeName}
                    </option>
                  ))}
                  {editData &&
                    editData.primaryMechanicID &&
                    !mechanicsOptions.some((m) => m.employeeID === editData.primaryMechanicID) && (
                      <option value={editData.primaryMechanicID}>
                        {editData.mechanicName}
                      </option>
                    )}
                </select>
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
                <select
                  name="additionalMechanicID"
                  value={formData.additionalMechanicID}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${
                    errors.additionalMechanicID
                      ? "border-red-500 bg-red-50/20"
                      : "border-slate-300"
                  }`}
                >
                  <option value="">None</option>
                  {mechanicsOptions.map((emp) => (
                    <option key={emp.employeeID} value={emp.employeeID}>
                      {emp.employeeName}
                    </option>
                  ))}
                  {editData &&
                    editData.additionalMechanicID &&
                    !mechanicsOptions.some((m) => m.employeeID === editData.additionalMechanicID) && (
                      <option value={editData.additionalMechanicID}>
                        {editData.additionalMechanic}
                      </option>
                    )}
                </select>
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
                  Issue / Work Performed *
                </label>
                <textarea
                  name="issue"
                  rows={3}
                  placeholder="Describe the issue fixed, parts replaced, or general maintenance performed..."
                  value={formData.issue}
                  onChange={handleInputChange}
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
                  Remarks (Optional)
                </label>
                <textarea
                  name="remarks"
                  rows={5}
                  placeholder="Any additional notes, future recommendations, or observations..."
                  value={formData.remarks}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
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
              {editData ? "Save Changes" : "Save Log"}
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
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
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
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Log</span>
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        {/* Summary Header */}
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

        {/* Details Layout */}
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
                  {log.date}
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
                  Issue / Work Performed
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
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(log.id);
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
// MECHANIC HISTORY LOGS PAGE (MAIN)
// ==========================================
export default function MechanicHistoryLogsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // View & Edit States
  const [selectedLog, setSelectedLog] = useState<HistoryLogRecord | null>(null);
  const [editingLog, setEditingLog] = useState<HistoryLogRecord | null>(null);

  // Database States
  const [logsList, setLogsList] = useState<HistoryLogRecord[]>([]);
  const [trucksOptions, setTrucksOptions] = useState<TruckOption[]>([]);
  const [mechanicsOptions, setMechanicsOptions] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Environment Config
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  // Initial Fetching
  useEffect(() => {
    fetchLogs();
    fetchDropdownOptions();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/HistoryLogsM`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      
      if (Array.isArray(result)) {
        setLogsList(result);
      } else if (result && Array.isArray(result.data)) {
        setLogsList(result.data);
      } else {
        setLogsList([]); 
      }

    } catch (error) {
      console.error("Error fetching logs:", error);
      setLogsList([]); 
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDropdownOptions = async () => {
    try {
      // Assuming you have a /api/trucks route on your Express server
      const truckRes = await fetch(`${API_URL}/api/trucks`);
      const truckData = await truckRes.json();
      // Ensure we extract the array whether it's wrapped in { data: [...] } or just [...]
      setTrucksOptions(truckData.data || truckData || []);

      // Assuming you have a /api/employees route (can filter by role=Mechanic if needed)
      const empRes = await fetch(`${API_URL}/api/employees?role=Mechanic`);
      const empData = await empRes.json();
      setMechanicsOptions(empData.data || empData || []);
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  };

  // Reset pagination when searching
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleModalSubmit = async (formData: any) => {
    try {
      if (editingLog) {
        // UPDATE Request
        const response = await fetch(
          `${API_URL}/api/HistoryLogsM/${editingLog.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          }
        );
        if (response.ok) {
          await fetchLogs(); // Refresh the list with relational data from backend
        }
      } else {
        // CREATE Request
        const response = await fetch(`${API_URL}/api/HistoryLogsM`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (response.ok) {
          await fetchLogs(); // Refresh the list
        }
      }
    } catch (error) {
      console.error("Error saving log:", error);
    }

    setEditingLog(null);
    setIsModalOpen(false);
    setSelectedLog(null); // Optional: close detail view if they edited from there
  };

  const handleDeleteLog = async (id: string | number) => {
    try {
      const response = await fetch(`${API_URL}/api/HistoryLogsM/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setLogsList((prev) => prev.filter((log) => log.id !== id));
        setSelectedLog(null);
      }
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  // Search filter
  const filteredLogs = logsList.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.plateNumber?.toLowerCase().includes(searchLower) ||
      log.truckType?.toLowerCase().includes(searchLower) ||
      log.mechanicName?.toLowerCase().includes(searchLower) ||
      log.additionalMechanic?.toLowerCase().includes(searchLower) ||
      log.issue?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  // === CONDITIONAL RENDER: SHOW DETAIL VIEW ===
  if (selectedLog) {
    return (
      <>
        <LogDetailView
          log={selectedLog}
          onBack={() => setSelectedLog(null)}
          onEdit={(logRecord) => {
            setEditingLog(logRecord);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteLog}
        />
        <LogMaintenanceModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingLog(null);
          }}
          onSubmitSuccess={handleModalSubmit}
          editData={editingLog}
          trucksOptions={trucksOptions}
          mechanicsOptions={mechanicsOptions}
        />
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* ================= PAGE HEADER ================= */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            History Logs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            View and manage past truck maintenance and repair records.
          </p>
        </div>

        {/* Action Button: Log Maintenance */}
        <button
          onClick={() => {
            setEditingLog(null);
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto h-11 px-5 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-all duration-200 whitespace-nowrap self-start sm:self-auto cursor-pointer"
        >
          <Wrench className="w-4 h-4 shrink-0" />
          <span>Log Maintenance</span>
        </button>
      </div>

      {/* ================= MAIN CONTENT CARD ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search Bar Container */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">
              Maintenance Records
            </h2>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search plate, mechanic, issue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-sm font-medium text-slate-500 animate-pulse">
                Loading database records...
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 w-1/2 text-left">
                    Plate Number
                  </th>
                  <th className="py-3.5 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 w-1/2 text-right">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-16 sm:py-20 text-center">
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
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      title="Click to view complete maintenance log"
                    >
                      {/* Left Column: Plate Number, Truck Type, Mechanic, Issue */}
                      <td className="py-4 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 text-left">
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
                          <div className="mt-0.5">{log.issue}</div>
                        </div>
                      </td>

                      {/* Right Column: Date */}
                      <td className="py-4 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 text-right align-top sm:align-middle">
                        <div className="text-sm font-medium text-slate-800">
                          {new Date(log.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Dynamic Pagination Footer */}
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

      <LogMaintenanceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLog(null);
        }}
        onSubmitSuccess={handleModalSubmit}
        editData={editingLog}
        trucksOptions={trucksOptions}
        mechanicsOptions={mechanicsOptions}
      />
    </div>
  );
}