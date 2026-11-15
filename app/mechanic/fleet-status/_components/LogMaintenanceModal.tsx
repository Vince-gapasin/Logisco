"use client";

import React, { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import {
  X,
  ChevronDown,
  Upload,
  Loader2,
  Images,
} from "lucide-react";
import { MAX_LOG_PHOTOS, MAX_LOG_UPLOAD_BYTES, type EmployeeOption, type HistoryLogRecord, type LogPhoto, type LogPhotoChanges, type TruckOption } from "./types";
import { formatInputDate } from "./dates";
import { ImageModal } from "./ImageModal";
import { captureMethod, checkRepairPhoto, loadRepairPhotoModel } from "./repairPhotoCheck";
import type { RepairPhotoReport } from "@/app/lib/repairPhoto";
import { apiFetch } from "@/app/lib/apiClient";

// ==========================================
// LOG MAINTENANCE MODAL (ADD/EDIT LOGS)
// ==========================================
interface LogMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (formData: Record<string, string>, photos: LogPhotoChanges) => void;
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
    driversReport: "",
    preliminaryRemarks: "",
    additionalIssue: "",
    progressRemarks: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  // The phase's new photos, each with what the check on this device found,
  // and the ones on file the mechanic took off. Only these travel on save.
  const [newPhotos, setNewPhotos] = useState<{ key: number; dataUrl: string; report: RepairPhotoReport }[]>([]);
  const [removedPhotoIDs, setRemovedPhotoIDs] = useState<string[]>([]);
  const photoKey = useRef(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [isTruckDropdownOpen, setIsTruckDropdownOpen] = useState(false);
  const [isPrimaryDropdownOpen, setIsPrimaryDropdownOpen] = useState(false);
  const [isAdditionalDropdownOpen, setIsAdditionalDropdownOpen] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  // While the picture is being looked at; saving waits for it.
  const [checkingPhoto, setCheckingPhoto] = useState(false);

  // The model is ~14 MB: started as the form opens, so it is usually ready by
  // the time a photo is taken. A failure here is retried on the photo itself.
  useEffect(() => {
    if (isOpen) void loadRepairPhotoModel().catch(() => undefined);
  }, [isOpen]);

  // The office's mechanic-photo switch, read as the form opens. Relaxed, a
  // photo the check would refuse is kept and marked for the office instead.
  // The server decides either way; strict until it says otherwise.
  const [photoCheckRelaxed, setPhotoCheckRelaxed] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    apiFetch<{ data: { repairPhotoCheck?: { mode?: string } } }>("/api/settings/photo-checks", { cache: "no-store" })
      .then((res) => {
        if (active) setPhotoCheckRelaxed(res.data?.repairPhotoCheck?.mode === "relaxed");
      })
      .catch((error) => console.error("Could not read the photo check setting:", error));
    return () => {
      active = false;
    };
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
      // The key its errors are kept under.
      photo: "photo",
      phase: "Preliminary",
      photos: "preliminaryPhotos",
      hasPhoto: "hasPreliminaryPhoto",
    },
    update: {
      issue: "additionalIssue",
      remarks: "progressRemarks",
      photo: "photo",
      phase: "Progress",
      photos: "progressPhotos",
      hasPhoto: "hasProgressPhoto",
    },
    log: { issue: "issue", remarks: "remarks", photo: "photo", phase: "Final", photos: "finalPhotos", hasPhoto: "hasFinalPhoto" },
  } as const;
  const activeFields = fieldMapping[formType] || fieldMapping.log;

  const editRecord = editData as unknown as Record<string, unknown> | null | undefined;
  // The phase's photos on file, less the ones taken off in this form.
  const onFilePhotos = (editRecord?.[activeFields.photos] as LogPhoto[] | undefined) ?? [];
  const keptPhotos = onFilePhotos.filter((photo) => !removedPhotoIDs.includes(photo.id));
  // The log says it has photos the screen has not loaded yet.
  const photosLoading = Boolean(editRecord?.[activeFields.hasPhoto]) && !editRecord?.[activeFields.photos];
  const photoCount = keptPhotos.length + newPhotos.length;
  // A data URL is plain text, so its length is what it adds to the request.
  const newPhotosBytes = newPhotos.reduce((total, photo) => total + photo.dataUrl.length, 0);

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
        driversReport: editData.driversReport || "",
        preliminaryRemarks: editData.preliminaryRemarks || "",
        additionalIssue: editData.additionalIssue || "",
        progressRemarks: editData.progressRemarks || "",
      });
      setNewPhotos([]);
      setRemovedPhotoIDs([]);
    } else if (isOpen && today) {
      setFormData({
        ...initialFormState,
        date: today,
        truckID: preselectedTruckId ? String(preselectedTruckId) : "",
        primaryMechanicID: chooseMechanic ? defaultPrimaryMechanicID : String(loggedInMechanic.employeeID),
        additionalMechanicID: inheritedAdditionalMechanicID || "",
      });
      setNewPhotos([]);
      setRemovedPhotoIDs([]);
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
    setNewPhotos([]);
    setRemovedPhotoIDs([]);
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
  // One that does not is dropped and the mechanic takes another. Several may
  // be picked at once from the gallery or a computer; each is checked.
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    method: RepairPhotoReport["method"] = captureMethod(),
  ) => {
    const input = e.target;
    const picked = Array.from(input.files ?? []);
    // So the same picture can be picked again after a refusal.
    input.value = "";
    if (picked.length === 0) return;

    const room = MAX_LOG_PHOTOS - photoCount;
    if (room <= 0) {
      setErrors((prev) => ({ ...prev, [activeFields.photo]: `At most ${MAX_LOG_PHOTOS} photos.` }));
      return;
    }
    const files = picked.slice(0, room);
    const problems: string[] = [];
    if (picked.length > room) problems.push(`Only ${room} more ${room === 1 ? "photo fits" : "photos fit"}; the rest were left out.`);

    setCheckingPhoto(true);
    setErrors((prev) => ({ ...prev, [activeFields.photo]: "" }));
    let unchecked = false;
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          problems.push(`${file.name || "That file"} is not an image.`);
          continue;
        }
        try {
          const checked = await checkRepairPhoto(file, method);
          if (checked.verdict?.verdict === "refused" && !photoCheckRelaxed) {
            problems.push(checked.verdict?.reason ?? "This photo was not accepted.");
            continue;
          }
          if (!checked.report.checked) unchecked = true;
          const key = ++photoKey.current;
          setNewPhotos((prev) => [...prev, { key, dataUrl: checked.dataUrl, report: checked.report }]);
        } catch {
          problems.push("Could not read that image. Please take or choose a different photo.");
        }
      }
      if (problems.length > 0) setErrors((prev) => ({ ...prev, [activeFields.photo]: problems.join(" ") }));
      if (unchecked) {
        showToast("A photo could not be checked on this device. It will be saved for the office to review.", "info");
      }
    } finally {
      setCheckingPhoto(false);
    }
  };

  const handleRemoveNewPhoto = (key: number) => {
    setNewPhotos((prev) => prev.filter((photo) => photo.key !== key));
    setErrors((prev) => ({ ...prev, [activeFields.photo]: "" }));
  };

  // Taken off the log when the form is saved, not before.
  const handleRemoveKeptPhoto = (id: string) => {
    setRemovedPhotoIDs((prev) => [...prev, id]);
    setErrors((prev) => ({ ...prev, [activeFields.photo]: "" }));
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
    // photos already on the log count, loaded or not.
    const hasPhoto = photoCount > 0 || photosLoading;
    if (!hasPhoto && !chooseMechanic) {
      newErrors[activeFields.photo] =
        onFilePhotos.length > 0 ? "Keep at least one photo." : "A photo is required.";
    }
    // All the new photos go up in one request. Already on the log, they cost
    // nothing; more can be added in the next save.
    if (newPhotosBytes > MAX_LOG_UPLOAD_BYTES) {
      newErrors[activeFields.photo] =
        "These new photos are too large to save together. Save with fewer, then add the rest in an update.";
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
    onSubmitSuccess(formData, {
      newPhotos: newPhotos.length
        ? {
            [activeFields.phase]: newPhotos.map((photo) => ({
              dataUrl: photo.dataUrl,
              // What the photo check found, sent with the photo for the server to keep.
              report: JSON.stringify(photo.report),
            })),
          }
        : {},
      removedPhotoIDs,
    });
  };

  const inApp = captureMethod() === "camera";
  const photoLabel = (hasOne: boolean) =>
    inApp ? (hasOne ? "Take Another" : "Take Photo") : hasOne ? "Add Photo" : "Choose Photo";
  const atLimit = photoCount >= MAX_LOG_PHOTOS;

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
                Maintenance Photos
                {!chooseMechanic && " *"}
              </label>
              <p className="text-xs sm:text-[11px] text-slate-500 mb-1">
                Photos of the truck or the work on it, up to {MAX_LOG_PHOTOS}. Each is checked on this device before it can be saved.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <button
                  type="button"
                  disabled={checkingPhoto || atLimit}
                  onClick={() => fileInputRef.current?.click()}
                  className="disabled:opacity-60 disabled:cursor-not-allowed min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-300 cursor-pointer"
                >
                  {checkingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{" "}
                  {photoLabel(photoCount > 0)}
                </button>
                {inApp && (
                  <button
                    type="button"
                    disabled={checkingPhoto || atLimit}
                    onClick={() => galleryInputRef.current?.click()}
                    className="disabled:opacity-60 disabled:cursor-not-allowed min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-300 cursor-pointer"
                  >
                    <Images className="w-4 h-4" /> Gallery
                  </button>
                )}
                <span className="text-xs text-slate-500 truncate max-w-xs" aria-live="polite">
                  {checkingPhoto
                    ? "Checking photo…"
                    : photosLoading
                      ? "Loading the photos on file…"
                      : photoCount === 0
                        ? "No photo yet"
                        : `${photoCount} of ${MAX_LOG_PHOTOS} photos`}
                </span>
                {/* In the app, straight from the camera: a photo taken now,
                    at the truck. The gallery is the other way in, for photos
                    taken earlier; they are still checked, and the office reviews them. */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture={inApp ? "environment" : undefined}
                  multiple={!inApp}
                  onChange={(event) => void handleFileChange(event)}
                  className="hidden"
                />
                {inApp && (
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => void handleFileChange(event, "gallery")}
                    className="hidden"
                  />
                )}
              </div>
              {errors[activeFields.photo] && (
                <p role="alert" className="text-red-500 text-xs sm:text-[11px] mt-1">{errors[activeFields.photo]}</p>
              )}
              {photoCount > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {keptPhotos.map((photo) => (
                    <li key={photo.id} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt="Photo on file"
                        onClick={() => setZoomedImage(photo.url)}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveKeptPhoto(photo.id)}
                        disabled={checkingPhoto}
                        aria-label="Remove this photo from the log"
                        className="absolute top-1 right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900/80 text-white hover:bg-red-600 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                  {newPhotos.map((photo) => (
                    <li key={photo.key} className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-blue-400 shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.dataUrl}
                        alt="New photo"
                        onClick={() => setZoomedImage(photo.dataUrl)}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {photo.report.verdict === "refused"
                          ? "For review"
                          : photo.report.method === "gallery"
                            ? "Gallery"
                            : photo.report.checked
                              ? "Checked"
                              : "Not checked"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveNewPhoto(photo.key)}
                        disabled={checkingPhoto}
                        aria-label="Remove this new photo"
                        className="absolute top-1 right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900/80 text-white hover:bg-red-600 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {newPhotos.some((photo) => photo.report.verdict === "refused") && (
                <p className="mt-1 text-xs sm:text-[11px] text-amber-700">
                  Not accepted by the photo check. The check is relaxed, so it is kept for the office to review.
                </p>
              )}
              {newPhotos.some((photo) => photo.report.method === "gallery" || !photo.report.checked) && (
                <p className="mt-1 text-xs sm:text-[11px] text-slate-500">
                  Photos from the gallery, or that could not be checked here, are saved for the office to review.
                </p>
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
