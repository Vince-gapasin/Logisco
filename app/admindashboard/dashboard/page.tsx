// ==========================================
// MAIN DASHBOARD PAGE FOR ADMIN USERS
// ==========================================
"use client";
import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Truck,
  X,
  Search,
  Plus,
  Trash2,
  Edit3,
} from "lucide-react";

// ==========================================
// CONSTANTS & DATA
// ==========================================

const COLOR_STYLES = {
  orange: {
    iconBg: "bg-orange-50",
    iconText: "text-orange-500",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-700",
  },
  blue: {
    iconBg: "bg-blue-50",
    iconText: "text-blue-500",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
  },
  green: {
    iconBg: "bg-green-50",
    iconText: "text-green-500",
    badgeBg: "bg-green-100",
    badgeText: "text-green-700",
  },
  red: {
    iconBg: "bg-red-50",
    iconText: "text-red-500",
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
  },
};

const TABS = [
  {
    name: "Pending Bookings",
    icon: Clock,
    color: "orange",
    statusLabel: "Pending",
  },
  { name: "In-Transit", icon: Truck, color: "blue", statusLabel: "In-Transit" },
  {
    name: "Completed",
    icon: CheckCircle2,
    color: "green",
    statusLabel: "Delivered",
  },
  {
    name: "Foul Trip",
    icon: AlertTriangle,
    color: "red",
    statusLabel: "Foul Trip",
  },
];

const DUMMY_BOOKINGS: { [key: string]: any[] } = {
  "Pending Bookings": [
    {
      orderId: "ORD-1001",
      client: "Bonchon",
      product: "Frozen Chicken",
      driver: "Juan Dela Cruz",
      helper: "Mark Reyes",
      dateTime: "2026-08-25 08:00 AM",
    },
  ],
  "In-Transit": [
    {
      orderId: "ORD-2001",
      client: "McDonald's",
      product: "Fries",
      driver: "Luis Manzano",
      helper: "Pedro Santos",
      dateTime: "2026-08-25 07:00 AM",
    },
  ],
  Completed: [
    {
      orderId: "ORD-3001",
      client: "Jollibee",
      product: "Gravy Mix",
      driver: "Juan Dela Cruz",
      helper: "Mark Reyes",
      dateTime: "2026-08-24 02:00 PM",
    },
  ],
  "Foul Trip": [
    {
      orderId: "ORD-4001",
      client: "McDonald's",
      product: "Condiments",
      driver: "Luis Manzano",
      helper: "John Doe",
      dateTime: "2026-08-25 06:00 AM",
    },
  ],
};

// ==========================================
// CLIENT SEARCH MODAL
// ==========================================

interface ClientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: any[];
  onSelectClient: (clientID: string) => void;
  onOpenNewClientBooking: () => void;
}

function ClientSearchModal({
  isOpen,
  onClose,
  clients,
  onSelectClient,
  onOpenNewClientBooking,
}: ClientSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filteredClients = searchTerm.trim()
    ? clients.filter((client) =>
        client.company.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : [];

  const handleClose = () => {
    setSearchTerm("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg relative p-6 sm:p-10 flex flex-col items-center text-center">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 tracking-tight">
          Select Registered Client
        </h2>

        <div className="relative w-full max-w-md mb-5">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search client name..."
            className="w-full bg-white border border-slate-300 rounded-full pl-4 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        {filteredClients.length > 0 && (
          <div className="w-full max-w-md mb-6 animate-fade-in">
            <div className="text-left font-bold text-slate-800 text-xs mb-1.5 ml-1">
              Results
            </div>
            <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse bg-white">
                <tbody className="divide-y divide-slate-200">
                  {filteredClients.map((client, index) => (
                    <tr
                      key={client.clientID}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="w-10 text-center py-2 border-r border-slate-200 text-slate-800 text-sm font-medium">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 text-slate-800 text-sm">
                        {client.company}
                      </td>
                      <td className="w-20 text-center border-l border-slate-200">
                        <button
                          onClick={() => onSelectClient(client.clientID)}
                          className="text-blue-500 hover:text-blue-700 text-sm font-medium px-2 py-1"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            handleClose();
            onOpenNewClientBooking();
          }}
          className="mt-2 bg-blue-600 hover:bg-black px-6 py-2.5 text-white font-bold rounded-lg text-sm shadow-md transition-colors duration-200 w-full sm:w-auto"
        >
          Create Booking for New Client
        </button>
      </div>
    </div>
  );
}

// ==========================================
// NEW CLIENT BOOKING MODAL
// ==========================================

interface NewClientBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trucks: any[];
  drivers: any[];
  helpers: any[];
  onSubmitSuccess: (data: any) => void;
}

function NewClientBookingModal({
  isOpen,
  onClose,
  trucks,
  drivers,
  helpers,
  onSubmitSuccess,
}: NewClientBookingModalProps) {
  const initialFormState = {
    clientName: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
    deliverySchedule: "",
    product: "",
    priorityLevel: "",
    subconPartner: "", // ADDED FOR SUBCON
    truckPlate: "",
    driver: "",
    helper1: "",
    helper2: "",
    notes: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [isSubconMode, setIsSubconMode] = useState(false); // ADDED FOR SUBCON

  const [pickupList, setPickupList] = useState<any[]>([
    {
      warehouseName: "",
      warehouseAddress: "",
      contactPerson: "",
      contactNumber: "",
      pickupTime: "",
      quantity: "",
    },
  ]);

  const [deliveryList, setDeliveryList] = useState<any[]>([
    {
      branchName: "",
      deliveryAddress: "",
      contactPerson: "",
      contactNumber: "",
      deliveryTime: "",
      quantity: "",
    },
  ]);

  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, boolean>>(
    {},
  );
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (isOpen) {
      setIsSubconMode(false); // RESET SUBCON MODE ON OPEN
      setFormData(initialFormState);
      setPickupList([
        {
          warehouseName: "",
          warehouseAddress: "",
          contactPerson: "",
          contactNumber: "",
          pickupTime: "",
          quantity: "",
        },
      ]);
      setDeliveryList([
        {
          branchName: "",
          deliveryAddress: "",
          contactPerson: "",
          contactNumber: "",
          deliveryTime: "",
          quantity: "",
        },
      ]);
      setDeleteConfirm({});
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
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

  const addPickupRow = () => {
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

  const removePickupRow = (index: number) => {
    if (pickupList.length === 1) return;
    setPickupList(pickupList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`pickup-${index}`]: false }));
  };

  const addDeliveryRow = () => {
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
  };

  const removeDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryList(deliveryList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`delivery-${index}`]: false }));
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!formData.clientName.trim())
      newErrors.clientName = "Client Name is required.";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required.";
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = "Contact number is required.";
    if (!formData.emailAddress.trim())
      newErrors.emailAddress = "Email address is required.";
    if (!formData.businessAddress.trim())
      newErrors.businessAddress = "Business address is required.";

    if (!formData.deliverySchedule)
      newErrors.deliverySchedule = "Delivery schedule is required.";
    if (!formData.product.trim())
      newErrors.product = "Product description is required.";
    if (!formData.priorityLevel)
      newErrors.priorityLevel = "Priority level is required.";

    if (isSubconMode && !formData.subconPartner)
      newErrors.subconPartner = "Subcon partner is required.";
    if (!formData.truckPlate)
      newErrors.truckPlate = "Truck plate number is required.";
    if (!formData.driver) newErrors.driver = "Driver assignment is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const submissionData = {
      ...formData,
      pickupList,
      deliveryList,
    };

    onSubmitSuccess(submissionData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            New Client Booking Form
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={validateAndSubmit}
          className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900"
        >
          {/* SECTION 1: Client Information */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex justify-between">
              <span>1. Client Information</span>
              <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                New Client
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Company or Client Name *
                </label>
                <input
                  type="text"
                  name="clientName"
                  placeholder="e.g., Jollibee - QC Branch"
                  value={formData.clientName}
                  onChange={handleChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.clientName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.clientName && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.clientName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Person *
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  placeholder="e.g., Juan Dela Cruz"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactPerson ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactPerson && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.contactPerson}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Number *
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  placeholder="Enter contact number"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.contactNumber}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="emailAddress"
                  placeholder="Enter email address"
                  value={formData.emailAddress}
                  onChange={handleChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emailAddress && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.emailAddress}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Business Address *
                </label>
                <input
                  type="text"
                  name="businessAddress"
                  placeholder="Enter business address"
                  value={formData.businessAddress}
                  onChange={handleChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.businessAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.businessAddress && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.businessAddress}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: PICKUP ADDRESSES */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                2. Pickup Addresses
              </span>
              <button
                type="button"
                onClick={addPickupRow}
                style={{ backgroundColor: "oklch(70.7% 0.165 254.624)" }}
                className="inline-flex items-center justify-center gap-1.5 text-white font-medium rounded-lg text-xs shadow-sm transition-all w-32.5 h-8 hover:opacity-90"
              >
                <Plus className="w-4 h-4 font-normal" /> New Pickup
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Warehouse Name
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[25%]">
                      Warehouse Address
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
                    <th className="p-2.5 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pickupList.map((row, idx) => {
                    const confirmKey = `pickup-${idx}`;
                    const isConfirming = deleteConfirm[confirmKey];

                    return (
                      <tr
                        key={idx}
                        className="border-b border-slate-200 last:border-0 font-normal text-black align-top"
                      >
                        <td className="p-2 border-r border-slate-200 text-center font-medium pt-3">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Enter Name"
                            value={row.warehouseName}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "warehouseName",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Enter Address"
                            value={row.warehouseAddress}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "warehouseAddress",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Contact Person"
                            value={row.contactPerson}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "contactPerson",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Contact Number"
                            value={row.contactNumber}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "contactNumber",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
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
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={row.quantity}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none min-w-15"
                          />
                        </td>
                        <td className="p-2 text-center align-middle">
                          {isConfirming ? (
                            <div
                              className="flex flex-col items-center gap-1 p-1.5 rounded-lg border shadow-sm"
                              style={{
                                backgroundColor:
                                  "oklch(63.7% 0.237 25.331 / 0.1)",
                                borderColor: "oklch(63.7% 0.237 25.331 / 0.4)",
                              }}
                            >
                              <span
                                className="text-[10px] font-semibold leading-tight"
                                style={{ color: "oklch(50% 0.237 25.331)" }}
                              >
                                Delete row?
                              </span>
                              <div className="flex items-center gap-2 justify-center">
                                <button
                                  type="button"
                                  onClick={() => removePickupRow(idx)}
                                  style={{
                                    backgroundColor:
                                      "oklch(63.7% 0.237 25.331)",
                                  }}
                                  className="px-2 py-0.5 text-white rounded text-[10px] font-bold hover:opacity-90"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirm((prev) => ({
                                      ...prev,
                                      [confirmKey]: false,
                                    }))
                                  }
                                  className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirm((prev) => ({
                                  ...prev,
                                  [confirmKey]: true,
                                }))
                              }
                              disabled={pickupList.length === 1}
                              className={`p-1.5 rounded-md transition-colors ${pickupList.length === 1 ? "text-slate-300 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-700"}`}
                              style={{
                                color:
                                  pickupList.length === 1
                                    ? undefined
                                    : "oklch(63.7% 0.237 25.331)",
                              }}
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: DELIVERY ADDRESSES */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                3. Delivery Address
              </span>
              <button
                type="button"
                onClick={addDeliveryRow}
                style={{ backgroundColor: "oklch(70.7% 0.165 254.624)" }}
                className="inline-flex items-center justify-center gap-1.5 text-white font-medium rounded-lg text-xs shadow-sm transition-all w-32.5 h-8 hover:opacity-90"
              >
                <Plus className="w-4 h-4 font-normal" /> New Branch
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs min-w-150">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200 w-[20%]">
                      Branch Name
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[25%]">
                      Delivery Address
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Person
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[15%]">
                      Contact Number
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-[12%]">
                      Delivery Time
                    </th>
                    <th className="p-2.5 border-r border-slate-200 w-24 text-center">
                      Quantity
                    </th>
                    <th className="p-2.5 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryList.map((row, idx) => {
                    const confirmKey = `delivery-${idx}`;
                    const isConfirming = deleteConfirm[confirmKey];

                    return (
                      <tr
                        key={idx}
                        className="border-b border-slate-200 last:border-0 font-normal text-black align-top"
                      >
                        <td className="p-2 border-r border-slate-200 text-center font-medium pt-3">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Enter Name"
                            value={row.branchName}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "branchName",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Enter Address"
                            value={row.deliveryAddress}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "deliveryAddress",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Contact Person"
                            value={row.contactPerson}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "contactPerson",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Contact Number"
                            value={row.contactNumber}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "contactNumber",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
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
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={row.quantity}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none min-w-15"
                          />
                        </td>
                        <td className="p-2 text-center align-middle">
                          {isConfirming ? (
                            <div
                              className="flex flex-col items-center gap-1 p-1.5 rounded-lg border shadow-sm"
                              style={{
                                backgroundColor:
                                  "oklch(63.7% 0.237 25.331 / 0.1)",
                                borderColor: "oklch(63.7% 0.237 25.331 / 0.4)",
                              }}
                            >
                              <span
                                className="text-[10px] font-semibold leading-tight"
                                style={{ color: "oklch(50% 0.237 25.331)" }}
                              >
                                Delete row?
                              </span>
                              <div className="flex items-center gap-2 justify-center">
                                <button
                                  type="button"
                                  onClick={() => removeDeliveryRow(idx)}
                                  style={{
                                    backgroundColor:
                                      "oklch(63.7% 0.237 25.331)",
                                  }}
                                  className="px-2 py-0.5 text-white rounded text-[10px] font-bold hover:opacity-90"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirm((prev) => ({
                                      ...prev,
                                      [confirmKey]: false,
                                    }))
                                  }
                                  className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirm((prev) => ({
                                  ...prev,
                                  [confirmKey]: true,
                                }))
                              }
                              disabled={deliveryList.length === 1}
                              className={`p-1.5 rounded-md transition-colors ${deliveryList.length === 1 ? "text-slate-300 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-700"}`}
                              style={{
                                color:
                                  deliveryList.length === 1
                                    ? undefined
                                    : "oklch(63.7% 0.237 25.331)",
                              }}
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4: BOOKING DETAILS & SCHEDULE */}
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
                  value={formData.deliverySchedule}
                  onChange={handleChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.deliverySchedule ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.deliverySchedule && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.deliverySchedule}
                  </p>
                )}
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
                  placeholder="e.g., Burger Buns"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.product ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.product && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.product}
                  </p>
                )}
              </div>
              <div className="sm:col-span-3 md:col-span-3">
                <label className="block text-xs font-medium text-black mb-1">
                  Priority Level *
                </label>
                <div className="relative w-full">
                  <select
                    name="priorityLevel"
                    value={formData.priorityLevel}
                    onChange={handleChange}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.priorityLevel ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  >
                    <option value="" disabled>
                      Select priority level
                    </option>
                    <option value="Standard">Standard</option>
                    <option value="Urgent">Urgent / Rush</option>
                    <option value="High Priority">High Priority</option>
                  </select>
                </div>
                {errors.priorityLevel && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.priorityLevel}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 5: ASSIGN DELIVERY CREW */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                5. Assign Delivery Crews & Vehicle {isSubconMode && "(Subcon)"}
              </span>
              <div className="flex items-center gap-4">
                {isSubconMode ? (
                  <button
                    type="button"
                    onClick={() => setIsSubconMode(false)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                  >
                    Assign to Own Resources
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsSubconMode(true)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      Assign to Subcon Partner
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        alert("Fleet Auto-Recommendation triggered!")
                      }
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      Auto-Recommend Available Resources
                    </button>
                  </>
                )}
              </div>
            </div>

            {isSubconMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Select Subcon Partner *
                  </label>
                  <div className="relative w-full">
                    <select
                      name="subconPartner"
                      value={formData.subconPartner}
                      onChange={handleChange}
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.subconPartner ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    >
                      <option value="" disabled>
                        Select partner
                      </option>
                      <option value="Lalamove">Lalamove</option>
                      <option value="Transportify">Transportify</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {errors.subconPartner && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.subconPartner}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Truck Plate No. *
                  </label>
                  <input
                    type="text"
                    name="truckPlate"
                    value={formData.truckPlate}
                    onChange={handleChange}
                    placeholder="Enter plate no."
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckPlate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.truckPlate && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.truckPlate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Driver *
                  </label>
                  <input
                    type="text"
                    name="driver"
                    value={formData.driver}
                    onChange={handleChange}
                    placeholder="Enter driver name"
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.driver ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.driver && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.driver}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #1 (Optional)
                  </label>
                  <input
                    type="text"
                    name="helper1"
                    value={formData.helper1}
                    onChange={handleChange}
                    placeholder="Enter helper 1 name"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #2 (Optional)
                  </label>
                  <input
                    type="text"
                    name="helper2"
                    value={formData.helper2}
                    onChange={handleChange}
                    placeholder="Enter helper 2 name"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Truck Plate No. *
                  </label>
                  <div className="relative w-full">
                    <select
                      name="truckPlate"
                      value={formData.truckPlate}
                      onChange={handleChange}
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckPlate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    >
                      <option value="" disabled>
                        Select truck
                      </option>
                      {trucks.map((t) => (
                        <option key={t.truckID} value={t.truckID}>
                          {t.plateNumber} ({t.model})
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.truckPlate && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.truckPlate}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Driver *
                  </label>
                  <div className="relative w-full">
                    <select
                      name="driver"
                      value={formData.driver}
                      onChange={handleChange}
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.driver ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    >
                      <option value="" disabled>
                        Select driver
                      </option>
                      {drivers.map((d) => (
                        <option key={d.employeeID} value={d.employeeName}>
                          {d.employeeName}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.driver && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.driver}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #1 (Optional)
                  </label>
                  <div className="relative w-full">
                    <select
                      name="helper1"
                      value={formData.helper1}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">Select helper</option>
                      {helpers.map((h) => (
                        <option key={h.employeeID} value={h.employeeName}>
                          {h.employeeName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #2 (Optional)
                  </label>
                  <div className="relative w-full">
                    <select
                      name="helper2"
                      value={formData.helper2}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">Select helper</option>
                      {helpers.map((h) => (
                        <option key={h.employeeID} value={h.employeeName}>
                          {h.employeeName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 6: NOTES / INSTRUCTIONS */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              6. Notes / Instructions (Optional)
            </div>
            <textarea
              name="notes"
              rows={5}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add special delivery instructions, gate pass codes, or handling notes here..."
              className="w-full min-h-30 resize-y bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* MODAL ACTION BUTTONS */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Generate Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// UNIVERSAL BOOKING MODAL
// ==========================================

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: any[];
  trucks: any[];
  drivers: any[];
  helpers: any[];
  preSelectedClientID?: string;
  onSubmitSuccess: (data: any) => void;
}

function BookingModal({
  isOpen,
  onClose,
  clients,
  trucks,
  drivers,
  helpers,
  preSelectedClientID,
  onSubmitSuccess,
}: BookingModalProps) {
  const initialFormState = {
    clientID: "",
    clientName: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
    requestDate: "",
    deliverySchedule: "",
    pickupTime: "",
    deliveryTime: "",
    priorityLevel: "",
    pickupAddress: "",
    pickupContactPerson: "",
    pickupContactNumber: "",
    product: "",
    quantity: "",
    deliveryAddress: "",
    deliveryContactPerson: "",
    deliveryContactNumber: "",
    subconPartner: "", // ADDED FOR SUBCON
    truckPlate: "",
    driver: "",
    helper1: "",
    helper2: "",
    notes: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [isSubconMode, setIsSubconMode] = useState(false); // ADDED FOR SUBCON

  // Dynamic lists for registered client
  const [pickupList, setPickupList] = useState<any[]>([
    {
      warehouseName: "",
      warehouseAddress: "",
      contactPerson: "",
      contactNumber: "",
      pickupTime: "",
      quantity: "",
    },
  ]);

  const [deliveryList, setDeliveryList] = useState<any[]>([
    {
      branchName: "",
      deliveryAddress: "",
      contactPerson: "",
      contactNumber: "",
      deliveryTime: "",
      quantity: "",
    },
  ]);

  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, boolean>>(
    {},
  );
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (isOpen) {
      setIsSubconMode(false); // RESET SUBCON MODE ON OPEN

      if (preSelectedClientID) {
        const client = clients.find((c) => c.clientID === preSelectedClientID);

        // 1. Auto-populate basic client information
        setFormData({
          ...initialFormState,
          clientID: preSelectedClientID,
          clientName: client ? client.company : "",
          contactPerson: client ? client.contactName : "",
          contactNumber: client ? client.contact : "",
          emailAddress: client
            ? client.emailAdd || client.emailAddress || ""
            : "",
          businessAddress: client
            ? client.businessAdd || client.businessAddress || ""
            : "",
        });

        // 2. FIX: Do NOT auto-populate addresses. Just set a single empty default row.
        // Users will select the warehouse/branch manually from the dropdowns.
        setPickupList([
          {
            warehouseName: "",
            warehouseAddress: "",
            contactPerson: "",
            contactNumber: "",
            pickupTime: "",
            quantity: "",
          },
        ]);

        setDeliveryList([
          {
            branchName: "",
            deliveryAddress: "",
            contactPerson: "",
            contactNumber: "",
            deliveryTime: "",
            quantity: "",
          },
        ]);
      } else {
        // If Walk-in/On-Call, reset everything to empty
        setFormData(initialFormState);
        setPickupList([
          {
            warehouseName: "",
            warehouseAddress: "",
            contactPerson: "",
            contactNumber: "",
            pickupTime: "",
            quantity: "",
          },
        ]);
        setDeliveryList([
          {
            branchName: "",
            deliveryAddress: "",
            contactPerson: "",
            contactNumber: "",
            deliveryTime: "",
            quantity: "",
          },
        ]);
      }

      setDeleteConfirm({});
      setErrors({});
    }
  }, [isOpen, preSelectedClientID, clients]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
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

  const addPickupRow = () => {
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

  const removePickupRow = (index: number) => {
    if (pickupList.length === 1) return;
    setPickupList(pickupList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`pickup-${index}`]: false }));
  };

  const addDeliveryRow = () => {
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
  };

  const removeDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryList(deliveryList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`delivery-${index}`]: false }));
  };

  const handleWarehouseSelect = (index: number, selectedName: string) => {
    const matchedWarehouse = (
      selectedClientRecord?.Warehouse ||
      selectedClientRecord?.warehouses ||
      []
    ).find((w: any) => (w.whName || w.warehouseName) === selectedName);
    const updated = [...pickupList];
    updated[index] = {
      ...updated[index],
      warehouseName: selectedName,
      warehouseAddress: matchedWarehouse
        ? matchedWarehouse.warehouseLoc ||
          matchedWarehouse.warehouseAddress ||
          ""
        : "",
      contactPerson: matchedWarehouse
        ? matchedWarehouse.contactPerson || ""
        : "",
      contactNumber: matchedWarehouse
        ? matchedWarehouse.contactNum || matchedWarehouse.contactNumber || ""
        : "",
    };
    setPickupList(updated);
  };

  const handleBranchSelect = (index: number, selectedName: string) => {
    const matchedBranch = (
      selectedClientRecord?.Branch ||
      selectedClientRecord?.branches ||
      []
    ).find((b: any) => b.branchName === selectedName);
    const updated = [...deliveryList];
    updated[index] = {
      ...updated[index],
      branchName: selectedName,
      deliveryAddress: matchedBranch
        ? matchedBranch.deliveryAddress || matchedBranch.branchAddress || ""
        : "",
      contactPerson: matchedBranch ? matchedBranch.contactPerson || "" : "",
      contactNumber: matchedBranch
        ? matchedBranch.contactNumber || matchedBranch.contactNum || ""
        : "",
    };
    setDeliveryList(updated);
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!formData.clientName.trim())
      newErrors.clientName = "Client / Company Name is required.";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required.";
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = "Contact number is required.";
    if (!formData.emailAddress.trim())
      newErrors.emailAddress = "Email address is required.";
    if (!formData.businessAddress.trim())
      newErrors.businessAddress = "Business address is required.";

    if (preSelectedClientID) {
      if (!formData.deliverySchedule)
        newErrors.deliverySchedule = "Delivery schedule is required.";
      if (!formData.priorityLevel)
        newErrors.priorityLevel = "Priority level is required.";
      if (!formData.product.trim())
        newErrors.product = "Product description is required.";
    } else {
      if (!formData.requestDate)
        newErrors.requestDate = "Request date is required.";
      if (!formData.deliverySchedule)
        newErrors.deliverySchedule = "Delivery schedule is required.";
      if (!formData.pickupTime)
        newErrors.pickupTime = "Pickup time is required.";
      if (!formData.deliveryTime)
        newErrors.deliveryTime = "Delivery time is required.";
      if (!formData.priorityLevel)
        newErrors.priorityLevel = "Priority level is required.";
      if (!formData.product.trim())
        newErrors.product = "Product description is required.";
      if (!formData.quantity.toString().trim())
        newErrors.quantity = "Quantity is required.";
      if (!formData.pickupAddress.trim())
        newErrors.pickupAddress = "Pickup address is required.";
      if (!formData.deliveryAddress.trim())
        newErrors.deliveryAddress = "Delivery address is required.";
    }

    if (isSubconMode && !formData.subconPartner)
      newErrors.subconPartner = "Subcon partner is required.";
    if (!formData.truckPlate)
      newErrors.truckPlate = "Truck plate number is required.";
    if (!formData.driver) newErrors.driver = "Driver assignment is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const submissionData = {
      ...formData,
      pickupList,
      deliveryList,
    };

    onSubmitSuccess(submissionData);
    onClose();
  };

  const selectedClientRecord = preSelectedClientID
    ? clients.find((c) => c.clientID === preSelectedClientID)
    : null;
  const registeredWarehouses =
    selectedClientRecord?.Warehouse || selectedClientRecord?.warehouses || [];
  const registeredBranches =
    selectedClientRecord?.Branch || selectedClientRecord?.branches || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {preSelectedClientID
              ? "Registered Client Booking"
              : "On-Call Booking Form"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={validateAndSubmit}
          className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900"
        >
          {/* SECTION 1: CLIENT INFORMATION */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex justify-between">
              <span>1. Client Information</span>
              {!preSelectedClientID && (
                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Walk-in / On-Call
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Company or Client Name *
                </label>
                {preSelectedClientID ? (
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold text-slate-700 truncate">
                    {formData.clientName}
                  </div>
                ) : (
                  <input
                    type="text"
                    name="clientName"
                    value={formData.clientName}
                    onChange={handleChange}
                    placeholder="e.g., Jollibee - QC Branch"
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.clientName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                )}
                {errors.clientName && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.clientName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Person *
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="e.g., Juan Dela Cruz"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactPerson ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactPerson && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.contactPerson}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Number *
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  placeholder="Enter contact number"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.contactNumber}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="emailAddress"
                  value={formData.emailAddress}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emailAddress && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.emailAddress}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Business Address *
                </label>
                <input
                  type="text"
                  name="businessAddress"
                  value={formData.businessAddress}
                  onChange={handleChange}
                  placeholder="Enter business address"
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.businessAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.businessAddress && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.businessAddress}
                  </p>
                )}
              </div>
            </div>
          </div>

          {!preSelectedClientID ? (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                2. Booking Details & Schedule
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Request Date *
                  </label>
                  <input
                    type="date"
                    name="requestDate"
                    value={formData.requestDate}
                    onChange={handleChange}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.requestDate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.requestDate && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.requestDate}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Delivery Schedule *
                  </label>
                  <input
                    type="date"
                    name="deliverySchedule"
                    value={formData.deliverySchedule}
                    onChange={handleChange}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.deliverySchedule ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.deliverySchedule && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.deliverySchedule}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Priority Level *
                  </label>
                  <div className="relative w-full">
                    <select
                      name="priorityLevel"
                      value={formData.priorityLevel}
                      onChange={handleChange}
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.priorityLevel ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    >
                      <option value="" disabled>
                        Select priority level
                      </option>
                      <option value="Standard">Standard</option>
                      <option value="Urgent">Urgent / Rush</option>
                      <option value="High Priority">High Priority</option>
                    </select>
                  </div>
                  {errors.priorityLevel && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.priorityLevel}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-black mb-1">
                    Pickup Time *
                  </label>
                  <input
                    type="time"
                    name="pickupTime"
                    value={formData.pickupTime}
                    onChange={handleChange}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.pickupTime ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.pickupTime && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.pickupTime}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-black mb-1">
                    Delivery Time *
                  </label>
                  <input
                    type="time"
                    name="deliveryTime"
                    value={formData.deliveryTime}
                    onChange={handleChange}
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.deliveryTime ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.deliveryTime && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.deliveryTime}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-black mb-1">
                    Product To Deliver *
                  </label>
                  <input
                    type="text"
                    name="product"
                    value={formData.product}
                    onChange={handleChange}
                    placeholder="e.g., Burger Buns"
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.product ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.product && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.product}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-black mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    placeholder="e.g., 40"
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.quantity ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.quantity && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.quantity}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Pickup Address *
                  </label>
                  <input
                    type="text"
                    name="pickupAddress"
                    value={formData.pickupAddress}
                    onChange={handleChange}
                    placeholder="Enter complete pickup address"
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.pickupAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.pickupAddress && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.pickupAddress}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Delivery Address *
                  </label>
                  <input
                    type="text"
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleChange}
                    placeholder="Enter complete delivery address"
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.deliveryAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.deliveryAddress && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.deliveryAddress}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* SECTION 2: PICKUP ADDRESSES */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                  <span className="font-semibold text-black text-sm tracking-wide">
                    2. Pickup Addresses
                  </span>
                  <button
                    type="button"
                    onClick={addPickupRow}
                    style={{ backgroundColor: "oklch(70.7% 0.165 254.624)" }}
                    className="inline-flex items-center justify-center gap-1.5 text-white font-medium rounded-lg text-xs shadow-sm transition-all w-32.5 h-8 hover:opacity-90"
                  >
                    <Plus className="w-4 h-4 font-normal" /> New Pickup
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs min-w-150">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                        <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                        <th className="p-2.5 border-r border-slate-200 w-[20%]">
                          Warehouse Name
                        </th>
                        <th className="p-2.5 border-r border-slate-200 w-[25%]">
                          Warehouse Address
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
                        <th className="p-2.5 w-16 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pickupList.map((row, idx) => {
                        const confirmKey = `pickup-${idx}`;
                        const isConfirming = deleteConfirm[confirmKey];

                        return (
                          <tr
                            key={idx}
                            className="border-b border-slate-200 last:border-0 font-normal text-black align-top"
                          >
                            <td className="p-2 border-r border-slate-200 text-center font-medium pt-3">
                              {idx + 1}
                            </td>
                            <td className="p-2 border-r border-slate-200 relative">
                              <div className="relative w-full">
                                <select
                                  value={row.warehouseName}
                                  onChange={(e) =>
                                    handleWarehouseSelect(idx, e.target.value)
                                  }
                                  className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none text-black truncate"
                                >
                                  <option value="">Select Warehouse</option>
                                  {registeredWarehouses.map(
                                    (w: any, i: number) => (
                                      <option
                                        key={i}
                                        value={w.whName || w.warehouseName}
                                      >
                                        {w.whName || w.warehouseName}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="text"
                                placeholder="Enter Address"
                                value={row.warehouseAddress}
                                onChange={(e) =>
                                  handlePickupChange(
                                    idx,
                                    "warehouseAddress",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="text"
                                placeholder="Enter Contact Person"
                                value={row.contactPerson}
                                onChange={(e) =>
                                  handlePickupChange(
                                    idx,
                                    "contactPerson",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="text"
                                placeholder="Enter contact number"
                                value={row.contactNumber}
                                onChange={(e) =>
                                  handlePickupChange(
                                    idx,
                                    "contactNumber",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
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
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="number"
                                placeholder="Qty"
                                value={row.quantity}
                                onChange={(e) =>
                                  handlePickupChange(
                                    idx,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none min-w-15"
                              />
                            </td>
                            <td className="p-2 text-center align-middle">
                              {isConfirming ? (
                                <div
                                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg border shadow-sm"
                                  style={{
                                    backgroundColor:
                                      "oklch(63.7% 0.237 25.331 / 0.1)",
                                    borderColor:
                                      "oklch(63.7% 0.237 25.331 / 0.4)",
                                  }}
                                >
                                  <span
                                    className="text-[10px] font-semibold leading-tight"
                                    style={{ color: "oklch(50% 0.237 25.331)" }}
                                  >
                                    Delete row?
                                  </span>
                                  <div className="flex items-center gap-2 justify-center">
                                    <button
                                      type="button"
                                      onClick={() => removePickupRow(idx)}
                                      style={{
                                        backgroundColor:
                                          "oklch(63.7% 0.237 25.331)",
                                      }}
                                      className="px-2 py-0.5 text-white rounded text-[10px] font-bold hover:opacity-90"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteConfirm((prev) => ({
                                          ...prev,
                                          [confirmKey]: false,
                                        }))
                                      }
                                      className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirm((prev) => ({
                                      ...prev,
                                      [confirmKey]: true,
                                    }))
                                  }
                                  disabled={pickupList.length === 1}
                                  className={`p-1.5 rounded-md transition-colors ${pickupList.length === 1 ? "text-slate-300 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-700"}`}
                                  style={{
                                    color:
                                      pickupList.length === 1
                                        ? undefined
                                        : "oklch(63.7% 0.237 25.331)",
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mx-auto" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 3: DELIVERY ADDRESSES */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                  <span className="font-semibold text-black text-sm tracking-wide">
                    3. Delivery Address
                  </span>
                  <button
                    type="button"
                    onClick={addDeliveryRow}
                    style={{ backgroundColor: "oklch(70.7% 0.165 254.624)" }}
                    className="inline-flex items-center justify-center gap-1.5 text-white font-medium rounded-lg text-xs shadow-sm transition-all w-32.5 h-8 hover:opacity-90"
                  >
                    <Plus className="w-4 h-4 font-normal" /> Branch
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs min-w-150">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                        <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                        <th className="p-2.5 border-r border-slate-200 w-[20%]">
                          Branch Name
                        </th>
                        <th className="p-2.5 border-r border-slate-200 w-[25%]">
                          Delivery Address
                        </th>
                        <th className="p-2.5 border-r border-slate-200 w-[15%]">
                          Contact Person
                        </th>
                        <th className="p-2.5 border-r border-slate-200 w-[15%]">
                          Contact Number
                        </th>
                        <th className="p-2.5 border-r border-slate-200 w-[12%]">
                          Delivery Time
                        </th>
                        <th className="p-2.5 border-r border-slate-200 w-24 text-center">
                          Quantity
                        </th>
                        <th className="p-2.5 w-16 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryList.map((row, idx) => {
                        const confirmKey = `delivery-${idx}`;
                        const isConfirming = deleteConfirm[confirmKey];

                        return (
                          <tr
                            key={idx}
                            className="border-b border-slate-200 last:border-0 font-normal text-black align-top"
                          >
                            <td className="p-2 border-r border-slate-200 text-center font-medium pt-3">
                              {idx + 1}
                            </td>
                            <td className="p-2 border-r border-slate-200 relative">
                              <div className="relative w-full">
                                <select
                                  value={row.branchName}
                                  onChange={(e) =>
                                    handleBranchSelect(idx, e.target.value)
                                  }
                                  className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none text-black truncate pr-6"
                                >
                                  <option value="">Select Branch</option>
                                  {registeredBranches.map(
                                    (b: any, i: number) => (
                                      <option key={i} value={b.branchName}>
                                        {b.branchName}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="text"
                                placeholder="Enter Address"
                                value={row.deliveryAddress}
                                onChange={(e) =>
                                  handleDeliveryChange(
                                    idx,
                                    "deliveryAddress",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="text"
                                placeholder="Enter Contact Person"
                                value={row.contactPerson}
                                onChange={(e) =>
                                  handleDeliveryChange(
                                    idx,
                                    "contactPerson",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="text"
                                placeholder="Enter contact number"
                                value={row.contactNumber}
                                onChange={(e) =>
                                  handleDeliveryChange(
                                    idx,
                                    "contactNumber",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
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
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="number"
                                placeholder="Qty"
                                value={row.quantity}
                                onChange={(e) =>
                                  handleDeliveryChange(
                                    idx,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-transparent border border-slate-200 rounded px-1.5 py-1 focus:ring-0 focus:outline-none min-w-15"
                              />
                            </td>
                            <td className="p-2 text-center align-middle">
                              {isConfirming ? (
                                <div
                                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg border shadow-sm"
                                  style={{
                                    backgroundColor:
                                      "oklch(63.7% 0.237 25.331 / 0.1)",
                                    borderColor:
                                      "oklch(63.7% 0.237 25.331 / 0.4)",
                                  }}
                                >
                                  <span
                                    className="text-[10px] font-semibold leading-tight"
                                    style={{ color: "oklch(50% 0.237 25.331)" }}
                                  >
                                    Delete row?
                                  </span>
                                  <div className="flex items-center gap-2 justify-center">
                                    <button
                                      type="button"
                                      onClick={() => removeDeliveryRow(idx)}
                                      style={{
                                        backgroundColor:
                                          "oklch(63.7% 0.237 25.331)",
                                      }}
                                      className="px-2 py-0.5 text-white rounded text-[10px] font-bold hover:opacity-90"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteConfirm((prev) => ({
                                          ...prev,
                                          [confirmKey]: false,
                                        }))
                                      }
                                      className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirm((prev) => ({
                                      ...prev,
                                      [confirmKey]: true,
                                    }))
                                  }
                                  disabled={deliveryList.length === 1}
                                  className={`p-1.5 rounded-md transition-colors ${deliveryList.length === 1 ? "text-slate-300 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-700"}`}
                                  style={{
                                    color:
                                      deliveryList.length === 1
                                        ? undefined
                                        : "oklch(63.7% 0.237 25.331)",
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mx-auto" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 4: BOOKING DETAILS & SCHEDULE */}
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
                      value={formData.deliverySchedule}
                      onChange={handleChange}
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.deliverySchedule ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    />
                    {errors.deliverySchedule && (
                      <p className="text-red-500 text-[11px] mt-1">
                        {errors.deliverySchedule}
                      </p>
                    )}
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
                      placeholder="e.g., Burger Buns"
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.product ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    />
                    {errors.product && (
                      <p className="text-red-500 text-[11px] mt-1">
                        {errors.product}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-3 md:col-span-3">
                    <label className="block text-xs font-medium text-black mb-1">
                      Priority Level *
                    </label>
                    <div className="relative w-full">
                      <select
                        name="priorityLevel"
                        value={formData.priorityLevel}
                        onChange={handleChange}
                        className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.priorityLevel ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                      >
                        <option value="" disabled>
                          Select priority level
                        </option>
                        <option value="Standard">Standard</option>
                        <option value="Urgent">Urgent / Rush</option>
                        <option value="High Priority">High Priority</option>
                      </select>
                    </div>
                    {errors.priorityLevel && (
                      <p className="text-red-500 text-[11px] mt-1">
                        {errors.priorityLevel}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SECTION 5: ASSIGN DELIVERY CREW */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                {preSelectedClientID ? "5." : "3."} Assign Delivery Crews &
                Vehicle {isSubconMode && "(Subcon)"}
              </span>
              <div className="flex items-center gap-4">
                {isSubconMode ? (
                  <button
                    type="button"
                    onClick={() => setIsSubconMode(false)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                  >
                    Assign to Own Resources
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsSubconMode(true)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      Assign to Subcon Partner
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        alert("Fleet Auto-Recommendation triggered!")
                      }
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      Auto-Recommend Available Resources
                    </button>
                  </>
                )}
              </div>
            </div>

            {isSubconMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Select Subcon Partner *
                  </label>
                  <div className="relative w-full">
                    <select
                      name="subconPartner"
                      value={formData.subconPartner}
                      onChange={handleChange}
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.subconPartner ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    >
                      <option value="" disabled>
                        Select partner
                      </option>
                      <option value="Lalamove">Lalamove</option>
                      <option value="Transportify">Transportify</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {errors.subconPartner && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.subconPartner}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Truck Plate No. *
                  </label>
                  <input
                    type="text"
                    name="truckPlate"
                    value={formData.truckPlate}
                    onChange={handleChange}
                    placeholder="Enter plate no."
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckPlate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.truckPlate && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.truckPlate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Driver *
                  </label>
                  <input
                    type="text"
                    name="driver"
                    value={formData.driver}
                    onChange={handleChange}
                    placeholder="Enter driver name"
                    className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.driver ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                  {errors.driver && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.driver}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #1 (Optional)
                  </label>
                  <input
                    type="text"
                    name="helper1"
                    value={formData.helper1}
                    onChange={handleChange}
                    placeholder="Enter helper 1 name"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #2 (Optional)
                  </label>
                  <input
                    type="text"
                    name="helper2"
                    value={formData.helper2}
                    onChange={handleChange}
                    placeholder="Enter helper 2 name"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Truck Plate No. *
                  </label>
                  <div className="relative w-full">
                    <select
                      name="truckPlate"
                      value={formData.truckPlate}
                      onChange={handleChange}
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckPlate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    >
                      <option value="" disabled>
                        Select truck
                      </option>
                      {trucks.map((t) => (
                        <option key={t.truckID} value={t.truckID}>
                          {t.plateNumber} ({t.model})
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.truckPlate && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.truckPlate}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Driver *
                  </label>
                  <div className="relative w-full">
                    <select
                      name="driver"
                      value={formData.driver}
                      onChange={handleChange}
                      className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.driver ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    >
                      <option value="" disabled>
                        Select driver
                      </option>
                      {drivers.map((d) => (
                        <option key={d.employeeID} value={d.employeeName}>
                          {d.employeeName}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.driver && (
                    <p className="text-red-500 text-[11px] mt-1">
                      {errors.driver}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #1 (Optional)
                  </label>
                  <div className="relative w-full">
                    <select
                      name="helper1"
                      value={formData.helper1}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">Select helper</option>
                      {helpers.map((h) => (
                        <option key={h.employeeID} value={h.employeeName}>
                          {h.employeeName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Helper #2 (Optional)
                  </label>
                  <div className="relative w-full">
                    <select
                      name="helper2"
                      value={formData.helper2}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">Select helper</option>
                      {helpers.map((h) => (
                        <option key={h.employeeID} value={h.employeeName}>
                          {h.employeeName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 6: NOTES / INSTRUCTIONS */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              {preSelectedClientID ? "6." : "4."} Notes / Instructions
              (Optional)
            </div>
            <textarea
              name="notes"
              rows={5}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add special delivery instructions, gate pass codes, or handling notes here..."
              className="w-full min-h-30 resize-y bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* MODAL ACTION BUTTONS */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Generate Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function KPIGrid({
  onNavigate,
  bookingsData,
}: {
  onNavigate: (name: string) => void;
  bookingsData: any;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {TABS.map((tab) => {
        const styles = COLOR_STYLES[tab.color as keyof typeof COLOR_STYLES];
        const count = bookingsData[tab.name]?.length ?? 0;
        return (
          <button
            key={tab.name}
            onClick={() => onNavigate(tab.name)}
            className="p-5 rounded-2xl shadow-sm bg-white border border-gray-200 hover:border-blue-600 transition-all flex items-center space-x-4 text-left w-full"
          >
            <div
              className={`w-14 h-14 rounded-full ${styles.iconBg} flex items-center justify-center ${styles.iconText} shrink-0`}
            >
              <tab.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-slate-800">{count}</p>
              <p className="text-gray-500 text-[11px] font-bold tracking-wider mt-0.5">
                {tab.name.toUpperCase()}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FeedTable({ tabConfig, bookings }: any) {
  const styles = COLOR_STYLES[tabConfig.color as keyof typeof COLOR_STYLES];
  const data = bookings || [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`w-9 h-9 rounded-xl ${styles.iconBg} flex items-center justify-center ${styles.iconText}`}
          >
            <tabConfig.icon className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {tabConfig.name} Feed
          </h3>
        </div>
        <span
          className={`px-3 py-1 ${styles.badgeBg} ${styles.badgeText} rounded-full text-xs font-bold`}
        >
          {data.length} Total
        </span>
      </div>

      {/* Body: Stacked Cards */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {data.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-2 opacity-20" />
            <p>No data found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {data.map((b: any) => (
              <div
                key={b.orderId}
                className="bg-gray-50/50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/10 transition-all duration-200"
              >
                {/* Card Header: Order ID & Client on Left, Status + Date/Time on Right */}
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 pr-2">
                    <h4 className="font-bold text-slate-800 text-base truncate">
                      {b.orderId}
                    </h4>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5 truncate">
                      {b.client}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`px-3 py-1 ${styles.badgeBg} ${styles.badgeText} rounded-full text-[11px] font-bold whitespace-nowrap`}
                    >
                      {tabConfig.statusLabel}
                    </span>
                    <span className="text-gray-500 text-[11px] font-medium whitespace-nowrap">
                      {b.dateTime}
                    </span>
                  </div>
                </div>

                {/* Card Details: Product, Driver, and Helper Side-by-Side in One Row with Truncation */}
                <div className="grid grid-cols-3 gap-2 text-sm mt-4 pt-4 border-t border-gray-200/80">
                  <div className="min-w-0">
                    <span className="text-gray-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold block mb-1 truncate">
                      Product
                    </span>
                    <span
                      className="text-slate-700 font-medium block truncate"
                      title={b.product}
                    >
                      {b.product}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold block mb-1 truncate">
                      Driver
                    </span>
                    <span
                      className="text-slate-700 font-medium block truncate"
                      title={b.driver}
                    >
                      {b.driver}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold block mb-1 truncate">
                      Helper
                    </span>
                    <span
                      className="text-slate-700 font-medium block truncate"
                      title={b.helper}
                    >
                      {b.helper}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// MAIN DASHBOARD PAGE COMPONENT
// ==========================================

export default function AdminDashboardPage() {
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isNewClientBookingOpen, setIsNewClientBookingOpen] = useState(false);
  const [isClientSearchModalOpen, setIsClientSearchModalOpen] = useState(false);
  const [selectedClientForBooking, setSelectedClientForBooking] = useState("");

  const [clients, setClients] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [helpers, setHelpers] = useState<any[]>([]);

  const [bookingsData, setBookingsData] = useState<{ [key: string]: any[] }>(
    DUMMY_BOOKINGS,
  );

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const clientRes = await axios.get(`${API_URL}/api/clients`);
        setClients(clientRes.data);

        const truckRes = await axios.get(`${API_URL}/api/trucks`);
        setTrucks(truckRes.data);

        const empRes = await axios.get(`${API_URL}/api/employees`);
        const allEmployees = empRes.data;
        setDrivers(
          allEmployees.filter((e: any) => e.role === "Driver" && e.isActive),
        );
        setHelpers(
          allEmployees.filter((e: any) => e.role === "Helper" && e.isActive),
        );
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }
    };
    fetchDashboardData();
  }, [API_URL]);

  const handleNavigate = (tabName: string) => {
    sectionRefs.current[tabName]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleModalSubmit = async (data: any) => {
    try {
      console.log("[FRONTEND] 🟢 Sending Order POST to Express...");

      let detailedNotes = "";

      if (!data.clientID) {
        detailedNotes += `[ON-CALL CUSTOMER]\nName: ${data.clientName}\nContact: ${data.contactPerson} (${data.contactNumber})\n\n`;
      }

      detailedNotes += `[DELIVERY DETAILS]\nPriority: ${data.priorityLevel}\nDelivery Schedule: ${data.deliverySchedule}\n`;
      detailedNotes += `\n[ASSIGNED CREW]\nTruck: ${data.truckPlate}\nDriver: ${data.driver}\nHelper 1: ${data.helper1 || "None"}\nHelper 2: ${data.helper2 || "None"}\n`;

      if (data.notes) {
        detailedNotes += `\n[NOTES]\n${data.notes}`;
      }

      // Updated payload to iterate dynamically assigned table rows if they exist
      const stops =
        data.deliveryList && data.deliveryList.length > 0
          ? data.deliveryList.map((d: any) => ({
              branchName: d.deliveryAddress || d.branchName,
              contactPerson: d.contactPerson || data.contactPerson,
              contactNum: d.contactNumber || data.contactNumber,
              expectedTime: d.deliveryTime || "12:00:00",
            }))
          : [
              {
                branchName: data.deliveryAddress,
                contactPerson: data.contactPerson,
                contactNum: data.contactNumber,
                expectedTime: "12:00:00",
              },
            ];

      const payload = {
        clientID: data.clientID || null,
        notes: detailedNotes,
        items: [
          {
            productName: data.product,
            productType: "General",
            quantity: Number(data.quantity) || 1,
            weightPerItem: 0,
          },
        ],
        stops: stops,
      };

      const res = await axios.post(`${API_URL}/api/orders`, payload);
      alert(
        `✅ Order Generated Successfully!\nTracking Code: ${res.data.orderCode}`,
      );
    } catch (err: any) {
      console.error(err);
      alert(
        `🚨 FAILED 🚨\n\nReason: ${err.response?.data?.error || err.message}`,
      );
    }
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Track pending bookings, in-transit deliveries, completed trips, and
            foul trips at a glance.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setSelectedClientForBooking("");
              setIsBookingModalOpen(true);
            }}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center bg-green-500 hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors duration-200 shadow-md whitespace-nowrap"
          >
            + On-Call Booking
          </button>
          <button
            onClick={() => setIsClientSearchModalOpen(true)}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center bg-blue-600 hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors duration-200 shadow-md whitespace-nowrap"
          >
            + New Booking
          </button>
        </div>
      </div>

      <KPIGrid onNavigate={handleNavigate} bookingsData={bookingsData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
        {TABS.map((tab) => (
          <div
            key={tab.name}
            ref={(el) => {
              sectionRefs.current[tab.name] = el;
            }}
            className="scroll-mt-6"
          >
            <FeedTable tabConfig={tab} bookings={bookingsData[tab.name]} />
          </div>
        ))}
      </div>

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        clients={clients}
        trucks={trucks}
        drivers={drivers}
        helpers={helpers}
        preSelectedClientID={selectedClientForBooking}
        onSubmitSuccess={handleModalSubmit}
      />

      <NewClientBookingModal
        isOpen={isNewClientBookingOpen}
        onClose={() => setIsNewClientBookingOpen(false)}
        trucks={trucks}
        drivers={drivers}
        helpers={helpers}
        onSubmitSuccess={handleModalSubmit}
      />

      <ClientSearchModal
        isOpen={isClientSearchModalOpen}
        onClose={() => setIsClientSearchModalOpen(false)}
        clients={clients}
        onSelectClient={(clientID) => {
          setSelectedClientForBooking(clientID);
          setIsClientSearchModalOpen(false);
          setIsBookingModalOpen(true);
        }}
        onOpenNewClientBooking={() => {
          setIsNewClientBookingOpen(true);
        }}
      />
    </div>
  );
}
