"use client";

// Putting a truck and a crew on a booking.
//
// Two screens did this, and they were the same screen: 640 of their 690 lines
// were identical, and the fifty that were not came down to a first assignment
// against a re-assignment - which endpoint to call, and what to call the
// button. Both of those follow from the booking, so neither screen has to say
// which it is.
//
// The differences that were not deliberate had already collected: on one of
// them the button that hands a booking to a sub-contractor had no label at
// all, so it was an invisible target, and the delivery schedule defaulted to
// today - which, now that the schedule saves, would have quietly moved every
// booking that had none.

import React, { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";

import { apiFetch } from "@/app/lib/apiClient";
import { changedBookingFields } from "@/app/lib/bookingEdits";
import { isValidPhone, PHONE_RULE } from "@/app/lib/bookingRules";
import { toFeedBooking, type BookingCrewView, type BookingView, type FeedStopRow } from "@/app/lib/bookingView";
import { DELIVERY_STATUS } from "@/app/lib/enums";
import BookingHistory from "@/components/booking/BookingHistory";
import BookingStopsReadOnly from "@/components/booking/BookingStopsReadOnly";
import CrewPicker from "@/components/booking/CrewPicker";
import DeliveryProgress from "@/components/booking/DeliveryProgress";
import SubconPartnerSelect from "@/components/booking/SubconPartnerSelect";
import { useAssignableCrew } from "@/components/booking/useAssignableCrew";

interface BookingAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingView | null;
  /** Told whether the booking was re-assigned, so a screen can word its own message. */
  onSubmitSuccess: (orderId: string, wasReassignment: boolean) => void;
  onCancelBooking: (event: React.MouseEvent, bookingID: string) => void;
}

type FormState = Record<string, string>;

const EMPTY_FORM: FormState = {
  clientName: "",
  contactPerson: "",
  contactNumber: "",
  emailAddress: "",
  businessAddress: "",
  deliverySchedule: "",
  product: "",
  priorityLevel: "Standard",
  subconPartner: "",
  partnerContact: "",
  truckPlate: "",
  driver: "",
  helper1: "",
  helper2: "",
  notes: "",
};

const readOnlyField =
  "w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 cursor-default focus:outline-none";
const editableField = "w-full border border-slate-300 rounded-md px-3 py-2 text-xs";
const label = "block text-xs font-medium text-black mb-1";

function crewStatusBadge(status: string): string {
  switch (status) {
    case "Accepted":
      return "bg-emerald-100 text-emerald-700";
    case "Declined":
      return "bg-red-100 text-red-700";
    case "Pending":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function crewMember(crews: BookingCrewView[] | undefined, role: string): string {
  return crews?.find((crew) => crew.role === role)?.employeeID ?? "";
}

export default function BookingAssignModal({
  isOpen,
  onClose,
  booking,
  onSubmitSuccess,
  onCancelBooking,
}: BookingAssignModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [pickupList, setPickupList] = useState<FeedStopRow[]>([]);
  const [deliveryList, setDeliveryList] = useState<FeedStopRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubconMode, setIsSubconMode] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Free trucks and crew for the date, plus whoever is already on this trip:
  // they show as busy precisely because of this booking, and must stay
  // selectable when only one of the three is being changed.
  const crew = useAssignableCrew(formData.deliverySchedule, isOpen && Boolean(booking), booking ?? undefined);

  useEffect(() => {
    if (!isOpen || !booking) return;

    setIsSubconMode(false);
    setShowCancelConfirm(false);
    setErrors({});
    setSubmitError("");

    setFormData({
      ...EMPTY_FORM,
      clientName: booking.clientName || "",
      contactPerson: booking.contactPerson || "",
      contactNumber: booking.contactNumber || "",
      emailAddress: booking.emailAddress || "",
      businessAddress: booking.businessAddress || "",
      // Left empty when the booking has none: filling in today would look like
      // a schedule somebody chose, and would now be saved as one.
      deliverySchedule: booking.scheduledDate || "",
      product: booking.product || "",
      priorityLevel: booking.priorityLevel || "Standard",
      // Whoever is on it already, which is nobody on a booking that has never
      // been assigned. A crew who declined is not carried over: the point of
      // opening it again is to pick someone else.
      truckPlate: booking.dispatchStatus === DELIVERY_STATUS.rejected ? "" : booking.truckID || "",
      driver: booking.dispatchStatus === DELIVERY_STATUS.rejected ? "" : crewMember(booking.crews, "Driver"),
      helper1: crewMember(booking.crews, "Helper #1"),
      helper2: crewMember(booking.crews, "Helper #2"),
      notes: booking.plainNotes || "",
    });

    // What was recorded when the booking was made.
    const feed = toFeedBooking(booking);
    setPickupList(feed.pickupList.map((row) => ({ ...row })));
    setDeliveryList(feed.deliveryList.map((row) => ({ ...row })));

    const scrollTimer = setTimeout(() => {
      crewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [isOpen, booking]);

  if (!isOpen || !booking) return null;

  // A trip that exists and is still live is changed in place. One a crew
  // declined is closed history, and the booking goes out on a new trip - the
  // same rule the API applies, which refuses to re-assign a rejected dispatch.
  const reassigning = Boolean(booking.dispatchID) && booking.dispatchStatus !== DELIVERY_STATUS.rejected;
  const hasCrew = (booking.crews?.length ?? 0) > 0;

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    if (errors[name]) setErrors((previous) => ({ ...previous, [name]: "" }));
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
        notes: booking.plainNotes,
      },
      formData,
    );
    if (!edits) return;

    await apiFetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "update", ...edits }),
    });
  };

  const validateAndSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmitError("");

    const found: Record<string, string> = {};
    if (!formData.deliverySchedule) found.deliverySchedule = "Delivery schedule is required.";
    if (!formData.priorityLevel) found.priorityLevel = "Priority level is required.";
    if (!isSubconMode && !formData.truckPlate) found.truckPlate = "Truck plate is required.";
    if (!isSubconMode && !formData.driver) found.driver = "Driver assignment is required.";

    if (Object.keys(found).length > 0) {
      setErrors(found);
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
        onSubmitSuccess(booking.orderId, reassigning);
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

      await (reassigning
        ? apiFetch(`/api/dispatch/${booking.dispatchID}/assign`, { method: "PATCH", body })
        : apiFetch(`/api/dispatch/${booking.id}/assign`, { method: "POST", body }));

      onSubmitSuccess(booking.orderId, reassigning);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save this assignment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto flex flex-col max-h-[90dvh] relative">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-wide">
              {reassigning ? "Review & Re-assign" : "Assign Booking"}: {booking.orderId}
            </h2>
            <span
              className={`text-xs sm:text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                reassigning ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {reassigning ? "Awaiting Confirmation" : "Unassigned"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          id="assign-booking-form"
          onSubmit={validateAndSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-900"
        >
          {/* Top Info & Progress Tracker */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto flex-1">
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Date Created
                </p>
                <p className="text-xs font-bold text-slate-800">{booking.dateCreated || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Created By
                </p>
                <p className="text-xs font-bold text-slate-800">{booking.createdBy || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Order Priority
                </p>
                <span
                  className={`inline-flex px-2 py-0.5 rounded font-bold text-xs sm:text-[10px] uppercase tracking-wider ${
                    booking.priorityLevel === "High Priority" || booking.priorityLevel === "Urgent"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {booking.priorityLevel || "Standard"}
                </span>
              </div>
            </div>

            <div className="w-full md:w-87.5 shrink-0">
              <h3 className="text-xs sm:text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 md:text-right">
                Delivery Progress
              </h3>
              <DeliveryProgress currentStatus={booking.status || (reassigning ? "Assigned" : "Created")} />
            </div>
          </div>

          {/* 1. Client Information - the client's own record, shown not edited */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Client Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className={label}>Company / Client Name</label>
                <input
                  type="text"
                  readOnly
                  value={formData.clientName}
                  className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold text-slate-700"
                />
              </div>
              <div>
                <label className={label}>Contact Person</label>
                <input type="text" readOnly value={formData.contactPerson} className={readOnlyField} />
              </div>
              <div>
                <label className={label}>Contact Number</label>
                <input type="text" readOnly value={formData.contactNumber} className={readOnlyField} />
              </div>
              <div>
                <label className={label}>Email Address</label>
                <input type="email" readOnly placeholder="N/A" value={formData.emailAddress} className={readOnlyField} />
              </div>
              <div>
                <label className={label}>Business Address</label>
                <input type="text" readOnly placeholder="N/A" value={formData.businessAddress} className={readOnlyField} />
              </div>
            </div>
          </div>

          {/* 2-3. Pickups and deliveries, as booked */}
          <BookingStopsReadOnly pickups={pickupList} deliveries={deliveryList} />

          {/* 4. Booking Details & Schedule */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Booking Details &amp; Schedule
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4 md:col-span-3">
                <label className={label}>Delivery Schedule *</label>
                <input
                  type="date"
                  name="deliverySchedule"
                  min={today}
                  value={formData.deliverySchedule}
                  onChange={handleChange}
                  className={`w-full border rounded-md px-3 py-2 text-xs ${
                    errors.deliverySchedule ? "border-red-500" : "border-slate-300"
                  }`}
                />
                {errors.deliverySchedule && <p className="mt-1 text-xs text-red-600">{errors.deliverySchedule}</p>}
              </div>
              <div className="sm:col-span-5 md:col-span-6">
                <label className={label}>Product To Deliver *</label>
                <input
                  type="text"
                  name="product"
                  value={formData.product}
                  onChange={handleChange}
                  className={editableField}
                />
              </div>
              <div className="sm:col-span-3 md:col-span-3">
                <label className={label}>Priority Level *</label>
                <select
                  name="priorityLevel"
                  value={formData.priorityLevel}
                  onChange={handleChange}
                  className={editableField}
                >
                  <option value="Standard">Standard</option>
                  <option value="Urgent">Urgent / Rush</option>
                  <option value="High Priority">High Priority</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. Crew and vehicle */}
          <div ref={crewSectionRef} className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs scroll-mt-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                {reassigning ? "5. Assigned Crew Status & Re-assignment" : "5. Assign Delivery Crews & Vehicle"}
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextMode = !isSubconMode;
                  setIsSubconMode(nextMode);
                  if (nextMode) {
                    setFormData((previous) => ({
                      ...previous,
                      truckPlate: "",
                      driver: "",
                      helper1: "",
                      helper2: "",
                    }));
                  }
                }}
                className="text-xs text-blue-600 underline hover:text-blue-800 cursor-pointer"
              >
                {isSubconMode ? "Assign to Own Resources" : "Assign to Subcon Partner"}
              </button>
            </div>

            {/* Who has answered, when somebody has been asked */}
            {hasCrew && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                <p className="font-bold text-slate-700">Current Crew Responses:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {booking.crews.map((member, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-200"
                    >
                      <span className="font-medium text-slate-800">
                        {member.role}: {member.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs sm:text-[10px] font-bold uppercase ${crewStatusBadge(member.status)}`}
                      >
                        {member.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSubconMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className={label}>Select Subcon Partner *</label>
                  <SubconPartnerSelect
                    id="subcon-partner"
                    value={formData.subconPartner}
                    onChange={(next) => setFormData((previous) => ({ ...previous, subconPartner: next }))}
                  />
                  {errors.subconPartner && <p className="mt-1 text-xs text-red-600">{errors.subconPartner}</p>}
                </div>
                <div>
                  <label className={label}>Truck / Plate No.</label>
                  <input
                    type="text"
                    name="truckPlate"
                    placeholder="optional"
                    value={formData.truckPlate}
                    onChange={handleChange}
                    className={`${editableField} placeholder:text-slate-400`}
                  />
                </div>
                <div>
                  <label className={label}>Driver Name</label>
                  <input
                    type="text"
                    name="driver"
                    placeholder="optional"
                    value={formData.driver}
                    onChange={handleChange}
                    className={`${editableField} placeholder:text-slate-400`}
                  />
                </div>
                <div>
                  <label className={label}>Driver&apos;s Contact No.</label>
                  <input
                    type="tel"
                    name="partnerContact"
                    placeholder="09XXXXXXXXX (optional)"
                    value={formData.partnerContact ?? ""}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs placeholder:text-slate-400 ${
                      errors.partnerContact ? "border-red-500" : "border-slate-300"
                    }`}
                  />
                  {errors.partnerContact && (
                    <p className="mt-1 text-[11px] leading-tight text-red-600">{errors.partnerContact}</p>
                  )}
                </div>
                <div>
                  <label className={label}>Helper #1</label>
                  <input
                    type="text"
                    name="helper1"
                    placeholder="optional"
                    value={formData.helper1}
                    onChange={handleChange}
                    className={`${editableField} placeholder:text-slate-400`}
                  />
                </div>
                <div>
                  <label className={label}>Helper #2</label>
                  <input
                    type="text"
                    name="helper2"
                    placeholder="optional"
                    value={formData.helper2}
                    onChange={handleChange}
                    className={`${editableField} placeholder:text-slate-400`}
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
                    setFormData((previous) => ({ ...previous, [field]: next }));
                    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: "" }));
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

          {/* 6. Notes */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              6. Notes / Instructions (Optional)
            </div>
            <textarea
              name="notes"
              placeholder="Any specific handling instructions..."
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              className="w-full resize-y border border-slate-300 rounded-md px-3 py-2 text-xs"
            />
          </div>

          {/* 7. What happened to this booking, newest first. */}
          <BookingHistory orderID={booking.id} />
        </form>

        {submitError && (
          <div className="shrink-0 mx-4 sm:mx-6 mb-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs">
            {submitError}
          </div>
        )}

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
            Cancel
          </button>

          <button
            type="submit"
            form="assign-booking-form"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : reassigning ? "Re-assign Booking" : "Assign Now"}
          </button>
        </div>

        {showCancelConfirm && (
          <div className="absolute inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in rounded-2xl">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Cancel Booking?</h3>
              <p className="text-sm text-slate-600 mb-6 px-2">
                Are you sure you want to cancel this booking? This action cannot be undone.
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
                  onClick={(event) => {
                    setShowCancelConfirm(false);
                    onCancelBooking(event, booking.id);
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
