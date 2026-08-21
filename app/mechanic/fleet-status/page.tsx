// ==========================================
// LOGISCO - MECHANIC FLEET STATUS PAGE
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
} from "lucide-react";

export interface TruckRecord {
  id: string | number;
  plateNumber: string;
  truckType: string;
  truckModel: string;
  capacity: string;
  lastChecked: string;
  status: "Operational" | "Maintenance";
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
              Complete truck diagnostics and specifications.
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
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    truck.status === "Operational"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {truck.status}
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
                  {truck.lastChecked || "N/A"}
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
              This will permanently remove the record from the list.
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
    "All" | "Operational" | "Maintenance"
  >("All");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);

  // === STATUS CONFIRMATION MODAL STATE ===
  const [statusConfirmTruck, setStatusConfirmTruck] =
    useState<TruckRecord | null>(null);

  // === PAGINATION STATES ===
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination to page 1 whenever the user searches or filters
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  // Mock fleet records for frontend visualization (Supabase-ready)
  const [fleetList, setFleetList] = useState<TruckRecord[]>([
    {
      id: 1,
      plateNumber: "ABC 1234",
      truckType: "Wing Van (10 Wheeler)",
      truckModel: "Isuzu Forward",
      capacity: "10 Tons",
      lastChecked: "Aug 19, 2026",
      status: "Operational",
    },
    {
      id: 2,
      plateNumber: "XYZ 5678",
      truckType: "Dump Truck",
      truckModel: "Hino Profia",
      capacity: "12 Tons",
      lastChecked: "Aug 18, 2026",
      status: "Maintenance",
    },
    {
      id: 3,
      plateNumber: "DEF 9012",
      truckType: "Flatbed Truck",
      truckModel: "Mitsubishi Fuso",
      capacity: "8 Tons",
      lastChecked: "Aug 19, 2026",
      status: "Operational",
    },
    {
      id: 4,
      plateNumber: "GHI 3456",
      truckType: "Refrigerated Van",
      truckModel: "Isuzu NPR",
      capacity: "5 Tons",
      lastChecked: "Aug 17, 2026",
      status: "Operational",
    },
    {
      id: 5,
      plateNumber: "JKL 7890",
      truckType: "Cargo Truck",
      truckModel: "UD Trucks Quester",
      capacity: "15 Tons",
      lastChecked: "Aug 16, 2026",
      status: "Maintenance",
    },
    {
      id: 6,
      plateNumber: "MNO 2468",
      truckType: "Wing Van (6 Wheeler)",
      truckModel: "Fuso Canter",
      capacity: "4 Tons",
      lastChecked: "Aug 19, 2026",
      status: "Operational",
    },
    {
      id: 7,
      plateNumber: "PQR 1357",
      truckType: "Pickup Truck",
      truckModel: "Toyota Hilux",
      capacity: "1 Ton",
      lastChecked: "Aug 19, 2026",
      status: "Operational",
    },
    {
      id: 8,
      plateNumber: "STU 2468",
      truckType: "Tanker Truck",
      truckModel: "Fuso Fighter",
      capacity: "10 Tons",
      lastChecked: "Aug 15, 2026",
      status: "Operational",
    },
    {
      id: 9,
      plateNumber: "VWX 3579",
      truckType: "Trailer Truck",
      truckModel: "Volvo FH16",
      capacity: "20 Tons",
      lastChecked: "Aug 14, 2026",
      status: "Maintenance",
    },
    {
      id: 10,
      plateNumber: "YZA 4680",
      truckType: "Closed Van",
      truckModel: "Isuzu NQR",
      capacity: "4 Tons",
      lastChecked: "Aug 12, 2026",
      status: "Operational",
    },
    {
      id: 11,
      plateNumber: "BCD 5791",
      truckType: "Boom Truck",
      truckModel: "Hino 500",
      capacity: "8 Tons",
      lastChecked: "Aug 11, 2026",
      status: "Operational",
    },
  ]);

  // Handle status update confirmation execution
  const handleConfirmStatusToggle = () => {
    if (!statusConfirmTruck) return;
    const nextStatus =
      statusConfirmTruck.status === "Operational"
        ? "Maintenance"
        : "Operational";

    setFleetList((prev) =>
      prev.map((truck) =>
        truck.id === statusConfirmTruck.id
          ? { ...truck, status: nextStatus }
          : truck,
      ),
    );
    setStatusConfirmTruck(null);
  };

  const handleModalSubmit = (record: TruckRecord) => {
    if (editingTruck) {
      setFleetList((prev) =>
        prev.map((t) => (t.id === record.id ? record : t)),
      );
      if (selectedTruck && selectedTruck.id === record.id) {
        setSelectedTruck(record);
      }
      setEditingTruck(null);
    } else {
      setFleetList((prev) => [record, ...prev]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteTruck = (id: string | number) => {
    setFleetList((prev) => prev.filter((t) => t.id !== id));
    setSelectedTruck(null);
  };

  // Category counts
  const totalCount = fleetList.length;
  const operationalCount = fleetList.filter(
    (t) => t.status === "Operational",
  ).length;
  const maintenanceCount = fleetList.filter(
    (t) => t.status === "Maintenance",
  ).length;

  // Filter logic combining search bar and status tabs
  const filteredFleet = fleetList.filter((truck) => {
    const matchesSearch =
      truck.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.truckType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab =
      selectedFilter === "All" ||
      truck.status.toLowerCase() === selectedFilter.toLowerCase();
    return matchesSearch && matchesTab;
  });

  // === PAGINATION CALCULATION ===
  const totalPages = Math.ceil(filteredFleet.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFleet = filteredFleet.slice(startIndex, endIndex);

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

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* ================= PAGE HEADER ================= */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Fleet Status (Mechanic Portal)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Monitor truck diagnostic health, asset availability, and maintenance
            conditions.
          </p>
        </div>

        {/* Action Button: Add Truck */}
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

      {/* ================= MAIN CONTENT CARD ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search & Filter Bar Container */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
          {/* Status Tabs/Buttons */}
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
              onClick={() => setSelectedFilter("Operational")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedFilter === "Operational"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 border border-emerald-200/50"
              }`}
            >
              Operational ({operationalCount})
            </button>
            <button
              onClick={() => setSelectedFilter("Maintenance")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedFilter === "Maintenance"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/10"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100/70 border border-amber-200/50"
              }`}
            >
              Maintenance ({maintenanceCount})
            </button>
          </div>

          {/* Search Bar Input */}
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

        {/* Data Table with Balanced Desktop Padding */}
        <div className="overflow-x-auto">
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
              {paginatedFleet.length === 0 ? (
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
                        Try adjusting your search query or filter selection to
                        view existing assets.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedFleet.map((truck) => (
                  <tr
                    key={truck.id}
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
                        Last Checked: {truck.lastChecked}
                      </div>
                    </td>

                    {/* Uniform Status Action Button Control */}
                    <td className="py-4 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 text-right">
                      <div
                        className="inline-block text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusConfirmTruck(truck);
                          }}
                          className={`w-36 h-8 inline-flex items-center justify-center text-xs font-semibold rounded-md border cursor-pointer transition-all shadow-xs ${
                            truck.status === "Operational"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/80"
                              : "bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100/80"
                          }`}
                        >
                          {truck.status}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {filteredFleet.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredFleet.length)} of {filteredFleet.length}{" "}
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

      {/* ================= STATUS CONFIRMATION MODAL ================= */}
      {statusConfirmTruck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                statusConfirmTruck.status === "Operational"
                  ? "bg-amber-100 text-amber-600"
                  : "bg-emerald-100 text-emerald-600"
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {statusConfirmTruck.status === "Operational"
                ? "Change truck status to Maintenance?"
                : "Is the maintenance for this truck completed?"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              {statusConfirmTruck.status === "Operational" ? (
                <>
                  Truck{" "}
                  <strong className="text-slate-900">
                    {statusConfirmTruck.plateNumber}
                  </strong>{" "}
                  will be marked as under maintenance and removed from active
                  route assignments.
                </>
              ) : (
                <>
                  Truck{" "}
                  <strong className="text-slate-900">
                    {statusConfirmTruck.plateNumber}
                  </strong>{" "}
                  will be marked back as operational and ready for deployment.
                </>
              )}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStatusConfirmTruck(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                className={`flex-1 py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md cursor-pointer ${
                  statusConfirmTruck.status === "Operational"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {statusConfirmTruck.status === "Operational"
                  ? "Confirm"
                  : "Mark as Operational"}
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
    </div>
  );
}
