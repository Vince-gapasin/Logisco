/* eslint-disable react-hooks/set-state-in-effect */
// ==========================================
// LOGISCO - FLEET STATUS PAGE
// ==========================================

"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

import type {
  Truck as ApiTruck,
  CreateTruckDto,
  UpdateTruckDto,
  TrucksResponse,
  TruckResponse,
} from "@/types/truck";

// ==========================================
// CONFIG & SESSION
// ==========================================

const ITEMS_PER_PAGE = 10;
const SESSION_KEY = "logisco_user_session";

interface UserSession {
  email: string;
  role: string;
  token: string;
  id: string;
  employeeName: string;
}

function getAuthSession(): UserSession {
  const savedSession =
    localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);

  if (!savedSession) {
    throw new Error("Authentication session not found. Please log in again.");
  }
  return JSON.parse(savedSession) as UserSession;
}

// ==========================================
// API FETCH HELPER
// ==========================================

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const session = getAuthSession();
  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${session.token}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let result: unknown = null;
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    result = await response.json();
  }

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "message" in result
        ? String((result as { message: unknown }).message)
        : `Request failed with status ${response.status}`;

    if (response.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
    throw new Error(message);
  }

  return result as T;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

// ==========================================
// FRONTEND TYPES & MAPPERS
// ==========================================

export interface TruckRecord {
  id: string;
  plateNumber: string;
  truckType: string;
  truckModel: string;
  capacity: string;
  lastChecked: string;
  status: string;
}

function mapApiTruck(truck: ApiTruck): TruckRecord {
  return {
    id: truck.truckID,
    plateNumber: truck.plateNumber || "N/A",
    truckType: truck.truckType || "N/A",
    truckModel: truck.model || "N/A",
    capacity: truck.capacity ? String(truck.capacity) : "",
    lastChecked: truck.lastChecked ? truck.lastChecked.split("T")[0] : "",
    status: truck.truckStatus || "Available",
  };
}

// ==========================================
// TRUCK MODAL COMPONENT (Add / Edit)
// ==========================================

interface TruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (formData: any, editData?: TruckRecord | null) => Promise<void>;
  editData?: TruckRecord | null;
}

function TruckModal({ isOpen, onClose, onSubmitSuccess, editData }: TruckModalProps) {
  const initialTruckState = {
    plateNumber: "",
    truckType: "",
    truckModel: "",
    capacity: "",
    lastChecked: "",
    status: "Available",
  };

  const [formData, setFormData] = useState(initialTruckState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editData) {
      setFormData({
        plateNumber: editData.plateNumber,
        truckType: editData.truckType,
        truckModel: editData.truckModel,
        capacity: editData.capacity,
        lastChecked: editData.lastChecked,
        status: editData.status,
      });
    } else {
      setFormData(initialTruckState);
    }
    setErrors({});
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialTruckState);
    setErrors({});
    onClose();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.plateNumber.trim()) newErrors.plateNumber = "Plate number is required.";
    if (!formData.truckType) newErrors.truckType = "Type of truck is required.";
    if (!formData.truckModel.trim()) newErrors.truckModel = "Truck model is required.";
    if (!String(formData.capacity).trim()) newErrors.capacity = "Capacity is required.";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitSuccess(formData, editData);
      handleCloseModal();
    } catch (error) {
      // Errors handled by parent toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold tracking-wide">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Truck Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">Plate Number *</label>
                <input
                  type="text"
                  name="plateNumber"
                  placeholder="e.g., ABC-1234"
                  value={formData.plateNumber}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs"
                />
                {errors.plateNumber && <p className="text-red-500 text-[11px] mt-1">{errors.plateNumber}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Type of Truck *</label>
                <select
                  name="truckType"
                  value={formData.truckType}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs"
                >
                  <option value="" disabled>Select truck type</option>
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
                  <option value="Others">Others</option>
                </select>
                {errors.truckType && <p className="text-red-500 text-[11px] mt-1">{errors.truckType}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Truck Model *</label>
                <input
                  type="text"
                  name="truckModel"
                  placeholder="e.g., Isuzu NPR"
                  value={formData.truckModel}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs"
                />
                {errors.truckModel && <p className="text-red-500 text-[11px] mt-1">{errors.truckModel}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Capacity *</label>
                <input
                  type="text"
                  name="capacity"
                  placeholder="e.g., 5000 kg"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs"
                />
                {errors.capacity && <p className="text-red-500 text-[11px] mt-1">{errors.capacity}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">Last Checked (Optional)</label>
                <input
                  type="date"
                  name="lastChecked"
                  value={formData.lastChecked}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isSubmitting}
              className="w-full sm:w-40 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-40 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editData ? "Save Changes" : "Add Truck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// TRUCK DETAIL VIEW
// ==========================================

interface TruckDetailViewProps {
  truck: TruckRecord;
  onBack: () => void;
  onEdit: (truckRecord: TruckRecord) => void;
  onDelete: (id: string) => Promise<void>;
}

function TruckDetailView({ truck, onBack, onEdit, onDelete }: TruckDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(truck.id);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Truck Information Record</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">Complete truck details from the database.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onEdit(truck)}
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Truck</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">{truck.plateNumber}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {truck.truckType}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  {truck.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-black mb-1">Truck Model</label>
            <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[34px]">
              {truck.truckModel}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-black mb-1">Capacity</label>
            <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[34px]">
              {truck.capacity}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-black mb-1">Last Checked</label>
            <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-[34px]">
              {truck.lastChecked || "N/A"}
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Truck Record</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              Are you sure you want to delete <strong className="text-slate-900">{truck.plateNumber}</strong>?
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm flex justify-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
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
// MAIN PAGE
// ==========================================

export default function FleetStatusPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [truckList, setTruckList] = useState<TruckRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchTrucks = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await apiFetch<TrucksResponse>("/api/fleet-status");
      setTruckList(response.data.map(mapApiTruck));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setTruckList([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  const handleRowClick = async (id: string) => {
    try {
      setErrorMessage("");
      const response = await apiFetch<TruckResponse>(`/api/fleet-status/${id}`);
      setSelectedTruck(mapApiTruck(response.data));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleModalSubmit = async (formData: any, editData?: TruckRecord | null) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      if (editData) {
        const payload: UpdateTruckDto = {
          plateNumber: formData.plateNumber,
          truckType: formData.truckType,
          model: formData.truckModel,
          capacity: formData.capacity,
          lastChecked: formData.lastChecked || null,
          truckStatus: formData.status,
        };

        await apiFetch<TruckResponse>(`/api/fleet-status/${editData.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        
        setSuccessMessage("Truck updated successfully.");
        if (selectedTruck) await handleRowClick(editData.id);
      } else {
        const payload: CreateTruckDto = {
          plateNumber: formData.plateNumber,
          truckType: formData.truckType,
          model: formData.truckModel,
          capacity: formData.capacity,
          lastChecked: formData.lastChecked || null,
          truckStatus: "Available",
        };

        await apiFetch<TruckResponse>("/api/fleet-status", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        
        setSuccessMessage("Truck added successfully.");
      }
      
      await fetchTrucks();
    } catch (error) {
      const msg = getErrorMessage(error);
      setErrorMessage(msg);
      throw error;
    }
  };

  const handleDeleteTruck = async (id: string) => {
    try {
      await apiFetch(`/api/fleet-status/${id}`, { method: "DELETE" });
      setSelectedTruck(null);
      setSuccessMessage("Truck deactivated successfully.");
      await fetchTrucks();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      throw error;
    }
  };

  const filteredTrucks = truckList.filter((truck) =>
    truck.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.truckType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTrucks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentTrucks = filteredTrucks.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (selectedTruck) {
    return (
      <>
        {successMessage && (
          <div className="fixed top-5 right-5 z-60 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="fixed top-5 right-5 z-60 bg-red-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm">
            {errorMessage}
          </div>
        )}
        <TruckDetailView
          truck={selectedTruck}
          onBack={() => setSelectedTruck(null)}
          onEdit={(truck) => {
            setEditingTruck(truck);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Fleet Status</h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">Monitor and manage fleet availability.</p>
        </div>
        <button
          onClick={() => {
            setEditingTruck(null);
            setIsModalOpen(true);
          }}
          className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md"
        >
          <Truck className="w-4 h-4" />
          <span>Add Truck</span>
        </button>
      </div>

      {successMessage && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">{successMessage}</div>}
      {errorMessage && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{errorMessage}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by plate number or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl pl-10 pr-4 py-2.5"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase">
                <th className="py-3.5 px-4 sm:px-6">Plate Number</th>
                <th className="py-3.5 px-4 sm:px-6">Last Checked</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium">Loading trucks...</p>
                  </td>
                </tr>
              ) : currentTrucks.length > 0 ? (
                currentTrucks.map((truck) => (
                  <tr
                    key={truck.id}
                    onClick={() => handleRowClick(truck.id)}
                    className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer text-sm"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                      {truck.plateNumber} <span className="text-xs text-slate-500 font-normal">({truck.truckType})</span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">{truck.lastChecked || "N/A"}</td>
                    <td className="py-3.5 px-4 sm:px-6">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {truck.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <FileText className="w-6 h-6 mx-auto mb-3 text-slate-500" />
                    <p className="text-sm font-medium">No trucks found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 flex flex-col sm:flex-row items-center justify-between text-xs border-t">
          <span>Showing {filteredTrucks.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredTrucks.length)} of {filteredTrucks.length} entries</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || isLoading}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0 || isLoading}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
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