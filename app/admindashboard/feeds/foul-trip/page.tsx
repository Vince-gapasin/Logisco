// File: app/admindashboard/feeds/fouls/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  ArrowLeft,
  AlertTriangle,
  X,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  Truck,
  Wrench,
  Paperclip,
} from "lucide-react";

// ==========================================
// DUMMY DATA (Realistic Foul Trip records with Full Pending History)
// ==========================================
const DUMMY_FOUL_BOOKINGS = [
  {
    id: "1",
    orderId: "ORD-1004",
    clientName: "KFC Philippines",
    contactPerson: "Col. Sanders",
    contactNumber: "09171234567",
    emailAddress: "logistics@kfc.ph",
    businessAddress: "Quezon City",
    product: "Frozen Chicken Parts",
    quantity: "150",
    scheduledDate: "2026-09-10",
    displayDate: "September 10, 2026",
    dateCreated: "September 8, 2026",
    createdBy: "Admin Dispatcher",
    status: "Foul Trip",
    confirmationStatus: "Vehicle Breakdown",
    priorityLevel: "Urgent",
    foulDetails: {
      reason: "Vehicle Breakdown",
      reportedAt: "Sept 10, 2026 08:30 AM",
      reportedBy: "Driver - Antonio Luna",
      description:
        "Engine overheated while traversing the Skyway. The vehicle lost power and requires immediate towing. Goods are still sealed but temperature control might be compromised if not transferred within 2 hours.",
      attachment: "Engine_Photo_Skyway.jpg",
    },
    pickupList: [
      {
        warehouseName: "Cold Storage Hub South",
        warehouseAddress: "Taguig City",
        contactPerson: "WH Admin",
        contactNumber: "09991112222",
        pickupTime: "06:00",
        quantity: "150",
        stopStatus: "Completed",
      },
    ],
    deliveryList: [
      {
        branchName: "KFC Commonwealth",
        deliveryAddress: "Commonwealth Ave, QC",
        contactPerson: "Branch Mgr",
        contactNumber: "09887776655",
        deliveryTime: "09:00",
        quantity: "150",
        stopStatus: "Pending",
      },
    ],
    truckPlate: "TRK-105 (Isuzu Forward)",
    driver: "Antonio Luna",
    helper1: "Jose Rizal",
    helper2: "",
    notes: "Requires strict temperature control below -18C.",
    crews: [
      { role: "Driver", name: "Antonio Luna", status: "Accepted" },
      { role: "Helper #1", name: "Jose Rizal", status: "Accepted" },
    ],
    remarks: [
      {
        dateTime: "Sept 8, 2026 08:15 AM",
        details: "Booking successfully created and logged into the system.",
        attachments: "N/A",
        staff: "Admin Dispatcher",
        role: "Dispatcher",
      },
      {
        dateTime: "Sept 9, 2026 09:30 AM",
        details: "Fleet TRK-105 and crew assigned to the delivery schedule.",
        attachments: "N/A",
        staff: "Logistics Coordinator",
        role: "Coordinator",
      },
      {
        dateTime: "Sept 9, 2026 11:45 AM",
        details: "All assigned crew members accepted the delivery.",
        attachments: "N/A",
        staff: "System",
        role: "Automated",
      },
      {
        dateTime: "Sept 10, 2026 06:15 AM",
        details:
          "Vehicle departed from Cold Storage Hub South. Status changed to In Transit.",
        attachments: "Gate_Pass_1004.pdf",
        staff: "Security Gate",
        role: "Guard",
      },
      {
        dateTime: "Sept 10, 2026 08:30 AM",
        details:
          "REPORTED INCIDENT: Engine overheated on Skyway. Status changed to Foul Trip.",
        attachments: "Engine_Photo_Skyway.jpg",
        staff: "Antonio Luna",
        role: "Driver",
      },
    ],
  },
  {
    id: "2",
    orderId: "ORD-1005",
    clientName: "Puregold",
    contactPerson: "Aling Puring",
    contactNumber: "09198887777",
    emailAddress: "logistics@puregold.com",
    businessAddress: "Manila City",
    product: "Assorted Canned Goods",
    quantity: "300",
    scheduledDate: "2026-09-10",
    displayDate: "September 10, 2026",
    dateCreated: "September 9, 2026",
    createdBy: "Logistics Coordinator",
    status: "Foul Trip",
    confirmationStatus: "Client Rejection",
    priorityLevel: "Standard",
    foulDetails: {
      reason: "Client Rejection - Wrong Specs",
      reportedAt: "Sept 10, 2026 10:45 AM",
      reportedBy: "Helper - Pedro Santos",
      description:
        "Store manager refused to accept the delivery. Claimed the canned goods delivered were 150g instead of the requested 250g specification in their PO.",
      attachment: "Rejection_Slip_Signed.pdf",
    },
    pickupList: [
      {
        warehouseName: "Main Distribution Center",
        warehouseAddress: "Bulacan Logistics Hub",
        contactPerson: "Head Guard",
        contactNumber: "09176665544",
        pickupTime: "07:00",
        quantity: "300",
        stopStatus: "Completed",
      },
    ],
    deliveryList: [
      {
        branchName: "Puregold Tondo",
        deliveryAddress: "Tondo, Manila",
        contactPerson: "Store Manager",
        contactNumber: "09172223333",
        deliveryTime: "10:30",
        quantity: "300",
        stopStatus: "Pending",
      },
    ],
    truckPlate: "TRK-108 (Fuso Canter)",
    driver: "Luis Manzano",
    helper1: "Pedro Santos",
    helper2: "",
    notes: "Unload at the secondary loading bay.",
    crews: [
      { role: "Driver", name: "Luis Manzano", status: "Accepted" },
      { role: "Helper #1", name: "Pedro Santos", status: "Accepted" },
    ],
    remarks: [
      {
        dateTime: "Sept 9, 2026 10:00 AM",
        details: "Booking created and saved.",
        attachments: "N/A",
        staff: "Logistics Coordinator",
        role: "Coordinator",
      },
      {
        dateTime: "Sept 9, 2026 11:20 AM",
        details: "Crew assigned and awaiting confirmations.",
        attachments: "N/A",
        staff: "Admin Dispatcher",
        role: "Dispatcher",
      },
      {
        dateTime: "Sept 9, 2026 01:15 PM",
        details: "Crew confirmed assignment.",
        attachments: "N/A",
        staff: "System",
        role: "Automated",
      },
      {
        dateTime: "Sept 10, 2026 07:15 AM",
        details: "Fleet dispatched. Delivery is now en route.",
        attachments: "Dispatch_Log.pdf",
        staff: "Security Gate",
        role: "Guard",
      },
      {
        dateTime: "Sept 10, 2026 10:45 AM",
        details:
          "INCIDENT: Client rejected goods upon inspection at the dock. Refusal form signed.",
        attachments: "Rejection_Slip_Signed.pdf",
        staff: "Pedro Santos",
        role: "Helper",
      },
    ],
  },
];

const ITEMS_PER_PAGE = 10;

// ==========================================
// STATUS BADGE HELPERS
// ==========================================
const getStatusBadgeClass = (status: string) => {
  if (
    status === "Vehicle Breakdown" ||
    status === "Client Rejection" ||
    status === "Accident"
  ) {
    return "bg-red-100 text-red-800 border border-red-200";
  }
  return "bg-amber-100 text-amber-800 border border-amber-200";
};

const renderStopStatus = (status?: string) => {
  const currentStatus = status || "Pending";
  const s = currentStatus.toLowerCase();

  if (s === "in progress") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" /> {currentStatus}
      </span>
    );
  } else if (s === "completed" || s === "complete") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="w-3 h-3" /> {currentStatus}
      </span>
    );
  } else {
    // Treat as Not Completed / Pending / No
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 border border-red-200">
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
  // For foul trips, it usually halted at "In Transit" before completing
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
  booking: any;
}

function BookingDetailsModal({
  isOpen,
  onClose,
  booking,
}: BookingDetailsModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState<any>({});
  const [pickupList, setPickupList] = useState<any[]>([]);
  const [deliveryList, setDeliveryList] = useState<any[]>([]);
  const [selectedRecoveryAction, setSelectedRecoveryAction] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (isOpen && booking) {
      // Reset selected action on open
      setSelectedRecoveryAction(null);

      setFormData({
        clientName: booking.clientName || "",
        contactPerson: booking.contactPerson || "Juan Dela Cruz",
        contactNumber: booking.contactNumber || "09123456789",
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

  const recoveryOptions = [
    {
      id: "reschedule",
      title: "Reschedule Delivery",
      description: "Reschedule delivery for a later date and time",
      icon: Calendar,
    },
    {
      id: "reassign",
      title: "Re-assign New Staff and Vehicle",
      description: "Re-assign this booking to another driver and vehicle",
      icon: Users,
    },
    {
      id: "subcon",
      title: "Assign Sub-Con Truck",
      description: "Assign a Sub-Con Truck to this booking",
      icon: Truck,
    },
    {
      id: "inspection",
      title: "Request Inspection",
      description: "Request inspection to the mechanic",
      icon: Wrench,
    },
  ];

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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Date Created
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.dateCreated}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Created By
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.createdBy}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Order Priority
                </p>
                <span
                  className={`inline-flex px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wider ${
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
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 md:text-right">
                Delivery Progress
              </h3>
              <DeliveryProgress currentStatus={booking.status} />
            </div>
          </div>

          {/* ========================================== */}
          {/* 1. Foul Trip – Choose Recovery Action */}
          {/* ========================================== */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              Foul Trip – Choose Recovery Action
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recoveryOptions.map((option) => {
                const isSelected = selectedRecoveryAction === option.id;
                const Icon = option.icon;
                return (
                  <div
                    key={option.id}
                    onClick={() => setSelectedRecoveryAction(option.id)}
                    className={`flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div
                        className={`p-2 rounded-lg ${isSelected ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-blue-500" : "border-slate-300"}`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                    <h4
                      className={`font-bold text-xs mb-1 ${isSelected ? "text-blue-900" : "text-slate-800"}`}
                    >
                      {option.title}
                    </h4>
                    <p
                      className={`text-[10px] leading-snug ${isSelected ? "text-blue-700/80" : "text-slate-500"}`}
                    >
                      {option.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

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
                  <div className="w-full flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-2">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span
                      className="text-xs font-bold text-blue-600 truncate cursor-pointer hover:underline"
                      title={formData.foulDetails.attachment}
                    >
                      {formData.foulDetails.attachment}
                    </span>
                  </div>
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
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Truck Plate No.
                </label>
                <input
                  readOnly
                  value={formData.truckPlate || "Not Assigned"}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Driver
                </label>
                <input
                  readOnly
                  value={formData.driver || "Not Assigned"}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Helper #1
                </label>
                <input
                  readOnly
                  value={formData.helper1 || "Not Assigned"}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
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
            {/* Primary save button if actionable */}
            {selectedRecoveryAction && (
              <button
                type="button"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-sm"
              >
                Proceed with Recovery
              </button>
            )}
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

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function FoulTripFeedPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredBookings = DUMMY_FOUL_BOOKINGS.filter(
    (booking) =>
      booking.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.product.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ==========================================
  // PAGINATION SETUP
  // ==========================================
  const totalBookings = filteredBookings.length;
  const totalPages = Math.max(Math.ceil(totalBookings / ITEMS_PER_PAGE), 1);
  const startIndex =
    totalBookings === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalBookings);

  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleOpenModal = (booking: any) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen relative">
      {/* ========================================== */}
      {/* HEADER */}
      {/* ========================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admindashboard/dashboard")}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              Foul Trip Feed
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Inspect cancelled or failed trip exceptions and incidents.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* ========================================== */}
        {/* FILTERS */}
        {/* ========================================== */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Trip Exceptions
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search order ID, client, product..."
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* TABLE */}
        {/* ========================================== */}
        <div className="overflow-x-auto min-h-135">
          <table className="w-full text-left border-collapse min-w-250 table-fixed">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 pl-6 sm:pl-8 pr-4 w-[12%] align-top">
                  Order ID
                </th>
                <th className="py-3.5 px-4 w-[15%] align-top">Client Name</th>
                <th className="py-3.5 px-4 w-[20%] align-top">
                  Product to Deliver
                </th>
                <th className="py-3.5 px-4 w-[15%] align-top">
                  Scheduled Date
                </th>
                <th className="py-3.5 px-4 w-[20%] align-top">Assigned Crew</th>
                <th className="py-3.5 pl-4 pr-6 sm:pr-8 w-[18%] align-top">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedBookings.length > 0 ? (
                paginatedBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    onClick={() => handleOpenModal(booking)}
                    className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-sm text-slate-800 cursor-pointer"
                  >
                    <td className="py-4 pl-6 sm:pl-8 pr-4 font-medium text-slate-900 align-top">
                      {booking.orderId}
                    </td>
                    <td className="py-4 px-4 font-medium align-top">
                      {booking.clientName}
                    </td>
                    <td className="py-4 px-4 align-top text-slate-600 truncate">
                      {booking.product}
                    </td>
                    <td className="py-4 px-4 align-top">
                      {booking.displayDate}
                    </td>

                    <td className="py-4 px-4 align-top">
                      {booking.crews && booking.crews.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {booking.crews.map((crew: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center text-xs truncate"
                            >
                              <span className="font-semibold text-slate-700 mr-1.5 shrink-0 w-16">
                                {crew.role}:
                              </span>
                              <span className="truncate text-slate-900">
                                {crew.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 italic text-xs font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Not Assigned
                        </span>
                      )}
                    </td>

                    {/* STATUS COLUMN */}
                    <td className="py-4 pl-4 pr-6 sm:pr-8 align-top">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getStatusBadgeClass(
                          booking.confirmationStatus,
                        )}`}
                      >
                        {booking.confirmationStatus}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        No foul trip bookings found
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        There are currently no active trip exceptions matching
                        your search.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ========================================== */}
        {/* PAGINATION */}
        {/* ========================================== */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {startIndex} to {endIndex} of {totalBookings} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage <= 1
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
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
              disabled={currentPage >= totalPages}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage >= totalPages
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Booking Details Modal */}
      <BookingDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        booking={selectedBooking}
      />
    </div>
  );
}
