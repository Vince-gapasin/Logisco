// File: app/admindashboard/calendar/unassigned-bookings/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  ArrowLeft,
  Inbox,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
} from "lucide-react";

// ==========================================
// DUMMY DATA
// ==========================================
const DUMMY_BOOKINGS = [
  {
    id: "1",
    orderId: "ORD-0001",
    clientName: "Jollibee",
    product: "Frozen Chicken Products",
    scheduledDate: "2026-09-08",
    displayDate: "September 8, 2026",
    dateCreated: "September 6, 2026",
    createdBy: "Admin Dispatcher",
    priorityLevel: "High Priority",
    status: "Created",
    remarks: [
      {
        dateTime: "Sept 6, 2026 08:15 AM",
        details: "Booking successfully created and logged into the system.",
        attachments: "N/A",
        staff: "Admin Dispatcher",
        role: "Dispatcher",
      },
    ],
  },
  {
    id: "2",
    orderId: "ORD-0002",
    clientName: "McDonald's",
    product: "Frozen Beef Patties",
    scheduledDate: "2026-09-09",
    displayDate: "September 9, 2026",
    dateCreated: "September 7, 2026",
    createdBy: "Logistics Coordinator",
    priorityLevel: "Standard",
    status: "Created",
    remarks: [],
  },
  {
    id: "3",
    orderId: "ORD-0003",
    clientName: "Chowking",
    product: "Dry Food Supplies",
    scheduledDate: "2026-09-10",
    displayDate: "September 10, 2026",
    dateCreated: "September 7, 2026",
    createdBy: "Admin User",
    priorityLevel: "Standard",
    status: "Created",
    remarks: [],
  },
  {
    id: "4",
    orderId: "ORD-0004",
    clientName: "Mang Inasal",
    product: "Frozen Chicken Products",
    scheduledDate: "2026-09-11",
    displayDate: "September 11, 2026",
    dateCreated: "September 8, 2026",
    createdBy: "Admin Dispatcher",
    priorityLevel: "Urgent",
    status: "Created",
    remarks: [],
  },
  {
    id: "5",
    orderId: "ORD-0005",
    clientName: "Greenwich",
    product: "Frozen Pizza Products",
    scheduledDate: "2026-09-12",
    displayDate: "September 12, 2026",
    dateCreated: "September 8, 2026",
    createdBy: "Admin Dispatcher",
    priorityLevel: "Standard",
    status: "Created",
    remarks: [],
  },
];

const ITEMS_PER_PAGE = 10;

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
// SUCCESS MODAL COMPONENT (Awaiting Crew Confirmation)
// ==========================================
interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderCode: string;
}

function SuccessModal({ isOpen, onClose, orderCode }: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">
          Booking Assigned Successfully!
        </h3>
        <p className="text-sm font-semibold text-blue-600 mb-3">
          Order ID: {orderCode}
        </p>
        <p className="text-xs text-slate-600 mb-6">
          The booking has already been assigned to the crew and is currently
          waiting for the crew&apos;s confirmation.
        </p>
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
// ASSIGN BOOKING MODAL (REFERENCE FORM)
// ==========================================
interface AssignBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onSubmitSuccess: (orderId: string) => void;
  onCancelBooking: (e: React.MouseEvent, bookingId: string) => void;
}

function AssignBookingModal({
  isOpen,
  onClose,
  booking,
  onSubmitSuccess,
  onCancelBooking,
}: AssignBookingModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    clientName: "",
    contactPerson: "Juan Dela Cruz",
    contactNumber: "09123456789",
    emailAddress: "",
    businessAddress: "",
    requestDate: currentDate,
    deliverySchedule: "",
    product: "",
    priorityLevel: "Standard",
    subconPartner: "",
    truckPlate: "",
    driver: "",
    helper1: "",
    helper2: "",
    notes: "",
  });

  const [isSubconMode, setIsSubconMode] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Trackers for inline deletion confirmation
  const [pickupToDelete, setPickupToDelete] = useState<number | null>(null);
  const [deliveryToDelete, setDeliveryToDelete] = useState<number | null>(null);

  const [pickupList, setPickupList] = useState<any[]>([
    {
      warehouseName: "Main Warehouse",
      warehouseAddress: "Manila Hub",
      contactPerson: "Warehouse Admin",
      contactNumber: "09181112233",
      pickupTime: "08:00",
      quantity: "50",
    },
  ]);
  const [deliveryList, setDeliveryList] = useState<any[]>([
    {
      branchName: "",
      deliveryAddress: "",
      contactPerson: "",
      contactNumber: "",
      deliveryTime: "12:00",
      quantity: "50",
    },
  ]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (isOpen && booking) {
      setIsSubconMode(false);
      setShowCancelConfirm(false);
      setPickupToDelete(null);
      setDeliveryToDelete(null);

      setFormData({
        clientName: booking.clientName || "",
        contactPerson: "Juan Dela Cruz",
        contactNumber: "09123456789",
        emailAddress: "",
        businessAddress: "",
        requestDate: new Date().toISOString().split("T")[0],
        deliverySchedule: booking.scheduledDate || "",
        product: booking.product || "",
        priorityLevel: booking.priorityLevel || "Standard",
        subconPartner: "",
        truckPlate: "",
        driver: "",
        helper1: "",
        helper2: "",
        notes: "",
      });
      setPickupList([
        {
          warehouseName: "Main Warehouse",
          warehouseAddress: "Manila Hub",
          contactPerson: "Warehouse Admin",
          contactNumber: "09181112233",
          pickupTime: "08:00",
          quantity: "50",
        },
      ]);
      setDeliveryList([
        {
          branchName: booking.clientName
            ? `${booking.clientName} Branch`
            : "Branch",
          deliveryAddress: "Metro Manila",
          contactPerson: "Branch Manager",
          contactNumber: "09192223344",
          deliveryTime: "12:00",
          quantity: "50",
        },
      ]);
      setErrors({});

      // Automatically scroll down to section 5 when modal opens
      setTimeout(() => {
        crewSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [isOpen, booking]);

  if (!isOpen || !booking) return null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePickupChange = (index: number, field: string, value: string) => {
    const updated = [...pickupList];
    updated[index][field] = value;
    setPickupList(updated);
  };

  const handleDeliveryChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    const updated = [...deliveryList];
    updated[index][field] = value;
    setDeliveryList(updated);
  };

  const addPickupRow = () =>
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

  const initiateRemovePickupRow = (index: number) => {
    if (pickupList.length === 1) return;
    setPickupToDelete(index);
  };

  const confirmRemovePickup = (index: number) => {
    setPickupList(pickupList.filter((_, idx) => idx !== index));
    setPickupToDelete(null);
  };

  const addDeliveryRow = () =>
    setDeliveryList([
      ...deliveryList,
      {
        branchName: "",
        deliveryAddress: "",
        contactPerson: "",
        contactNumber: "",
        deliveryTime: "",
        quantity: "",
      },
    ]);

  const initiateRemoveDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryToDelete(index);
  };

  const confirmRemoveDelivery = (index: number) => {
    setDeliveryList(deliveryList.filter((_, idx) => idx !== index));
    setDeliveryToDelete(null);
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    onSubmitSuccess(booking.orderId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto flex flex-col max-h-[90vh] relative">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-wide">
              Assign Booking: {booking.orderId}
            </h2>
            <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Unassigned
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Date Created
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.dateCreated || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Created By
                </p>
                <p className="text-xs font-bold text-slate-800">
                  {booking.createdBy || "N/A"}
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
                  {booking.priorityLevel || "Standard"}
                </span>
              </div>
            </div>

            <div className="w-full md:w-87.5 shrink-0">
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 md:text-right">
                Delivery Progress
              </h3>
              <DeliveryProgress currentStatus={booking.status || "Created"} />
            </div>
          </div>

          {/* Client Info */}
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
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
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
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
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
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
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
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Pickup */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                2. Pickup Addresses *
              </span>
              <button
                type="button"
                onClick={addPickupRow}
                className="inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-medium rounded-lg text-xs shadow-sm px-4 py-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Pickup
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg pb-2">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Warehouse Name *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[25%]">
                      Warehouse Address *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Person *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Number *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[12%]">
                      Pick Up Time *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-24 text-center">
                      Quantity*
                    </th>
                    <th className="p-2.5 min-w-35 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pickupList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium align-middle">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          <option value="Main Warehouse">Main Warehouse</option>
                          <option value="North Hub">North Hub</option>
                          <option value="South Distribution Center">
                            South Distribution Center
                          </option>
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) =>
                            handlePickupChange(idx, "quantity", e.target.value)
                          }
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 min-w-15 text-center"
                        />
                      </td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                3. Delivery Address *
              </span>
              <button
                type="button"
                onClick={addDeliveryRow}
                className="inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-medium rounded-lg text-xs shadow-sm px-4 py-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Branch
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg pb-2">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Branch Name *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[25%]">
                      Delivery Address *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Person *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Number *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[12%]">
                      Delivery Time *
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-24 text-center">
                      Quantity*
                    </th>
                    <th className="p-2.5 min-w-35 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium align-middle">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          <option value={`${booking.clientName} North Branch`}>
                            {booking.clientName} North Branch
                          </option>
                          <option value={`${booking.clientName} South Branch`}>
                            {booking.clientName} South Branch
                          </option>
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-200 align-top">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 min-w-15 text-center"
                        />
                      </td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Schedule */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Booking Details & Schedule
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4 md:col-span-3">
                <label className="block text-xs font-medium text-black mb-1">
                  Delivery Schedule *
                </label>
                <input
                  type="date"
                  name="deliverySchedule"
                  min={currentDate}
                  value={formData.deliverySchedule}
                  onChange={handleChange}
                  className={`w-full border rounded-md px-3 py-2 text-xs ${errors.deliverySchedule ? "border-red-500" : "border-slate-300"}`}
                />
              </div>
              <div className="sm:col-span-5 md:col-span-6">
                <label className="block text-xs font-medium text-black mb-1">
                  Product To Deliver *
                </label>
                <input
                  type="text"
                  name="product"
                  value={formData.product}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                />
              </div>
              <div className="sm:col-span-3 md:col-span-3">
                <label className="block text-xs font-medium text-black mb-1">
                  Priority Level *
                </label>
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
              </div>
            </div>
          </div>

          {/* Assign Crew / Vehicle (Target Section to scroll into view) */}
          <div
            ref={crewSectionRef}
            className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs scroll-mt-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                5. Assign Delivery Crews & Vehicle
              </span>
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
            </div>

            {isSubconMode ? (
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
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.truckPlate ? "border-red-500" : "border-slate-300"}`}
                  >
                    <option value="">Select truck</option>
                    <option value="TRK-101">TRK-101 (Isuzu Elf)</option>
                    <option value="TRK-102">TRK-102 (Mitsubishi Fuso)</option>
                    <option value="TRK-103">TRK-103 (Hino 300)</option>
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
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.driver ? "border-red-500" : "border-slate-300"}`}
                  >
                    <option value="">Select driver</option>
                    <option value="Juan Dela Cruz">Juan Dela Cruz</option>
                    <option value="Pedro Santos">Pedro Santos</option>
                    <option value="Luis Manzano">Luis Manzano</option>
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
                    <option value="Mark Reyes">Mark Reyes</option>
                    <option value="John Doe">John Doe</option>
                    <option value="Carlo Reyes">Carlo Reyes</option>
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
                    <option value="Mark Reyes">Mark Reyes</option>
                    <option value="John Doe">John Doe</option>
                    <option value="Carlo Reyes">Carlo Reyes</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
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
            Cancel
          </button>

          <button
            type="submit"
            form="assign-booking-form"
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Assign Now
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
// MAIN UNASSIGNED BOOKINGS PAGE COMPONENT
// ==========================================

export default function UnassignedBookingsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successOrderCode, setSuccessOrderCode] = useState("");

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredBookings = DUMMY_BOOKINGS.filter(
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

  const handleModalSubmitSuccess = (orderId: string) => {
    setSuccessOrderCode(orderId);
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
            onClick={() => router.push("/admindashboard/calendar")}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Back to Calendar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Inbox className="w-6 h-6 text-orange-500" />
              Unassigned Bookings
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Review and assign pending delivery schedules to available fleets.
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
            Pending Assignments
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search order ID, client, or product..."
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
                <th className="py-3.5 pl-6 sm:pl-8 pr-4 w-[15%]">Order ID</th>
                <th className="py-3.5 px-4 w-[20%]">Client Name</th>
                <th className="py-3.5 px-4 w-[30%]">Product to Deliver</th>
                <th className="py-3.5 px-4 w-[20%]">Scheduled Date</th>
                <th className="py-3.5 pl-4 pr-6 sm:pr-8 w-[15%] text-center">
                  Action
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
                    <td className="py-3.5 pl-6 sm:pl-8 pr-4 font-medium text-slate-900 truncate">
                      {booking.orderId}
                    </td>
                    <td className="py-3.5 px-4 truncate font-medium">
                      {booking.clientName}
                    </td>
                    <td
                      className="py-3.5 px-4 truncate"
                      title={booking.product}
                    >
                      {booking.product}
                    </td>
                    <td className="py-3.5 px-4 truncate">
                      {booking.displayDate}
                    </td>
                    <td className="py-3.5 pl-4 pr-6 sm:pr-8 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(booking);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors duration-200 whitespace-nowrap cursor-pointer"
                      >
                        Assign Now
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        No unassigned bookings found
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        All current schedules have been assigned or no bookings
                        match your search criteria.
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

      {/* Modals */}
      <AssignBookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        booking={selectedBooking}
        onSubmitSuccess={handleModalSubmitSuccess}
        onCancelBooking={handleCancelBooking}
      />

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        orderCode={successOrderCode}
      />
    </div>
  );
}
