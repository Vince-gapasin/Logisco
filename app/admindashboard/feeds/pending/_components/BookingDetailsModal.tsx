"use client";

import BookingHistory from "@/components/booking/BookingHistory";
import React, { useState, useRef, useEffect } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import DeliveryProgress from "@/components/booking/DeliveryProgress";
import { isValidPhone, PHONE_RULE } from "@/app/lib/bookingRules";
import { changedBookingFields } from "@/app/lib/bookingEdits";
import { type FeedBooking, type FeedStopRow } from "@/app/lib/bookingView";
import BookingStopsReadOnly from "@/components/booking/BookingStopsReadOnly";
import CrewPicker from "@/components/booking/CrewPicker";
import SubconPartnerSelect from "@/components/booking/SubconPartnerSelect";
import { useAssignableCrew } from "@/components/booking/useAssignableCrew";
import {
  FileText,
  Info,
  X,
  Trash2,
} from "lucide-react";
import { getCrewStatusBadge } from "./badges";

// ==========================================
// BOOKING DETAILS / ASSIGNMENT MODAL
// ==========================================
interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: FeedBooking | null;
  onSubmitSuccess: (orderId: string, status: string) => void;
  onCancelBooking: (e: React.MouseEvent, bookingId: string) => void;
}

export function BookingDetailsModal({
  isOpen,
  onClose,
  booking,
  onSubmitSuccess,
  onCancelBooking,
}: BookingDetailsModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [pickupList, setPickupList] = useState<FeedStopRow[]>([]);
  const [deliveryList, setDeliveryList] = useState<FeedStopRow[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubconMode, setIsSubconMode] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Free trucks and crew for the date, plus whoever is on this trip now.
  // The lists here used to be typed into the page ("TRK-102", "Juan Dela
  // Cruz"), so a re-assignment could only ever pick someone invented.
  const crew = useAssignableCrew(formData.deliverySchedule ?? "", isOpen && Boolean(booking), booking ?? undefined);

  // The form is seeded from the booking this was opened with. That is a
  // synchronous setState in an effect, which the rule is right to notice and
  // is also the only way to fill a form from a prop that arrives later.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen && booking) {
      setIsSubconMode(false);
      setShowCancelConfirm(false);

      setFormData({
        clientName: booking.clientName || "",
        contactPerson: booking.contactPerson || "",
        contactNumber: booking.contactNumber || "",
        emailAddress: booking.emailAddress || "",
        businessAddress: booking.businessAddress || "",
        requestDate: booking.dateCreated || currentDate,
        deliverySchedule: booking.scheduledDate || "",
        product: booking.product || "",
        priorityLevel: booking.priorityLevel || "Standard",
        subconPartner: booking.subconPartner || "",
        truckPlate: booking.truckID || "",
        // Whoever turned the trip down is not the suggestion to reopen with:
        // the coordinator is here to pick someone else.
        driver:
          booking.confirmationStatus === "Declined"
            ? ""
            : booking.crews?.find((c: { role: string }) => c.role === "Driver")?.employeeID || "",
        helper1: booking.crews?.find((c: { role: string }) => c.role === "Helper #1")?.employeeID || "",
        helper2: booking.crews?.find((c: { role: string }) => c.role === "Helper #2")?.employeeID || "",
        notes: booking.notes || "",
      });

      setPickupList(
        booking.pickupList?.length
          ? JSON.parse(JSON.stringify(booking.pickupList))
          : [],
      );

      setDeliveryList(
        booking.deliveryList?.length
          ? JSON.parse(JSON.stringify(booking.deliveryList))
          : [
              {
                branchName: "",
                deliveryAddress: "",
                contactPerson: "",
                contactNumber: "",
                deliveryTime: "",
                quantity: "",
                stopStatus: "Pending",
              },
            ],
      );

      setErrors({});
      setSubmitError("");

      setTimeout(() => {
        crewSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [isOpen, booking, currentDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen || !booking) return null;

  const isAssignCrew = booking.confirmationStatus === "Assign Crew";
  const isPendingCrew = booking.confirmationStatus === "Pending Crew";
  // A declined trip and one that never had a crew both need assigning, which
  // is the whole point of opening them here.
  const wasDeclined = booking.confirmationStatus === "Declined";
  const isUnassigned = booking.confirmationStatus === "Unassigned";
  const isEditable = isAssignCrew || isPendingCrew || wasDeclined || isUnassigned;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    if (!isEditable) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  /**
   * Writes back what was changed about the booking - its day, its urgency,
   * what is on it - before anyone is assigned to carry it. First, and
   * separately: a crew assigned against a schedule that failed to save would
   * be going out on the wrong day.
   */
  const saveBookingEdits = async () => {
    const edits = changedBookingFields(
      {
        scheduledDate: booking.scheduledDate,
        priorityLevel: booking.priorityLevel,
        product: booking.product,
        notes: booking.notes,
      },
      formData,
    );
    if (!edits) return;

    await apiFetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "update", ...edits }),
    });
  };

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable || isSubmitting) return;
    setSubmitError("");

    const newErrors: { [key: string]: string } = {};

    if (!formData.deliverySchedule)
      newErrors.deliverySchedule = "Delivery schedule is required.";
    if (!formData.priorityLevel)
      newErrors.priorityLevel = "Priority level is required.";
    if (!isSubconMode && !formData.truckPlate)
      newErrors.truckPlate = "Truck plate is required.";
    if (!isSubconMode && !formData.driver)
      newErrors.driver = "Driver assignment is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // A partner has no app: the coordinator records their trip under
    // Reports > Sub-con Trips once it is handed over.
    if (isSubconMode) {
      const partnerContact = (formData.partnerContact ?? "").trim();
      if (!formData.subconPartner) {
        setErrors({ subconPartner: "Choose the sub-contractor." });
        return;
      }
      if (partnerContact && !isValidPhone(partnerContact)) {
        setErrors({ partnerContact: PHONE_RULE });
        return;
      }
      setIsSubmitting(true);
      try {
        await saveBookingEdits();
        await apiFetch("/api/subcon-trips", {
          method: "POST",
          body: JSON.stringify({
            orderID: booking.id,
            subConID: formData.subconPartner,
            driverName: formData.driver || undefined,
            plateNumber: formData.truckPlate || undefined,
            contactNumber: partnerContact || undefined,
            helpers: [formData.helper1, formData.helper2].filter(Boolean),
          }),
        });
        onSubmitSuccess(booking.orderId, booking.confirmationStatus);
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to hand the booking to the partner.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await saveBookingEdits();
      const body = JSON.stringify({
        truckID: formData.truckPlate,
        driverID: formData.driver,
        helper1ID: formData.helper1 || undefined,
        helper2ID: formData.helper2 || undefined,
        totalCargoWeight: 0,
      });
      // Re-assign the trip there is; assign one if there is none. A declined
      // trip counts as none: it is closed, kept as history, and the booking
      // goes out on a new one - re-assigning in place is refused for it.
      await (booking.dispatchID && !wasDeclined
        ? apiFetch(`/api/dispatch/${booking.dispatchID}/assign`, { method: "PATCH", body })
        : apiFetch(`/api/dispatch/${booking.id}/assign`, { method: "POST", body }));
      onSubmitSuccess(booking.orderId, booking.confirmationStatus);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save this assignment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = isEditable
    ? "w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
    : "w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 cursor-default focus:outline-none";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-full flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <FileText className="w-5 h-5" /> Booking Details:{" "}
              {booking.orderId}
            </h2>
            <p className="text-xs font-medium opacity-80 mt-0.5">
              Status: {booking.status} | {booking.confirmationStatus}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <form
          id="pending-booking-form"
          onSubmit={validateAndSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-900"
        >
          {/* Top Info & Progress Tracker */}
          <div className="border border-slate-200 rounded-xl p-4 md:p-6 bg-white shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto flex-1">
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Date Created
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.dateCreated}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Created By
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.createdBy}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Order Priority
                </p>
                <span
                  className={`inline-flex px-2 py-0.5 rounded font-bold text-xs sm:text-[10px] uppercase tracking-wider ${
                    booking.priorityLevel === "High Priority" ||
                    booking.priorityLevel === "Urgent"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {booking.priorityLevel}
                </span>
              </div>
            </div>

            <div className="w-full md:w-87.5 shrink-0">
              <h3 className="text-xs sm:text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2 md:text-right">
                Delivery Progress
              </h3>
              <DeliveryProgress currentStatus={booking.status} />
            </div>
          </div>

          {/* 1. Client Information */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Client Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Company / Client Name
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.clientName}
                  className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  readOnly
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  value={formData.contactNumber}
                  readOnly
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="emailAddress"
                  placeholder="N/A"
                  value={formData.emailAddress}
                  readOnly
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Business Address
                </label>
                <input
                  type="text"
                  name="businessAddress"
                  placeholder="N/A"
                  value={formData.businessAddress}
                  readOnly
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {isEditable && (
            <p className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              A client&apos;s contact details belong to their record. To change them, edit the client under Clients
              &amp; Partners.
            </p>
          )}

          {/* 2-3. Pickups and deliveries, as booked */}
          <BookingStopsReadOnly pickups={pickupList} deliveries={deliveryList} showStatus={!isEditable} />

          {/* 4. Booking Details & Schedule */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Booking Details & Schedule
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4 md:col-span-3">
                <label className="block text-xs font-medium text-black mb-1">
                  Delivery Schedule {isEditable && "*"}
                </label>
                <input
                  type={isEditable ? "date" : "text"}
                  name="deliverySchedule"
                  min={isEditable ? currentDate : undefined}
                  value={
                    isEditable ? formData.deliverySchedule : booking.displayDate
                  }
                  onChange={handleChange}
                  readOnly={!isEditable}
                  className={
                    isEditable
                      ? `w-full border rounded-md px-3 py-2 text-xs ${
                          errors.deliverySchedule
                            ? "border-red-500"
                            : "border-slate-300"
                        }`
                      : inputClass
                  }
                />
              </div>
              <div className="sm:col-span-5 md:col-span-6">
                <label className="block text-xs font-medium text-black mb-1">
                  Product To Deliver {isEditable && "*"}
                </label>
                <input
                  type="text"
                  name="product"
                  value={formData.product}
                  onChange={handleChange}
                  readOnly={!isEditable}
                  className={
                    isEditable
                      ? "w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                      : inputClass
                  }
                />
              </div>
              <div className="sm:col-span-3 md:col-span-3">
                <label className="block text-xs font-medium text-black mb-1">
                  Priority Level {isEditable && "*"}
                </label>
                {isEditable ? (
                  <select
                    name="priorityLevel"
                    value={formData.priorityLevel}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Urgent">Urgent / Rush</option>
                    <option value="High Priority">High Priority</option>
                  </select>
                ) : (
                  <input
                    readOnly
                    value={formData.priorityLevel}
                    className={inputClass}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 5. Assign Crew / Vehicle */}
          <div
            ref={crewSectionRef}
            className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs scroll-mt-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                5.{" "}
                {isPendingCrew
                  ? "Assigned Crew Status & Re-assignment"
                  : "Assign Delivery Crews & Vehicle"}
              </span>
              {isEditable && !isPendingCrew && (
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !isSubconMode;
                    setIsSubconMode(nextMode);
                    if (nextMode) {
                      setFormData((prev) => ({
                        ...prev,
                        truckPlate: "",
                        driver: "",
                        helper1: "",
                        helper2: "",
                      }));
                    }
                  }}
                  className="text-xs text-blue-600 underline hover:text-blue-800 cursor-pointer"
                >
                  {isSubconMode
                    ? "Assign to Own Resources"
                    : "Assign to Subcon Partner"}
                </button>
              )}
            </div>

            {/* Crew Status Summary Banner (Visible for Pending Crew Confirmation) */}
            {isPendingCrew && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                <p className="font-bold text-slate-700">
                  Current Crew Responses:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {booking.crews?.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-200"
                    >
                      <span className="font-medium text-slate-800">
                        {c.role}: {c.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs sm:text-[10px] font-bold uppercase ${getCrewStatusBadge(
                          c.status || "Pending",
                        )}`}
                      >
                        {c.status || "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isEditable ? (
              // Read-only Crew Info
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Truck Plate No.
                  </label>
                  <input
                    readOnly
                    value={formData.truckPlate || "Not Assigned"}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Driver
                  </label>
                  <input
                    readOnly
                    value={formData.driver || "Not Assigned"}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Helper #1
                  </label>
                  <input
                    readOnly
                    value={formData.helper1 || "Not Assigned"}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Helper #2
                  </label>
                  <input
                    readOnly
                    value={formData.helper2 || "Not Assigned"}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : isSubconMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Select Subcon Partner *
                  </label>
                  <SubconPartnerSelect
                    id="subcon-partner"
                    value={formData.subconPartner}
                    onChange={(next) => setFormData((prev) => ({ ...prev, subconPartner: next }))}
                  />
                  {errors.subconPartner && <p className="mt-1 text-xs text-red-600">{errors.subconPartner}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Truck / Plate No.
                  </label>
                  <input
                    type="text"
                    name="truckPlate"
                    placeholder="optional"
                    value={formData.truckPlate}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    name="driver"
                    placeholder="optional"
                    value={formData.driver}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Driver&apos;s Contact No.
                  </label>
                  <input
                    type="tel"
                    name="partnerContact"
                    placeholder="09XXXXXXXXX (optional)"
                    value={formData.partnerContact ?? ""}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs placeholder:text-slate-500 ${errors.partnerContact ? "border-red-500" : "border-slate-300"}`}
                  />
                  {errors.partnerContact && <p className="mt-1 text-[11px] leading-tight text-red-600">{errors.partnerContact}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #1
                  </label>
                  <input
                    type="text"
                    name="helper1"
                    placeholder="optional"
                    value={formData.helper1}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #2
                  </label>
                  <input
                    type="text"
                    name="helper2"
                    placeholder="optional"
                    value={formData.helper2}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs placeholder:text-slate-500"
                  />
                </div>
              </div>
            ) : (
              <>
                <CrewPicker
                  required
                  value={{
                    truckPlate: formData.truckPlate,
                    driver: formData.driver,
                    helper1: formData.helper1,
                    helper2: formData.helper2,
                  }}
                  onChange={(field, next) => {
                    setFormData((prev) => ({ ...prev, [field]: next }));
                    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
                  }}
                  trucks={crew.trucks}
                  drivers={crew.drivers}
                  helpers={crew.helpers}
                  loading={crew.loading}
                  errors={{ truckPlate: errors.truckPlate, driver: errors.driver }}
                />
                {crew.error && <p className="mt-2 text-xs text-red-600">{crew.error}</p>}
              </>
            )}
          </div>

          {/* 6. Notes / Instructions */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              6. Notes / Instructions {isEditable && "(Optional)"}
            </div>
            <textarea
              name="notes"
              rows={3}
              placeholder={
                isEditable ? "Any specific handling instructions..." : ""
              }
              value={formData.notes}
              onChange={handleChange}
              readOnly={!isEditable}
              className={`w-full resize-y rounded-md px-3 py-2 text-xs ${
                isEditable
                  ? "border border-slate-300"
                  : "bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none cursor-default"
              }`}
            />
          </div>

          {/* 7. What happened to this booking, newest first. */}
          <BookingHistory orderID={booking.id} />
        </form>

        {/* FIXED FOOTER */}
        <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 bg-slate-50">
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="w-full sm:w-auto px-6 py-2.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer sm:mr-auto"
          >
            Cancel Booking
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-200 hover:bg-black hover:text-white text-slate-800 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Close Details
          </button>

          {submitError && (
            <p role="alert" className="w-full sm:w-auto sm:mr-auto text-xs text-red-600">{submitError}</p>
          )}
          {/*
            One button for every booking this screen can act on. It used to be
            two, each named after a status, which left a declined booking with
            neither: the form was there and filled in, and there was nothing to
            press to send the new crew their assignment.
          */}
          {isEditable && (
            <button
              type="submit"
              form="pending-booking-form"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              {isSubmitting ? "Saving…" : isPendingCrew ? "Re-assign Booking" : "Assign Now"}
            </button>
          )}
        </div>

        {/* Cancel Confirmation Modal Overlay */}
        {showCancelConfirm && (
          <div className="absolute inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in rounded-2xl">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Cancel Booking?
              </h3>
              <p className="text-sm text-slate-600 mb-6 px-2">
                Are you sure you want to cancel this booking? This action cannot
                be undone.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  No, Keep It
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    setShowCancelConfirm(false);
                    onCancelBooking(e, booking.id);
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
