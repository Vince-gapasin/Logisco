/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { normalizePhone, PHONE_RULE } from "@/app/lib/bookingRules";
import { X, Plus, Trash2 } from "lucide-react";
import type { ClientRecord, DeliveryAddress, PickupAddress } from "./types";

// ==========================================
// SESSION & API FETCH
// ==========================================

// ==========================================
// 1. CLIENT MODAL
// ==========================================

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saves it. Resolves false when the save was refused, so the form stays open. */
  onSubmitSuccess: (record: ClientRecord) => Promise<boolean>;
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
    {},
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
          ? editData.pickupAddresses.map((row) => ({ ...row }))
          : [
              {
                warehouseName: "",
                warehouseAddress: "",
                contactPerson: "",
                contactNumber: "",
              },
            ],
      );
      setDeliveryList(
        editData.deliveryAddresses && editData.deliveryAddresses.length > 0
          ? editData.deliveryAddresses.map((row) => ({ ...row }))
          : [
              {
                branchName: "",
                deliveryAddress: "",
                contactPerson: "",
                contactNumber: "",
              },
            ],
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePickupChange = (
    index: number,
    field: keyof PickupAddress,
    value: string,
  ) => {
    setPickupList((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    if (errors[`pickup-${index}-${field}`])
      setErrors((prev) => ({ ...prev, [`pickup-${index}-${field}`]: "" }));
  };

  const handleDeliveryChange = (
    index: number,
    field: keyof DeliveryAddress,
    value: string,
  ) => {
    setDeliveryList((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    if (errors[`delivery-${index}-${field}`])
      setErrors((prev) => ({ ...prev, [`delivery-${index}-${field}`]: "" }));
  };

  const addPickupRow = () =>
    setPickupList([
      ...pickupList,
      {
        warehouseName: "",
        warehouseAddress: "",
        contactPerson: "",
        contactNumber: "",
      },
    ]);
  const removePickupRow = (index: number) => {
    if (pickupList.length === 1) return;
    setPickupList(pickupList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`pickup-${index}`]: false }));
  };

  const addDeliveryRow = () =>
    setDeliveryList([
      ...deliveryList,
      {
        branchName: "",
        deliveryAddress: "",
        contactPerson: "",
        contactNumber: "",
      },
    ]);
  const removeDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryList(deliveryList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`delivery-${index}`]: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Client name is required.";
    if (!formData.contactName.trim())
      newErrors.contactName = "Contact name is required.";
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = "Contact number is required.";
    else if (!normalizePhone(formData.contactNumber))
      newErrors.contactNumber = PHONE_RULE;
    if (!formData.emailAddress.trim())
      newErrors.emailAddress = "Email address is required.";
    if (!formData.businessAddress.trim())
      newErrors.businessAddress = "Business address is required.";

    pickupList.forEach((p, idx) => {
      if (p.warehouseName || p.warehouseAddress) {
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
        else if (!normalizePhone(p.contactNumber))
          newErrors[`pickup-${idx}-contactNumber`] = PHONE_RULE;
      }
    });

    deliveryList.forEach((d, idx) => {
      if (d.branchName || d.deliveryAddress) {
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
        else if (!normalizePhone(d.contactNumber))
          newErrors[`delivery-${idx}-contactNumber`] = PHONE_RULE;
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
      contactNumber: normalizePhone(formData.contactNumber) ?? formData.contactNumber,
      emailAddress: formData.emailAddress,
      businessAddress: formData.businessAddress,
      pickupAddresses: pickupList
        .filter((p) => p.warehouseName.trim() !== "")
        .map((p) => ({ ...p, contactNumber: normalizePhone(p.contactNumber) ?? p.contactNumber })),
      deliveryAddresses: deliveryList
        .filter((d) => d.branchName.trim() !== "")
        .map((d) => ({ ...d, contactNumber: normalizePhone(d.contactNumber) ?? d.contactNumber })),
    };

    // Closed once it has saved. It used to close first, so a save the server
    // refused took everything that had been typed with it.
    if (await onSubmitSuccess(newRecord)) handleCloseModal();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {editData ? "Edit Client Form" : "New Client Form"}
          </h2>
          <button
            onClick={handleCloseModal}
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 max-h-[80dvh] overflow-y-auto text-sm text-slate-900"
        >
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Client & Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Company / Client Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter client name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.name ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contactName"
                  placeholder="Enter contact name"
                  value={formData.contactName}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactName && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.emailAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.emailAddress && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
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
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.businessAddress ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.businessAddress && (
                  <p className="text-red-500 text-xs sm:text-[11px] mt-1">
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
                    <th className="p-2.5 border-r border-slate-200 text-center">
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
                            <p className="text-red-500 text-xs sm:text-[10px] mt-0.5">
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
                            <p className="text-red-500 text-xs sm:text-[10px] mt-0.5">
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
                            <p className="text-red-500 text-xs sm:text-[10px] mt-0.5">
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 text-center focus:ring-0 focus:outline-none placeholder:text-slate-500 ${errNum ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errNum && (
                            <p className="text-red-500 text-xs sm:text-[10px] mt-0.5 text-center">
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
                                className="text-xs sm:text-[10px] font-semibold leading-tight"
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
                                  className="px-2 py-0.5 text-white rounded text-xs sm:text-[10px] font-bold hover:opacity-90 transition-colors"
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
                                  className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs sm:text-[10px] font-bold hover:bg-slate-300 transition-colors"
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
                              className={`min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1.5 rounded-md transition-colors ${pickupList.length === 1 ? "text-slate-300 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-700"}`}
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
                    <th className="p-2.5 border-r border-slate-200 text-center">
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
                            <p className="text-red-500 text-xs sm:text-[10px] mt-0.5">
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
                            <p className="text-red-500 text-xs sm:text-[10px] mt-0.5">
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
                            <p className="text-red-500 text-xs sm:text-[10px] mt-0.5">
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 text-center focus:ring-0 focus:outline-none placeholder:text-slate-500 ${errNum ? "border-red-500 bg-red-50/20" : "border-slate-200"}`}
                          />
                          {errNum && (
                            <p className="text-red-500 text-xs sm:text-[10px] mt-0.5 text-center">
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
                                className="text-xs sm:text-[10px] font-semibold leading-tight"
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
                                  className="px-2 py-0.5 text-white rounded text-xs sm:text-[10px] font-bold hover:opacity-90 transition-colors"
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
                                  className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs sm:text-[10px] font-bold hover:bg-slate-300 transition-colors"
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
                              className={`min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1.5 rounded-md transition-colors ${deliveryList.length === 1 ? "text-slate-300 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-700"}`}
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

          <div className="flex flex-row items-center justify-end sm:justify-center gap-2 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCloseModal}
              style={{ backgroundColor: "oklch(63.7% 0.237 25.331)" }}
              className="w-auto sm:w-40 py-2 sm:py-2.5 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 px-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
              className="w-auto sm:w-40 py-2 sm:py-2.5 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center hover:opacity-95 px-3"
            >
              {editData ? "Save Changes" : "Add Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
