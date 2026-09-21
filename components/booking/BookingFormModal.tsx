"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import {
  addressKey,
  findAddressClashes,
  normalizePhone,
  parseQuantity,
  PHONE_RULE,
  sanitizePhoneInput,
  sanitizeQuantityInput,
} from "@/app/lib/bookingRules";
import SelectMenu from "@/components/SelectMenu";
import CrewPicker, { suggestCrew, type CrewChoice, type CrewPerson, type CrewTruck } from "@/components/booking/CrewPicker";
import RowDeleteButton from "@/components/booking/RowDeleteButton";

// One booking form for every way a booking starts: a registered client, an
// on-call (walk-in) customer, or a new client. The on-call and new-client
// forms were two copies of the same 1,000 lines, so every fix had to be made
// twice and they had drifted.

export type BookingFormVariant = "registered" | "on-call" | "new-client";

export interface PickupRow {
  warehouseID?: string | null;
  warehouseName: string;
  warehouseAddress: string;
  contactPerson: string;
  contactNumber: string;
  pickupTime: string;
  quantity: string;
}
export interface DeliveryRow {
  branchName: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
  deliveryTime: string;
  quantity: string;
}

export interface BookingFormResult {
  clientID: string;
  clientName: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  businessAddress: string;
  requestDate: string;
  deliverySchedule: string;
  product: string;
  priorityLevel: string;
  subconPartner: string;
  truckPlate: string;
  driver: string;
  helper1: string;
  helper2: string;
  notes: string;
  pickupList: PickupRow[];
  deliveryList: DeliveryRow[];
  /** No truck or no driver: the booking waits in Unassigned Bookings. */
  unassigned: boolean;
  resolvedNames: { truck: string; driver: string; helper1: string; helper2: string };
}

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: BookingFormVariant;
  clients?: any[];
  trucks: any[];
  drivers: any[];
  helpers: any[];
  subcontractors: any[];
  preSelectedClientID?: string;
  onSubmitSuccess: (data: BookingFormResult) => void;
}

const TITLES: Record<BookingFormVariant, string> = {
  registered: "Registered Client Booking",
  "on-call": "On-Call Booking Form",
  "new-client": "New Client Booking Form",
};
const BADGES: Record<BookingFormVariant, string | null> = {
  registered: null,
  "on-call": "Walk-in / On-Call",
  "new-client": "New Client",
};

const emptyPickup = (): PickupRow => ({
  warehouseName: "",
  warehouseAddress: "",
  contactPerson: "",
  contactNumber: "",
  pickupTime: "",
  quantity: "",
});
const emptyDelivery = (): DeliveryRow => ({
  branchName: "",
  deliveryAddress: "",
  contactPerson: "",
  contactNumber: "",
  deliveryTime: "",
  quantity: "",
});

const today = () => new Date().toISOString().split("T")[0];

function initialForm() {
  return {
    clientID: "",
    clientName: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
    requestDate: today(),
    deliverySchedule: "",
    product: "",
    priorityLevel: "",
    subconPartner: "",
    truckPlate: "",
    driver: "",
    helper1: "",
    helper2: "",
    notes: "",
  };
}

const toTruck = (t: any): CrewTruck => ({
  ...t,
  truckID: t.truckID || t.id,
  plateNumber: t.plateNumber || t.plate_number || "Unknown",
});
const toPerson = (p: any): CrewPerson => ({
  ...p,
  employeeID: p.employeeID || p.id,
  employeeName: p.employeeName || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown",
});

// Red border for a field with an error; the message is shown under it
// unless it is only "Required".
const cellClass = (hasError: boolean) =>
  `w-full bg-transparent border rounded px-1.5 py-1 ${hasError ? "border-red-500 bg-red-50" : "border-slate-200"}`;

function CellError({ message }: { message?: string }) {
  if (!message || message === "Required") return null;
  return <p className="mt-1 text-[11px] leading-tight text-red-600">{message}</p>;
}

// Mounted only while open, so every opening starts from a blank form.
export default function BookingFormModal(props: BookingFormModalProps) {
  if (!props.isOpen) return null;
  return <BookingForm {...props} />;
}

function BookingForm({
  onClose,
  variant,
  clients = [],
  trucks,
  drivers,
  helpers,
  subcontractors,
  preSelectedClientID,
  onSubmitSuccess,
}: BookingFormModalProps) {
  const currentDate = today();
  const registered = variant === "registered" && Boolean(preSelectedClientID);

  const clientRecord = registered ? clients.find((c) => c.clientID === preSelectedClientID) : null;

  const [formData, setFormData] = useState(() => ({
    ...initialForm(),
    ...(clientRecord
      ? {
          clientID: preSelectedClientID ?? "",
          clientName: clientRecord.company ?? "",
          contactPerson: clientRecord.contactName ?? "",
          contactNumber: clientRecord.contact ?? "",
          emailAddress: clientRecord.emailAdd || clientRecord.emailAddress || "",
          businessAddress: clientRecord.businessAdd || clientRecord.businessAddress || "",
        }
      : {}),
  }));
  const [isSubconMode, setIsSubconMode] = useState(false);
  // Who is free on the chosen date, once loaded; until then the lists the
  // dashboard already had.
  // Lists are absent when that load failed.
  const [freeCrew, setFreeCrew] = useState<{
    date: string;
    trucks?: CrewTruck[];
    drivers?: CrewPerson[];
    helpers?: CrewPerson[];
  } | null>(null);
  const [pickupList, setPickupList] = useState<PickupRow[]>([emptyPickup()]);
  const [deliveryList, setDeliveryList] = useState<DeliveryRow[]>([emptyDelivery()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmUnassigned, setConfirmUnassigned] = useState<BookingFormResult | null>(null);

  const availableTrucks = useMemo(() => freeCrew?.trucks ?? (trucks ?? []).map(toTruck), [freeCrew, trucks]);
  const availableDrivers = useMemo(() => freeCrew?.drivers ?? (drivers ?? []).map(toPerson), [freeCrew, drivers]);
  const availableHelpers = useMemo(() => freeCrew?.helpers ?? (helpers ?? []).map(toPerson), [freeCrew, helpers]);
  const loadingCrew = Boolean(formData.deliverySchedule) && freeCrew?.date !== formData.deliverySchedule;

  // Crew fields the coordinator has set by hand. A suggestion never
  // overrides those while they are still free.
  const touched = useRef<Partial<Record<keyof CrewChoice, boolean>>>({});
  const crewRef = useRef<CrewChoice>({ truckPlate: "", driver: "", helper1: "", helper2: "" });
  useEffect(() => {
    crewRef.current = {
      truckPlate: formData.truckPlate,
      driver: formData.driver,
      helper1: formData.helper1,
      helper2: formData.helper2,
    };
  }, [formData.truckPlate, formData.driver, formData.helper1, formData.helper2]);

  // Once a date is chosen: who is free, and a suggested crew. Choices made
  // by hand are kept while they are still free.
  useEffect(() => {
    const date = formData.deliverySchedule;
    if (!date) return;
    let live = true;
    apiFetch<any>(`/api/dispatch/available-resources?date=${date}`, { cache: "no-store" })
      .then((res) => {
        if (!live) return;
        const next = {
          date,
          trucks: (res?.data?.trucks || []).map(toTruck),
          drivers: (res?.data?.drivers || []).map(toPerson),
          helpers: (res?.data?.helpers || []).map(toPerson),
        };
        setFreeCrew(next);
        const picked = suggestCrew(crewRef.current, touched.current, next.trucks, next.drivers, next.helpers);
        setFormData((prev) => ({ ...prev, ...picked }));
      })
      .catch((error) => {
        console.error("Failed to load resources for this date:", error);
        if (!live) return;
        // Still suggest a crew, from the lists the dashboard already has.
        setFreeCrew({ date });
        const picked = suggestCrew(
          crewRef.current,
          touched.current,
          (trucks ?? []).map(toTruck),
          (drivers ?? []).map(toPerson),
          (helpers ?? []).map(toPerson),
        );
        setFormData((prev) => ({ ...prev, ...picked }));
      });
    return () => {
      live = false;
    };
    // The dashboard's lists are only a fallback; a change to them should not
    // reload who is free.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.deliverySchedule]);

  const registeredWarehouses: any[] = clientRecord?.Warehouse || clientRecord?.warehouses || [];
  const registeredBranches: any[] = clientRecord?.Branch || clientRecord?.branches || [];

  // Addresses already in use, so a dropdown can grey them out: a warehouse
  // picked on another pickup row, or one whose address is a delivery's.
  const usedAddresses = useMemo(
    () => ({
      pickups: pickupList.map((p) => addressKey(p.warehouseAddress)),
      deliveries: deliveryList.map((d) => addressKey(d.deliveryAddress)),
      key: addressKey,
    }),
    [pickupList, deliveryList],
  );

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    const value = name === "contactNumber" ? sanitizePhoneInput(e.target.value) : e.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError(name);
  };

  const setCrew = (field: keyof CrewChoice, value: string) => {
    touched.current[field] = true;
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  const cleanCell = (field: string, value: string) =>
    field === "contactNumber" ? sanitizePhoneInput(value) : field === "quantity" ? sanitizeQuantityInput(value) : value;

  const handlePickupChange = (index: number, field: keyof PickupRow, value: string) => {
    setPickupList((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: cleanCell(field, value) } : row)));
    clearError(`pickup_${index}_${field}`);
  };
  const handleDeliveryChange = (index: number, field: keyof DeliveryRow, value: string) => {
    setDeliveryList((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: cleanCell(field, value) } : row)));
    clearError(`delivery_${index}_${field}`);
  };

  // Errors are keyed by row position, so they are cleared when a row goes.
  const removePickupRow = (index: number) => {
    if (pickupList.length === 1) return;
    setPickupList((rows) => rows.filter((_, i) => i !== index));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("pickup_"))));
  };
  const removeDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryList((rows) => rows.filter((_, i) => i !== index));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("delivery_"))));
  };

  const handleWarehouseSelect = (index: number, selectedName: string) => {
    const match = registeredWarehouses.find((w: any) => (w.whName || w.warehouseName) === selectedName);
    setPickupList((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              warehouseID: match?.warehouseID ?? null,
              warehouseName: selectedName,
              warehouseAddress: match ? match.warehouseLoc || match.warehouseAddress || "" : "",
              contactPerson: match ? match.contactPerson || "" : "",
              contactNumber: match ? match.contactNum || match.contactNumber || "" : "",
            }
          : row,
      ),
    );
    ["warehouseName", "warehouseAddress", "contactPerson", "contactNumber"].forEach((f) => clearError(`pickup_${index}_${f}`));
  };

  const handleBranchSelect = (index: number, selectedName: string) => {
    const match = registeredBranches.find((b: any) => b.branchName === selectedName);
    setDeliveryList((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              branchName: selectedName,
              deliveryAddress: match ? match.deliveryAddress || match.branchAddress || "" : "",
              contactPerson: match ? match.contactPerson || "" : "",
              contactNumber: match ? match.contactNumber || match.contactNum || "" : "",
            }
          : row,
      ),
    );
    ["branchName", "deliveryAddress", "contactPerson", "contactNumber"].forEach((f) => clearError(`delivery_${index}_${f}`));
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const phone = (key: string, value: string) => {
      if (!value.trim()) next[key] = key.includes("_") ? "Required" : "Contact number is required.";
      else if (!normalizePhone(value)) next[key] = PHONE_RULE;
    };
    const quantity = (key: string, value: string) => {
      if (!value.trim()) next[key] = "Required";
      else if (parseQuantity(value) === null) next[key] = "At least 1";
    };

    if (!formData.clientName.trim()) next.clientName = "Company / client name is required.";
    if (!formData.contactPerson.trim()) next.contactPerson = "Contact person is required.";
    phone("contactNumber", formData.contactNumber);
    if (!formData.deliverySchedule) next.deliverySchedule = "Delivery schedule is required.";
    if (!formData.product.trim()) next.product = "Product description is required.";
    if (!formData.priorityLevel) next.priorityLevel = "Priority level is required.";

    pickupList.forEach((p, i) => {
      if (!p.warehouseName.trim()) next[`pickup_${i}_warehouseName`] = "Required";
      if (!p.warehouseAddress.trim()) next[`pickup_${i}_warehouseAddress`] = "Required";
      if (!p.contactPerson.trim()) next[`pickup_${i}_contactPerson`] = "Required";
      phone(`pickup_${i}_contactNumber`, p.contactNumber);
      if (!p.pickupTime) next[`pickup_${i}_pickupTime`] = "Required";
      quantity(`pickup_${i}_quantity`, p.quantity);
    });
    deliveryList.forEach((d, i) => {
      if (!d.branchName.trim()) next[`delivery_${i}_branchName`] = "Required";
      if (!d.deliveryAddress.trim()) next[`delivery_${i}_deliveryAddress`] = "Required";
      if (!d.contactPerson.trim()) next[`delivery_${i}_contactPerson`] = "Required";
      phone(`delivery_${i}_contactNumber`, d.contactNumber);
      if (!d.deliveryTime) next[`delivery_${i}_deliveryTime`] = "Required";
      quantity(`delivery_${i}_quantity`, d.quantity);
    });

    for (const clash of findAddressClashes(
      pickupList.map((p) => ({ address: p.warehouseAddress })),
      deliveryList.map((d) => ({ address: d.deliveryAddress })),
    )) {
      const key = clash.section === "pickup" ? `pickup_${clash.index}_warehouseAddress` : `delivery_${clash.index}_deliveryAddress`;
      next[key] = clash.message;
    }

    if (isSubconMode && !formData.subconPartner) next.subconPartner = "Subcon partner is required.";

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    const truck = availableTrucks.find((t) => t.truckID === formData.truckPlate);
    const driver = availableDrivers.find((d) => d.employeeID === formData.driver);
    const helper1 = availableHelpers.find((h) => h.employeeID === formData.helper1);
    const helper2 = availableHelpers.find((h) => h.employeeID === formData.helper2);
    const unassigned = !isSubconMode && (!formData.truckPlate || !formData.driver);

    const result: BookingFormResult = {
      ...formData,
      subconPartner: isSubconMode ? formData.subconPartner : "",
      contactNumber: normalizePhone(formData.contactNumber) ?? formData.contactNumber,
      emailAddress: formData.emailAddress.trim() || "N/A",
      businessAddress: formData.businessAddress.trim() || "N/A",
      pickupList: pickupList.map((p) => ({ ...p, contactNumber: normalizePhone(p.contactNumber) ?? p.contactNumber })),
      deliveryList: deliveryList.map((d) => ({ ...d, contactNumber: normalizePhone(d.contactNumber) ?? d.contactNumber })),
      unassigned,
      resolvedNames: {
        truck: isSubconMode ? formData.truckPlate : (truck?.plateNumber ?? ""),
        driver: isSubconMode ? formData.driver : (driver?.employeeName ?? ""),
        helper1: isSubconMode ? formData.helper1 : (helper1?.employeeName ?? ""),
        helper2: isSubconMode ? formData.helper2 : (helper2?.employeeName ?? ""),
      },
    };

    // Without a truck and a driver the booking cannot be dispatched yet;
    // say so before creating it.
    if (unassigned) {
      setConfirmUnassigned(result);
      return;
    }
    onSubmitSuccess(result);
    onClose();
  };

  const partnerOptions = [
    ...subcontractors.map((s: any) => ({ value: s.companyName, label: s.companyName })),
    { value: "Other", label: "Other" },
  ];

  const errorCount = Object.keys(errors).length;
  const badge = BADGES[variant];
  const inputClass = (key: string) =>
    `w-full border rounded-md px-3 py-2 text-xs ${errors[key] ? "border-red-500 bg-red-50/20" : "border-slate-300"}`;

  return (
    <>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
          <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
            <h2 className="text-xl font-bold text-white tracking-wide">{TITLES[variant]}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={validateAndSubmit} noValidate className="p-6 space-y-6 max-h-[80dvh] overflow-y-auto text-sm text-slate-900">
            {/* Client Info */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex justify-between">
                <span>1. Client Information</span>
                {badge && (
                  <span className="text-xs sm:text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {badge}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Company / Client Name *</label>
                  {registered ? (
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold text-slate-700 truncate">
                      {formData.clientName}
                    </div>
                  ) : (
                    <input
                      type="text"
                      name="clientName"
                      placeholder="e.g., Acme Corp or Juan Dela Cruz"
                      value={formData.clientName}
                      onChange={handleChange}
                      className={inputClass("clientName")}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Contact Person *</label>
                  <input
                    type="text"
                    name="contactPerson"
                    placeholder="e.g., Juan Dela Cruz"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    className={inputClass("contactPerson")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Contact Number *</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    name="contactNumber"
                    placeholder="e.g., 09123456789"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    className={inputClass("contactNumber")}
                  />
                  {errors.contactNumber && <p className="mt-1 text-[11px] leading-tight text-red-600">{errors.contactNumber}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Email Address</label>
                  <input
                    type="email"
                    name="emailAddress"
                    placeholder="company@email.com"
                    value={formData.emailAddress}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Business Address</label>
                  <input
                    type="text"
                    name="businessAddress"
                    placeholder="Enter full business address"
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
                <span className="font-semibold text-black text-sm tracking-wide">2. Pickup Addresses *</span>
                <button
                  type="button"
                  onClick={() => setPickupList((rows) => [...rows, emptyPickup()])}
                  className="inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-medium rounded-lg text-xs shadow-sm px-4 py-1.5"
                >
                  <Plus className="w-4 h-4" /> New Pickup
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs min-w-150">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                      <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                      <th className="p-2.5 border-r border-slate-200 w-[20%]">Warehouse Name *</th>
                      <th className="p-2.5 border-r border-slate-200 w-[25%]">Address *</th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">Contact Person *</th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">Contact Number *</th>
                      <th className="p-2.5 border-r border-slate-200 w-[12%]">Pick Up Time *</th>
                      <th className="p-2.5 border-r border-slate-200 w-24 text-center">Quantity*</th>
                      <th className="p-2.5 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickupList.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-200 align-top">
                        <td className="p-2 border-r border-slate-200 text-center font-medium">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200">
                          {registered ? (
                            <select
                              value={row.warehouseName}
                              onChange={(e) => handleWarehouseSelect(idx, e.target.value)}
                              className={cellClass(Boolean(errors[`pickup_${idx}_warehouseName`]))}
                            >
                              <option value="">Select Warehouse</option>
                              {registeredWarehouses.map((w: any, i: number) => {
                                const name = w.whName || w.warehouseName;
                                const key = usedAddresses.key(w.warehouseLoc || w.warehouseAddress || "");
                                const inUse =
                                  name !== row.warehouseName &&
                                  (pickupList.some((p, j) => j !== idx && p.warehouseName === name) ||
                                    (key !== "" && usedAddresses.deliveries.includes(key)));
                                return (
                                  <option key={i} value={name} disabled={inUse}>
                                    {name}
                                    {inUse ? " (already used)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Warehouse Name"
                              value={row.warehouseName}
                              onChange={(e) => handlePickupChange(idx, "warehouseName", e.target.value)}
                              className={cellClass(Boolean(errors[`pickup_${idx}_warehouseName`]))}
                            />
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Full Address"
                            value={row.warehouseAddress}
                            onChange={(e) => handlePickupChange(idx, "warehouseAddress", e.target.value)}
                            className={cellClass(Boolean(errors[`pickup_${idx}_warehouseAddress`]))}
                          />
                          <CellError message={errors[`pickup_${idx}_warehouseAddress`]} />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Contact Person"
                            value={row.contactPerson}
                            onChange={(e) => handlePickupChange(idx, "contactPerson", e.target.value)}
                            className={cellClass(Boolean(errors[`pickup_${idx}_contactPerson`]))}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="tel"
                            inputMode="tel"
                            placeholder="09XXXXXXXXX"
                            value={row.contactNumber}
                            onChange={(e) => handlePickupChange(idx, "contactNumber", e.target.value)}
                            className={cellClass(Boolean(errors[`pickup_${idx}_contactNumber`]))}
                          />
                          <CellError message={errors[`pickup_${idx}_contactNumber`] && "11 digits, starting 09"} />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="time"
                            value={row.pickupTime}
                            onChange={(e) => handlePickupChange(idx, "pickupTime", e.target.value)}
                            className={cellClass(Boolean(errors[`pickup_${idx}_pickupTime`]))}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <QuantityInput
                            value={row.quantity}
                            onChange={(v) => handlePickupChange(idx, "quantity", v)}
                            hasError={Boolean(errors[`pickup_${idx}_quantity`])}
                          />
                          <CellError message={errors[`pickup_${idx}_quantity`]} />
                        </td>
                        <td className="p-2 text-center">
                          <RowDeleteButton onConfirm={() => removePickupRow(idx)} disabled={pickupList.length === 1} />
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
                <span className="font-semibold text-black text-sm tracking-wide">3. Delivery Address *</span>
                <button
                  type="button"
                  onClick={() => setDeliveryList((rows) => [...rows, emptyDelivery()])}
                  className="inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-medium rounded-lg text-xs shadow-sm px-4 py-1.5"
                >
                  <Plus className="w-4 h-4" /> Branch
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs min-w-150">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                      <th className="p-2.5 w-10 border-r border-slate-200 text-center"></th>
                      <th className="p-2.5 border-r border-slate-200 w-[20%]">Branch Name *</th>
                      <th className="p-2.5 border-r border-slate-200 w-[25%]">Delivery Address *</th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">Contact Person *</th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">Contact Number *</th>
                      <th className="p-2.5 border-r border-slate-200 w-[12%]">Delivery Time *</th>
                      <th className="p-2.5 border-r border-slate-200 w-24 text-center">Quantity*</th>
                      <th className="p-2.5 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryList.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-200 align-top">
                        <td className="p-2 border-r border-slate-200 text-center font-medium">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200">
                          {registered ? (
                            <select
                              value={row.branchName}
                              onChange={(e) => handleBranchSelect(idx, e.target.value)}
                              className={cellClass(Boolean(errors[`delivery_${idx}_branchName`]))}
                            >
                              <option value="">Select Branch</option>
                              {registeredBranches.map((b: any, i: number) => {
                                const key = usedAddresses.key(b.deliveryAddress || b.branchAddress || "");
                                const inUse =
                                  b.branchName !== row.branchName &&
                                  (deliveryList.some((d, j) => j !== idx && d.branchName === b.branchName) ||
                                    (key !== "" && usedAddresses.pickups.includes(key)));
                                return (
                                  <option key={i} value={b.branchName} disabled={inUse}>
                                    {b.branchName}
                                    {inUse ? " (already used)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Branch Name"
                              value={row.branchName}
                              onChange={(e) => handleDeliveryChange(idx, "branchName", e.target.value)}
                              className={cellClass(Boolean(errors[`delivery_${idx}_branchName`]))}
                            />
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Full Address"
                            value={row.deliveryAddress}
                            onChange={(e) => handleDeliveryChange(idx, "deliveryAddress", e.target.value)}
                            className={cellClass(Boolean(errors[`delivery_${idx}_deliveryAddress`]))}
                          />
                          <CellError message={errors[`delivery_${idx}_deliveryAddress`]} />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Contact Person"
                            value={row.contactPerson}
                            onChange={(e) => handleDeliveryChange(idx, "contactPerson", e.target.value)}
                            className={cellClass(Boolean(errors[`delivery_${idx}_contactPerson`]))}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="tel"
                            inputMode="tel"
                            placeholder="09XXXXXXXXX"
                            value={row.contactNumber}
                            onChange={(e) => handleDeliveryChange(idx, "contactNumber", e.target.value)}
                            className={cellClass(Boolean(errors[`delivery_${idx}_contactNumber`]))}
                          />
                          <CellError message={errors[`delivery_${idx}_contactNumber`] && "11 digits, starting 09"} />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="time"
                            value={row.deliveryTime}
                            onChange={(e) => handleDeliveryChange(idx, "deliveryTime", e.target.value)}
                            className={cellClass(Boolean(errors[`delivery_${idx}_deliveryTime`]))}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <QuantityInput
                            value={row.quantity}
                            onChange={(v) => handleDeliveryChange(idx, "quantity", v)}
                            hasError={Boolean(errors[`delivery_${idx}_quantity`])}
                          />
                          <CellError message={errors[`delivery_${idx}_quantity`]} />
                        </td>
                        <td className="p-2 text-center">
                          <RowDeleteButton onConfirm={() => removeDeliveryRow(idx)} disabled={deliveryList.length === 1} />
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
                  <label className="block text-xs font-medium text-black mb-1">Delivery Schedule *</label>
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
                  <label className="block text-xs font-medium text-black mb-1">Product To Deliver *</label>
                  <input
                    type="text"
                    name="product"
                    placeholder="e.g., 50 boxes of tile"
                    value={formData.product}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.product ? "border-red-500" : "border-slate-300"}`}
                  />
                </div>
                <div className="sm:col-span-3 md:col-span-3">
                  <label className="block text-xs font-medium text-black mb-1">Priority Level *</label>
                  <select
                    name="priorityLevel"
                    value={formData.priorityLevel}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.priorityLevel ? "border-red-500" : "border-slate-300"}`}
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    <option value="Standard">Standard</option>
                    <option value="Urgent">Urgent / Rush</option>
                    <option value="High Priority">High Priority</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Assign Crew / Subcon */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                <span className="font-semibold text-black text-sm tracking-wide">
                  5. Assign Delivery Crews & Vehicle {isSubconMode && "(Subcon)"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSubconMode((on) => !on)}
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                  {isSubconMode ? "Assign to Own Resources" : "Assign to Subcon Partner"}
                </button>
              </div>

              {isSubconMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-black mb-1" htmlFor="subcon-partner">
                      Select Subcon Partner *
                    </label>
                    <SelectMenu
                      id="subcon-partner"
                      value={formData.subconPartner}
                      onChange={(v) => {
                        setFormData((prev) => ({ ...prev, subconPartner: v }));
                        clearError("subconPartner");
                      }}
                      options={partnerOptions}
                      placeholder="Select partner"
                      searchPlaceholder="Search company"
                    />
                    {errors.subconPartner && <p className="mt-1 text-xs text-red-600">{errors.subconPartner}</p>}
                  </div>
                  {(
                    [
                      ["truckPlate", "Truck / Plate No."],
                      ["driver", "Driver Name"],
                      ["helper1", "Helper #1"],
                      ["helper2", "Helper #2"],
                    ] as const
                  ).map(([name, title]) => (
                    <div key={name}>
                      <label className="block text-xs font-medium text-black mb-1">{title}</label>
                      <input
                        type="text"
                        name={name}
                        placeholder="Optional"
                        value={formData[name]}
                        onChange={handleChange}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <CrewPicker
                    value={{
                      truckPlate: formData.truckPlate,
                      driver: formData.driver,
                      helper1: formData.helper1,
                      helper2: formData.helper2,
                    }}
                    onChange={setCrew}
                    trucks={availableTrucks}
                    drivers={availableDrivers}
                    helpers={availableHelpers}
                    loading={loadingCrew}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {formData.deliverySchedule
                      ? "Suggested from who is free. Change any of them; leave the truck or driver unassigned to assign later."
                      : "Pick a delivery schedule and a free truck and crew are suggested."}
                  </p>
                </>
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

            {errorCount > 0 && (
              <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Check the fields marked in red.
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-slate-200 justify-end">
              <button type="button" onClick={onClose} className="px-6 py-2.5 bg-slate-200 text-slate-800 font-semibold rounded-xl text-sm">
                Cancel
              </button>
              <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm">
                Generate Booking
              </button>
            </div>
          </form>
        </div>
      </div>

      {confirmUnassigned && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60" role="dialog" aria-modal="true" aria-labelledby="unassigned-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="unassigned-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Create as an Unassigned Booking?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {!confirmUnassigned.truckPlate && !confirmUnassigned.driver
                ? "No truck or driver is assigned."
                : !confirmUnassigned.truckPlate
                  ? "No truck is assigned."
                  : "No driver is assigned."}{" "}
              The booking will be saved and wait under Unassigned Bookings until a truck and driver are assigned.
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmUnassigned(null)}
                className="min-h-11 px-5 py-2 rounded-xl bg-slate-200 text-sm font-semibold text-slate-800"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={() => {
                  const result = confirmUnassigned;
                  setConfirmUnassigned(null);
                  onSubmitSuccess(result);
                  onClose();
                }}
                className="min-h-11 px-5 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white"
              >
                Create unassigned booking
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Whole numbers from 1 up. The browser's own arrows stop at 1, and a minus
// sign, decimal point or exponent cannot be typed.
function QuantityInput({ value, onChange, hasError }: { value: string; onChange: (value: string) => void; hasError: boolean }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      step={1}
      placeholder="0"
      value={value}
      onKeyDown={(e) => {
        if (["-", "+", "e", "E", ".", ","].includes(e.key)) e.preventDefault();
      }}
      onChange={(e) => onChange(e.target.value)}
      className={`${cellClass(hasError)} min-w-15`}
    />
  );
}
