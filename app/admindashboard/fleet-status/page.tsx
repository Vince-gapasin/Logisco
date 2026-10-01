// ==========================================
// LOGISCO - FLEET STATUS PAGE
// ==========================================

"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";
import RowOpenButton from "@/components/RowOpenButton";
import TruckMaintenanceHistory from "@/components/truck/TruckMaintenanceHistory";
import TruckStatusControl from "@/components/truck/TruckStatusControl";
import {
  Search,
  Truck,
  FileText,
  X,
  ArrowLeft,
  History as HistoryIcon,
  Edit3,
  Wrench,
  Trash2,
  AlertTriangle,
  Loader2,
  ChevronDown,
} from "lucide-react";

import type {
  Truck as ApiTruck,
  TruckStatus,
  TruckType,
  CreateTruckDto,
  UpdateTruckDto,
} from "@/types/truck";

// ==========================================
// CONFIG & SESSION
// ==========================================

const ITEMS_PER_PAGE = 10;

// ==========================================
// API FETCH HELPER
// ==========================================

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
  fuelTypeID: string;
  /** Resolved name, so a list does not have to look up 36 ids. */
  fuelTypeName: string;
}

function mapApiTruck(truck: ApiTruck): TruckRecord {
  if (!truck) return {} as TruckRecord; // Safety guard
  return {
    id: truck.truckID,
    plateNumber: truck.plateNumber || "N/A",
    truckType: truck.truckType || "N/A",
    truckModel: truck.model || "N/A",
    capacity: truck.capacity ? String(truck.capacity) : "",
    lastChecked: truck.lastChecked ? truck.lastChecked.split("T")[0] : "",
    status: truck.truckStatus || "Available",
    fuelTypeID: truck.fuelTypeID || "",
    // Blank when nothing is recorded rather than defaulting to diesel: the
    // fuel a truck burns decides which price series its cost is drawn from,
    // and a guess there is a wrong number that looks right.
    fuelTypeName: truck.fuelType?.name || "",
  };
}

// ==========================================
// TRUCK MODAL COMPONENT (Add / Edit)
// ==========================================

interface TruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (
    formData: Record<string, string>,
    editData?: TruckRecord | null,
  ) => Promise<void>;
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
    status: "Available",
    fuelTypeID: "",
  };

  const [formData, setFormData] = useState(initialTruckState);
  const [fuelTypes, setFuelTypes] = useState<{ fuelTypeID: string; name: string; unit: string }[]>([]);
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
    "Others",
  ];

  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isFuelDropdownOpen, setIsFuelDropdownOpen] = useState(false);

  // The button shows the chosen fuel by name; the form still stores its id.
  const selectedFuelName = fuelTypes.find((fuel) => fuel.fuelTypeID === formData.fuelTypeID)?.name ?? "";
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seeded from the truck this was opened to edit.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (editData) {
      setFormData({
        plateNumber: editData.plateNumber,
        truckType: editData.truckType,
        truckModel: editData.truckModel,
        capacity: editData.capacity,
        lastChecked: editData.lastChecked,
        status: editData.status,
        fuelTypeID: editData.fuelTypeID,
      });
    } else {
      setFormData(initialTruckState);
    }
    setErrors({});
  }, [editData, isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // The fuels this form may offer. Only the active ones come back, so a retired
  // fuel is never offered again while the trucks already on it keep their name.
  useEffect(() => {
    if (!isOpen) return;

    void apiFetch<{ data: { fuelTypeID: string; name: string; unit: string }[] }>("/api/fuel-types")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      .then((result) => setFuelTypes(result.data ?? []))
      .catch(() => setFuelTypes([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialTruckState);
    setErrors({});
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.plateNumber.trim())
      newErrors.plateNumber = "Plate number is required.";
    if (!formData.truckType) newErrors.truckType = "Type of truck is required.";
    if (!formData.truckModel.trim())
      newErrors.truckModel = "Truck model is required.";
    if (!String(formData.capacity).trim())
      newErrors.capacity = "Capacity is required.";

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
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs"
                />
                {errors.plateNumber && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.plateNumber}
                  </p>
                )}
              </div>

              {/* Both of these are the dropdown the mechanic fleet screen
                  already uses: a button and a panel rather than a native
                  select, so the two fleet forms look and behave alike. */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Truck *
                </label>
                <div
                  className={`relative w-full ${isTypeDropdownOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isTypeDropdownOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setIsTypeDropdownOpen(false)} />
                  )}
                  <button
                    type="button"
                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                    className={`w-full bg-white border rounded-md px-3 py-2 min-h-tap sm:min-h-0 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.truckType ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"}`}
                  >
                    <span className={formData.truckType ? "text-black" : "text-slate-500"}>
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
                            handleInputChange({ target: { name: "truckType", value: opt } });
                            setIsTypeDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 min-h-tap sm:min-h-0 text-xs hover:bg-slate-50 transition-colors ${formData.truckType === opt ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
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
                  Fuel Type
                </label>
                <div
                  className={`relative w-full ${isFuelDropdownOpen ? "z-70" : "z-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isFuelDropdownOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setIsFuelDropdownOpen(false)} />
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFuelDropdownOpen(!isFuelDropdownOpen)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 min-h-tap sm:min-h-0 text-xs font-normal text-black flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all"
                  >
                    <span className={selectedFuelName ? "text-black" : "text-slate-500"}>
                      {selectedFuelName || "Select fuel type"}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isFuelDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isFuelDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto text-left">
                      {fuelTypes.map((fuel) => (
                        <button
                          key={fuel.fuelTypeID}
                          type="button"
                          onClick={() => {
                            handleInputChange({ target: { name: "fuelTypeID", value: fuel.fuelTypeID } });
                            setIsFuelDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 min-h-tap sm:min-h-0 text-xs hover:bg-slate-50 transition-colors ${formData.fuelTypeID === fuel.fuelTypeID ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
                        >
                          {fuel.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Truck Model *
                </label>
                <input
                  type="text"
                  name="truckModel"
                  placeholder="e.g., Isuzu NPR"
                  value={formData.truckModel}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs"
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs"
                />
                {errors.capacity && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.capacity}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Last Checked (Optional)
                </label>
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
              className="w-full sm:w-40 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm shadow-md disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-40 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
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
  /** Opens this truck's repair history, as the mechanic's module does. */
  onHistory: () => void;
  /** Takes it off the road or puts it back, when the mechanic cannot. */
  onStatus: () => void;
}

function TruckDetailView({
  truck,
  onBack,
  onEdit,
  onDelete,
  onHistory,
  onStatus,
}: TruckDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const styles = getStatusStyles(truck.status);

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
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        {/* LEFT SIDE: Back Button + Truck Identity */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="hidden sm:block w-px h-8 bg-slate-200"></div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Truck className="w-5 h-5 text-slate-500" />
              {truck.plateNumber}
            </h2>

            <span className="px-2.5 py-0.5 rounded-full text-xs sm:text-[10px] font-medium bg-blue-100 text-blue-700">
              {truck.truckType}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs sm:text-[10px] font-medium ${styles.bgLight.split(" border")[0]}`}
            >
              {truck.status}
            </span>
            {truck.fuelTypeName && (
              <span className="px-2.5 py-0.5 rounded-full text-xs sm:text-[10px] font-medium bg-amber-100 text-amber-800">
                {truck.fuelTypeName}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* Everything about past repairs lives behind this, the same as in the
              mechanic's module - one screen, one layout, whichever side you are
              looking from. */}
          <button
            onClick={onHistory}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 md:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-slate-200 shadow-sm cursor-pointer"
          >
            <HistoryIcon className="w-4 h-4 shrink-0" />
            <span>History</span>
          </button>

          {/* Taking a truck off the road is not the same job as editing its
              plate or its capacity, and it was only reachable through the form
              that does those - which had no status field in it at all. */}
          <button
            onClick={onStatus}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 md:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-slate-200 shadow-sm cursor-pointer"
          >
            <Wrench className="w-4 h-4 shrink-0" />
            <span>Status</span>
          </button>

          <button
            onClick={() => onEdit(truck)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-3 md:py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4 shrink-0" />
            <span>Edit Truck</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-3 md:py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">
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
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8.5">
                  {truck.plateNumber || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Truck
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8.5">
                  {truck.truckType || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Fuel Type
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8.5">
                  {truck.fuelTypeName || "Not recorded"}
                </div>
              </div>
          <div>
            <label className="block text-xs font-medium text-black mb-1">
              Truck Model
            </label>
            <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8.5">
              {truck.truckModel}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-black mb-1">
              Capacity
            </label>
            <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8.5">
              {truck.capacity}
            </div>
          </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Last Checked
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8.5">
                  {truck.lastChecked || "N/A"}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Truck Record
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900">{truck.plateNumber}</strong>?
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm flex justify-center gap-2"
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

// The statuses a filter pill is offered for.
//
// The four the service will actually store, in the order an office reads them:
// what can go out today, what is out, what is being fixed, what is not coming
// back soon. The mechanic's copy of this list leads with On Maintenance, which
// is the right order for a mechanic and the wrong one here.
//
// It also carries an "Already Booked" pill. Nothing in the system writes that
// status - the truck service validates against TRUCK_STATUS, which has four -
// so that pill can only ever read (0), and it is not repeated here.
const STATUS_FILTERS = [
  "Available",
  "On Delivery",
  "On Maintenance",
  "Out of Service",
] as const;

export default function FleetStatusPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [truckList, setTruckList] = useState<TruckRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  /** Whether the selected truck's repair history is the screen being shown. */
  const [showTruckHistory, setShowTruckHistory] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  /**
   * The office putting a truck off the road, or back on it.
   *
   * The same endpoint the mechanic uses, which already audits the change, tells
   * every mechanic, and opens a maintenance log when a truck is grounded. What
   * the office adds is the reason - the server writes it in as the report that
   * started the cycle, because that is what an override is: an account of the
   * decision, not of the work.
   */
  const changeTruckStatus = async (status: TruckStatus, reason: string): Promise<string | null> => {
    if (!selectedTruck) return "No truck is selected.";

    try {
      await apiFetch(`/api/fleet-status/${selectedTruck.id}`, {
        method: "PUT",
        body: JSON.stringify({
          plateNumber: selectedTruck.plateNumber,
          truckType: selectedTruck.truckType,
          model: selectedTruck.truckModel,
          capacity: selectedTruck.capacity,
          truckStatus: status,
          lastChecked: selectedTruck.lastChecked,
          fuelTypeID: selectedTruck.fuelTypeID || null,
          reason,
        }),
      });

      // Read back rather than patched in place, so the row, the detail and the
      // counts along the top all come from the same answer.
      await fetchTrucks();
      setSelectedTruck((current) => (current ? { ...current, status } : current));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "The status could not be changed.";
    }
  };
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);

  useEffect(() => {
    // Back to page one whenever the search or the filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  const fetchTrucks = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await apiFetch<{ data?: ApiTruck[] } | ApiTruck[]>("/api/fleet-status");
      // Safety fix: handle array natively or wrapped in .data
      const trucksArray = Array.isArray(response) ? response : (response.data || []);
      setTruckList(trucksArray.map(mapApiTruck));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setTruckList([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // The rows land in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTrucks();
  }, [fetchTrucks]);

  const handleRowClick = async (id: string) => {
    try {
      setErrorMessage("");
      const response = await apiFetch<{ data?: ApiTruck } & ApiTruck>(`/api/fleet-status/${id}`);
      // Safety fix: handle object natively or wrapped in .data
      const truckData = response.data || response;
      setSelectedTruck(mapApiTruck(truckData));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleModalSubmit = async (
    formData: Record<string, string>,
    editData?: TruckRecord | null,
  ) => {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      if (editData) {
        const payload: UpdateTruckDto = {
          plateNumber: formData.plateNumber,
          truckType: formData.truckType as TruckType,
          model: formData.truckModel,
          capacity: Number(formData.capacity),
          lastChecked: formData.lastChecked || null,
          truckStatus: formData.status as TruckStatus,
          fuelTypeID: formData.fuelTypeID || null,
        };

        await apiFetch<unknown>(`/api/fleet-status/${editData.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Truck updated successfully.");
        if (selectedTruck) await handleRowClick(editData.id);
      } else {
        const payload: CreateTruckDto = {
          plateNumber: formData.plateNumber,
          truckType: formData.truckType as TruckType,
          model: formData.truckModel,
          capacity: Number(formData.capacity),
          lastChecked: formData.lastChecked || null,
          truckStatus: "Available",
          fuelTypeID: formData.fuelTypeID || null,
        };

        await apiFetch<unknown>("/api/fleet-status", {
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

  // Counted off the whole list rather than the filtered one, so the pills keep
  // saying how big the fleet is while you are looking at one part of it.
  const statusCounts = truckList.reduce<Record<string, number>>((tally, truck) => {
    tally[truck.status] = (tally[truck.status] ?? 0) + 1;
    return tally;
  }, {});

  const filteredTrucks = truckList.filter((truck) => {
    if (selectedFilter !== "All" && truck.status !== selectedFilter) return false;
    const term = searchTerm.toLowerCase();
    return (
      truck.plateNumber.toLowerCase().includes(term) ||
      truck.status.toLowerCase().includes(term) ||
      truck.truckType.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredTrucks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentTrucks = filteredTrucks.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  // The history is its own screen rather than a panel inside the detail, which is
  // how the mechanic's module does it and what the office asked to match.
  if (selectedTruck && showTruckHistory) {
    return (
      <TruckMaintenanceHistory
        truckID={selectedTruck.id}
        plateNumber={selectedTruck.plateNumber}
        onBack={() => setShowTruckHistory(false)}
      />
    );
  }

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
          onHistory={() => setShowTruckHistory(true)}
          onStatus={() => setChangingStatus(true)}
          onEdit={(truck) => {
            setEditingTruck(truck);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteTruck}
        />
        {changingStatus && (
          <TruckStatusControl
            plateNumber={selectedTruck.plateNumber}
            current={selectedTruck.status}
            onChange={changeTruckStatus}
            onClose={() => setChangingStatus(false)}
          />
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
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh]">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Fleet Status
          </h1>
          </div>
        <button
          onClick={() => {
            setEditingTruck(null);
            setIsModalOpen(true);
          }}
          className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-all duration-200 cursor-pointer"
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span>Add Truck</span>
        </button>
      </div>

      {successMessage && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
            <button
              onClick={() => setSelectedFilter("All")}
              className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "All" ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"}`}
            >
              All ({truckList.length})
            </button>

            {STATUS_FILTERS.map((status) => {
              const styles = getStatusStyles(status);
              return (
                <button
                  key={status}
                  onClick={() => setSelectedFilter(status)}
                  className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === status ? styles.tabActive : styles.bgLight}`}
                >
                  {status} ({statusCounts[status] ?? 0})
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <UrlSearchSync onQuery={setSearchTerm} />
            <input
              type="text"
              placeholder="Search by Plate No or Type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto relative z-10 min-h-75">
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
              ) : currentTrucks.length > 0 ? (
                currentTrucks.map((truck) => {
                  const currentStyles = getStatusStyles(truck.status);
                  return (
                    <tr
                      key={truck.id}
                      data-pressable
                      onClick={() => handleRowClick(truck.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-4 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 text-left">
                        <div className="font-medium text-slate-900 truncate">
                          <RowOpenButton
                            label={`View truck ${truck.plateNumber}`}
                            onOpen={() => handleRowClick(truck.id)}
                            className="max-w-full truncate"
                          >
                            {truck.plateNumber}
                          </RowOpenButton>
                          <span className="text-xs text-slate-500 font-normal ml-1 sm:ml-2">
                            — {truck.truckType}
                            {truck.fuelTypeName && (
                              <span className="ml-1.5">· {truck.fuelTypeName}</span>
                            )}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Last Checked: {truck.lastChecked || "N/A"}
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
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        No fleet records found
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {filteredTrucks.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredTrucks.length)} of{" "}
            {filteredTrucks.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || isLoading}
              className="min-h-tap md:min-h-0 inline-flex items-center justify-center px-3 py-1.5 border rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span className="mx-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={
                currentPage === totalPages || totalPages === 0 || isLoading
              }
              className="min-h-tap md:min-h-0 inline-flex items-center justify-center px-3 py-1.5 border rounded-lg disabled:opacity-50"
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