// File: app/admindashboard/calendar/in-transit/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  ArrowLeft,
  Truck,
  X,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";

// ==========================================
// DUMMY DATA (Realistic In-Transit records with accumulated history)
// ==========================================
const DUMMY_IN_TRANSIT_BOOKINGS = [
  {
    id: "1",
    orderId: "ORD-1001",
    clientName: "Burger King",
    contactPerson: "John Doe",
    contactNumber: "09123456789",
    emailAddress: "johndoe@burgerking.com",
    businessAddress: "Quezon City",
    product: "Frozen Beef Patties & Buns",
    quantity: "50",
    scheduledDate: "2026-09-10",
    displayDate: "September 10, 2026",
    dateCreated: "September 8, 2026",
    createdBy: "Admin Dispatcher",
    status: "In Transit",
    confirmationStatus: "On Route",
    priorityLevel: "High Priority",
    pickupList: [
      {
        warehouseName: "North Hub Storage",
        warehouseAddress: "Valenzuela City",
        contactPerson: "WH Admin",
        contactNumber: "09991112222",
        pickupTime: "08:00",
        quantity: "50",
        stopStatus: "Completed",
      },
    ],
    deliveryList: [
      {
        branchName: "Burger King QC",
        deliveryAddress: "Quezon City Branch",
        contactPerson: "Branch Mgr",
        contactNumber: "09887776655",
        deliveryTime: "10:00",
        quantity: "50",
        stopStatus: "In Progress",
      },
    ],
    truckPlate: "TRK-103 (Hino 300)",
    driver: "Juan Dela Cruz",
    helper1: "Mark Santos",
    helper2: "Carlo Reyes",
    notes: "Requires strict temperature control. Keep reefer active.",
    crews: [
      { role: "Driver", name: "Juan Dela Cruz", status: "Accepted" },
      { role: "Helper #1", name: "Mark Santos", status: "Accepted" },
      { role: "Helper #2", name: "Carlo Reyes", status: "Accepted" },
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
        details: "Fleet TRK-103 and crew assigned to the delivery schedule.",
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
        dateTime: "Sept 10, 2026 07:15 AM",
        details:
          "Vehicle departed from North Hub Storage. Status changed to In Transit.",
        attachments: "Gate_Pass_1001.pdf",
        staff: "Security Gate",
        role: "Guard",
      },
    ],
  },
  {
    id: "2",
    orderId: "ORD-1002",
    clientName: "Jollibee",
    contactPerson: "Maria Clara",
    contactNumber: "09198887777",
    emailAddress: "maria@jollibee.com",
    businessAddress: "Pasig City",
    product: "Frozen Chicken Products",
    quantity: "100",
    scheduledDate: "2026-09-10",
    displayDate: "September 10, 2026",
    dateCreated: "September 8, 2026",
    createdBy: "Admin User",
    status: "In Transit",
    confirmationStatus: "On Route",
    priorityLevel: "Standard",
    pickupList: [
      {
        warehouseName: "Main Warehouse",
        warehouseAddress: "Pasig Logistics Hub",
        contactPerson: "Head Guard",
        contactNumber: "09176665544",
        pickupTime: "07:00",
        quantity: "100",
        stopStatus: "Completed",
      },
    ],
    deliveryList: [
      {
        branchName: "Jollibee Manila",
        deliveryAddress: "Ermita, Manila",
        contactPerson: "Store Manager",
        contactNumber: "09172223333",
        deliveryTime: "09:30",
        quantity: "100",
        stopStatus: "Pending", // Set as pending to demonstrate the "No" icon variant
      },
    ],
    truckPlate: "TRK-101 (Isuzu Elf)",
    driver: "Luis Manzano",
    helper1: "Pedro Santos",
    helper2: "",
    notes: "Morning delivery preferred. Unload at back bay.",
    crews: [
      { role: "Driver", name: "Luis Manzano", status: "Accepted" },
      { role: "Helper #1", name: "Pedro Santos", status: "Accepted" },
    ],
    remarks: [
      {
        dateTime: "Sept 8, 2026 10:00 AM",
        details: "Booking created and saved.",
        attachments: "N/A",
        staff: "Admin User",
        role: "Administrator",
      },
      {
        dateTime: "Sept 8, 2026 11:20 AM",
        details: "Crew assigned and awaiting confirmations.",
        attachments: "N/A",
        staff: "Admin Dispatcher",
        role: "Dispatcher",
      },
      {
        dateTime: "Sept 9, 2026 08:00 AM",
        details: "Crew confirmed assignment.",
        attachments: "N/A",
        staff: "System",
        role: "Automated",
      },
      {
        dateTime: "Sept 10, 2026 06:45 AM",
        details: "Fleet dispatched. Delivery is now en route.",
        attachments: "Dispatch_Log.pdf",
        staff: "Security Gate",
        role: "Guard",
      },
    ],
  },
  {
    id: "3",
    orderId: "ORD-1003",
    clientName: "McDonald's",
    contactPerson: "Ronald Smith",
    contactNumber: "09223334444",
    emailAddress: "ronald@mcdonalds.com",
    businessAddress: "Makati City",
    product: "Fries & Condiments",
    quantity: "200",
    scheduledDate: "2026-09-10",
    displayDate: "September 10, 2026",
    dateCreated: "September 9, 2026",
    createdBy: "Logistics Coordinator",
    status: "In Transit",
    confirmationStatus: "On Route",
    priorityLevel: "Urgent",
    pickupList: [
      {
        warehouseName: "South Distribution Center",
        warehouseAddress: "Muntinlupa",
        contactPerson: "Dock Manager",
        contactNumber: "09181234567",
        pickupTime: "06:00",
        quantity: "200",
        stopStatus: "Completed",
      },
    ],
    deliveryList: [
      {
        branchName: "McDonald's Makati",
        deliveryAddress: "Ayala Ave, Makati",
        contactPerson: "Shift Sup",
        contactNumber: "09179998888",
        deliveryTime: "08:00",
        quantity: "200",
        stopStatus: "In Progress",
      },
    ],
    truckPlate: "TRK-102 (Mitsubishi Fuso)",
    driver: "Antonio Luna",
    helper1: "Jose Rizal",
    helper2: "Andres Bonifacio",
    notes: "Rush delivery. Proceed directly to Makati via Skyway.",
    crews: [
      { role: "Driver", name: "Antonio Luna", status: "Accepted" },
      { role: "Helper #1", name: "Jose Rizal", status: "Accepted" },
      { role: "Helper #2", name: "Andres Bonifacio", status: "Accepted" },
    ],
    remarks: [
      {
        dateTime: "Sept 9, 2026 03:45 PM",
        details: "Initial urgent booking created.",
        attachments: "N/A",
        staff: "Logistics Coordinator",
        role: "Coordinator",
      },
      {
        dateTime: "Sept 9, 2026 04:00 PM",
        details: "Directly assigned to available standby crew.",
        attachments: "N/A",
        staff: "Admin Dispatcher",
        role: "Dispatcher",
      },
      {
        dateTime: "Sept 10, 2026 05:30 AM",
        details: "Truck loaded and dispatched from South DC.",
        attachments: "Waybill_1003.jpg",
        staff: "Dock Manager",
        role: "Warehouse",
      },
    ],
  },
];

const ITEMS_PER_PAGE = 10;

// ==========================================
// STATUS BADGE HELPERS
// ==========================================
const getStatusBadgeClass = (status: string) => {
  if (status === "On Route" || status === "In Transit") {
    return "bg-blue-100 text-blue-800 border border-blue-200";
  }
  if (status === "Delayed") {
    return "bg-red-100 text-red-800 border border-red-200";
  }
  return "bg-amber-100 text-amber-800 border border-amber-200";
};

// Reusable Component for inside Form lists: Pickup/Delivery Stop Statuses
const StopStatusBadge = ({ status }: { status?: string }) => {
  const currentStatus = status || "Pending";
  const normalized = currentStatus.toLowerCase();

  // ✓ Check — Completed
  if (
    normalized === "completed" ||
    normalized === "yes" ||
    normalized === "done"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {currentStatus}
      </span>
    );
  }

  // 🕒 Clock — In Progress
  if (normalized === "in progress") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
        <Clock className="w-3.5 h-3.5" />
        {currentStatus}
      </span>
    );
  }

  // ❌ No — Default/Pending/Not Completed
  const displayText = currentStatus === "Pending" ? "No" : currentStatus;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 shadow-sm">
      <X className="w-3.5 h-3.5" />
      {displayText}
    </span>
  );
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
  const currentIndex = PROGRESS_STAGES.indexOf(currentStatus);

  return (
    <div className="w-full px-2">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.75 bg-slate-200 rounded-full z-0"></div>
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.75 bg-blue-500 rounded-full z-0 transition-all duration-500"
          style={{
            width: `${Math.max(0, (currentIndex / (PROGRESS_STAGES.length - 1)) * 100)}%`,
          }}
        ></div>

        {PROGRESS_STAGES.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;

          let iconBg = "bg-slate-200 text-slate-400 border-slate-200";
          if (isCompleted) iconBg = "bg-blue-500 text-white border-blue-500";
          if (isActive)
            iconBg =
              "bg-white text-blue-600 border-[1.5px] border-blue-500 shadow-sm ring-2 ring-blue-50";

          return (
            <div
              key={stage}
              className="relative z-10 flex flex-col items-center gap-1 w-10"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${iconBg}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-blue-600 animate-pulse" : "bg-slate-300"}`}
                  ></div>
                )}
              </div>
              <span
                className={`text-[8px] sm:text-[9px] font-bold text-center whitespace-nowrap tracking-wide ${isActive ? "text-blue-700" : isCompleted ? "text-slate-700" : "text-slate-400"}`}
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
  onCancelBooking: (e: React.MouseEvent, bookingId: string) => void;
}

function BookingDetailsModal({
  isOpen,
  onClose,
  booking,
  onCancelBooking,
}: BookingDetailsModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState<any>({});
  const [pickupList, setPickupList] = useState<any[]>([]);
  const [deliveryList, setDeliveryList] = useState<any[]>([]);
  const [isSubconMode, setIsSubconMode] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && booking) {
      setIsSubconMode(false);
      setShowCancelConfirm(false);

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
      });

      setPickupList(
        booking.pickupList?.length
          ? JSON.parse(JSON.stringify(booking.pickupList))
          : [
              {
                warehouseName: "Main Warehouse",
                warehouseAddress: "Manila Hub",
                contactPerson: "Warehouse Admin",
                contactNumber: "09181112233",
                pickupTime: "08:00",
                quantity: "50",
                stopStatus: "Completed",
              },
            ],
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
                deliveryTime: "12:00",
                quantity: "50",
                stopStatus: "Pending",
              },
            ],
      );

      setTimeout(() => {
        crewSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [isOpen, booking, currentDate]);

  if (!isOpen || !booking) return null;

  // In Transit bookings are generally read-only in this modal context
  const isEditable = false;

  const inputClass = isEditable
    ? "w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
    : "w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 cursor-default focus:outline-none";

  const tableInputClass = isEditable
    ? "w-full bg-transparent border border-slate-200 rounded px-1.5 py-1"
    : "w-full bg-transparent border-none px-1.5 py-1 font-medium text-slate-700 cursor-default focus:outline-none";

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
                      {/* Added Stop Status cell for Pickup Table */}
                      <td className="p-2 text-center bg-slate-50 align-top">
                        <StopStatusBadge
                          status={row.stopStatus || "Completed"}
                        />
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
                        <StopStatusBadge status={row.stopStatus} />
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

          {/* 7. Remarks */}
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
        <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-200 hover:bg-black hover:text-white text-slate-800 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Close Details
          </button>
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
                    onCancelBooking(e, booking.orderId);
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

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function InTransitFeedPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredBookings = DUMMY_IN_TRANSIT_BOOKINGS.filter(
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

  const handleCancelBooking = (e: React.MouseEvent, bookingId: string) => {
    e.stopPropagation();
    alert(`Cancel booking logic triggered for Order: ${bookingId}`);
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
              <Truck className="w-6 h-6 text-blue-500" />
              In-Transit Feed
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Monitor active deliveries currently on the road.
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
            Active Deliveries
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
                        className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getStatusBadgeClass(booking.confirmationStatus)}`}
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
                        No in-transit bookings found
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        There are currently no active deliveries on the road or
                        matching your search.
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
        onCancelBooking={handleCancelBooking}
      />
    </div>
  );
}
