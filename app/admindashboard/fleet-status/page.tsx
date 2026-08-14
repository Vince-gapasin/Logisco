// ==========================================
// FLEET STATUS PAGE & TRUCK MODAL
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
  Loader2, // Added for loading state
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

  useEffect(() => {
    if (editData) {
      setFormData({
        plateNumber: editData.plateNumber || "",
        truckType: editData.truckType || "",
        truckModel: editData.truckModel || "",
        capacity: editData.capacity || "",
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
    onClose();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
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
    if (!formData.capacity.trim()) newErrors.capacity = "Capacity is required.";
    if (!formData.lastChecked)
      newErrors.lastChecked = "Last checked date is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const updatedRecord: TruckRecord = {
      id: editData ? editData.id : Date.now(),
      plateNumber: formData.plateNumber,
      truckType: formData.truckType,
      truckModel: formData.truckModel,
      capacity: formData.capacity,
      lastChecked: formData.lastChecked,
      status: editData ? editData.status : "Operational",
    };

    onSubmitSuccess(updatedRecord);
    setFormData(initialTruckState);
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
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
                  onChange={handleInputChange}
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
                <select
                  name="truckType"
                  value={formData.truckType}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckType ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>
                    Select truck type
                  </option>
                  <option value="Closed Van">Closed Van</option>
                  <option value="Wing Van">Wing Van</option>
                  <option value="Dry Van">Dry Van</option>
                  <option value="Refrigerated Truck">Refrigerated Truck</option>
                  <option value="Boom Truck">Boom Truck</option>
                  <option value="Flatbed Truck">Flatbed Truck</option>
                  <option value="Dump Truck">Dump Truck</option>
                  <option value="Trailer Truck">Trailer Truck</option>
                  <option value="Tanker Truck">Tanker Truck</option>
                  <option value="Pickup Truck">Pickup Truck</option>
                  <option value="Other">Other</option>
                </select>
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
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
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
                  value={formData.lastChecked}
                  onChange={handleInputChange}
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
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
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
// TRUCK INFORMATION DETAIL VIEW
// ==========================================
interface TruckDetailViewProps {
  truck: TruckRecord;
  onBack: () => void;
  onEdit: (truckRecord: TruckRecord) => void;
  onDelete: (id: string | number) => void;
}

function TruckDetailView({
  truck,
  onBack,
  onEdit,
  onDelete,
}: TruckDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
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
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Truck</span>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold border border-blue-100">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {truck.plateNumber}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {truck.truckType}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  {truck.status || "Operational"}
                </span>
              </div>
            </div>
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
                  {truck.lastChecked
                    ? new Date(truck.lastChecked).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
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
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(truck.id);
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
// FLEET STATUS MAIN PAGE
// ==========================================
export default function FleetStatusPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [truckList, setTruckList] = useState<TruckRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Loading state added

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);

  // Reset pagination to page 1 whenever the user searches
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // ==========================================
  // LIVE DATABASE CONNECTION (FETCH TRUCKS)
  // ==========================================
  useEffect(() => {
    const fetchTrucks = async () => {
      setIsLoading(true); // Ensure loading is true before fetch
      try {
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
        const response = await axios.get(`${API_URL}/api/trucks`);

        // THE BULLETPROOF FIX: Check if the array is hiding inside a 'data' property
        const backendData = response.data.data || response.data;
        let liveData: TruckRecord[] = [];

        // Now we check 'backendData' instead of 'response.data'
        if (Array.isArray(backendData)) {
          liveData = backendData.map((dbTruck: any) => ({
            id: dbTruck.truckID || dbTruck.id,
            plateNumber: dbTruck.plateNumber,
            truckType: dbTruck.truckType || dbTruck.type,
            truckModel: dbTruck.model,
            capacity: dbTruck.capacity,
            lastChecked: dbTruck.lastMaintenance,
            status: dbTruck.status || "Operational",
          }));
        } else {
          console.warn("Expected an array from backend, got:", response.data);
        }

        setTruckList(liveData);
      } catch (error) {
        console.error("Failed to fetch trucks:", error);
      } finally {
        setIsLoading(false); // Stop loading regardless of success/fail
      }
    };

    fetchTrucks();
  }, []);

  // ==========================================
  // LIVE DATABASE CONNECTION (ADD TRUCK)
  // ==========================================

  const handleRowClick = async (id: string | number) => {
    try {
      // 🚀 Update connection here later
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
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

      // Send the modal data to Express
      if (editingTruck) {
        // 🚀 Connect EDIT endpoint here
        setTruckList((prev) =>
          prev.map((t) => (t.id === record.id ? record : t)),
        );

        if (selectedTruck && selectedTruck.id === record.id) {
          setSelectedTruck(record);
        }
        setEditingTruck(null);
      } else {
        const response = await axios.post(`${API_URL}/api/trucks`, record);
        const dbTruck = response.data;

        // Update the UI immediately with the real Database ID
        const uiRecord: TruckRecord = {
          ...record,
          id: dbTruck.truckID || dbTruck.id,
        };
        setTruckList((prev) => [uiRecord, ...prev]);
      }

      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Failed to save truck:", error);
      const serverMsg =
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.message;
      alert(`🚨 BACKEND REJECTED IT 🚨\n\nReason: ${serverMsg}`);
    }
  };

  const handleDeleteTruck = async (id: string | number) => {
    try {
      // 🚀 FOR TEAMMATE: Connect DELETE endpoint here
      setTruckList((prev) => prev.filter((t) => t.id !== id));
      setSelectedTruck(null);
    } catch (error) {
      console.error("Failed to delete truck:", error);
      alert("Error deleting truck. Please try again.");
    }
  };

  // 1. Filter the entire list first
  const filteredTrucks = truckList.filter(
    (truck) =>
      truck.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.truckType.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // 2. Pagination Math based on filtered results
  const totalPages = Math.ceil(filteredTrucks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // 3. Slice exactly 10 entries for the current page
  const currentTrucks = filteredTrucks.slice(startIndex, endIndex);

  // === CONDITIONAL RENDER: SHOW DETAIL VIEW ===
  if (selectedTruck) {
    return (
      <>
        <TruckDetailView
          truck={selectedTruck}
          onBack={() => setSelectedTruck(null)}
          onEdit={(truckRecord) => {
            setEditingTruck(truckRecord);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteTruck}
        />
        <TruckModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTruck(null);
          }}
          onSubmitSuccess={handleModalSubmit}
          editData={editingTruck}
        />
      </>
    );
  }

  // === MAIN FLEET STATUS LIST VIEW ===
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Fleet Status
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Monitor and manage fleet availability, maintenance logs, and truck
            asset statuses.
          </p>
        </div>

        <div className="flex justify-center sm:justify-start w-full sm:w-auto">
          <button
            onClick={() => {
              setEditingTruck(null);
              setIsModalOpen(true);
            }}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-all duration-200 whitespace-nowrap"
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>Add Truck</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by plate number or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-162.5">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Plate Number</th>
                <th className="py-3.5 px-4 sm:px-6">Last Checked</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                // Loading State View
                <tr>
                  <td colSpan={3} className="py-16 sm:py-20 text-center">
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
                // Populated Data View
                currentTrucks.map((truck) => (
                  <tr
                    key={truck.id}
                    onClick={() => handleRowClick(truck.id)}
                    className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-sm text-slate-800"
                    title="Click to view complete truck record"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                      {truck.plateNumber}{" "}
                      <span className="text-xs text-slate-500 font-normal">
                        ({truck.truckType})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">{truck.lastChecked}</td>
                    <td className="py-3.5 px-4 sm:px-6">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {truck.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                // Empty State View (Shown only if not loading AND no data)
                <tr>
                  <td colSpan={3} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        No trucks found
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        Truck records will appear here once added via the form
                        or connected to your backend database.
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
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || isLoading}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage === 1 || isLoading
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
              disabled={
                currentPage === totalPages || totalPages === 0 || isLoading
              }
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage === totalPages || totalPages === 0 || isLoading
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <TruckModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTruck(null);
        }}
        onSubmitSuccess={handleModalSubmit}
        editData={editingTruck}
      />
    </div>
  );
}
