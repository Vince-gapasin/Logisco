"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileText, X } from "lucide-react";
import RecoveryPanel from "@/components/foulTrip/RecoveryPanel";
import type { IncidentView } from "@/services/foulTrip/foulTripService";
import type { FeedBooking } from "@/app/lib/bookingView";

// The foul-trip details and recovery screen. Shared by the Foul Trip feed and
// the dashboard's Foul Trip list, so a booking opens the same way from both.

// A booking is listed while its incident is open. Each row carries its
// incident, and the details section reads what the crew actually reported
// instead of parsing the trip note.
export type FoulTripRow = FeedBooking & { incident: IncidentView | null };

export function attachIncident(booking: FeedBooking, incident: IncidentView | undefined): FoulTripRow {
  if (!incident) return { ...booking, incident: null };
  const located = incident.latitude != null && incident.longitude != null;
  return {
    ...booking,
    incident,
    foulDetails: {
      reason: incident.issueType,
      reportedAt: new Date(incident.reportedAt).toLocaleString("en-PH"),
      reportedBy: [incident.reporterName, incident.reporterContact].filter(Boolean).join(" · ") || "Crew",
      description: [
        incident.details,
        located ? `Location: ${incident.latitude!.toFixed(5)}, ${incident.longitude!.toFixed(5)}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      attachment: incident.photoUrl ?? "",
    },
  };
}

const renderStopStatus = (status?: string) => {
  const currentStatus = status || "Pending";
  const s = currentStatus.toLowerCase();

  if (s === "in progress") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" /> {currentStatus}
      </span>
    );
  } else if (s.includes("deliver") || s === "completed" || s === "complete") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="w-3 h-3" /> {currentStatus}
      </span>
    );
  } else {
    // Treat as Not Completed / Pending / No
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 border border-red-200">
        <X className="w-3 h-3" />{" "}
        {currentStatus === "Pending" ? "No" : currentStatus}
      </span>
    );
  }
};

// ==========================================
// PROGRESS TRACKER COMPONENT
// ==========================================
const PROGRESS_STAGES = [
  "Created",
  "Assigned",
  "In Transit",
  "Complete",
  "Returned",
];

function DeliveryProgress({ currentStatus }: { currentStatus: string }) {
  const currentIndex = PROGRESS_STAGES.indexOf("In Transit");

  return (
    <div className="w-full px-2">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.75 bg-slate-200 rounded-full z-0"></div>
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.75 bg-red-500 rounded-full z-0 transition-all duration-500"
          style={{
            width: `${Math.max(0, (currentIndex / (PROGRESS_STAGES.length - 1)) * 100)}%`,
          }}
        ></div>

        {PROGRESS_STAGES.map((stage, index) => {
          const isCompleted = index <= currentIndex;
          const isActive = index === currentIndex;

          let iconBg = "bg-slate-200 text-slate-400 border-slate-200";
          if (isCompleted && !isActive)
            iconBg = "bg-red-500 text-white border-red-500";
          if (isActive)
            iconBg =
              "bg-white text-red-600 border-[1.5px] border-red-500 shadow-sm ring-2 ring-red-50";

          return (
            <div
              key={stage}
              className="relative z-10 flex flex-col items-center gap-1 w-10"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${iconBg}`}
              >
                {isCompleted && !isActive ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : isActive ? (
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                )}
              </div>
              <span
                className={`text-[8px] sm:text-[9px] font-bold text-center whitespace-nowrap tracking-wide ${isActive ? "text-red-700" : isCompleted ? "text-slate-700" : "text-slate-400"}`}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// BOOKING DETAILS MODAL
// ==========================================
interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedSuccess: (message: string) => void;
  booking: any;
}

export default function FoulTripDetailsModal({
  isOpen,
  onClose,
  onProceedSuccess,
  booking,
}: BookingDetailsModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState<any>({});
  const [pickupList, setPickupList] = useState<any[]>([]);
  const [deliveryList, setDeliveryList] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && booking) {
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
        truckPlate:
          booking.truckPlate === "Not Assigned" ? "" : booking.truckPlate,
        driver: booking.driver === "Not Assigned" ? "" : booking.driver,
        helper1: booking.helper1 === "Not Assigned" ? "" : booking.helper1,
        helper2: booking.helper2 === "Not Assigned" ? "" : booking.helper2,
        notes: booking.notes || "",
        foulDetails: booking.foulDetails || {},
      });

      setPickupList(
        booking.pickupList?.length
          ? JSON.parse(JSON.stringify(booking.pickupList))
          : [],
      );

      setDeliveryList(
        booking.deliveryList?.length
          ? JSON.parse(JSON.stringify(booking.deliveryList))
          : [],
      );
    }
  }, [isOpen, booking, currentDate]);


  if (!isOpen || !booking) return null;

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 cursor-default focus:outline-none";
  const tableInputClass =
    "w-full bg-transparent border-none px-1.5 py-1 font-medium text-slate-700 cursor-default focus:outline-none";


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
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-900">
          {/* Top Info & Progress Tracker */}
          <div className="border border-slate-200 rounded-xl p-4 md:p-6 bg-white shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto flex-1">
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Date Created
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.dateCreated}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Created By
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.createdBy}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
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
              <h3 className="text-xs sm:text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 md:text-right">
                Delivery Progress
              </h3>
              <DeliveryProgress currentStatus={booking.status} />
            </div>
          </div>

          {/* 1. Recovery. booking.incident is attached by the page from
              /api/foul-trips; a booking without one cannot be acted on. */}
          {booking.incident ? (
            <RecoveryPanel incident={booking.incident} onDone={onProceedSuccess} />
          ) : (
            <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 text-sm text-amber-900">
              This foul trip has no incident record, so no recovery can be started from here.
            </div>
          )}

          {/* ========================================== */}
          {/* 2. Foul Trip Details                  */}
          {/* ========================================== */}
          <div className="border border-red-200 rounded-xl p-4 bg-red-50/30 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <AlertTriangle className="w-24 h-24 text-red-600" />
            </div>
            <div className="flex items-center gap-2 border-b border-red-200 pb-2 mb-4 font-bold text-red-700 text-sm tracking-wide">
              <AlertTriangle className="w-4 h-4" /> Foul Trip Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4 relative z-10">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Incident Reason
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.foulDetails?.reason || ""}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-bold text-red-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reported Date & Time
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.foulDetails?.reportedAt || ""}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reported By
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.foulDetails?.reportedBy || ""}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Attachment
                </label>
                {formData.foulDetails?.attachment ? (
                  <a
                    href={formData.foulDetails.attachment}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-md p-2 hover:bg-slate-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={formData.foulDetails.attachment} alt="Photo from the crew" className="w-12 h-12 rounded object-cover shrink-0" />
                    <span className="text-xs font-bold text-blue-600 hover:underline">View photo full size</span>
                  </a>
                ) : (
                  <input
                    type="text"
                    readOnly
                    value="No Attachment"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-medium text-slate-400 focus:outline-none italic"
                  />
                )}
              </div>
            </div>

            <div className="relative z-10">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Incident Description / Remarks
              </label>
              <textarea
                readOnly
                rows={3}
                value={formData.foulDetails?.description || ""}
                className="w-full resize-y rounded-md px-3 py-2 text-xs bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none cursor-default"
              />
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
                  Company Name
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
                  readOnly
                  value={formData.contactPerson}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.contactNumber}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  readOnly
                  value={formData.emailAddress}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Business Address
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.businessAddress}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* 2. Pickup Address */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                2. Pickup Addresses
              </span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg pb-2">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Warehouse Name
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[25%]">
                      Address
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Person
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Number
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[12%]">
                      Pick Up Time
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-24 text-center">
                      Quantity
                    </th>
                    <th className="p-2.5 text-center w-[10%]">
                      <div className="flex items-center justify-center gap-1.5">
                        Stop Status
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pickupList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium align-middle">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          readOnly
                          value={row.warehouseName}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.warehouseAddress}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.contactPerson}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.contactNumber}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="time"
                          value={row.pickupTime}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="number"
                          value={row.quantity}
                          readOnly
                          className={`${tableInputClass} min-w-15 text-center`}
                        />
                      </td>
                      <td className="p-2 text-center bg-slate-50 align-top">
                        {renderStopStatus(row.stopStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Delivery Address */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                3. Delivery Address
              </span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg pb-2">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Branch Name
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Delivery Address
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Person
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Number
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[10%]">
                      Delivery Time
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-16 text-center">
                      Quantity
                    </th>
                    <th className="p-2.5 text-center w-[10%]">
                      <div className="flex items-center justify-center gap-1.5">
                        Stop Status
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium align-middle">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          readOnly
                          value={row.branchName}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.deliveryAddress}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.contactPerson}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="text"
                          value={row.contactNumber}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="time"
                          value={row.deliveryTime}
                          readOnly
                          className={tableInputClass}
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top bg-slate-50">
                        <input
                          type="number"
                          value={row.quantity}
                          readOnly
                          className={`${tableInputClass} min-w-15 text-center`}
                        />
                      </td>
                      <td className="p-2 text-center bg-slate-50 align-top">
                        {renderStopStatus(row.stopStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Booking Details & Schedule */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Booking Details & Schedule
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4 md:col-span-3">
                <label className="block text-xs font-medium text-black mb-1">
                  Delivery Schedule
                </label>
                <input
                  type="text"
                  readOnly
                  value={booking.displayDate}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-5 md:col-span-6">
                <label className="block text-xs font-medium text-black mb-1">
                  Product To Deliver
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.product}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-3 md:col-span-3">
                <label className="block text-xs font-medium text-black mb-1">
                  Priority Level
                </label>
                <input
                  readOnly
                  value={formData.priorityLevel}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* 5. Assigned Crew / Vehicle */}
          <div
            ref={crewSectionRef}
            className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs scroll-mt-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                5. Assigned Delivery Crews & Vehicle
              </span>
            </div>

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
          </div>

          {/* 6. Notes / Instructions */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              6. Notes / Instructions
            </div>
            <textarea
              name="notes"
              rows={3}
              readOnly
              value={formData.notes}
              className={`w-full resize-y rounded-md px-3 py-2 text-xs bg-slate-50 border border-slate-200 font-medium text-slate-700 focus:outline-none cursor-default`}
            />
          </div>

          {/* 7. Remarks History */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              7. Remarks History
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center">
                      #
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[18%]">
                      Date & Time
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[35%]">
                      Details
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[17%]">
                      Attachments
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Staff
                    </th>
                    <th className="p-2.5 w-[15%]">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.remarks && booking.remarks.length > 0 ? (
                    booking.remarks.map((r: any, idx: number) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-200 font-medium text-slate-700"
                      >
                        <td className="p-2 border-r border-slate-200 text-center bg-slate-50">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200 bg-slate-50">
                          {r.dateTime}
                        </td>
                        <td className="p-2 border-r border-slate-200 bg-slate-50">
                          {r.details}
                        </td>
                        <td className="p-2 border-r border-slate-200 bg-slate-50">
                          {r.attachments || "N/A"}
                        </td>
                        <td className="p-2 border-r border-slate-200 bg-slate-50">
                          {r.staff}
                        </td>
                        <td className="p-2 bg-slate-50">{r.role}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-4 text-center text-slate-500 italic bg-slate-50"
                      >
                        No remarks found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FIXED FOOTER */}
        <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-200 hover:bg-black hover:text-white text-slate-800 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

