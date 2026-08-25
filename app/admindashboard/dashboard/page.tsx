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

// ==========================================
// CLIENT SEARCH MODAL (For "New Booking")
// ==========================================

interface ClientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: any[]; 
  onSelectClient: (clientID: string) => void;
}

function ClientSearchModal({
  isOpen,
  onClose,
  clients,
  onSelectClient,
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
          onClick={handleClose}
          className="mt-2 bg-slate-200 hover:bg-slate-300 px-6 py-2.5 text-slate-700 font-bold rounded-lg text-sm shadow-sm transition-colors w-full sm:w-auto">
          Cancel Search
        </button>
      </div>
    </div>
  );
}

// ==========================================
// UNIVERSAL BOOKING MODAL (RESTORED UI FIELDS)
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

  useEffect(() => {
    if (isOpen) {
      if (preSelectedClientID) {
        const client = clients.find(c => c.clientID === preSelectedClientID);
        setFormData({
          ...initialFormState,
          clientID: preSelectedClientID,
          clientName: client ? client.company : "",
          contactPerson: client ? client.contactName : "",
          contactNumber: client ? client.contact : ""
        });
      } else {
        setFormData(initialFormState);
      }
      setErrors({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preSelectedClientID]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

    // Restore your original validation!
    if (!formData.clientName.trim()) newErrors.clientName = "Client / Company Name is required.";
    if (!formData.contactPerson.trim()) newErrors.contactPerson = "Contact person is required.";
    if (!formData.contactNumber.trim()) newErrors.contactNumber = "Contact number is required.";
    if (!formData.requestDate) newErrors.requestDate = "Request date is required.";
    if (!formData.deliverySchedule) newErrors.deliverySchedule = "Delivery schedule is required.";
    if (!formData.pickupTime) newErrors.pickupTime = "Pickup time is required.";
    if (!formData.deliveryTime) newErrors.deliveryTime = "Delivery time is required.";
    if (!formData.priorityLevel) newErrors.priorityLevel = "Priority level is required.";
    if (!formData.product.trim()) newErrors.product = "Product description is required.";
    if (!formData.quantity.toString().trim()) newErrors.quantity = "Quantity is required.";
    if (!formData.pickupAddress.trim()) newErrors.pickupAddress = "Pickup address is required.";
    if (!formData.deliveryAddress.trim()) newErrors.deliveryAddress = "Delivery address is required.";
    if (!formData.truckPlate) newErrors.truckPlate = "Truck plate number is required.";
    if (!formData.driver) newErrors.driver = "Driver assignment is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmitSuccess(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {preSelectedClientID ? "Registered Client Booking" : "On-Call Booking Form"}
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
          className="p-6 space-y-6 overflow-y-auto flex-1 text-sm text-slate-900"
        >
          {/* SECTION 1: CLIENT INFORMATION */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex justify-between">
              <span>1. Client Information</span>
              {!preSelectedClientID && (
                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Walk-in / On-Call</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Company Name / Client Name *
                </label>
                {preSelectedClientID ? (
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold text-slate-700">
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
                {errors.clientName && <p className="text-red-500 text-[11px] mt-1">{errors.clientName}</p>}
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
                {errors.contactPerson && <p className="text-red-500 text-[11px] mt-1">{errors.contactPerson}</p>}
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
                {errors.contactNumber && <p className="text-red-500 text-[11px] mt-1">{errors.contactNumber}</p>}
              </div>
            </div>
          </div>

          {/* SECTION 2: DELIVERY DETAILS (100% RESTORED) */}
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
                {errors.requestDate && <p className="text-red-500 text-[11px] mt-1">{errors.requestDate}</p>}
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
                {errors.deliverySchedule && <p className="text-red-500 text-[11px] mt-1">{errors.deliverySchedule}</p>}
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
                {errors.priorityLevel && <p className="text-red-500 text-[11px] mt-1">{errors.priorityLevel}</p>}
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
                {errors.pickupTime && <p className="text-red-500 text-[11px] mt-1">{errors.pickupTime}</p>}
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
                {errors.deliveryTime && <p className="text-red-500 text-[11px] mt-1">{errors.deliveryTime}</p>}
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
                {errors.product && <p className="text-red-500 text-[11px] mt-1">{errors.product}</p>}
              </div>
              <div>
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
                {errors.quantity && <p className="text-red-500 text-[11px] mt-1">{errors.quantity}</p>}
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
                {errors.pickupAddress && <p className="text-red-500 text-[11px] mt-1">{errors.pickupAddress}</p>}
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
                {errors.deliveryAddress && <p className="text-red-500 text-[11px] mt-1">{errors.deliveryAddress}</p>}
              </div>
            </div>
          </div>

          {/* SECTION 3: ASSIGN DELIVERY CREW (LIVE FROM DATABASE) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <span className="font-semibold text-black text-sm tracking-wide">
                3. Assign Delivery Crew & Vehicle
              </span>
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
                  {trucks.map(t => (
                    <option key={t.truckID} value={t.truckID}>
                      {t.plateNumber} ({t.model})
                    </option>
                  ))}
                </select>
                {errors.truckPlate && <p className="text-red-500 text-[11px] mt-1">{errors.truckPlate}</p>}
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
                  {drivers.map(d => (
                    <option key={d.employeeID} value={d.employeeID}>
                      {d.employeeName}
                    </option>
                  ))}
                </select>
                {errors.driver && <p className="text-red-500 text-[11px] mt-1">{errors.driver}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Helper #1 (Optional)
                </label>
                <select
                  name="helper1"
                  value={formData.helper1}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">Select helper</option>
                  {helpers.map(h => (
                    <option key={h.employeeID} value={h.employeeID}>
                      {h.employeeName}
                    </option>
                  ))}
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
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">Select helper</option>
                  {helpers.map(h => (
                    <option key={h.employeeID} value={h.employeeID}>
                      {h.employeeName}
                    </option>
                  ))}
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
              Generate Order
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

function KPIGrid({ onNavigate, bookingsData }: { onNavigate: (name: string) => void, bookingsData: any }) {
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
          {data.length} Total
        </span>
      </div>
      <div className="overflow-x-auto min-h-75">
        {data.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-2 opacity-20" />
            <p>No data found.</p>
          </div>
        ) : (
          <table className="w-full text-left min-w-125">
            <tbody className="divide-y divide-gray-50 text-sm">
              {data.map((b: any) => (
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

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isClientSearchModalOpen, setIsClientSearchModalOpen] = useState(false);
  const [selectedClientForBooking, setSelectedClientForBooking] = useState("");
  
  // 🚀 STATE FOR DYNAMIC DATA
  const [clients, setClients] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [helpers, setHelpers] = useState<any[]>([]);

  const [bookingsData, setBookingsData] = useState<{ [key: string]: any[] }>({
    "Pending Bookings": [],
    "In-Transit": [],
    Completed: [],
    "Foul Trip": [],
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // 🚀 FETCH ORDERS AND DYNAMICALLY EXTRACT ON-CALL NAMES
  const fetchOrders = async () => {
    try {
      const orderRes = await axios.get(`${API_URL}/api/orders`);
      
      const mappedPending = orderRes.data.map((o: any) => {
        let displayClient = o.Client?.company;
        
        // Extract On-Call name saved securely in notes
        if (!displayClient) {
          const match = o.notes?.match(/Name:\s*(.*)/);
          displayClient = match ? `Walk-in: ${match[1]}` : 'Walk-in Customer';
        }

        return {
          orderId: o.orderCode,
          client: displayClient,
        };
      });

      setBookingsData(prev => ({
        ...prev,
        "Pending Bookings": mappedPending
      }));
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const clientRes = await axios.get(`${API_URL}/api/clients`);
        setClients(clientRes.data);

        const truckRes = await axios.get(`${API_URL}/api/trucks`);
        setTrucks(truckRes.data);

        const empRes = await axios.get(`${API_URL}/api/employees`);
        const allEmployees = empRes.data;
        setDrivers(allEmployees.filter((e: any) => e.role === 'Driver' && e.isActive));
        setHelpers(allEmployees.filter((e: any) => e.role === 'Helper' && e.isActive));

        await fetchOrders(); 
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }
    };
    fetchDashboardData();
  }, []);

  const handleNavigate = (tabName: string) => {
    sectionRefs.current[tabName]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // 🚀 SUBMIT THE PAYLOAD (Packages extra UI fields perfectly into 'notes')
  const handleModalSubmit = async (data: any) => {
    try {
      console.log("[FRONTEND] 🟢 Sending Order POST to Express...");

      let detailedNotes = "";
      
      // If it's an On-Call booking (No UUID), stamp their details!
      if (!data.clientID) {
        detailedNotes += `[ON-CALL CUSTOMER]\nName: ${data.clientName}\nContact: ${data.contactPerson} (${data.contactNumber})\n\n`;
      }

      detailedNotes += `[DELIVERY DETAILS]\nPriority: ${data.priorityLevel}\nRequest Date: ${data.requestDate}\nDelivery Schedule: ${data.deliverySchedule}\nPickup: ${data.pickupAddress} @ ${data.pickupTime}\n`;
      detailedNotes += `\n[ASSIGNED CREW]\nTruck: ${data.truckPlate}\nDriver: ${data.driver}\nHelper 1: ${data.helper1 || 'None'}\nHelper 2: ${data.helper2 || 'None'}\n`;
      
      if (data.notes) {
        detailedNotes += `\n[NOTES]\n${data.notes}`;
      }

      const payload = {
        clientID: data.clientID || null, // Allows null for On-Call
        notes: detailedNotes,
        items: [{
          productName: data.product,
          productType: "General",
          quantity: Number(data.quantity) || 1,
          weightPerItem: 0
        }],
        stops: [{
          branchName: data.deliveryAddress,
          contactPerson: data.contactPerson,
          contactNum: data.contactNumber,
          expectedTime: data.deliveryTime || "12:00:00"
        }]
      };

      const res = await axios.post(`${API_URL}/api/orders`, payload);
      alert(`✅ Order Generated Successfully!\nTracking Code: ${res.data.orderCode}`);
      
      await fetchOrders();

    } catch (err: any) {
      console.error(err);
      alert(`🚨 FAILED 🚨\n\nReason: ${err.response?.data?.error || err.message}`);
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

      {/* 🚀 THE RESTORED BOOKING FORM */}
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

      <ClientSearchModal
        isOpen={isClientSearchModalOpen}
        onClose={() => setIsClientSearchModalOpen(false)}
        clients={clients}
        onSelectClient={(clientID) => {
          setSelectedClientForBooking(clientID);
          setIsClientSearchModalOpen(false);
          setIsBookingModalOpen(true); 
        }}
      />
    </div>
  );
}