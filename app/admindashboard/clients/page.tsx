// ==========================================
// CLIENTS & PARTNERS MANAGEMENT PAGE
// ==========================================
"use client";

import React, { useState } from "react";
import { UserPlus, Search, FileText, X, Plus, Trash2 } from "lucide-react";

type TabType = "Clients" | "Partners" | "On-Call";

// ==========================================
// TYPESCRIPT INTERFACES
// ==========================================

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

export interface OnCallRecord {
  id: string | number;
  name: string;
  status: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  address: string;
}

export type UnifiedRecord = ClientRecord | PartnerRecord | OnCallRecord;

// ==========================================
// 1. CLIENT MODAL
// ==========================================

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: ClientRecord) => void;
}

export function ClientModal({
  isOpen,
  onClose,
  onSubmitSuccess,
}: ClientModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
  });

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
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handlePickupChange = (
    index: number,
    field: keyof PickupAddress,
    value: string,
  ) => {
    const updated = [...pickupList];
    updated[index][field] = value;
    setPickupList(updated);
    const errKey = `pickup-${index}-${field}`;
    if (errors[errKey]) {
      setErrors((prev) => ({ ...prev, [errKey]: "" }));
    }
  };

  const handleDeliveryChange = (
    index: number,
    field: keyof DeliveryAddress,
    value: string,
  ) => {
    const updated = [...deliveryList];
    updated[index][field] = value;
    setDeliveryList(updated);
    const errKey = `delivery-${index}-${field}`;
    if (errors[errKey]) {
      setErrors((prev) => ({ ...prev, [errKey]: "" }));
    }
  };

  const addPickupRow = () => {
    setPickupList([
      ...pickupList,
      {
        warehouseName: "",
        warehouseAddress: "",
        contactPerson: "",
        contactNumber: "",
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
      },
    ]);
  };

  const removeDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryList(deliveryList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`delivery-${index}`]: false }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Client name is required.";
    if (!formData.contactName.trim())
      newErrors.contactName = "Contact name is required.";
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = "Contact number is required.";
    if (!formData.emailAddress.trim())
      newErrors.emailAddress = "Email address is required.";
    if (!formData.businessAddress.trim())
      newErrors.businessAddress = "Business address is required.";

    pickupList.forEach((p, idx) => {
      if (!p.warehouseName.trim())
        newErrors[`pickup-${idx}-warehouseName`] =
          "Warehouse name is required.";
      if (!p.warehouseAddress.trim())
        newErrors[`pickup-${idx}-warehouseAddress`] =
          "Warehouse address is required.";
      if (!p.contactPerson.trim())
        newErrors[`pickup-${idx}-contactPerson`] =
          "Contact person is required.";
      if (!p.contactNumber.trim())
        newErrors[`pickup-${idx}-contactNumber`] =
          "Contact number is required.";
    });

    deliveryList.forEach((d, idx) => {
      if (!d.branchName.trim())
        newErrors[`delivery-${idx}-branchName`] = "Branch name is required.";
      if (!d.deliveryAddress.trim())
        newErrors[`delivery-${idx}-deliveryAddress`] =
          "Delivery address is required.";
      if (!d.contactPerson.trim())
        newErrors[`delivery-${idx}-contactPerson`] =
          "Contact person is required.";
      if (!d.contactNumber.trim())
        newErrors[`delivery-${idx}-contactNumber`] =
          "Contact number is required.";
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: ClientRecord = {
      id: Date.now(),
      name: formData.name,
      status: "Active",
      contactPerson: formData.contactName,
      contactNumber: formData.contactNumber,
      emailAddress: formData.emailAddress,
      businessAddress: formData.businessAddress,
      pickupAddresses: pickupList,
      deliveryAddresses: deliveryList,
    };

    onSubmitSuccess(newRecord);
    setFormData({
      name: "",
      contactName: "",
      contactNumber: "",
      emailAddress: "",
      businessAddress: "",
    });
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
    setDeleteConfirm({});
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            New Client Form
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900"
        >
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Client & Delivery Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter client name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.name ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.name && (
                  <p className="text-red-500 text-[11px] mt-1">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  name="contactName"
                  placeholder="Enter contact name"
                  value={formData.contactName}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactName && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.contactName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  placeholder="Enter contact number"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
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
                  Email Address
                </label>
                <input
                  type="email"
                  name="emailAddress"
                  placeholder="Enter email address"
                  value={formData.emailAddress}
                  onChange={handleInputChange}
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
                  Business Address
                </label>
                <input
                  type="text"
                  name="businessAddress"
                  placeholder="Enter business address"
                  value={formData.businessAddress}
                  onChange={handleInputChange}
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

          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                2. Pickup Addresses:
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
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200">
                      Warehouse Name
                    </th>
                    <th className="p-2.5 border-r border-slate-200">
                      Warehouse Address
                    </th>
                    <th className="p-2.5 border-r border-slate-200">
                      Contact Person
                    </th>
                    <th className="p-2.5 border-r border-slate-200">
                      Contact Number
                    </th>
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errName ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errName && (
                            <p className="text-red-500 text-[10px] mt-0.5">
                              {errName}
                            </p>
                          )}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errAddr ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errAddr && (
                            <p className="text-red-500 text-[10px] mt-0.5">
                              {errAddr}
                            </p>
                          )}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errPerson ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errPerson && (
                            <p className="text-red-500 text-[10px] mt-0.5">
                              {errPerson}
                            </p>
                          )}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none placeholder:text-slate-400 ${errNum ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errNum && (
                            <p className="text-red-500 text-[10px] mt-0.5">
                              {errNum}
                            </p>
                          )}
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
                                Are you sure you want to delete?
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => removePickupRow(idx)}
                                  style={{
                                    backgroundColor:
                                      "oklch(63.7% 0.237 25.331)",
                                  }}
                                  className="px-2 py-0.5 text-white rounded text-[10px] font-bold hover:opacity-90 transition-colors"
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
                                  className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 transition-colors"
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
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                    <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                    <th className="p-2.5 border-r border-slate-200">
                      Branch Name
                    </th>
                    <th className="p-2.5 border-r border-slate-200">
                      Delivery Address
                    </th>
                    <th className="p-2.5 border-r border-slate-200">
                      Contact Person
                    </th>
                    <th className="p-2.5 border-r border-slate-200">
                      Contact Number
                    </th>
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errBranch ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errBranch && (
                            <p className="text-red-500 text-[10px] mt-0.5">
                              {errBranch}
                            </p>
                          )}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errAddr ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errAddr && (
                            <p className="text-red-500 text-[10px] mt-0.5">
                              {errAddr}
                            </p>
                          )}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none ${errPerson ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errPerson && (
                            <p className="text-red-500 text-[10px] mt-0.5">
                              {errPerson}
                            </p>
                          )}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 focus:ring-0 focus:outline-none placeholder:text-slate-400 ${errNum ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errNum && (
                            <p className="text-red-500 text-[10px] mt-0.5">
                              {errNum}
                            </p>
                          )}
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
                                Are you sure you want to delete?
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => removeDeliveryRow(idx)}
                                  style={{
                                    backgroundColor:
                                      "oklch(63.7% 0.237 25.331)",
                                  }}
                                  className="px-2 py-0.5 text-white rounded text-[10px] font-bold hover:opacity-90 transition-colors"
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
                                  className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300 transition-colors"
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

          <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-32 py-2 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-32 py-2 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Add Client
            </button>
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
}

export function PartnerModal({
  isOpen,
  onClose,
  onSubmitSuccess,
}: PartnerModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    contractType: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim())
      newErrors.name = "Owner/Company name is required.";
    if (!formData.contractType.trim())
      newErrors.contractType = "Type of contract is required.";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required.";
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = "Contact number is required.";
    if (!formData.emailAddress.trim())
      newErrors.emailAddress = "Email address is required.";
    if (!formData.businessAddress.trim())
      newErrors.businessAddress = "Business address is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: PartnerRecord = {
      id: Date.now(),
      name: formData.name,
      status: "Active",
      contractType: formData.contractType,
      contactPerson: formData.contactPerson,
      contactNumber: formData.contactNumber,
      emailAddress: formData.emailAddress,
      businessAddress: formData.businessAddress,
    };

    onSubmitSuccess(newRecord);
    setFormData({
      name: "",
      contractType: "",
      contactPerson: "",
      contactNumber: "",
      emailAddress: "",
      businessAddress: "",
    });
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            Add new Partners
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 text-sm text-slate-900"
        >
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              Partner & Contract Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Owner/Company Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter company or owner name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.name ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.name && (
                  <p className="text-red-500 text-[11px] mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Contract
                </label>
                <select
                  name="contractType"
                  value={formData.contractType}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contractType ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>
                    Select type of contract
                  </option>
                  <option value="Long-Term Contract">Long-Term Contract</option>
                  <option value="Short-Term Contract">
                    Short-Term Contract
                  </option>
                  <option value="Per Delivery">Per Delivery</option>
                  <option value="On-Demand">On-Demand</option>
                  <option value="Subcontract">Subcontract</option>
                </select>
                {errors.contractType && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.contractType}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  placeholder="Enter contact person"
                  value={formData.contactPerson}
                  onChange={handleInputChange}
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
                  Contact Number
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  placeholder="Enter contact number"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.contactNumber}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="emailAddress"
                  placeholder="Enter email address"
                  value={formData.emailAddress}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emailAddress && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.emailAddress}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Business Address
                </label>
                <input
                  type="text"
                  name="businessAddress"
                  placeholder="Enter business address"
                  value={formData.businessAddress}
                  onChange={handleInputChange}
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

          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-32 py-2 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-32 py-2 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Add partners
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 3. ON-CALL MODAL
// ==========================================

interface OnCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: OnCallRecord) => void;
}

export function OnCallModal({
  isOpen,
  onClose,
  onSubmitSuccess,
}: OnCallModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    address: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim())
      newErrors.name = "Company/Owner name is required.";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required.";
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = "Contact number is required.";
    if (!formData.emailAddress.trim())
      newErrors.emailAddress = "Email address is required.";
    if (!formData.address.trim()) newErrors.address = "Address is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: OnCallRecord = {
      id: Date.now(),
      name: formData.name,
      status: "Active",
      contactPerson: formData.contactPerson,
      contactNumber: formData.contactNumber,
      emailAddress: formData.emailAddress,
      address: formData.address,
    };

    onSubmitSuccess(newRecord);
    setFormData({
      name: "",
      contactPerson: "",
      contactNumber: "",
      emailAddress: "",
      address: "",
    });
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            New On-Call Personnel Form
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 text-sm text-slate-900"
        >
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3">
            <div className="border-b border-slate-200 pb-2 mb-3 font-semibold text-black text-sm tracking-wide">
              Personnel Credentials
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Company/Owner Name
              </label>
              <input
                type="text"
                name="name"
                placeholder="Enter company or owner name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.name ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
              />
              {errors.name && (
                <p className="text-red-500 text-[11px] mt-1">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  placeholder="Enter contact person"
                  value={formData.contactPerson}
                  onChange={handleInputChange}
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
                  Contact Number
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  placeholder="Enter contact number"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.contactNumber}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="emailAddress"
                placeholder="Enter email address"
                value={formData.emailAddress}
                onChange={handleInputChange}
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
                Address
              </label>
              <input
                type="text"
                name="address"
                placeholder="Enter address"
                value={formData.address}
                onChange={handleInputChange}
                className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.address ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
              />
              {errors.address && (
                <p className="text-red-500 text-[11px] mt-1">
                  {errors.address}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-32 py-2 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-32 py-2 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Add Personnel
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

function ClientsTable({
  activeTab,
  currentData,
}: {
  activeTab: TabType;
  currentData: UnifiedRecord[];
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-162.5">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <th className="py-3.5 px-4 sm:px-6">Name</th>
              <th className="py-3.5 px-4 sm:px-6">Status</th>
              <th className="py-3.5 px-4 sm:px-6">Contact Person</th>
              <th className="py-3.5 px-4 sm:px-6">Contact Number</th>
            </tr>
          </thead>
          <tbody>
            {currentData.length > 0 ? (
              currentData.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 hover:bg-slate-50/50 text-sm font-normal text-slate-800"
                >
                  <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                    {item.name}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 font-normal">
                    {item.contactPerson}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 font-normal">
                    {item.contactNumber}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-12 sm:py-16 text-center">
                  <div className="flex flex-col items-center justify-center px-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-slate-900 font-medium text-sm">
                      No {activeTab.toLowerCase()} available
                    </p>
                    <p className="text-slate-600 font-normal text-xs mt-1 max-w-sm">
                      Data for {activeTab} will appear here once you connect
                      your backend database.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-normal text-slate-700 bg-white">
        <span>Showing {currentData.length} entries</span>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 font-medium cursor-not-allowed"
          >
            Previous
          </button>
          <button
            disabled
            className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 font-medium cursor-not-allowed"
          >
            Next
          </button>
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

  const [dataMap, setDataMap] = useState<Record<TabType, UnifiedRecord[]>>({
    Clients: [],
    Partners: [],
    "On-Call": [],
  });

  const currentData = dataMap[activeTab].filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleClientSubmit = (newRecord: ClientRecord) => {
    setDataMap((prev) => ({
      ...prev,
      Clients: [newRecord, ...prev.Clients],
    }));
  };

  const handlePartnerSubmit = (newRecord: PartnerRecord) => {
    setDataMap((prev) => ({
      ...prev,
      Partners: [newRecord, ...prev.Partners],
    }));
  };

  const handleOnCallSubmit = (newRecord: OnCallRecord) => {
    setDataMap((prev) => ({
      ...prev,
      "On-Call": [newRecord, ...prev["On-Call"]],
    }));
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Clients & Partners
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Manage your client directories, partner relationships, and on-call
            personnel.
          </p>
        </div>

        {/* Action Buttons with exact original styling and hover:bg-black */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
          {activeTab === "Clients" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Add Client</span>
            </button>
          )}

          {activeTab === "Partners" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>Add Partner</span>
            </button>
          )}

          {activeTab === "On-Call" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-colors duration-200 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>On-Call Booking</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="border-b border-slate-100 px-4 sm:px-6 pt-4 flex gap-6 sm:gap-8 overflow-x-auto">
          {(["Clients", "Partners", "On-Call"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchTerm("");
                }}
                style={
                  isActive ? { color: "oklch(54.6% 0.245 262.881)" } : undefined
                }
                className={`pb-4 text-sm sm:text-base transition-all relative whitespace-nowrap ${
                  isActive
                    ? "font-semibold"
                    : "text-slate-600 hover:text-slate-900 font-normal"
                }`}
              >
                {tab}
                {isActive && (
                  <div
                    style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  />
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

        <ClientsTable activeTab={activeTab} currentData={currentData} />
      </div>

      {activeTab === "Clients" && (
        <ClientModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmitSuccess={handleClientSubmit}
        />
      )}

      {activeTab === "Partners" && (
        <PartnerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmitSuccess={handlePartnerSubmit}
        />
      )}

      {activeTab === "On-Call" && (
        <OnCallModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmitSuccess={handleOnCallSubmit}
        />
      )}
    </div>
  );
}
