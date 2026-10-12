"use client";

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
import { captureMethod, checkRepairPhoto, loadRepairPhotoModel } from "./repairPhotoCheck";

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
  /**
   * Opened by the office rather than a mechanic: the primary mechanic is chosen
   * from the list - it defaults to whoever is on the repair - instead of being
   * the person signed in, who is not the one doing the work.
   */
  chooseMechanic?: boolean;
  defaultPrimaryMechanicID?: string;
}

export function LogMaintenanceModal({ isOpen, onClose, onSubmitSuccess, editData, trucksOptions, mechanicsOptions, preselectedTruckId, formType = "log", loggedInMechanic, inheritedAdditionalMechanicID, isSaving, chooseMechanic = false, defaultPrimaryMechanicID = "" }: LogMaintenanceModalProps) {
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
    // What the photo check found, sent with the photo for the server to keep.
    preliminaryPhotoReport: "",
    progressPhotoReport: "",
    photoReport: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [isTruckDropdownOpen, setIsTruckDropdownOpen] = useState(false);
  const [isPrimaryDropdownOpen, setIsPrimaryDropdownOpen] = useState(false);
  const [isAdditionalDropdownOpen, setIsAdditionalDropdownOpen] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // While the picture is being looked at; saving waits for it.
  const [checkingPhoto, setCheckingPhoto] = useState(false);

  // The model is ~14 MB: started as the form opens, so it is usually ready by
  // the time a photo is taken. A failure here is retried on the photo itself.
  useEffect(() => {
    if (isOpen) void loadRepairPhotoModel().catch(() => undefined);
  }, [isOpen]);

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
      report: "preliminaryPhotoReport",
      hasPhoto: "hasPreliminaryPhoto",
    },
    update: {
      issue: "additionalIssue",
      remarks: "progressRemarks",
      photo: "progressPhotoUrl",
      report: "progressPhotoReport",
      hasPhoto: "hasProgressPhoto",
    },
    log: { issue: "issue", remarks: "remarks", photo: "photoUrl", report: "photoReport", hasPhoto: "hasFinalPhoto" },
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
          : chooseMechanic
            ? defaultPrimaryMechanicID
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
        primaryMechanicID: chooseMechanic ? defaultPrimaryMechanicID : String(loggedInMechanic.employeeID),
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
    chooseMechanic,
    defaultPrimaryMechanicID,
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

  // Every photo is looked at on this device before it can be saved: it has to
  // show a truck, a part of one, or the work on it (app/lib/repairPhoto.ts).
  // One that does not is dropped and the mechanic takes another.
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    // So the same picture can be picked again after a refusal.
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, [activeFields.photo]: "Please choose an image." }));
      return;
    }

    setCheckingPhoto(true);
    setErrors((prev) => ({ ...prev, [activeFields.photo]: "" }));
    try {
      const checked = await checkRepairPhoto(file);
      if (checked.verdict?.verdict === "refused") {
        setFormData((prev) => ({ ...prev, [activeFields.photo]: "", [activeFields.report]: "" }));
        setErrors((prev) => ({ ...prev, [activeFields.photo]: checked.verdict?.reason ?? "This photo was not accepted." }));
        return;
      }
      setFormData((prev) => ({
        ...prev,
        [activeFields.photo]: checked.dataUrl,
        [activeFields.report]: JSON.stringify(checked.report),
      }));
      if (!checked.report.checked) {
        showToast("The photo could not be checked on this device. It will be saved for the office to review.", "info");
      }
    } catch {
      showToast("Could not read that image. Please take or choose a different photo.", "error");
    } finally {
      setCheckingPhoto(false);
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

    // Required - a log the office writes may leave it out. When editing, the
    // photo already on the log counts.
    const hasPhoto =
      Boolean(formData[activeFields.photo]) ||
      Boolean(editData && (editData as unknown as Record<string, unknown>)[activeFields.hasPhoto]);
    if (!hasPhoto && !chooseMechanic) {
      newErrors[activeFields.photo] = "A photo is required.";
    }
    if (checkingPhoto) {
      newErrors[activeFields.photo] = "Wait for the photo check to finish.";
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

  const inApp = captureMethod() === "camera";
  const photoLabel = (hasOne: boolean) =>
    inApp ? (hasOne ? "Retake Photo" : "Take Photo") : hasOne ? "Change Photo" : "Choose Photo";

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
            aria-label="Close"
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
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
                    className={`min-h-tap md:pointer-fine:min-h-0 w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.truckID ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"} ${preselectedTruckId ? "opacity-75 cursor-not-allowed bg-slate-50" : ""}`}
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
                          className={`min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-start w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${String(formData.truckID) === String(truck.truckID) ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}
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
                {chooseMechanic ? (
                  <div className="relative">
                    <select
                      name="primaryMechanicID"
                      value={formData.primaryMechanicID || ""}
                      onChange={handleInputChange}
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 appearance-none cursor-pointer ${errors.primaryMechanicID ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    >
                      <option value="">Select the mechanic who did the work...</option>
                      {mechanicsOptions
                        .filter((emp) => String(emp.employeeID) !== String(formData.additionalMechanicID))
                        .map((mech) => (
                          <option key={mech.employeeID} value={String(mech.employeeID)}>
                            {mech.employeeName}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : (
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 font-medium cursor-not-allowed">
                  {/* An unassigned log is taken by whoever edits it. */}
                  {editData?.primaryMechanicID
                    ? editData.mechanicName
                    : loggedInMechanic.employeeName}
                </div>
                )}
                {chooseMechanic && errors.primaryMechanicID && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">{errors.primaryMechanicID}</p>
                )}
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
                {editData ? "Update Maintenance Photo" : "Maintenance Photo"}
                {!chooseMechanic && " *"}
              </label>
              <p className="text-xs sm:text-[11px] text-slate-500 mb-1">
                A photo of the truck or the work on it. It is checked on this device before it can be saved.
              </p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  disabled={checkingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className="disabled:opacity-60 disabled:cursor-wait min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-300 cursor-pointer"
                >
                  {checkingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{" "}
                  {photoLabel(Boolean(formData[activeFields.photo]))}
                </button>
                <span className="text-xs text-slate-500 truncate max-w-xs" aria-live="polite">
                  {checkingPhoto
                    ? "Checking photo…"
                    : !formData[activeFields.photo]
                      ? "No photo yet"
                      : !formData[activeFields.report]
                        ? "Photo on file"
                        : formData[activeFields.report].includes('"checked":true')
                          ? "Photo checked and attached"
                          : "Photo attached, not checked - the office will review it"}
                </span>
                {/* In the app, straight from the camera: a photo taken now,
                    at the truck, not one from the gallery. */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture={inApp ? "environment" : undefined}
                  onChange={(event) => void handleFileChange(event)}
                  className="hidden"
                />
              </div>
              {errors[activeFields.photo] && (
                <p role="alert" className="text-red-500 text-xs sm:text-[11px] mt-1">{errors[activeFields.photo]}</p>
              )}
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

          <div className="flex flex-row items-center justify-end sm:justify-center gap-2 sm:gap-4 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleCloseModal} style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }} className="w-auto sm:w-40 py-2 sm:py-2.5 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 cursor-pointer px-3">Cancel</button>
            <button type="submit" disabled={isSaving} style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }} className={`w-auto sm:w-40 py-2 sm:py-2.5 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center cursor-pointer px-3 ${isSaving ? "opacity-70 cursor-not-allowed" : "hover:opacity-95"} px-3 sm:px-4`}>
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
