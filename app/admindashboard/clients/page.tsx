/* eslint-disable react-hooks/set-state-in-effect */
// ==========================================
// CLIENTS & PARTNERS MANAGEMENT PAGE
// ==========================================
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  UserPlus,
  Search,
  FileText,
  X,
  Plus,
  Trash2,
  ArrowLeft,
  Edit3,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

// ==========================================
// TYPES & DTOs
// ==========================================

type TabType = "Clients" | "Partners";

interface PickupAddress {
  warehouseName: string;
  warehouseAddress: string;
  contactPerson: string;
  contactNumber: string;
}

interface DeliveryAddress {
  branchName: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
}

export interface ClientRecord {
  id: string | number;
  name: string;
  status: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress?: string;
  businessAddress?: string;
  pickupAddresses?: PickupAddress[];
  deliveryAddresses?: DeliveryAddress[];
}

export interface PartnerRecord {
  id: string | number;
  name: string;
  status: string;
  contractType: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  businessAddress: string;
}

export type UnifiedRecord = ClientRecord | PartnerRecord;

interface ClientsResponse {
  data: any[];
}

interface PartnersResponse {
  data: any[];
}

// ==========================================
// SESSION & API FETCH
// ==========================================

const SESSION_KEY = "logisco_user_session";

interface UserSession {
  email: string;
  role: string;
  token: string;
  id: string;
  employeeName: string;
}

function getAuthSession(): UserSession {
  const savedSession =
    localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);

  if (!savedSession) {
    throw new Error("Authentication session not found. Please log in again.");
  }
  return JSON.parse(savedSession) as UserSession;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const session = getAuthSession();
  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${session.token}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  let result: unknown = null;
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    result = await response.json();
  }

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "message" in result
        ? String((result as any).message)
        : `Request failed with status ${response.status}`;

    if (response.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
    throw new Error(message);
  }

  return result as T;
}

// ==========================================
// 1. CLIENT MODAL
// ==========================================

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: ClientRecord) => void;
  editData?: ClientRecord | null;
}

export function ClientModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  editData,
}: ClientModalProps) {
  const initialClientState = {
    name: "",
    contactName: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
  };

  const [formData, setFormData] = useState(initialClientState);

  const [pickupList, setPickupList] = useState<PickupAddress[]>([
    {
      warehouseName: "",
      warehouseAddress: "",
      contactPerson: "",
      contactNumber: "",
    },
  ]);

  const [deliveryList, setDeliveryList] = useState<DeliveryAddress[]>([
    {
      branchName: "",
      deliveryAddress: "",
      contactPerson: "",
      contactNumber: "",
    },
  ]);

  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, boolean>>(
    {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name || "",
        contactName: editData.contactPerson || "",
        contactNumber: editData.contactNumber || "",
        emailAddress: editData.emailAddress || "",
        businessAddress: editData.businessAddress || "",
      });
      setPickupList(
        editData.pickupAddresses && editData.pickupAddresses.length > 0
          ? [...editData.pickupAddresses]
          : [
              {
                warehouseName: "",
                warehouseAddress: "",
                contactPerson: "",
                contactNumber: "",
              },
            ]
      );
      setDeliveryList(
        editData.deliveryAddresses && editData.deliveryAddresses.length > 0
          ? [...editData.deliveryAddresses]
          : [
              {
                branchName: "",
                deliveryAddress: "",
                contactPerson: "",
                contactNumber: "",
              },
            ]
      );
    } else {
      setFormData(initialClientState);
      setPickupList([
        {
          warehouseName: "",
          warehouseAddress: "",
          contactPerson: "",
          contactNumber: "",
        },
      ]);
      setDeliveryList([
        {
          branchName: "",
          deliveryAddress: "",
          contactPerson: "",
          contactNumber: "",
        },
      ]);
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialClientState);
    setPickupList([{ warehouseName: "", warehouseAddress: "", contactPerson: "", contactNumber: "" }]);
    setDeliveryList([{ branchName: "", deliveryAddress: "", contactPerson: "", contactNumber: "" }]);
    setDeleteConfirm({});
    setErrors({});
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePickupChange = (index: number, field: keyof PickupAddress, value: string) => {
    const updated = [...pickupList];
    updated[index][field] = value;
    setPickupList(updated);
    if (errors[`pickup-${index}-${field}`]) setErrors((prev) => ({ ...prev, [`pickup-${index}-${field}`]: "" }));
  };

  const handleDeliveryChange = (index: number, field: keyof DeliveryAddress, value: string) => {
    const updated = [...deliveryList];
    updated[index][field] = value;
    setDeliveryList(updated);
    if (errors[`delivery-${index}-${field}`]) setErrors((prev) => ({ ...prev, [`delivery-${index}-${field}`]: "" }));
  };

  const addPickupRow = () => setPickupList([...pickupList, { warehouseName: "", warehouseAddress: "", contactPerson: "", contactNumber: "" }]);
  const removePickupRow = (index: number) => {
    if (pickupList.length === 1) return;
    setPickupList(pickupList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`pickup-${index}`]: false }));
  };

  const addDeliveryRow = () => setDeliveryList([...deliveryList, { branchName: "", deliveryAddress: "", contactPerson: "", contactNumber: "" }]);
  const removeDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryList(deliveryList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`delivery-${index}`]: false }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Client name is required.";
    if (!formData.contactName.trim()) newErrors.contactName = "Contact name is required.";
    if (!formData.contactNumber.trim()) newErrors.contactNumber = "Contact number is required.";
    if (!formData.emailAddress.trim()) newErrors.emailAddress = "Email address is required.";
    if (!formData.businessAddress.trim()) newErrors.businessAddress = "Business address is required.";

    pickupList.forEach((p, idx) => {
      if (p.warehouseName || p.warehouseAddress) {
        if (!p.warehouseName.trim()) newErrors[`pickup-${idx}-warehouseName`] = "Warehouse name is required.";
        if (!p.warehouseAddress.trim()) newErrors[`pickup-${idx}-warehouseAddress`] = "Warehouse address is required.";
        if (!p.contactPerson.trim()) newErrors[`pickup-${idx}-contactPerson`] = "Contact person is required.";
        if (!p.contactNumber.trim()) newErrors[`pickup-${idx}-contactNumber`] = "Contact number is required.";
      }
    });

    deliveryList.forEach((d, idx) => {
      if (d.branchName || d.deliveryAddress) {
        if (!d.branchName.trim()) newErrors[`delivery-${idx}-branchName`] = "Branch name is required.";
        if (!d.deliveryAddress.trim()) newErrors[`delivery-${idx}-deliveryAddress`] = "Delivery address is required.";
        if (!d.contactPerson.trim()) newErrors[`delivery-${idx}-contactPerson`] = "Contact person is required.";
        if (!d.contactNumber.trim()) newErrors[`delivery-${idx}-contactNumber`] = "Contact number is required.";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: ClientRecord = {
      id: editData ? editData.id : Date.now(),
      name: formData.name,
      status: editData ? editData.status : "Active",
      contactPerson: formData.contactName,
      contactNumber: formData.contactNumber,
      emailAddress: formData.emailAddress,
      businessAddress: formData.businessAddress,
      pickupAddresses: pickupList.filter((p) => p.warehouseName.trim() !== ""),
      deliveryAddresses: deliveryList.filter((d) => d.branchName.trim() !== ""),
    };

    onSubmitSuccess(newRecord);
    handleCloseModal();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {editData ? "Edit Client Form" : "New Client Form"}
          </h2>
          <button onClick={handleCloseModal} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">1. Client & Information</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">Company / Client Name</label>
                <input type="text" name="name" placeholder="Enter client name" value={formData.name} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.name ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.name && <p className="text-red-500 text-[11px] mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Contact Person</label>
                <input type="text" name="contactName" placeholder="Enter contact name" value={formData.contactName} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.contactName && <p className="text-red-500 text-[11px] mt-1">{errors.contactName}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Contact Number</label>
                <input type="text" name="contactNumber" placeholder="Enter contact number" value={formData.contactNumber} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.contactNumber && <p className="text-red-500 text-[11px] mt-1">{errors.contactNumber}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Email Address</label>
                <input type="email" name="emailAddress" placeholder="Enter email address" value={formData.emailAddress} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.emailAddress && <p className="text-red-500 text-[11px] mt-1">{errors.emailAddress}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">Business Address</label>
                <input type="text" name="businessAddress" placeholder="Enter business address" value={formData.businessAddress} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.businessAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.businessAddress && <p className="text-red-500 text-[11px] mt-1">{errors.businessAddress}</p>}
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">2. Pickup Addresses:</span>
              <button type="button" onClick={addPickupRow} style={{ backgroundColor: "oklch(70.7% 0.165 254.624)" }} className="inline-flex items-center justify-center gap-1.5 text-white font-medium rounded-lg text-xs shadow-sm transition-all w-32.5 h-8 hover:opacity-90">
                <Plus className="w-4 h-4 font-normal" /> New Pickup
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200">Warehouse Name</th>
                    <th className="p-2.5 border-r border-slate-200">Warehouse Address</th>
                    <th className="p-2.5 border-r border-slate-200">Contact Person</th>
                    <th className="p-2.5 border-r border-slate-200">Contact Number</th>
                    <th className="p-2.5 w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pickupList.map((row, idx) => {
                    const confirmKey = `pickup-${idx}`;
                    const isConfirming = deleteConfirm[confirmKey];
                    const errName = errors[`pickup-${idx}-warehouseName`];
                    const errAddr = errors[`pickup-${idx}-warehouseAddress`];
                    const errPerson = errors[`pickup-${idx}-contactPerson`];
                    const errNum = errors[`pickup-${idx}-contactNumber`];

                    return (
                      <tr key={idx} className="border-b border-slate-200 last:border-0 font-normal text-black align-top">
                        <td className="p-2 border-r border-slate-200 text-center font-medium pt-3">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200">
                          <input type="text" placeholder="Enter Name" value={row.warehouseName} onChange={(e) => handlePickupChange(idx, "warehouseName", e.target.value)} className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errName ? "border-red-500 bg-red-50/20" : "border-slate-200"}`} />
                          {errName && <p className="text-red-500 text-[10px] mt-0.5">{errName}</p>}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input type="text" placeholder="Enter Address" value={row.warehouseAddress} onChange={(e) => handlePickupChange(idx, "warehouseAddress", e.target.value)} className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errAddr ? "border-red-500 bg-red-50/20" : "border-slate-200"}`} />
                          {errAddr && <p className="text-red-500 text-[10px] mt-0.5">{errAddr}</p>}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input type="text" placeholder="Enter Contact Person" value={row.contactPerson} onChange={(e) => handlePickupChange(idx, "contactPerson", e.target.value)} className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errPerson ? "border-red-500 bg-red-50/20" : "border-slate-200"}`} />
                          {errPerson && <p className="text-red-500 text-[10px] mt-0.5">{errPerson}</p>}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input type="text" placeholder="Enter contact number" value={row.contactNumber} onChange={(e) => handlePickupChange(idx, "contactNumber", e.target.value)} className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none placeholder:text-slate-400 ${errNum ? "border-red-500 bg-red-50/20" : "border-slate-200"}`} />
                          {errNum && <p className="text-red-500 text-[10px] mt-0.5">{errNum}</p>}
                        </td>
                        <td className="p-2 text-center align-middle">
                          {isConfirming ? (
                            <div className="flex flex-col items-center gap-1 p-1.5 rounded-lg border shadow-sm" style={{ backgroundColor: "oklch(63.7% 0.237 25.331 / 0.1)", borderColor: "oklch(63.7% 0.237 25.331 / 0.4)", }}>
                              <span className="text-[10px] font-semibold leading-tight" style={{ color: "oklch(50% 0.237 25.331)" }}>Are you sure you want to delete?</span>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => removePickupRow(idx)} style={{ backgroundColor: "oklch(63.7% 0.237 25.331)", }} className="px-2 py-0.5 text-white rounded text-[10px] font-bold hover:opacity-90 transition-colors">Yes</button>
                                <button type="button" onClick={() => setDeleteConfirm((prev) => ({ ...prev, [confirmKey]: false, }))} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 transition-colors">No</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setDeleteConfirm((prev) => ({ ...prev, [confirmKey]: true, }))} disabled={pickupList.length === 1} className={`p-1.5 rounded-md transition-colors ${pickupList.length === 1 ? "text-slate-300 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-700"}`} style={{ color: pickupList.length === 1 ? undefined : "oklch(63.7% 0.237 25.331)" }}>
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

          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">3. Delivery Address</span>
              <button type="button" onClick={addDeliveryRow} style={{ backgroundColor: "oklch(70.7% 0.165 254.624)" }} className="inline-flex items-center justify-center gap-1.5 text-white font-medium rounded-lg text-xs shadow-sm transition-all w-32.5 h-8 hover:opacity-90">
                <Plus className="w-4 h-4 font-normal" /> Branch
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200">Branch Name</th>
                    <th className="p-2.5 border-r border-slate-200">Delivery Address</th>
                    <th className="p-2.5 border-r border-slate-200">Contact Person</th>
                    <th className="p-2.5 border-r border-slate-200">Contact Number</th>
                    <th className="p-2.5 w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryList.map((row, idx) => {
                    const confirmKey = `delivery-${idx}`;
                    const isConfirming = deleteConfirm[confirmKey];
                    const errBranch = errors[`delivery-${idx}-branchName`];
                    const errAddr = errors[`delivery-${idx}-deliveryAddress`];
                    const errPerson = errors[`delivery-${idx}-contactPerson`];
                    const errNum = errors[`delivery-${idx}-contactNumber`];

                    return (
                      <tr key={idx} className="border-b border-slate-200 last:border-0 font-normal text-black align-top">
                        <td className="p-2 border-r border-slate-200 text-center font-medium pt-3">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200">
                          <input type="text" placeholder="Enter Name" value={row.branchName} onChange={(e) => handleDeliveryChange(idx, "branchName", e.target.value)} className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errBranch ? "border-red-500 bg-red-50/20" : "border-slate-200"}`} />
                          {errBranch && <p className="text-red-500 text-[10px] mt-0.5">{errBranch}</p>}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input type="text" placeholder="Enter Address" value={row.deliveryAddress} onChange={(e) => handleDeliveryChange(idx, "deliveryAddress", e.target.value)} className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errAddr ? "border-red-500 bg-red-50/20" : "border-slate-200"}`} />
                          {errAddr && <p className="text-red-500 text-[10px] mt-0.5">{errAddr}</p>}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input type="text" placeholder="Enter Contact Person" value={row.contactPerson} onChange={(e) => handleDeliveryChange(idx, "contactPerson", e.target.value)} className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errPerson ? "border-red-500 bg-red-50/20" : "border-slate-200"}`} />
                          {errPerson && <p className="text-red-500 text-[10px] mt-0.5">{errPerson}</p>}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input type="text" placeholder="Enter contact number" value={row.contactNumber} onChange={(e) => handleDeliveryChange(idx, "contactNumber", e.target.value)} className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none placeholder:text-slate-400 ${errNum ? "border-red-500 bg-red-50/20" : "border-slate-200"}`} />
                          {errNum && <p className="text-red-500 text-[10px] mt-0.5">{errNum}</p>}
                        </td>
                        <td className="p-2 text-center align-middle">
                          {isConfirming ? (
                            <div className="flex flex-col items-center gap-1 p-1.5 rounded-lg border shadow-sm" style={{ backgroundColor: "oklch(63.7% 0.237 25.331 / 0.1)", borderColor: "oklch(63.7% 0.237 25.331 / 0.4)", }}>
                              <span className="text-[10px] font-semibold leading-tight" style={{ color: "oklch(50% 0.237 25.331)" }}>Are you sure you want to delete?</span>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => removeDeliveryRow(idx)} style={{ backgroundColor: "oklch(63.7% 0.237 25.331)", }} className="px-2 py-0.5 text-white rounded text-[10px] font-bold hover:opacity-90 transition-colors">Yes</button>
                                <button type="button" onClick={() => setDeleteConfirm((prev) => ({ ...prev, [confirmKey]: false, }))} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 transition-colors">No</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setDeleteConfirm((prev) => ({ ...prev, [confirmKey]: true, }))} disabled={deliveryList.length === 1} className={`p-1.5 rounded-md transition-colors ${deliveryList.length === 1 ? "text-slate-300 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-700"}`} style={{ color: deliveryList.length === 1 ? undefined : "oklch(63.7% 0.237 25.331)", }}>
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

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleCloseModal} style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }} className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95">Cancel</button>
            <button type="submit" style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }} className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95">{editData ? "Save Changes" : "Add Client"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. PARTNER MODAL
// ==========================================

interface PartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: PartnerRecord) => void;
  editData?: PartnerRecord | null;
}

export function PartnerModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  editData,
}: PartnerModalProps) {
  const initialPartnerState = {
    name: "",
    contractType: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
  };

  const [formData, setFormData] = useState(initialPartnerState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isContractDropdownOpen, setIsContractDropdownOpen] = useState(false);

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name || "",
        contractType: editData.contractType || "",
        contactPerson: editData.contactPerson || "",
        contactNumber: editData.contactNumber || "",
        emailAddress: editData.emailAddress || "",
        businessAddress: editData.businessAddress || "",
      });
    } else {
      setFormData(initialPartnerState);
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialPartnerState);
    setErrors({});
    setIsContractDropdownOpen(false);
    onClose();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Owner Name/Company name is required.";
    if (!formData.contractType.trim()) newErrors.contractType = "Type of contract is required.";
    if (!formData.contactPerson.trim()) newErrors.contactPerson = "Contact person is required.";
    if (!formData.contactNumber.trim()) newErrors.contactNumber = "Contact number is required.";
    if (!formData.emailAddress.trim()) newErrors.emailAddress = "Email address is required.";
    if (!formData.businessAddress.trim()) newErrors.businessAddress = "Business address is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: PartnerRecord = {
      id: editData ? editData.id : Date.now(),
      name: formData.name,
      status: editData ? editData.status : "Active",
      contractType: formData.contractType,
      contactPerson: formData.contactPerson,
      contactNumber: formData.contactNumber,
      emailAddress: formData.emailAddress,
      businessAddress: formData.businessAddress,
    };

    onSubmitSuccess(newRecord);
    setFormData(initialPartnerState);
    setErrors({});
    setIsContractDropdownOpen(false);
    onClose();
  };

  const CONTRACT_TYPES = ["Regular", "On-Call", "Seasonal"];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {editData ? "Edit Partner" : "Add New Partner"}
          </h2>
          <button onClick={handleCloseModal} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              Partner & Contract Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">Owner/Company Name</label>
                <input type="text" name="name" placeholder="Enter company or owner name" value={formData.name} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.name ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.name && <p className="text-red-500 text-[11px] mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Type of Contract</label>
                <div className={`relative w-full ${isContractDropdownOpen ? "z-70" : "z-10"}`} onClick={(e) => e.stopPropagation()}>
                  {isContractDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setIsContractDropdownOpen(false)} />}
                  <button type="button" onClick={() => setIsContractDropdownOpen(!isContractDropdownOpen)} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-600 relative z-50 transition-all ${errors.contractType ? "border-red-500 bg-red-50/20 text-black" : "border-slate-300 text-black"}`}>
                    <span className={formData.contractType ? "text-black" : "text-slate-400"}>{formData.contractType || "Select type of contract"}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isContractDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isContractDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-60 py-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 text-left">
                      {CONTRACT_TYPES.map((opt) => (
                        <button key={opt} type="button" onClick={() => { handleInputChange({ target: { name: "contractType", value: opt } }); setIsContractDropdownOpen(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${formData.contractType === opt ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-700"}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.contractType && <p className="text-red-500 text-[11px] mt-1">{errors.contractType}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Contact Person</label>
                <input type="text" name="contactPerson" placeholder="Enter contact person" value={formData.contactPerson} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactPerson ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.contactPerson && <p className="text-red-500 text-[11px] mt-1">{errors.contactPerson}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">Contact Number</label>
                <input type="text" name="contactNumber" placeholder="Enter contact number" value={formData.contactNumber} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.contactNumber && <p className="text-red-500 text-[11px] mt-1">{errors.contactNumber}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">Email Address</label>
                <input type="email" name="emailAddress" placeholder="Enter email address" value={formData.emailAddress} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.emailAddress && <p className="text-red-500 text-[11px] mt-1">{errors.emailAddress}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">Business Address</label>
                <input type="text" name="businessAddress" placeholder="Enter business address" value={formData.businessAddress} onChange={handleInputChange} className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.businessAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`} />
                {errors.businessAddress && <p className="text-red-500 text-[11px] mt-1">{errors.businessAddress}</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button type="button" onClick={handleCloseModal} style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }} className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95">Cancel</button>
            <button type="submit" style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }} className="w-full sm:w-40 py-2.5 sm:py-2.5 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95">{editData ? "Save Changes" : "Add partner"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// RECORD DETAIL VIEW COMPONENT
// ==========================================

interface RecordDetailViewProps {
  record: UnifiedRecord;
  tabType: TabType;
  onBack: () => void;
  onEdit: (record: UnifiedRecord) => void;
  onDelete: (id: string | number) => void;
}

function RecordDetailView({
  record,
  tabType,
  onBack,
  onEdit,
  onDelete,
}: RecordDetailViewProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isClient = (rec: UnifiedRecord): rec is ClientRecord =>
    tabType === "Clients";
  const isPartner = (rec: UnifiedRecord): rec is PartnerRecord =>
    tabType === "Partners";

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs" title={`Back to ${tabType}`}><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{tabType.slice(0, -1)} Information Record</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">Complete profile retrieved directly from database.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => onEdit(record)} className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors"><Edit3 className="w-4 h-4" /><span>Edit Record</span></button>
          <button onClick={() => setShowDeleteModal(true)} className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors"><Trash2 className="w-4 h-4" /><span>Delete</span></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold border border-blue-100">{record.name ? record.name[0].toUpperCase() : "R"}</div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">{record.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{tabType}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{record.status || "Active"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-900">
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">1. General Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-black mb-1">Name / Company</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">{record.name || "N/A"}</div></div>
              <div><label className="block text-xs font-medium text-black mb-1">Contact Person</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">{record.contactPerson || "N/A"}</div></div>
              <div><label className="block text-xs font-medium text-black mb-1">Contact Number</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">{record.contactNumber || "N/A"}</div></div>
              <div className="sm:col-span-2"><label className="block text-xs font-medium text-black mb-1">Email Address</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">{record.emailAddress || "N/A"}</div></div>
              {isPartner(record) && (<div><label className="block text-xs font-medium text-black mb-1">Contract Type</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">{record.contractType || "N/A"}</div></div>)}
              <div className="sm:col-span-3"><label className="block text-xs font-medium text-black mb-1">Address</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-12 wrap-break-word">{isPartner(record) || isClient(record) ? record.businessAddress : "N/A"}</div></div>
            </div>
          </div>

          {isClient(record) && (
            <>
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">2. Pickup Addresses</div>
                {record.pickupAddresses && record.pickupAddresses.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs table-fixed">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                          <th className="p-2.5 border-r border-slate-200 w-[25%]">Warehouse Name</th>
                          <th className="p-2.5 border-r border-slate-200 w-[35%]">Address</th>
                          <th className="p-2.5 border-r border-slate-200 w-[20%]">Contact Person</th>
                          <th className="p-2.5 w-[20%]">Contact Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.pickupAddresses.map((p, idx) => (
                          <tr key={idx} className="border-b border-slate-200 last:border-0">
                            <td className="p-2.5 border-r border-slate-200 truncate">{p.warehouseName || "N/A"}</td>
                            <td className="p-2.5 border-r border-slate-200 truncate">{p.warehouseAddress || "N/A"}</td>
                            <td className="p-2.5 border-r border-slate-200 truncate">{p.contactPerson || "N/A"}</td>
                            <td className="p-2.5 truncate">{p.contactNumber || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (<div className="text-xs text-slate-500 py-2">No pickup addresses recorded.</div>)}
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">3. Delivery Addresses</div>
                {record.deliveryAddresses && record.deliveryAddresses.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs table-fixed">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                          <th className="p-2.5 border-r border-slate-200 w-[25%]">Branch Name</th>
                          <th className="p-2.5 border-r border-slate-200 w-[35%]">Address</th>
                          <th className="p-2.5 border-r border-slate-200 w-[20%]">Contact Person</th>
                          <th className="p-2.5 w-[20%]">Contact Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.deliveryAddresses.map((d, idx) => (
                          <tr key={idx} className="border-b border-slate-200 last:border-0">
                            <td className="p-2.5 border-r border-slate-200 truncate">{d.branchName || "N/A"}</td>
                            <td className="p-2.5 border-r border-slate-200 truncate">{d.deliveryAddress || "N/A"}</td>
                            <td className="p-2.5 border-r border-slate-200 truncate">{d.contactPerson || "N/A"}</td>
                            <td className="p-2.5 truncate">{d.contactNumber || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (<div className="text-xs text-slate-500 py-2">No delivery addresses recorded.</div>)}
              </div>
            </>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6" /></div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Record</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">Are you sure you want to delete <strong className="text-slate-900">{record.name}</strong>? This will permanently remove the record from the database.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors">Cancel</button>
              <button onClick={() => { onDelete(record.id); setShowDeleteModal(false); }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-md">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function ClientsTable({ activeTab, currentData, onRowClick }: { activeTab: TabType; currentData: UnifiedRecord[]; onRowClick: (record: UnifiedRecord) => void; }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { setCurrentPage(1); }, [currentData, activeTab]);

  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = currentData.slice(startIndex, endIndex);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-200 table-fixed">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <th className="py-3.5 px-4 sm:px-6 w-[30%]">Name</th>
              <th className="py-3.5 px-4 sm:px-6 w-[15%]">Status</th>
              <th className="py-3.5 px-4 sm:px-6 w-[25%]">Contact Person</th>
              <th className="py-3.5 px-4 sm:px-6 w-[30%]">Contact Number</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr key={item.id} onClick={() => onRowClick(item)} className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-sm text-slate-800" title="Click to view complete record">
                  <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900 truncate">{item.name}</td>
                  <td className="py-3.5 px-4 sm:px-6 truncate"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">{item.status}</span></td>
                  <td className="py-3.5 px-4 sm:px-6 truncate">{item.contactPerson}</td>
                  <td className="py-3.5 px-4 sm:px-6 truncate">{item.contactNumber}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-12 sm:py-16 text-center">
                  <div className="flex flex-col items-center justify-center px-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3"><FileText className="w-6 h-6" /></div>
                    <p className="text-slate-900 font-medium text-sm">No {activeTab.toLowerCase()} available</p>
                    <p className="text-slate-600 font-normal text-xs mt-1 max-w-sm">Data for {activeTab} will appear here once you add new records.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-normal text-slate-700 bg-white">
        <span>Showing {currentData.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, currentData.length)} of {currentData.length} entries</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Previous</button>
          <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Next</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN CLIENTS PAGE COMPONENT
// ==========================================

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("Clients");
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UnifiedRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<UnifiedRecord | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [dataMap, setDataMap] = useState<Record<TabType, UnifiedRecord[]>>({
    Clients: [],
    Partners: [],
  });

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const fetchClientsAndPartners = useCallback(async () => {
    try {
      const clientRes = await apiFetch<ClientsResponse>("/api/clients");
      const mappedClients: ClientRecord[] = clientRes.data
        .filter((c: any) => c.contractType !== "On-Call")
        .map((c: any) => ({
          id: c.clientID,
          name: c.company,
          status: c.status,
          contactPerson: c.contactName,
          contactNumber: c.contact,
          emailAddress: c.emailAdd,
          businessAddress: c.businessAdd,
          pickupAddresses: (c.Warehouse || c.warehouse || c.warehouses || []).map((w: any) => ({
            warehouseName: w.whName || "",
            warehouseAddress: w.warehouseLoc || "",
            contactPerson: w.contactPerson || "",
            contactNumber: w.contactNum || w.contactNumber || "",
          })),
          deliveryAddresses: (c.Branch || c.branch || c.branches || []).map((b: any) => ({
            branchName: b.branchName || "",
            deliveryAddress: b.deliveryAddress || "",
            contactPerson: b.contactPerson || "",
            contactNumber: b.contactNumber || b.contactNum || "",
          })),
        }));

      // SECURE FIX: Now pulls securely from our new Next.js Subcontractors route!
      const partnerRes = await apiFetch<PartnersResponse>("/api/subcontractors");
      const mappedPartners: PartnerRecord[] = partnerRes.data.map((p: any) => ({
        id: p.subConID || p.id,
        name: p.companyName,
        status: p.isActive !== false ? "Active" : "Inactive",
        contractType: p.contractType || "On-Call",
        contactPerson: p.contactName || p.contactPerson,
        contactNumber: p.contactNumber,
        emailAddress: p.emailAddress || "",
        businessAddress: p.businessAddress || "",
      }));

      setDataMap({
        Clients: mappedClients,
        Partners: mappedPartners,
      });
    } catch (error) {
      console.error("Failed to fetch data from Database:", error);
      setToastMessage("Failed to load records");
    }
  }, []);

  useEffect(() => {
    fetchClientsAndPartners();
  }, [fetchClientsAndPartners]);

  const currentData = dataMap[activeTab].filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const checkNoChanges = (original: any, updated: any) => {
    return JSON.stringify(original) === JSON.stringify(updated);
  };

  const handleClientSubmit = async (newRecord: ClientRecord) => {
    try {
      if (editingRecord) {
        if (checkNoChanges(editingRecord, newRecord)) {
          setToastMessage("No changes were made.");
          setEditingRecord(null);
          return;
        }

        const payload = {
          name: newRecord.name,
          contactName: newRecord.contactPerson,
          contactNumber: newRecord.contactNumber,
          emailAddress: newRecord.emailAddress,
          businessAddress: newRecord.businessAddress,
        };

        await apiFetch(`/api/clients/${newRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        setToastMessage("Changes saved successfully.");
      } else {
        const payload = {
          name: newRecord.name,
          contactName: newRecord.contactPerson,
          contactNumber: newRecord.contactNumber,
          emailAddress: newRecord.emailAddress,
          businessAddress: newRecord.businessAddress,
          pickupAddresses: newRecord.pickupAddresses,
          deliveryAddresses: newRecord.deliveryAddresses,
        };

        await apiFetch(`/api/clients`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setToastMessage("Added successfully.");
      }
      
      setEditingRecord(null);
      await fetchClientsAndPartners();
      if (editingRecord) setSelectedRecord(newRecord);
    } catch (error: any) {
      console.error("Failed to save client to Database:", error);
      setToastMessage(error.message || "Error saving record.");
    }
  };

  const handlePartnerSubmit = async (newRecord: PartnerRecord) => {
    try {
      // Structure explicitly formatted to match what POST /api/subcontractors expects
      const payload = {
        companyName: newRecord.name,
        contractType: newRecord.contractType,
        contactPerson: newRecord.contactPerson,
        contactNumber: newRecord.contactNumber,
        emailAddress: newRecord.emailAddress,
        businessAddress: newRecord.businessAddress,
      };

      if (editingRecord) {
        if (checkNoChanges(editingRecord, newRecord)) {
          setToastMessage("No changes were made.");
          setEditingRecord(null);
          return;
        }

        await apiFetch(`/api/subcontractors/${newRecord.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setToastMessage("Changes saved successfully.");
      } else {
        await apiFetch(`/api/subcontractors`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setToastMessage("Added successfully.");
      }
      
      setEditingRecord(null);
      await fetchClientsAndPartners();
      if (editingRecord) setSelectedRecord(newRecord);
    } catch (error: any) {
      console.error("Failed to save partner to Database:", error);
      setToastMessage(error.message || "Error saving record.");
    }
  };

  const handleDeleteRecord = async (id: string | number) => {
    try {
      const endpoint = activeTab === "Partners" ? "subcontractors" : "clients";
      await apiFetch(`/api/${endpoint}/${id}`, { method: "DELETE" });

      setSelectedRecord(null);
      setToastMessage("Deleted successfully.");
      await fetchClientsAndPartners();
    } catch (error: any) {
      console.error(`Failed to delete ${activeTab} from Database:`, error);
      setToastMessage(error.message || "Error deleting record.");
    }
  };

  if (selectedRecord) {
    return (
      <>
        <RecordDetailView
          record={selectedRecord}
          tabType={activeTab}
          onBack={() => setSelectedRecord(null)}
          onEdit={(rec) => {
            setEditingRecord(rec);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteRecord}
        />

        {activeTab === "Clients" && (
          <ClientModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingRecord(null);
            }}
            onSubmitSuccess={handleClientSubmit}
            editData={editingRecord as ClientRecord}
          />
        )}
        {activeTab === "Partners" && (
          <PartnerModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingRecord(null);
            }}
            onSubmitSuccess={handlePartnerSubmit}
            editData={editingRecord as PartnerRecord}
          />
        )}

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-100 animate-in fade-in slide-in-from-bottom-5">
            <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-slate-700">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  toastMessage.toLowerCase().includes("error") || toastMessage.toLowerCase().includes("fail")
                    ? "bg-red-500"
                    : toastMessage === "No changes were made."
                      ? "bg-blue-500"
                      : "bg-emerald-500"
                }`}
              >
                {toastMessage === "No changes were made." ? (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {toastMessage}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Clients & Partners
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Manage your client directories and partner relationships.
          </p>
        </div>

        <div className="flex justify-center sm:justify-start w-full sm:w-auto">
          {activeTab === "Clients" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Add Client</span>
            </button>
          )}
          {activeTab === "Partners" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Add Partner</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="border-b border-slate-100 px-4 sm:px-6 pt-4 flex gap-6 sm:gap-8 overflow-x-auto">
          {(["Clients", "Partners"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchTerm("");
                }}
                style={isActive ? { color: "oklch(54.6% 0.245 262.881)" } : undefined}
                className={`pb-4 text-sm sm:text-base transition-all relative whitespace-nowrap ${
                  isActive ? "font-semibold" : "text-slate-600 hover:text-slate-900 font-normal"
                }`}
              >
                {tab}
                {isActive && (
                  <div style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }} className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm font-normal text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <ClientsTable activeTab={activeTab} currentData={currentData} onRowClick={(record) => setSelectedRecord(record)} />
      </div>

      {activeTab === "Clients" && (
        <ClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmitSuccess={handleClientSubmit} />
      )}
      {activeTab === "Partners" && (
        <PartnerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmitSuccess={handlePartnerSubmit} />
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-100 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-slate-700">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                toastMessage.toLowerCase().includes("error") || toastMessage.toLowerCase().includes("fail")
                  ? "bg-red-500"
                  : toastMessage === "No changes were made." ? "bg-blue-500" : "bg-emerald-500"
              }`}
            >
              {toastMessage === "No changes were made." ? (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}