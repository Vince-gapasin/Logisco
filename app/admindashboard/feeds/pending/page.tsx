// File: app/admindashboard/calendar/pending-bookings/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  ArrowLeft,
  CalendarDays,
  X,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";

// ==========================================
// DUMMY DATA (Enriched to match the detailed form fields)
// ==========================================
const DUMMY_PENDING_BOOKINGS = [
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
    scheduledDate: "2026-09-14",
    displayDate: "September 14, 2026",
    dateCreated: "September 10, 2026",
    createdBy: "Admin Dispatcher",
    status: "Created",
    confirmationStatus: "Pending Crew",
    priorityLevel: "High Priority",
    pickupList: [
      {
        warehouseName: "North Hub Storage",
        warehouseAddress: "Valenzuela City",
        contactPerson: "WH Admin",
        contactNumber: "09991112222",
        pickupTime: "08:00",
        quantity: "50",
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
        stopStatus: "Pending",
      },
    ],
    truckPlate: "TRK-103 (Hino 300)",
    driver: "Juan Dela Cruz",
    helper1: "Mark Santos",
    helper2: "Carlo Reyes",
    notes: "Requires strict temperature control.",
    crews: [
      { role: "Driver", name: "Juan Dela Cruz", status: "Accepted" },
      { role: "Helper #1", name: "Mark Santos", status: "Pending" },
      { role: "Helper #2", name: "Carlo Reyes", status: "Pending" },
    ],
    remarks: [
      {
        dateTime: "Sept 10, 2026 08:15 AM",
        details: "Booking successfully created and logged into the system.",
        attachments: "N/A",
        staff: "Admin Dispatcher",
        role: "Dispatcher",
      },
      {
        dateTime: "Sept 11, 2026 09:30 AM",
        details: "Client followed up to confirm priority level.",
        attachments: "N/A",
        staff: "Support Rep",
        role: "Customer Support",
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
    scheduledDate: "2026-09-14",
    displayDate: "September 14, 2026",
    dateCreated: "September 11, 2026",
    createdBy: "Admin User",
    status: "Assigned",
    confirmationStatus: "Crew to Start Delivery",
    priorityLevel: "Standard",
    pickupList: [
      {
        warehouseName: "Main Warehouse",
        warehouseAddress: "Pasig Logistics Hub",
        contactPerson: "Head Guard",
        contactNumber: "09176665544",
        pickupTime: "07:00",
        quantity: "100",
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
        stopStatus: "Pending",
      },
    ],
    truckPlate: "TRK-101 (Isuzu Elf)",
    driver: "Juan Dela Cruz",
    helper1: "Mark Santos",
    helper2: "",
    notes: "Morning delivery preferred.",
    crews: [
      { role: "Driver", name: "Juan Dela Cruz", status: "Accepted" },
      { role: "Helper #1", name: "Mark Santos", status: "Accepted" },
    ],
    remarks: [
      {
        dateTime: "Sept 11, 2026 10:00 AM",
        details: "Booking created and resources allocated.",
        attachments: "N/A",
        staff: "Admin User",
        role: "Administrator",
      },
      {
        dateTime: "Sept 12, 2026 01:20 PM",
        details: "All crew members have confirmed their assignment.",
        attachments: "N/A",
        staff: "System",
        role: "Automated",
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
    scheduledDate: "2026-09-15",
    displayDate: "September 15, 2026",
    dateCreated: "September 11, 2026",
    createdBy: "Logistics Coordinator",
    status: "Assigned",
    confirmationStatus: "Pending Crew",
    priorityLevel: "Standard",
    pickupList: [
      {
        warehouseName: "South Distribution Center",
        warehouseAddress: "Muntinlupa",
        contactPerson: "Dock Manager",
        contactNumber: "09181234567",
        pickupTime: "06:00",
        quantity: "200",
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
        stopStatus: "Pending",
      },
    ],
    truckPlate: "TRK-102 (Mitsubishi Fuso)",
    driver: "Luis Manzano",
    helper1: "Pedro Santos",
    helper2: "Carlo Reyes",
    notes: "N/A",
    crews: [
      { role: "Driver", name: "Luis Manzano", status: "Pending" },
      { role: "Helper #1", name: "Pedro Santos", status: "Pending" },
      { role: "Helper #2", name: "Carlo Reyes", status: "Pending" },
    ],
    remarks: [
      {
        dateTime: "Sept 11, 2026 03:45 PM",
        details: "Initial booking created.",
        attachments: "N/A",
        staff: "Logistics Coordinator",
        role: "Coordinator",
      },
    ],
  },
  {
    id: "4",
    orderId: "ORD-1004",
    clientName: "Mang Inasal",
    contactPerson: "Mark Bautista",
    contactNumber: "09170001122",
    emailAddress: "mark@manginasal.com",
    businessAddress: "Pasay City",
    product: "Frozen Chicken & Marinades",
    quantity: "150",
    scheduledDate: "2026-09-16",
    displayDate: "September 16, 2026",
    dateCreated: "September 12, 2026",
    createdBy: "Admin Dispatcher",
    status: "Created",
    confirmationStatus: "Assign Crew",
    priorityLevel: "Standard",
    pickupList: [
      {
        warehouseName: "Main Warehouse",
        warehouseAddress: "Pasig Logistics Hub",
        contactPerson: "Head Guard",
        contactNumber: "09176665544",
        pickupTime: "09:00",
        quantity: "150",
      },
    ],
    deliveryList: [
      {
        branchName: "Mang Inasal Pasay",
        deliveryAddress: "Roxas Blvd, Pasay",
        contactPerson: "Store Manager",
        contactNumber: "09173335566",
        deliveryTime: "11:30",
        quantity: "150",
        stopStatus: "Pending",
      },
    ],
    truckPlate: "",
    driver: "",
    helper1: "",
    helper2: "",
    notes: "Awaiting dispatcher to assign resources.",
    crews: [],
    remarks: [
      {
        dateTime: "Sept 12, 2026 10:15 AM",
        details:
          "Booking successfully saved. Pending assignment of fleet and crew.",
        attachments: "N/A",
        staff: "Admin Dispatcher",
        role: "Dispatcher",
      },
    ],
  },
];

const ITEMS_PER_PAGE = 10;

// ==========================================
// STATUS BADGE HELPERS
// ==========================================
const getStatusBadgeClass = (status: string) => {
  if (status === "Crew to Start Delivery") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  }
  if (status === "Assign Crew") {
    return "bg-blue-100 text-blue-800 border border-blue-200";
  }
  return "bg-amber-100 text-amber-800 border border-amber-200";
};

const getCrewStatusBadge = (status: string) => {
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
// SUCCESS MODAL COMPONENT
// ==========================================
interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
  title: string;
  description: string;
}

function SuccessModal({
  isOpen,
  onClose,
  orderCode,
  title,
  description,
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm font-semibold text-blue-600 mb-3">
          Order ID: {orderCode}
        </p>
        <p className="text-xs text-slate-600 mb-6">{description}</p>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ==========================================
// BOOKING DETAILS / ASSIGNMENT MODAL
// ==========================================
interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onSubmitSuccess: (orderId: string, status: string) => void;
  onCancelBooking: (e: React.MouseEvent, bookingId: string) => void;
}

function BookingDetailsModal({
  isOpen,
  onClose,
  booking,
  onSubmitSuccess,
  onCancelBooking,
}: BookingDetailsModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState<any>({});
  const [pickupList, setPickupList] = useState<any[]>([]);
  const [deliveryList, setDeliveryList] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubconMode, setIsSubconMode] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Trackers for inline deletion confirmation
  const [pickupToDelete, setPickupToDelete] = useState<number | null>(null);
  const [deliveryToDelete, setDeliveryToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && booking) {
      setIsSubconMode(false);
      setShowCancelConfirm(false);
      setPickupToDelete(null);
      setDeliveryToDelete(null);

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

      setErrors({});

      setTimeout(() => {
        crewSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [isOpen, booking, currentDate]);

  if (!isOpen || !booking) return null;

  const isAssignCrew = booking.confirmationStatus === "Assign Crew";
  const isPendingCrew = booking.confirmationStatus === "Pending Crew";
  const isEditable = isAssignCrew || isPendingCrew;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    if (!isEditable) return;
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePickupChange = (index: number, field: string, value: string) => {
    if (!isEditable) return;
    const updated = [...pickupList];
    updated[index][field] = value;
    setPickupList(updated);
  };

  const handleDeliveryChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    if (!isEditable) return;
    const updated = [...deliveryList];
    updated[index][field] = value;
    setDeliveryList(updated);
  };

  const addPickupRow = () => {
    if (!isEditable) return;
    setPickupList([
      ...pickupList,
      {
        warehouseName: "",
        warehouseAddress: "",
        contactPerson: "",
        contactNumber: "",
        pickupTime: "",
        quantity: "",
      },
    ]);
  };

  const initiateRemovePickupRow = (index: number) => {
    if (!isEditable || pickupList.length === 1) return;
    setPickupToDelete(index);
  };

  const confirmRemovePickup = (index: number) => {
    setPickupList(pickupList.filter((_, idx) => idx !== index));
    setPickupToDelete(null);
  };

  const addDeliveryRow = () => {
    if (!isEditable) return;
    setDeliveryList([
      ...deliveryList,
      {
        branchName: "",
        deliveryAddress: "",
        contactPerson: "",
        contactNumber: "",
        deliveryTime: "",
        quantity: "",
        stopStatus: "Pending",
      },
    ]);
  };

  const initiateRemoveDeliveryRow = (index: number) => {
    if (!isEditable || deliveryList.length === 1) return;
    setDeliveryToDelete(index);
  };

  const confirmRemoveDelivery = (index: number) => {
    setDeliveryList(deliveryList.filter((_, idx) => idx !== index));
    setDeliveryToDelete(null);
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;

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

    onSubmitSuccess(booking.orderId, booking.confirmationStatus);
    onClose();
  };

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
        <form
          id="pending-booking-form"
          onSubmit={validateAndSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-900"
        >
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
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  readOnly={!isEditable}
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
                  onChange={handleChange}
                  readOnly={!isEditable}
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
                  onChange={handleChange}
                  readOnly={!isEditable}
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
                  onChange={handleChange}
                  readOnly={!isEditable}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* 2. Pickup Address */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                2. Pickup Addresses {isEditable && "*"}
              </span>
              {isEditable && (
                <button
                  type="button"
                  onClick={addPickupRow}
                  className="inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-medium rounded-lg text-xs shadow-sm px-4 py-1.5 cursor-pointer hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" /> New Pickup
                </button>
              )}
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg pb-2">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Warehouse Name {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[25%]">
                      Address {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Person {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Number {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[12%]">
                      Pick Up Time {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-24 text-center">
                      Quantity{isEditable && "*"}
                    </th>
                    {isEditable && (
                      <th className="p-2.5 min-w-35 text-center">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pickupList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium align-middle">
                        {idx + 1}
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        {isEditable ? (
                          <select
                            value={row.warehouseName}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "warehouseName",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 text-black"
                          >
                            <option value="">Select Warehouse</option>
                            <option value="Main Warehouse">
                              Main Warehouse
                            </option>
                            <option value="North Hub">North Hub</option>
                            <option value="South Distribution Center">
                              South Distribution Center
                            </option>
                            <option value={row.warehouseName}>
                              {row.warehouseName}
                            </option>
                          </select>
                        ) : (
                          <input
                            readOnly
                            value={row.warehouseName}
                            className={tableInputClass}
                          />
                        )}
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="text"
                          value={row.warehouseAddress}
                          onChange={(e) =>
                            handlePickupChange(
                              idx,
                              "warehouseAddress",
                              e.target.value,
                            )
                          }
                          readOnly={!isEditable}
                          className={tableInputClass}
                        />
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="text"
                          value={row.contactPerson}
                          onChange={(e) =>
                            handlePickupChange(
                              idx,
                              "contactPerson",
                              e.target.value,
                            )
                          }
                          readOnly={!isEditable}
                          className={tableInputClass}
                        />
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="text"
                          value={row.contactNumber}
                          onChange={(e) =>
                            handlePickupChange(
                              idx,
                              "contactNumber",
                              e.target.value,
                            )
                          }
                          readOnly={!isEditable}
                          className={tableInputClass}
                        />
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="time"
                          value={row.pickupTime}
                          onChange={(e) =>
                            handlePickupChange(
                              idx,
                              "pickupTime",
                              e.target.value,
                            )
                          }
                          readOnly={!isEditable}
                          className={tableInputClass}
                        />
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) =>
                            handlePickupChange(idx, "quantity", e.target.value)
                          }
                          readOnly={!isEditable}
                          className={`${tableInputClass} min-w-15 text-center`}
                        />
                      </td>
                      {isEditable && (
                        <td className="p-2 text-center align-middle">
                          {pickupToDelete === idx ? (
                            <div className="flex flex-col gap-1.5 items-center bg-red-50 p-2 rounded-lg border border-red-100 min-w-35">
                              <span className="text-[10px] font-semibold text-red-700 text-center leading-tight">
                                Are you sure you want to delete this address?
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => confirmRemovePickup(idx)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-medium transition-colors cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPickupToDelete(null)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-medium transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => initiateRemovePickupRow(idx)}
                              disabled={pickupList.length === 1}
                              className="p-1.5 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </td>
                      )}
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
                3. Delivery Address {isEditable && "*"}
              </span>
              {isEditable && (
                <button
                  type="button"
                  onClick={addDeliveryRow}
                  className="inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-medium rounded-lg text-xs shadow-sm px-4 py-1.5 cursor-pointer hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" /> Branch
                </button>
              )}
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg pb-2">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Branch Name {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Delivery Address {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Person {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Number {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[10%]">
                      Delivery Time {isEditable && "*"}
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-16 text-center">
                      Quantity{isEditable && "*"}
                    </th>
                    {!isEditable && (
                      <th className="p-2.5 text-center w-[10%]">Stop Status</th>
                    )}
                    {isEditable && (
                      <th className="p-2.5 min-w-35 text-center">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {deliveryList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium align-middle">
                        {idx + 1}
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        {isEditable ? (
                          <select
                            value={row.branchName}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "branchName",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 text-black"
                          >
                            <option value="">Select Branch</option>
                            <option value={`${booking.clientName} Main Branch`}>
                              {booking.clientName} Main Branch
                            </option>
                            <option
                              value={`${booking.clientName} North Branch`}
                            >
                              {booking.clientName} North Branch
                            </option>
                            <option
                              value={`${booking.clientName} South Branch`}
                            >
                              {booking.clientName} South Branch
                            </option>
                            <option value={row.branchName}>
                              {row.branchName}
                            </option>
                          </select>
                        ) : (
                          <input
                            readOnly
                            value={row.branchName}
                            className={tableInputClass}
                          />
                        )}
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="text"
                          value={row.deliveryAddress}
                          onChange={(e) =>
                            handleDeliveryChange(
                              idx,
                              "deliveryAddress",
                              e.target.value,
                            )
                          }
                          readOnly={!isEditable}
                          className={tableInputClass}
                        />
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="text"
                          value={row.contactPerson}
                          onChange={(e) =>
                            handleDeliveryChange(
                              idx,
                              "contactPerson",
                              e.target.value,
                            )
                          }
                          readOnly={!isEditable}
                          className={tableInputClass}
                        />
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="text"
                          value={row.contactNumber}
                          onChange={(e) =>
                            handleDeliveryChange(
                              idx,
                              "contactNumber",
                              e.target.value,
                            )
                          }
                          readOnly={!isEditable}
                          className={tableInputClass}
                        />
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="time"
                          value={row.deliveryTime}
                          onChange={(e) =>
                            handleDeliveryChange(
                              idx,
                              "deliveryTime",
                              e.target.value,
                            )
                          }
                          readOnly={!isEditable}
                          className={tableInputClass}
                        />
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 align-top ${!isEditable ? "bg-slate-50" : ""}`}
                      >
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) =>
                            handleDeliveryChange(
                              idx,
                              "quantity",
                              e.target.value,
                            )
                          }
                          readOnly={!isEditable}
                          className={`${tableInputClass} min-w-15 text-center`}
                        />
                      </td>
                      {!isEditable && (
                        <td className="p-2 text-center bg-slate-50 align-top">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700">
                            {row.stopStatus || "Pending"}
                          </span>
                        </td>
                      )}
                      {isEditable && (
                        <td className="p-2 text-center align-middle">
                          {deliveryToDelete === idx ? (
                            <div className="flex flex-col gap-1.5 items-center bg-red-50 p-2 rounded-lg border border-red-100 min-w-35">
                              <span className="text-[10px] font-semibold text-red-700 text-center leading-tight">
                                Are you sure you want to delete this address?
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => confirmRemoveDelivery(idx)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-medium transition-colors cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeliveryToDelete(null)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-medium transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => initiateRemoveDeliveryRow(idx)}
                              disabled={deliveryList.length === 1}
                              className="p-1.5 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </td>
                      )}
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
                      setFormData((prev: any) => ({
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
                  {booking.crews?.map((c: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-200"
                    >
                      <span className="font-medium text-slate-800">
                        {c.role}: {c.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getCrewStatusBadge(
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
            ) : isSubconMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Select Subcon Partner *
                  </label>
                  <select
                    name="subconPartner"
                    value={formData.subconPartner}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  >
                    <option value="" disabled>
                      Select partner
                    </option>
                    <option value="FastLogistics">FastLogistics</option>
                    <option value="SpeedyTransit">SpeedyTransit</option>
                    <option value="Other">Other</option>
                  </select>
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
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs placeholder:text-slate-400"
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
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs placeholder:text-slate-400"
                  />
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
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs placeholder:text-slate-400"
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
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs placeholder:text-slate-400"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Truck Plate No. *
                  </label>
                  <select
                    name="truckPlate"
                    value={formData.truckPlate}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${
                      errors.truckPlate ? "border-red-500" : "border-slate-300"
                    }`}
                  >
                    <option value="">Select truck</option>
                    <option value="TRK-101 (Isuzu Elf)">
                      TRK-101 (Isuzu Elf)
                    </option>
                    <option value="TRK-102 (Mitsubishi Fuso)">
                      TRK-102 (Mitsubishi Fuso)
                    </option>
                    <option value="TRK-103 (Hino 300)">
                      TRK-103 (Hino 300)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Driver *
                  </label>
                  <select
                    name="driver"
                    value={formData.driver}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${
                      errors.driver ? "border-red-500" : "border-slate-300"
                    }`}
                  >
                    <option value="">Select driver</option>
                    <option value="Juan Dela Cruz">Juan Dela Cruz</option>
                    <option value="Pedro Santos">Pedro Santos</option>
                    <option value="Luis Manzano">Luis Manzano</option>
                    <option value="Carlo Reyes">Carlo Reyes</option>
                    <option value="Antonio Luna">Antonio Luna</option>
                    <option value="Andres Bonifacio">Andres Bonifacio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #1
                  </label>
                  <select
                    name="helper1"
                    value={formData.helper1}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  >
                    <option value="">Select helper</option>
                    <option value="Mark Santos">Mark Santos</option>
                    <option value="James Garcia">James Garcia</option>
                    <option value="Daniel Cruz">Daniel Cruz</option>
                    <option value="Paolo Reyes">Paolo Reyes</option>
                    <option value="Gabriela Silang">Gabriela Silang</option>
                    <option value="Pedro Santos">Pedro Santos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #2
                  </label>
                  <select
                    name="helper2"
                    value={formData.helper2}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  >
                    <option value="">Select helper</option>
                    <option value="Carlo Reyes">Carlo Reyes</option>
                    <option value="Ryan Mendoza">Ryan Mendoza</option>
                    <option value="Nico Santos">Nico Santos</option>
                    <option value="Apolinario Mabini">Apolinario Mabini</option>
                  </select>
                </div>
              </div>
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

          {/* 7. Remarks */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              7. Remarks
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

          {isAssignCrew && (
            <button
              type="submit"
              form="pending-booking-form"
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              Assign Now
            </button>
          )}

          {isPendingCrew && (
            <button
              type="submit"
              form="pending-booking-form"
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              Re-assign Booking
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
export default function PendingBookingPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successOrderCode, setSuccessOrderCode] = useState("");
  const [successTitle, setSuccessTitle] = useState("");
  const [successDesc, setSuccessDesc] = useState("");

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredBookings = DUMMY_PENDING_BOOKINGS.filter(
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

  const handleModalSubmitSuccess = (orderId: string, status: string) => {
    setSuccessOrderCode(orderId);
    if (status === "Assign Crew") {
      setSuccessTitle("Booking Assigned Successfully!");
      setSuccessDesc(
        "The booking has already been assigned to the crew and is currently waiting for the crew's confirmation.",
      );
    } else {
      setSuccessTitle("Booking Re-assigned Successfully!");
      setSuccessDesc(
        "The booking has been updated and is waiting for crew confirmation.",
      );
    }
    setIsSuccessModalOpen(true);
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
            title="Back to Calendar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-blue-500" />
              Pending Bookings
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Review and manage unfulfilled delivery schedules and assignments.
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
            Pending Booking List
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
                        No pending bookings found
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        There are currently no scheduled deliveries in pending
                        status or matching your search.
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
        onSubmitSuccess={handleModalSubmitSuccess}
        onCancelBooking={handleCancelBooking}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        orderCode={successOrderCode}
        title={successTitle}
        description={successDesc}
      />
    </div>
  );
}
