"use client";

import { useEffect, useRef, useState } from "react";
import { AVAILABILITY } from "@/app/lib/enums";
import {
  ChevronDown,
  Edit3,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  MailCheck,
  CheckCircle2,
  MoreHorizontal,
  UserCheck,
  UserX,
  Paperclip,
  HeartPulse,
} from "lucide-react";
import PerformancePanel from "@/components/employee/PerformancePanel";
import type { EmployeeRecord } from "./types";
import { ReadField } from "./ReadField";
import { formatDate } from "./helpers";

// ==========================================
// EMPLOYEE DETAIL
// ==========================================

interface EmployeeDetailViewProps {
  employee: EmployeeRecord;
  currentRole: string;
  onBack: () => void;
  onEdit: (employee: EmployeeRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  onToggleStatus: (employee: EmployeeRecord) => Promise<void>;
}

type EmployeeDetailTab = "overview" | "health" | "attachments" | "performance";

export function EmployeeDetailView({
  employee,
  currentRole,
  onBack,
  onEdit,
  onDelete,
  onActivate,
  onToggleStatus,
}: EmployeeDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] =
    useState<EmployeeDetailTab>("overview");
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentRole.toLowerCase() === "admin";
  const canEdit = isAdmin;

  // Every role is rated now, each on its own work: the crew on their trips,
  // mechanics on their repairs, the office on running the deliveries.
  const showsPerformance = ["driver", "helper", "mechanic", "coordinator", "admin"].includes(
    (employee.role ?? "").trim().toLowerCase(),
  );

  const accountActivated = Boolean(employee.activation_completed_at);
  const activationCooldownMs = 15 * 60 * 1000;

  // Read lazily: calling the clock during render makes the render impure.
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!employee.activation_sent_at || accountActivated) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [employee.activation_sent_at, accountActivated]);

  const activationSentAt = employee.activation_sent_at
    ? new Date(employee.activation_sent_at).getTime()
    : null;

  const activationCooldownActive =
    !accountActivated &&
    activationSentAt !== null &&
    currentTime - activationSentAt < activationCooldownMs;

  const activationRemainingMs =
    activationCooldownActive && activationSentAt !== null
      ? activationCooldownMs - (currentTime - activationSentAt)
      : 0;

  const activationRemainingMinutes = Math.ceil(activationRemainingMs / 60000);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setIsMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // EXACT LOGIC FROM YOUR UPDATED CODE, modified only to safely close the UI modal
  const confirmDelete = async () => {
    try {
      setIsDeleting(true);

      await onDelete(employee.id);

      // Explicitly shut the modal to prevent any React state unmount warnings
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleActivation = async () => {
    try {
      setIsActivating(true);
      await onActivate(employee.id);
    } finally {
      setIsActivating(false);
    }
  };

  const confirmStatusChange = async () => {
    try {
      setIsUpdatingStatus(true);
      await onToggleStatus(employee);
      setShowStatusModal(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const employeeName = [
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.suffix,
  ]
    .filter(Boolean)
    .join(" ");

  const availabilityBadgeClass =
    employee.availability === AVAILABILITY.inTransit
      ? "bg-blue-100 text-blue-700"
      : employee.availability === AVAILABILITY.booked
        ? "bg-amber-100 text-amber-700"
        : employee.availability === AVAILABILITY.onLeave || employee.availability === AVAILABILITY.unavailable
          ? "bg-slate-200 text-slate-700"
          : "bg-emerald-100 text-emerald-700";

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] animate-fade-in">
      {/* PROFILE HEADER */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xs transition-colors hover:bg-slate-100"
            title="Back to Directory"
            aria-label="Back to Employee Directory"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-base font-bold text-blue-700 sm:h-14 sm:w-14 sm:text-lg">
              {employee.firstName ? employee.firstName[0] : "E"}
              {employee.lastName ? employee.lastName[0] : ""}
            </div>
            <div className="min-w-0">
              <h1 className="wrap-break-word sm:truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {employeeName || "Employee"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                  {employee.role}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    employee.isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {employee.isActive ? "Active" : "Inactive"}
                </span>
                {employee.isActive && (
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${availabilityBadgeClass}`}
                  >
                    {employee.availability || "Available"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {isAdmin && !accountActivated && (
            activationCooldownActive ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400 cursor-not-allowed"
              >
                <Loader2 className="h-4 w-4" />
                Resend in {activationRemainingMinutes} min
              </button>
            ) : (
              <button
                type="button"
                onClick={handleActivation}
                disabled={isActivating || !employee.emailAddress}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isActivating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MailCheck className="h-4 w-4" />
                )}
                {isActivating
                  ? "Sending Invite..."
                  : activationSentAt
                    ? "Resend Activation"
                    : "Allow Login"}
              </button>
            )
          )}

          {isAdmin && accountActivated && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Login Access
            </div>
          )}

          {canEdit && (
            <div ref={moreMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMoreOpen((open) => !open)}
                aria-expanded={isMoreOpen}
                aria-haspopup="menu"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
              >
                <MoreHorizontal className="h-4 w-4" />
                More
                <ChevronDown className="h-4 w-4" />
              </button>

              {isMoreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onEdit(employee);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-4 w-4 text-blue-600" />
                    Edit
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMoreOpen(false);
                      setShowStatusModal(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {employee.isActive ? (
                      <UserX className="h-4 w-4 text-amber-600" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                    )}
                    {employee.isActive ? "Disable" : "Enable"}
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMoreOpen(false);
                      setShowDeleteModal(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:px-6">
          {(
            [
              ["overview", "Overview"],
              ["health", "Health Info"],
              ["attachments", "Attachments"],
              // Only the crew who run deliveries: there is nothing honest to
              // show for an admin or a coordinator.
              ...(showsPerformance ? ([["performance", "Performance"]] as const) : []),
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 px-3 py-4 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === "overview" && (
            <div className="space-y-6 text-sm text-slate-900">
          {/* PERSONAL */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Personal Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <ReadField label="First Name" value={employee.firstName} />
              <ReadField label="Middle Name" value={employee.middleName} />
              <ReadField label="Last Name" value={employee.lastName} />
              <ReadField label="Suffix" value={employee.suffix} />
              <ReadField label="Gender" value={employee.gender} />
              <ReadField
                label="Birthdate"
                value={formatDate(employee.birthdate)}
              />
              <div className="sm:col-span-2">
                <ReadField label="Address" value={employee.address} />
              </div>
              <ReadField
                label="Contact Number"
                value={employee.contactNumber}
              />
              <ReadField label="Email Address" value={employee.emailAddress} />
              <ReadField label="Blood Type" value={employee.bloodType} />
              <ReadField label="Nationality" value={employee.nationality} />
              <ReadField label="Religion" value={employee.religion} />
            </div>
          </div>

              {/* EMPLOYMENT */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold tracking-wide text-black">
                  2. Employment Information
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ReadField label="Role" value={employee.role} />
                  <ReadField
                    label="Availability"
                    value={employee.availability}
                  />
                  <ReadField
                    label="Date Employed"
                    value={formatDate(employee.dateEmployed)}
                  />
                </div>
              </div>

              {/* DRIVER */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold tracking-wide text-black">
                  3. Driver Information (if applicable)
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <ReadField
                    label="Driver's License No."
                    value={employee.licenseNumber}
                  />
                  <ReadField
                    label="License Type / Restriction"
                    value={employee.driverLicenseType}
                  />
                  <ReadField
                    label="License Expiration Date"
                    value={formatDate(employee.licenseExpirationDate)}
                  />
                  <ReadField
                    label="Driving Experience (Years)"
                    value={
                      employee.drivingExperience
                        ? `${employee.drivingExperience} years`
                        : ""
                    }
                  />
                </div>
              </div>

              {/* OTHER */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold tracking-wide text-black">
                  4. Other Information
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <ReadField
                      label="Skills / Specialization"
                      value={employee.skills}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <ReadField label="Other Remarks" value={employee.remarks} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "health" && (
            <div className="space-y-6 text-sm text-slate-900">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 text-sm font-semibold tracking-wide text-black">
                  <HeartPulse className="h-4 w-4 text-blue-600" />
                  Health & Emergency Information
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <ReadField
                    label="Health Condition"
                    value={employee.healthCondition}
                  />
                  <ReadField
                    label="Drug Test Status"
                    value={employee.drugTestStatus}
                  />
                  <ReadField
                    label="Last Medical Check-up"
                    value={formatDate(employee.lastMedicalCheckup)}
                  />
                  <ReadField
                    label="Emergency Contact Person"
                    value={employee.emergencyContactPerson}
                  />
                  <ReadField
                    label="Emergency Contact Number"
                    value={employee.emergencyContactNumber}
                  />
                  <ReadField
                    label="Relationship"
                    value={employee.relationship}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "attachments" && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Paperclip className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Employee Attachments
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Medical documents, certificates, and other employee files will
                appear here when attachment storage is connected.
              </p>
            </div>
          )}

          {activeTab === "performance" && showsPerformance && (
            <PerformancePanel employeeID={employee.id} />
          )}
        </div>
      </div>

      {/* STATUS MODAL */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
            <div
              className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                employee.isActive
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {employee.isActive ? (
                <UserX className="h-6 w-6" />
              ) : (
                <UserCheck className="h-6 w-6" />
              )}
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">
              {employee.isActive ? "Disable Employee" : "Enable Employee"}
            </h3>
            <p className="mb-6 text-sm leading-6 text-slate-600">
              {employee.isActive
                ? `Disable ${employeeName}? They will no longer be treated as an active employee.`
                : `Enable ${employeeName}? They will be restored as an active employee.`}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                disabled={isUpdatingStatus}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStatusChange}
                disabled={isUpdatingStatus}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition-colors disabled:opacity-50 ${
                  employee.isActive
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isUpdatingStatus && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {employee.isActive ? "Confirm Disable" : "Confirm Enable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Employee Record
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900">
                {employee.firstName} {employee.lastName}
              </strong>
              ? This will permanently remove the record.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md flex items-center justify-center gap-2"
              >
                {isDeleting && (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                )}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
