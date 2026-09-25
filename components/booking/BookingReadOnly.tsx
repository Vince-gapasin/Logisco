"use client";

import type { RefObject } from "react";

// The parts of a booking that a screen only shows, never changes: who booked
// it, when it is for, who is carrying it and what was written on it.
//
// The in-transit and completed screens held these twice, byte for byte. A
// trip on the road and a trip that is over are read the same way, so they are
// read from one place now.

export const readOnlyInputClass =
  "w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 cursor-default focus:outline-none";

const panel = "border border-slate-200 rounded-xl p-4 bg-white shadow-xs";
const heading = "border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide";
const label = "block text-xs font-medium text-black mb-1";
const crewLabel = "block text-xs sm:text-[11px] font-medium text-slate-500 mb-1";

function Field({ title, value, className = readOnlyInputClass }: { title: string; value: string; className?: string }) {
  return (
    <div>
      <label className={label}>{title}</label>
      <input type="text" readOnly value={value} className={className} />
    </div>
  );
}

export interface BookingFields {
  clientName?: string;
  contactPerson?: string;
  contactNumber?: string;
  emailAddress?: string;
  businessAddress?: string;
  product?: string;
  priorityLevel?: string;
  truckPlate?: string;
  driver?: string;
  helper1?: string;
  helper2?: string;
  notes?: string;
}

export function ClientInformation({ fields }: { fields: BookingFields }) {
  return (
    <div className={panel}>
      <div className={heading}>1. Client Information</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <Field
          title="Company Name"
          value={fields.clientName ?? ""}
          className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold text-slate-700"
        />
        <Field title="Contact Person" value={fields.contactPerson ?? ""} />
        <Field title="Contact Number" value={fields.contactNumber ?? ""} />
        <Field title="Email Address" value={fields.emailAddress ?? ""} />
        <Field title="Business Address" value={fields.businessAddress ?? ""} />
      </div>
    </div>
  );
}

export function BookingSchedule({ fields, scheduledFor }: { fields: BookingFields; scheduledFor: string }) {
  return (
    <div className={panel}>
      <div className={heading}>4. Booking Details &amp; Schedule</div>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-4 md:col-span-3">
          <label className={label}>Delivery Schedule</label>
          <input type="text" readOnly value={scheduledFor} className={readOnlyInputClass} />
        </div>
        <div className="sm:col-span-5 md:col-span-6">
          <label className={label}>Product To Deliver</label>
          <input type="text" readOnly value={fields.product ?? ""} className={readOnlyInputClass} />
        </div>
        <div className="sm:col-span-3 md:col-span-3">
          <label className={label}>Priority Level</label>
          <input readOnly value={fields.priorityLevel ?? ""} className={readOnlyInputClass} />
        </div>
      </div>
    </div>
  );
}

export function AssignedCrew({
  fields,
  sectionRef,
}: {
  fields: BookingFields;
  /** The modal scrolls here when it opens. */
  sectionRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={sectionRef} className={`${panel} scroll-mt-4`}>
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
        <span className="font-semibold text-black text-sm tracking-wide">
          5. Assigned Delivery Crews &amp; Vehicle
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className={crewLabel}>Truck Plate No.</label>
          <input readOnly value={fields.truckPlate || "Not Assigned"} className={readOnlyInputClass} />
        </div>
        <div>
          <label className={crewLabel}>Driver</label>
          <input readOnly value={fields.driver || "Not Assigned"} className={readOnlyInputClass} />
        </div>
        <div>
          <label className={crewLabel}>Helper #1</label>
          <input readOnly value={fields.helper1 || "Not Assigned"} className={readOnlyInputClass} />
        </div>
        <div>
          <label className={crewLabel}>Helper #2</label>
          <input readOnly value={fields.helper2 || "Not Assigned"} className={readOnlyInputClass} />
        </div>
      </div>
    </div>
  );
}

export function BookingNotes({ notes }: { notes: string }) {
  return (
    <div className={panel}>
      <div className={heading}>6. Notes / Instructions</div>
      <textarea
        name="notes"
        rows={3}
        readOnly
        value={notes}
        className="w-full resize-y rounded-md px-3 py-2 text-xs bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none cursor-default"
      />
    </div>
  );
}
