// ==========================================
// MAIN DASHBOARD PAGE FOR ADMIN USERS
// ==========================================
"use client";
import React, { useRef, useState } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Truck,
  X,
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

// Placeholder data
const BOOKINGS = {
  "Pending Bookings": [],
  "In-Transit": [],
  Completed: [],
  "Foul Trip": [],
};

// ==========================================
// ON-CALL BOOKING MODAL COMPONENT
// ==========================================

interface OnCallBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (data: any) => void;
}

function OnCallBookingModal({
  isOpen,
  onClose,
  onSubmitSuccess,
}: OnCallBookingModalProps) {
  const initialFormState = {
    clientName: "",
    contactPerson: "",
    contactNumber: "",
    requestDate: "",
    deliverySchedule: "",
    pickupTime: "",
    deliveryTime: "",
    priorityLevel: "",
    pickupAddress: "",
    product: "",
    quantity: "",
    deliveryAddress: "",
    truckPlate: "",
    driver: "",
    helper1: "",
    helper2: "",
    notes: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!formData.clientName.trim())
      newErrors.clientName = "Client / Company Name is required.";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required.";
    if (!formData.contactNumber.trim())
      newErrors.contactNumber = "Contact number is required.";
    if (!formData.requestDate)
      newErrors.requestDate = "Request date is required.";
    if (!formData.deliverySchedule)
      newErrors.deliverySchedule = "Delivery schedule is required.";
    if (!formData.pickupTime) newErrors.pickupTime = "Pickup time is required.";
    if (!formData.deliveryTime)
      newErrors.deliveryTime = "Delivery time is required.";
    if (!formData.priorityLevel)
      newErrors.priorityLevel = "Priority level is required.";
    if (!formData.product.trim())
      newErrors.product = "Product description is required.";
    if (!formData.quantity.trim()) newErrors.quantity = "Quantity is required.";
    if (!formData.pickupAddress.trim())
      newErrors.pickupAddress = "Pickup address is required.";
    if (!formData.deliveryAddress.trim())
      newErrors.deliveryAddress = "Delivery address is required.";
    if (!formData.truckPlate)
      newErrors.truckPlate = "Truck plate number is required.";
    if (!formData.driver) newErrors.driver = "Driver assignment is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmitSuccess(formData);
    setFormData(initialFormState);
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        
        {/* MODAL TITLE BANNER */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            On-Call Booking Form
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL FORM */}
        <form
          onSubmit={validateAndSubmit}
          className="p-6 space-y-6 overflow-y-auto flex-1 text-sm text-slate-900"
        >
          {/* SECTION 1: CLIENT INFORMATION */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              1. Client Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Company / Client Name *
                </label>
                <input
                  type="text"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleChange}
                  placeholder="e.g., Jollibee - QC Branch"
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
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="e.g., Arki Lim"
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
            </div>
          </div>

          {/* SECTION 2: DELIVERY DETAILS */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              2. Delivery Details
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
                <select
                  name="priorityLevel"
                  value={formData.priorityLevel}
                  onChange={handleChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.priorityLevel ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>Select priority level</option>
                  <option value="Standard">Standard</option>
                  <option value="Urgent">Urgent / Rush</option>
                  <option value="High Priority">High Priority</option>
                </select>
                {errors.priorityLevel && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.priorityLevel}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
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
              <div>
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
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Product Description *
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
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Quantity *
                </label>
                <input
                  type="text"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="e.g., 40 Cases"
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

          {/* SECTION 3: ASSIGN DELIVERY CREW */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                3. Assign Delivery Crew & Vehicle
              </span>
              <button
                type="button"
                onClick={() => alert("Fleet Auto-Recommendation triggered!")}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
              >
                Auto-Recommend Available Resources
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Truck Plate No. *
                </label>
                <select
                  name="truckPlate"
                  value={formData.truckPlate}
                  onChange={handleChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckPlate ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>Select truck</option>
                  <option value="ABC-1234">ABC-1234 (Closed Van)</option>
                  <option value="XYZ-5678">XYZ-5678 (Wing Van)</option>
                </select>
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
                <select
                  name="driver"
                  value={formData.driver}
                  onChange={handleChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.driver ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>Select driver</option>
                  <option value="Juan Dela Cruz">Juan Dela Cruz</option>
                  <option value="Pedro Santos">Pedro Santos</option>
                </select>
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
                <select
                  name="helper1"
                  value={formData.helper1}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 border-slate-300"
                >
                  <option value="">Select helper</option>
                  <option value="Mark Reyes">Mark Reyes</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Helper #2 (Optional)
                </label>
                <select
                  name="helper2"
                  value={formData.helper2}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 border-slate-300"
                >
                  <option value="">Select helper</option>
                  <option value="John Doe">John Doe</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 4: NOTES / INSTRUCTIONS */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
              4. Notes / Instructions (Optional)
            </div>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add special delivery instructions, gate pass codes, or handling notes here..."
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* MODAL ACTION BUTTONS */}
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
              className="w-36 py-2 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center hover:opacity-95"
            >
              Assign Booking
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

function KPIGrid({ onNavigate }: { onNavigate: (name: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {TABS.map((tab) => {
        const styles = COLOR_STYLES[tab.color as keyof typeof COLOR_STYLES];
        const count = BOOKINGS[tab.name as keyof typeof BOOKINGS]?.length ?? 0;
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
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full">
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
          {bookings.length} Total
        </span>
      </div>
      <div className="overflow-x-auto min-h-75">
        {bookings.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-2 opacity-20" />
            <p>No data found.</p>
          </div>
        ) : (
          <table className="w-full text-left min-w-125">
            <tbody className="divide-y divide-gray-50 text-sm">
              {bookings.map((b: any) => (
                <tr key={b.orderId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {b.orderId}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{b.client}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 ${styles.badgeBg} ${styles.badgeText} rounded-full text-xs font-bold`}
                    >
                      {tabConfig.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

  const [isOnCallModalOpen, setIsOnCallModalOpen] = useState(false);

  const handleNavigate = (tabName: string) => {
    sectionRefs.current[tabName]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleModalSubmit = (data: any) => {
    console.log("Submitted On-Call Booking Data:", data);
    alert(
      "On-Call Booking successfully created and assigned! (Local state placeholder)",
    );
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Track pending bookings, in-transit deliveries, completed trips, and
            foul trips at a glance.
          </p>
        </div>

        {/* BUTTON GROUP */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsOnCallModalOpen(true)}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors duration-200 shadow-md shadow-green-200 whitespace-nowrap"
          >
            + On-Call Booking
          </button>
          <button
            onClick={() =>
              alert("New Booking form/workflow will be configured separately.")
            }
            style={{ backgroundColor: "oklch(54.6% 0.245 262.881)" }}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center text-white text-sm font-semibold rounded-xl hover:opacity-95 transition-all duration-200 shadow-md whitespace-nowrap"
          >
            + New Booking
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPIGrid onNavigate={handleNavigate} />

      {/* 2x2 Responsive Grid for Data Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
        {TABS.map((tab) => (
          <div
            key={tab.name}
            ref={(el) => {
              sectionRefs.current[tab.name] = el;
            }}
            className="scroll-mt-6"
          >
            <FeedTable
              tabConfig={tab}
              bookings={BOOKINGS[tab.name as keyof typeof BOOKINGS]}
            />
          </div>
        ))}
      </div>

      {/* ON-CALL BOOKING MODAL */}
      <OnCallBookingModal
        isOpen={isOnCallModalOpen}
        onClose={() => setIsOnCallModalOpen(false)}
        onSubmitSuccess={handleModalSubmit}
      />
    </div>
  );
}