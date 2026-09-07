// File: app/admindashboard/calendar/awaiting-confirmation/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  ArrowLeft,
  Clock,
  X,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";

// ==========================================
// DUMMY DATA (Filtered to only show pending/declined crews)
// ==========================================
const INITIAL_DUMMY_CONFIRMATIONS = [
  {
    id: "1",
    orderId: "ORD-0001",
    clientName: "Jollibee",
    scheduledDate: "2026-09-08",
    displayDate: "September 8, 2026",
    product: "Frozen Chicken Products",
    crews: [
      { role: "Driver", name: "Juan Dela Cruz", status: "Accepted" },
      { role: "Helper #1", name: "Mark Santos", status: "Pending" },
      { role: "Helper #2", name: "Carlo Reyes", status: "Declined" },
    ],
  },
  {
    id: "2",
    orderId: "ORD-0002",
    clientName: "McDonald's",
    scheduledDate: "2026-09-09",
    displayDate: "September 9, 2026",
    product: "Frozen Beef Patties",
    crews: [
      { role: "Driver", name: "Luis Manzano", status: "Pending" },
      { role: "Helper #1", name: "Pedro Santos", status: "Pending" },
    ],
  },
  {
    id: "3",
    orderId: "ORD-0003",
    clientName: "Chowking",
    scheduledDate: "2026-09-10",
    displayDate: "September 10, 2026",
    product: "Dry Food Supplies",
    crews: [
      { role: "Driver", name: "Antonio Luna", status: "Accepted" },
      { role: "Helper #1", name: "Jose Rizal", status: "Accepted" },
    ], // Note: If all are Accepted, this will be filtered out automatically below!
  },
  {
    id: "4",
    orderId: "ORD-0004",
    clientName: "Mang Inasal",
    scheduledDate: "2026-09-11",
    displayDate: "September 11, 2026",
    product: "Frozen Chicken Products",
    crews: [
      { role: "Driver", name: "Andres Bonifacio", status: "Declined" },
      { role: "Helper #1", name: "Emilio Aguinaldo", status: "Pending" },
      { role: "Helper #2", name: "Apolinario Mabini", status: "Accepted" },
    ],
  },
  {
    id: "5",
    orderId: "ORD-0005",
    clientName: "Greenwich",
    scheduledDate: "2026-09-12",
    displayDate: "September 12, 2026",
    product: "Frozen Pizza Products",
    crews: [
      { role: "Driver", name: "Diego Silang", status: "Accepted" },
      { role: "Helper #1", name: "Gabriela Silang", status: "Pending" },
    ],
  },
  {
    id: "6",
    orderId: "ORD-0006",
    clientName: "Red Ribbon",
    scheduledDate: "2026-09-13",
    displayDate: "September 13, 2026",
    product: "Assorted Cakes & Pastries",
    crews: [{ role: "Driver", name: "Arturo Dimayuga", status: "Pending" }],
  },
];

const ITEMS_PER_PAGE = 10;

// Helper function to assign color classes to statuses
const getStatusBadge = (status: string) => {
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
// SUCCESS MODAL COMPONENT
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
          Booking Re-assigned Successfully!
        </h3>
        <p className="text-sm font-semibold text-blue-600 mb-3">
          Order ID: {orderCode}
        </p>
        <p className="text-xs text-slate-600 mb-6">
          The booking has been updated and is waiting for crew confirmation.
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
// ASSIGN / RE-ASSIGN BOOKING MODAL FORM
// ==========================================
interface ReassignBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onSubmitSuccess: (orderId: string) => void;
}

function ReassignBookingModal({
  isOpen,
  onClose,
  booking,
  onSubmitSuccess,
}: ReassignBookingModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const crewSectionRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    clientName: "",
    contactPerson: "Juan Dela Cruz",
    contactNumber: "09123456789",
    emailAddress: "N/A",
    businessAddress: "N/A",
    requestDate: currentDate,
    deliverySchedule: "",
    product: "",
    priorityLevel: "Standard",
    subconPartner: "",
    truckPlate: "TRK-101",
    driver: "",
    helper1: "",
    helper2: "",
    notes: "",
  });

  const [isSubconMode, setIsSubconMode] = useState(false);
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

      // Extract existing crew members if available
      const driverObj = booking.crews?.find((c: any) => c.role === "Driver");
      const h1Obj = booking.crews?.find((c: any) => c.role === "Helper #1");
      const h2Obj = booking.crews?.find((c: any) => c.role === "Helper #2");

      setFormData({
        clientName: booking.clientName || "",
        contactPerson: "Juan Dela Cruz",
        contactNumber: "09123456789",
        emailAddress: "N/A",
        businessAddress: "N/A",
        requestDate: new Date().toISOString().split("T")[0],
        deliverySchedule: booking.scheduledDate || currentDate,
        product: booking.product || "",
        priorityLevel: "Standard",
        subconPartner: "",
        truckPlate: "TRK-101",
        driver: driverObj ? driverObj.name : "",
        helper1: h1Obj ? h1Obj.name : "",
        helper2: h2Obj ? h2Obj.name : "",
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

      setTimeout(() => {
        crewSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [isOpen, booking, currentDate]);

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
  const removePickupRow = (index: number) => {
    if (pickupList.length === 1) return;
    setPickupList(pickupList.filter((_, idx) => idx !== index));
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
  const removeDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryList(deliveryList.filter((_, idx) => idx !== index));
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-wide">
              Review & Re-assign: {booking.orderId}
            </h2>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Awaiting Confirmation
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
          onSubmit={validateAndSubmit}
          className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900"
        >
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
                  type="text"
                  name="emailAddress"
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
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
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
                      Quantity *
                    </th>
                    <th className="p-2.5 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pickupList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) =>
                            handlePickupChange(idx, "quantity", e.target.value)
                          }
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 min-w-15"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removePickupRow(idx)}
                          disabled={pickupList.length === 1}
                          className="p-1.5 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
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
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
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
                      Quantity *
                    </th>
                    <th className="p-2.5 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryList.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 border-r border-slate-200 text-center font-medium">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
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
                      <td className="p-2 border-r border-slate-200">
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
                          className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 min-w-15"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeDeliveryRow(idx)}
                          disabled={deliveryList.length === 1}
                          className="p-1.5 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
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
                5. Assigned Crew Status & Re-assignment
              </span>
              <button
                type="button"
                onClick={() => setIsSubconMode(!isSubconMode)}
                className="text-xs text-blue-600 underline hover:text-blue-800 cursor-pointer"
              >
                {isSubconMode
                  ? "Assign to Own Resources"
                  : "Assign to Subcon Partner"}
              </button>
            </div>

            {/* Crew Status Summary Banner */}
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
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(c.status)}`}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
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
                    placeholder="Optional"
                    value={formData.truckPlate}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    name="driver"
                    placeholder="Optional"
                    value={formData.driver}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #1
                  </label>
                  <input
                    type="text"
                    name="helper1"
                    placeholder="Optional"
                    value={formData.helper1}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #2
                  </label>
                  <input
                    type="text"
                    name="helper2"
                    placeholder="Optional"
                    value={formData.helper2}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
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
                    <option value="Carlo Reyes">Carlo Reyes</option>
                    <option value="Antonio Luna">Antonio Luna</option>
                    <option value="Andres Bonifacio">Andres Bonifacio</option>
                    <option value="Diego Silang">Diego Silang</option>
                    <option value="Arturo Dimayuga">Arturo Dimayuga</option>
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

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-slate-200 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-200 hover:bg-black hover:text-white text-slate-800 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              Re-assign Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function AwaitingConfirmationPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successOrderCode, setSuccessOrderCode] = useState("");

  // Logic to hide records where all crew members have already accepted/confirmed
  const pendingConfirmations = INITIAL_DUMMY_CONFIRMATIONS.filter((booking) => {
    const hasUnconfirmedCrew = booking.crews.some(
      (crew) => crew.status === "Pending" || crew.status === "Declined",
    );
    return hasUnconfirmedCrew;
  });

  // ==========================================
  // FILTERING
  // ==========================================
  const filteredConfirmations = pendingConfirmations.filter(
    (booking) =>
      booking.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.product.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ==========================================
  // PAGINATION SETUP
  // ==========================================
  const totalBookings = filteredConfirmations.length;
  const totalPages = Math.max(Math.ceil(totalBookings / ITEMS_PER_PAGE), 1);
  const startIndex =
    totalBookings === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalBookings);

  const paginatedBookings = filteredConfirmations.slice(
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
              <Clock className="w-6 h-6 text-blue-500" />
              Awaiting Crew Confirmation
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Monitor individual crew responses for upcoming delivery schedules.
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
            Crew Status List
          </h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search order ID or client..."
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
                <th className="py-3.5 px-4 sm:px-6 w-[15%] align-top">
                  Order ID
                </th>
                <th className="py-3.5 px-4 sm:px-6 w-[15%] align-top">
                  Client Name
                </th>
                <th className="py-3.5 px-4 sm:px-6 w-[15%] align-top">
                  Scheduled Date
                </th>
                <th className="py-3.5 px-4 sm:px-6 w-[25%] align-top">
                  Assigned Crews
                </th>
                <th className="py-3.5 px-4 sm:px-6 w-[15%] align-top">
                  Status
                </th>
                <th className="py-3.5 px-4 sm:px-6 w-[15%] text-center align-top">
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
                    <td className="py-4 px-4 sm:px-6 font-medium text-slate-900 align-top">
                      {booking.orderId}
                    </td>
                    <td className="py-4 px-4 sm:px-6 font-medium align-top">
                      {booking.clientName}
                    </td>
                    <td className="py-4 px-4 sm:px-6 align-top">
                      {booking.displayDate}
                    </td>

                    {/* ASSIGNED CREWS COLUMN */}
                    <td className="py-4 px-4 sm:px-6 align-top">
                      <div className="flex flex-col gap-2">
                        {booking.crews.map((crew, idx) => (
                          <div
                            key={idx}
                            className="h-8 flex items-center truncate"
                          >
                            <span className="font-semibold text-slate-700 mr-2 shrink-0">
                              {crew.role}:
                            </span>
                            <span className="truncate">{crew.name}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* STATUS COLUMN */}
                    <td className="py-4 px-4 sm:px-6 align-top">
                      <div className="flex flex-col gap-2">
                        {booking.crews.map((crew, idx) => (
                          <div key={idx} className="h-8 flex items-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${getStatusBadge(
                                crew.status,
                              )}`}
                            >
                              {crew.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* ACTION COLUMN */}
                    <td className="py-4 px-4 sm:px-6 text-center align-top">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(booking);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors duration-200 whitespace-nowrap cursor-pointer"
                      >
                        Re-assign
                      </button>
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
                        No pending confirmations found
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        All crew members have confirmed their schedules or no
                        records match your search.
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
      <ReassignBookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        booking={selectedBooking}
        onSubmitSuccess={handleModalSubmitSuccess}
      />

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        orderCode={successOrderCode}
      />
    </div>
  );
}
