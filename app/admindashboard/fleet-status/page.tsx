// ==========================================
// LOGISCO - FLEET STATUS PAGE
// ==========================================

"use client";

import UrlSearchSync from "@/components/UrlSearchSync";
import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";
import { bookingSummary, shownTruckStatus } from "@/app/lib/truckBooking";
import RowOpenButton from "@/components/RowOpenButton";
import TruckHistory from "@/components/truck/TruckHistory";
import TruckStatusControl from "@/components/truck/TruckStatusControl";
import TruckTripCard from "@/components/truck/TruckTripCard";
import type { TruckTrip } from "@/services/truck/truckService";
import { formatDate } from "@/app/lib/datetime";
import { useIsPhone } from "@/app/lib/useIsPhone";
import { useToast } from "@/components/Toast";
import { readStoredSession } from "@/app/lib/clientSession";
import { LogMaintenanceModal } from "@/app/mechanic/fleet-status/_components/LogMaintenanceModal";
import { CurrentRepairSections, currentRepairOf, type CurrentRepair } from "@/app/mechanic/fleet-status/_components/CurrentRepair";
import { useLogPhotos } from "@/app/mechanic/fleet-status/_components/useLogPhotos";
import type { EmployeeOption, HistoryLogRecord } from "@/app/mechanic/fleet-status/_components/types";
import {
  Search,
  Truck,
  FileText,
  X,
  ArrowLeft,
  History as HistoryIcon,
  Edit3,
  Wrench,
  Ban,
  RotateCcw,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";

import type {
  Truck as ApiTruck,
  TruckStatus,
  TruckType,
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
  /** The booking it is on, when the list sent one. */
  booking: TruckTrip | null;
  /** "Already Booked" or the stored status - what the list and filters go by. */
  shownStatus: string;
}

function mapApiTruck(truck: ApiTruck & { currentTrip?: TruckTrip | null }): TruckRecord {
  if (!truck) return {} as TruckRecord; // Safety guard
  return {
    id: truck.truckID,
    // Blank rather than "N/A": these are the values the edit form is seeded
    // with, and a placeholder put here was saved back as the truck's model.
    plateNumber: truck.plateNumber || "",
    truckType: truck.truckType || "",
    truckModel: truck.model || "",
    capacity: truck.capacity ? String(truck.capacity) : "",
    lastChecked: truck.lastChecked ? truck.lastChecked.split("T")[0] : "",
    status: truck.truckStatus || "Available",
    fuelTypeID: truck.fuelTypeID || "",
    // Blank when nothing is recorded rather than defaulting to diesel: the
    // fuel a truck burns decides which price series its cost is drawn from,
    // and a guess there is a wrong number that looks right.
    fuelTypeName: truck.fuelType?.name || "",
    booking: truck.currentTrip ?? null,
    shownStatus: shownTruckStatus(truck.truckStatus || "Available", truck.currentTrip),
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
    // The same word the mechanic's form uses, so one truck is not filed two ways.
    "Other",
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
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
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
                    className={`w-full bg-white border rounded-md px-3 py-2 min-h-tap sm:pointer-fine:min-h-0 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.truckType ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"}`}
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
                          className={`w-full text-left px-3 py-2 min-h-tap sm:pointer-fine:min-h-0 text-xs hover:bg-slate-50 transition-colors ${formData.truckType === opt ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
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
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 min-h-tap sm:pointer-fine:min-h-0 text-xs font-normal text-black flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all"
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
                          className={`w-full text-left px-3 py-2 min-h-tap sm:pointer-fine:min-h-0 text-xs hover:bg-slate-50 transition-colors ${formData.fuelTypeID === fuel.fuelTypeID ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
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

          <div className="flex flex-row items-center justify-end sm:justify-center gap-2 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isSubmitting}
              className="w-auto sm:w-40 py-2 sm:py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md disabled:opacity-50 px-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-auto sm:w-40 py-2 sm:py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 px-3"
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
  /** The booking it is on, if any. */
  trip: TruckTrip | null;
  onBack: () => void;
  onEdit: (truckRecord: TruckRecord) => void;
  /** Retires it: the server's soft delete, which keeps its history. */
  onDelete: (id: string) => Promise<void>;
  /** Opened from the archive, where the only action is to bring it back. */
  isArchived: boolean;
  onRestore: (id: string) => Promise<void>;
  /** Opens this truck's repair history, as the mechanic's module does. */
  onHistory: () => void;
  /** Takes it off the road or puts it back, when the mechanic cannot. */
  onStatus: () => void;
  /** The repair it is in the middle of, read as the mechanic's page reads it. */
  repair: CurrentRepair;
  /** The mechanic's Maintenance Update Form, filed from the office. */
  onMaintenanceUpdate: () => void;
  /** The final maintenance log, which finishes the repair and returns the truck to Available. */
  onFinalLog: () => void;
}

function TruckDetailView({
  truck,
  trip,
  onBack,
  onEdit,
  onDelete,
  isArchived,
  onRestore,
  onHistory,
  onStatus,
  repair,
  onMaintenanceUpdate,
  onFinalLog,
}: TruckDetailViewProps) {
  // Being repaired, here or by an outside company - what the mechanic's page
  // calls under maintenance.
  const isGrounded = truck.status === "On Maintenance" || truck.status === "Out of Service";
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const shownStatus = shownTruckStatus(truck.status, trip);
  const styles = getStatusStyles(shownStatus);

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
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0"
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
              {shownStatus}
            </span>
            {truck.fuelTypeName && (
              <span className="px-2.5 py-0.5 rounded-full text-xs sm:text-[10px] font-medium bg-amber-100 text-amber-800">
                {truck.fuelTypeName}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* Everything about past repairs lives behind this, the same as in the
              mechanic's module - one screen, one layout, whichever side you are
              looking from. */}
          <button
            onClick={onHistory}
            className="flex-none md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-slate-200 shadow-sm cursor-pointer"
          >
            <HistoryIcon className="w-4 h-4 shrink-0" />
            <span>History</span>
          </button>

          {/* The same form the mechanics use, so the office can record an
              inspection or a progress update on a truck being repaired. */}
          {!isArchived && isGrounded && (
            <button
              onClick={onMaintenanceUpdate}
              className="flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-amber-200 shadow-sm cursor-pointer"
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span>Maintenance Update Form</span>
            </button>
          )}

          {/* Finishing the repair the way a mechanic does: the final log -
              work performed, remarks, a photo - and the truck is Available. */}
          {!isArchived && isGrounded && (
            <button
              onClick={onFinalLog}
              className="flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-emerald-200 shadow-sm cursor-pointer"
            >
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span>Final Maintenance Log</span>
            </button>
          )}

          {/* Taking a truck off the road is not the same job as editing its
              plate or its capacity, and it was only reachable through the form
              that does those - which had no status field in it at all. */}
          {isArchived ? (
            <button
              onClick={() => void onRestore(truck.id)}
              className="flex-none md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-emerald-600 hover:bg-black text-white px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Restore Truck</span>
            </button>
          ) : (
            <>
              <button
                onClick={onStatus}
                className="flex-none md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-slate-200 shadow-sm cursor-pointer"
              >
                <Wrench className="w-4 h-4 shrink-0" />
                <span>Status</span>
              </button>

              <button
                onClick={() => onEdit(truck)}
                className="flex-none md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
              >
                <Edit3 className="w-4 h-4 shrink-0" />
                <span>Edit Truck</span>
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex-none md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 sm:py-3 md:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
              >
                <Ban className="w-4 h-4 shrink-0" />
                <span>Disable</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">
        <div className="space-y-6 text-sm text-slate-900">
          {trip && <TruckTripCard trip={trip} />}
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
                  {truck.plateNumber || "—"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Truck
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8.5">
                  {truck.truckType || "—"}
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
              {truck.truckModel || "—"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-black mb-1">
              Capacity
            </label>
            <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8.5">
              {truck.capacity ? `${truck.capacity} kg` : "N/A"}
            </div>
          </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Last Checked
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-8.5">
                  {truck.lastChecked ? formatDate(truck.lastChecked) : "Not recorded"}
                </div>
              </div>
            </div>
          </div>

          {/* The repair under way - its inspection and progress updates -
              exactly as the mechanic's truck page shows it. */}
          <CurrentRepairSections repair={repair} show={isGrounded && !isArchived} />
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center my-auto">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Disable Truck
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              <strong className="text-slate-900">{truck.plateNumber}</strong> will
              be disabled: it leaves the fleet and can no longer be booked. Its
              history is kept, and it can be restored from Disabled Trucks.
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
                Disable
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

// The statuses a filter pill is offered for, in the order an office reads them:
// what can go out today, what is booked, what is out, what is being fixed, what
// is not coming back soon. The mechanic's copy of this list leads with On
// Maintenance, which is the right order for a mechanic and the wrong one here.
//
// "Already Booked" is not stored. A truck on a booking is "On Delivery" on its
// record; the list calls it booked until the crew starts the trip.
const STATUS_FILTERS = [
  "Available",
  "Already Booked",
  "On Delivery",
  "On Maintenance",
  "Out of Service",
] as const;

export default function FleetStatusPage() {
  // The full search hint is cut off in a phone-width box.
  const isPhone = useIsPhone();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [truckList, setTruckList] = useState<TruckRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Messages go through the same pop-up notice as every other screen. This
  // page had its own banners - pinned to a corner over a truck, inline over the
  // list - in a style found nowhere else.
  const showToast = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TruckTrip | null>(null);
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
      // Only the status and why. This sent the whole truck as the screen last
      // saw it, so a blank model went back as the "N/A" the screen shows for it.
      await apiFetch(`/api/fleet-status/${selectedTruck.id}`, {
        method: "PUT",
        body: JSON.stringify({ truckStatus: status, reason }),
      });

      // Read back rather than patched in place, so the row, the detail and the
      // counts along the top all come from the same answer.
      await fetchTrucks();
      await handleRowClick(selectedTruck.id);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "The status could not be changed.";
    }
  };
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // The maintenance logs and mechanics the mechanic's page works from, so the
  // office can see the repair under way and file the same forms.
  const [maintenanceLogs, setMaintenanceLogs] = useState<HistoryLogRecord[]>([]);
  const [mechanics, setMechanics] = useState<EmployeeOption[]>([]);
  const [logForm, setLogForm] = useState<{ type: "inspection" | "update" | "log"; pending: { status: TruckStatus; reason: string } | null } | null>(null);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const { logs: logsWithPhotos, seed: seedLogPhotos } = useLogPhotos(maintenanceLogs, selectedTruck?.id);

  const fetchMaintenanceLogs = useCallback(async () => {
    try {
      const result = await apiFetch<{ data?: (HistoryLogRecord & { createdAt?: string })[] }>("/api/historyLogsM", { cache: "no-store" });
      setMaintenanceLogs(
        (result.data ?? [])
          .map((log) => ({ ...log, created_at: log.created_at ?? log.createdAt }))
          .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()),
      );
    } catch {
      // The truck page still works without them; the repair sections stay empty.
    }
  }, []);

  useEffect(() => {
    // The rows land in network callbacks, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMaintenanceLogs();
    void apiFetch<{ data?: { employeeID: string; employeeName: string; role: string }[] }>(
      "/api/employees?page=1&limit=100&role=Mechanic&isActive=true",
    )
      .then((result) => setMechanics((result.data ?? []).map((e) => ({ employeeID: e.employeeID, employeeName: e.employeeName, role: e.role }))))
      .catch(() => setMechanics([]));
  }, [fetchMaintenanceLogs]);

  const officeUser = (() => {
    const session = readStoredSession();
    return { employeeID: session?.id ?? "", employeeName: session?.employeeName ?? "Office" };
  })();

  useEffect(() => {
    // Back to page one whenever the search or the filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  const saveOfficeLog = async (formData: Record<string, string>) => {
    if (!selectedTruck || !logForm || isSavingLog) return;
    setIsSavingLog(true);
    try {
      const saved = await apiFetch<{ data?: { id?: string } }>("/api/historyLogsM", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          statusBefore: selectedTruck.status,
          statusAfter: logForm.pending?.status ?? selectedTruck.status,
        }),
      });
      if (saved?.data?.id) {
        seedLogPhotos(saved.data.id, {
          preliminary: formData.preliminaryPhotoUrl,
          progress: formData.progressPhotoUrl,
          final: formData.photoUrl,
        });
      }
      // The status change this log was written for, flagged so the server
      // does not open a second, empty log beside it.
      if (logForm.pending) {
        await apiFetch(`/api/fleet-status/${selectedTruck.id}`, {
          method: "PUT",
          body: JSON.stringify({ truckStatus: logForm.pending.status, reason: logForm.pending.reason, logOpened: true }),
        });
        await fetchTrucks();
        await handleRowClick(selectedTruck.id);
      }
      await fetchMaintenanceLogs();
      showToast(logForm.pending ? "Final log saved. The truck is available again." : "Maintenance log saved.", "success");
      setLogForm(null);
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    } finally {
      setIsSavingLog(false);
    }
  };

  const fetchTrucks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch<{ data?: ApiTruck[] } | ApiTruck[]>(
        showArchived ? "/api/fleet-status?archived=true" : "/api/fleet-status",
      );
      // Safety fix: handle array natively or wrapped in .data
      const trucksArray = Array.isArray(response) ? response : (response.data || []);
      setTruckList(trucksArray.map(mapApiTruck));
    } catch (error) {
      showToast(getErrorMessage(error), "error");
      setTruckList([]);
    } finally {
      setIsLoading(false);
    }
  }, [showArchived, showToast]);

  useEffect(() => {
    // The rows land in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTrucks();
  }, [fetchTrucks]);

  const handleRowClick = async (id: string) => {
    try {
      const response = await apiFetch<{ data?: ApiTruck; currentTrip?: TruckTrip | null } & ApiTruck>(`/api/fleet-status/${id}`);
      // Safety fix: handle object natively or wrapped in .data
      const truckData = response.data || response;
      setSelectedTruck(mapApiTruck(truckData));
      setSelectedTrip(response.currentTrip ?? null);
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  };

  const handleModalSubmit = async (
    formData: Record<string, string>,
    editData?: TruckRecord | null,
  ) => {
    try {

      // Capacity goes as typed: the server keeps the number in it, so "5000 kg"
      // is 5000. Number("5000 kg") here was NaN, which arrived as null - an edit
      // quietly ignored it and adding a truck was refused for having none.
      const details = {
        plateNumber: formData.plateNumber.trim(),
        truckType: formData.truckType as TruckType,
        model: formData.truckModel.trim(),
        capacity: formData.capacity,
        lastChecked: formData.lastChecked || null,
        fuelTypeID: formData.fuelTypeID || null,
      };

      if (editData) {
        // PUT, which is what the route answers; this sent PATCH, which it does
        // not, so every edit from this screen failed. The status is left out:
        // it is changed through Status, and the form's copy could be stale.
        await apiFetch<unknown>(`/api/fleet-status/${editData.id}`, {
          method: "PUT",
          body: JSON.stringify(details),
        });

        showToast("Truck updated successfully.");
        if (selectedTruck) await handleRowClick(editData.id);
      } else {
        await apiFetch<unknown>("/api/fleet-status", {
          method: "POST",
          body: JSON.stringify({ ...details, truckStatus: "Available" }),
        });

        showToast("Truck added successfully.");
      }

      await fetchTrucks();
    } catch (error) {
      const msg = getErrorMessage(error);
      showToast(msg, "error");
      throw error;
    }
  };

  const handleDeleteTruck = async (id: string) => {
    try {
      await apiFetch(`/api/fleet-status/${id}`, { method: "DELETE" });
      setSelectedTruck(null);
      showToast("Truck disabled. It can be restored from Disabled Trucks.");
      await fetchTrucks();
    } catch (error) {
      showToast(getErrorMessage(error), "error");
      throw error;
    }
  };

  const handleRestoreTruck = async (id: string) => {
    try {
      await apiFetch(`/api/fleet-status/${id}`, {
        method: "PUT",
        body: JSON.stringify({ restore: true }),
      });
      setSelectedTruck(null);
      showToast("Truck restored. It is back in the fleet and available.");
      await fetchTrucks();
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  };

  // Counted off the whole list rather than the filtered one, so the pills keep
  // saying how big the fleet is while you are looking at one part of it.
  const statusCounts = truckList.reduce<Record<string, number>>((tally, truck) => {
    tally[truck.shownStatus] = (tally[truck.shownStatus] ?? 0) + 1;
    return tally;
  }, {});

  const filteredTrucks = truckList.filter((truck) => {
    if (selectedFilter !== "All" && truck.shownStatus !== selectedFilter) return false;
    const term = searchTerm.toLowerCase();
    return (
      truck.plateNumber.toLowerCase().includes(term) ||
      truck.shownStatus.toLowerCase().includes(term) ||
      (truck.booking?.orderCode ?? "").toLowerCase().includes(term) ||
      (truck.booking?.clientName ?? "").toLowerCase().includes(term) ||
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
  // how the mechanic's module does it and what the office asked to match. It
  // holds every update - repairs and record changes - and opens each one.
  if (selectedTruck && showTruckHistory) {
    return (
      <TruckHistory
        truckID={selectedTruck.id}
        plateNumber={selectedTruck.plateNumber}
        onBack={() => setShowTruckHistory(false)}
      />
    );
  }

  // The repair the open truck is in the middle of.
  const selectedRepair = currentRepairOf(
    { id: selectedTruck?.id ?? "", plateNumber: selectedTruck?.plateNumber ?? "" },
    logsWithPhotos,
  );

  if (selectedTruck) {
    return (
      <>
        <LogMaintenanceModal
          isOpen={logForm !== null}
          onClose={() => setLogForm(null)}
          onSubmitSuccess={(formData) => void saveOfficeLog(formData)}
          editData={null}
          trucksOptions={[{ truckID: selectedTruck.id, plateNumber: selectedTruck.plateNumber, truckType: selectedTruck.truckType }]}
          mechanicsOptions={mechanics}
          preselectedTruckId={selectedTruck.id}
          formType={logForm?.type ?? "update"}
          loggedInMechanic={officeUser}
          inheritedAdditionalMechanicID={selectedRepair.activeLog?.additionalMechanicID ? String(selectedRepair.activeLog.additionalMechanicID) : ""}
          isSaving={isSavingLog}
          chooseMechanic
          defaultPrimaryMechanicID={selectedRepair.activeLog?.primaryMechanicID ? String(selectedRepair.activeLog.primaryMechanicID) : ""}
        />
        <TruckDetailView
          truck={selectedTruck}
          trip={selectedTrip}
          onBack={() => setSelectedTruck(null)}
          onHistory={() => setShowTruckHistory(true)}
          onStatus={() => setChangingStatus(true)}
          onEdit={(truck) => {
            setEditingTruck(truck);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteTruck}
          isArchived={showArchived}
          onRestore={handleRestoreTruck}
          repair={selectedRepair}
          onMaintenanceUpdate={() =>
            setLogForm({ type: selectedRepair.inProgress ? "update" : "inspection", pending: null })
          }
          onFinalLog={() =>
            setLogForm({ type: "log", pending: { status: "Available" as TruckStatus, reason: "Repair finished - final maintenance log filed." } })
          }
        />
        {changingStatus && (
          <TruckStatusControl
            plateNumber={selectedTruck.plateNumber}
            current={selectedTruck.status}
            trip={selectedTrip}
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
      <div className="mb-6 flex flex-row flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {showArchived ? "Disabled Trucks" : "Fleet Status"}
          </h1>
          </div>
        <div className="flex flex-row gap-2">
          <button
            onClick={() => {
              setShowArchived(!showArchived);
              setSelectedFilter("All");
              setCurrentPage(1);
            }}
            className="w-auto sm:w-44 h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl shadow-sm transition-all duration-200 border border-slate-300 cursor-pointer px-3"
          >
            <Ban className="w-4 h-4 shrink-0" />
            <span>{showArchived ? "Active Fleet" : "Disabled Trucks"}</span>
          </button>
          {!showArchived && (
            <button
              onClick={() => {
                setEditingTruck(null);
                setIsModalOpen(true);
              }}
              className="w-auto sm:w-40 h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-700 hover:bg-black text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl shadow-md transition-all duration-200 cursor-pointer px-3"
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>Add Truck</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 w-full lg:w-auto lg:min-w-0 md:flex-wrap overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            <button
              onClick={() => setSelectedFilter("All")}
              className={`min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "All" ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"}`}
            >
              All ({truckList.length})
            </button>

            {/* The archive is one list; the status pills belong to the fleet. */}
            {!showArchived && STATUS_FILTERS.map((status) => {
              const styles = getStatusStyles(status);
              return (
                <button
                  key={status}
                  onClick={() => setSelectedFilter(status)}
                  className={`min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === status ? styles.tabActive : styles.bgLight}`}
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
              placeholder={isPhone ? "Search trucks…" : "Search by Plate No, Type or Booking..."}
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
                  const currentStyles = getStatusStyles(truck.shownStatus);
                  return (
                    <tr
                      key={truck.id}
                      data-pressable
                      onClick={() => handleRowClick(truck.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-4 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 text-left">
                        <div className="font-medium text-slate-900 sm:truncate">
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
                          Last Checked: {truck.lastChecked ? formatDate(truck.lastChecked) : "Not recorded"}
                        </div>
                        {truck.booking && (
                          <div className="text-xs text-blue-700 mt-1 break-words">
                            {bookingSummary(truck.booking)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 text-right">
                        <div className="relative inline-block text-right z-10">
                          <div
                            className={`w-28 sm:w-36 h-8 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md border shadow-xs ${currentStyles.btn}`}
                          >
                            <span>{truck.shownStatus}</span>
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
          {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || isLoading}
              className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center px-3 py-1.5 border rounded-lg disabled:opacity-50"
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
              className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center px-3 py-1.5 border rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
          )}
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