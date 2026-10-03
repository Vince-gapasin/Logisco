"use client";

import { compressImageToDataUrl } from "@/app/lib/imageCompression";
import React, { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import {
  X,
  ChevronDown,
  Upload,
  Loader2,
} from "lucide-react";
import type { EmployeeOption, HistoryLogRecord, TruckOption } from "./types";
import { formatInputDate } from "./dates";
import { ImageModal } from "./ImageModal";

// ==========================================
// LOG MAINTENANCE MODAL (ADD/EDIT LOGS)
// ==========================================
interface LogMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (formData: Record<string, string>) => void;
  editData?: HistoryLogRecord | null;
  trucksOptions: TruckOption[];
  mechanicsOptions: EmployeeOption[];
  preselectedTruckId?: string | number | null;
  formType?: "inspection" | "update" | "log";
  loggedInMechanic: { employeeID: string | number; employeeName: string };
  inheritedAdditionalMechanicID?: string; 
  isSaving?: boolean;
}

export function LogMaintenanceModal({ isOpen, onClose, onSubmitSuccess, editData, trucksOptions, mechanicsOptions, preselectedTruckId, formType = "log", loggedInMechanic, inheritedAdditionalMechanicID, isSaving }: LogMaintenanceModalProps) {
  const showToast = useToast();
  const initialFormState: Record<string, string> = {
    date: "",
    truckID: "",
    primaryMechanicID: "",
    additionalMechanicID: "",
    issue: "",
    remarks: "",
    photoUrl: "",
    driversReport: "",
    preliminaryRemarks: "",
    preliminaryPhotoUrl: "",
    additionalIssue: "",
    progressRemarks: "",
    progressPhotoUrl: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [isTruckDropdownOpen, setIsTruckDropdownOpen] = useState(false);
  const [isPrimaryDropdownOpen, setIsPrimaryDropdownOpen] = useState(false);
  const [isAdditionalDropdownOpen, setIsAdditionalDropdownOpen] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const fieldMapping = {
    inspection: {
      issue: "driversReport",
      remarks: "preliminaryRemarks",
      photo: "preliminaryPhotoUrl",
    },
    update: {
      issue: "additionalIssue",
      remarks: "progressRemarks",
      photo: "progressPhotoUrl",
    },
    log: { issue: "issue", remarks: "remarks", photo: "photoUrl" },
  };
  const activeFields = fieldMapping[formType] || fieldMapping.log;

  // 3. Add `today` and `loggedInMechanic` to the dependency array
  // Seeded from the log this was opened to edit.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (editData) {
      setFormData({
        // --- UPDATED: Use the new helper to stop the edit form from shifting the date back ---
        date: editData.date ? formatInputDate(editData.date) : "",
        truckID: editData.truckID ? String(editData.truckID) : "",
        primaryMechanicID: editData.primaryMechanicID
          ? String(editData.primaryMechanicID)
          : String(loggedInMechanic.employeeID),
        additionalMechanicID: editData.additionalMechanicID
          ? String(editData.additionalMechanicID)
          : "",
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
      setFormData({
        ...initialFormState,
        date: today,
        truckID: preselectedTruckId ? String(preselectedTruckId) : "",
        primaryMechanicID: String(loggedInMechanic.employeeID),
        additionalMechanicID: inheritedAdditionalMechanicID || "",
      });
    }
  }, [
  /* eslint-enable react-hooks/set-state-in-effect */
    editData,
    isOpen,
    preselectedTruckId,
    today,
    loggedInMechanic,
    inheritedAdditionalMechanicID,
  ]);

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
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Stored as a data URL in LogPhotos, so keep it small.
      compressImageToDataUrl(file)
        .then((dataUrl) =>
          setFormData((prev) => ({
            ...prev,
            [activeFields.photo]: dataUrl,
          })),
        )
        .catch(() => showToast("Could not read that image. Please choose a different photo.", "error"));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = "Date is required.";
    else if (formData.date > today)
      newErrors.date = "Future dates are not allowed.";
    if (!formData.truckID) newErrors.truckID = "Truck selection is required.";
    if (!formData.primaryMechanicID)
      newErrors.primaryMechanicID = "Primary mechanic is required.";

    const issueValue = String(
      formData[activeFields.issue] || "",
    ).trim();
    if (!issueValue) {
      newErrors[activeFields.issue] =
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
            {formType === "inspection"
              ? "Maintenance Inspection Form"
              : formType === "update"
                ? "Maintenance Update Form"
                : editData
                  ? "Edit Maintenance Log"
                  : "Maintenance Log Form"}
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
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.date ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.date && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">{errors.date}</p>
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
                    className={`min-h-tap md:min-h-0 w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.truckID ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"} ${preselectedTruckId ? "opacity-75 cursor-not-allowed bg-slate-50" : ""}`}
                  >
                    <span
                      className={
                        formData.truckID
                          ? "text-black truncate pr-2"
                          : "text-slate-500"
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
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto text-left">
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
                          className={`min-h-tap md:min-h-0 inline-flex items-center justify-start w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${String(formData.truckID) === String(truck.truckID) ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
                        >
                          {truck.plateNumber} — {truck.truckType}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.truckID && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.truckID}
                  </p>
                )}
              </div>

              {/* Primary Mechanic (Auto-filled & Read-only) */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Primary Mechanic *
                </label>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 font-medium cursor-not-allowed">
                  {editData
                    ? editData.mechanicName
                    : loggedInMechanic.employeeName}
                </div>
                {/* Hidden input preserves the value for form submission */}
                <input
                  type="hidden"
                  name="primaryMechanicID"
                  value={formData.primaryMechanicID}
                />
              </div>

              {/* Additional Mechanic */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Additional Mechanic (Optional)
                </label>
                <div className="relative">
                  <select
                    name="additionalMechanicID"
                    value={formData.additionalMechanicID || ""}
                    onChange={handleInputChange}
                    disabled={!formData.primaryMechanicID}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 appearance-none ${!formData.primaryMechanicID ? "opacity-60 cursor-not-allowed bg-slate-50" : "cursor-pointer"} ${errors.additionalMechanicID ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  >
                    <option value="">Select Mechanic...</option>
                    {mechanicsOptions
                      .filter(
                        (emp) =>
                          String(emp.employeeID) !==
                          String(formData.primaryMechanicID),
                      )
                      .map((mech) => (
                        <option
                          key={mech.employeeID}
                          value={String(mech.employeeID)}
                        >
                          {mech.employeeName}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {errors.additionalMechanicID && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors.additionalMechanicID}
                  </p>
                )}
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
                  {formType === "inspection"
                    ? "Issue To Fix *"
                    : formType === "update"
                      ? "Additional Issue *"
                      : "Work Performed *"}
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
                  value={formData[activeFields.issue]}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors[activeFields.issue] ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors[activeFields.issue] && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
                    {errors[activeFields.issue]}
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
                  name={activeFields.remarks}
                  rows={5}
                  placeholder="Any additional notes, future recommendations, or observations..."
                  value={formData[activeFields.remarks]}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              3. {editData ? "Photo Evidence" : "Upload Attachment"}
            </div>
            <div>
              <label className="block text-xs font-medium text-black mb-1">
                {editData
                  ? "Update Maintenance Photo"
                  : "Upload Maintenance Photo (Optional)"}
              </label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-tap md:min-h-0 inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-300 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />{" "}
                  {formData[activeFields.photo]
                    ? "Change File"
                    : "Choose File"}
                </button>
                <span className="text-xs text-slate-500 truncate max-w-xs">
                  {formData[activeFields.photo]
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
              {formData[activeFields.photo] && (
                <div className="mt-3 relative w-24 h-24 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                  <img
                    src={formData[activeFields.photo]}
                    alt="Preview"
                    onClick={() =>
                      setZoomedImage(formData[activeFields.photo])
                    }
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleCloseModal} style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }} className="w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 cursor-pointer">Cancel</button>
            <button type="submit" disabled={isSaving} style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }} className={`w-full sm:w-40 py-2.5 text-white font-semibold rounded-xl text-sm shadow-md transition-all flex items-center justify-center cursor-pointer ${isSaving ? "opacity-70 cursor-not-allowed" : "hover:opacity-95"}`}>
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : editData ? "Save Changes" : "Save Log"}
            </button>
          </div>
        </form>
      </div>
      {zoomedImage && (
        <ImageModal src={zoomedImage} onClose={() => setZoomedImage(null)} />
      )}
    </div>
  );
}
