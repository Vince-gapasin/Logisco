// ==========================================
// FLEET STATUS PAGE & TRUCK MODAL
// ==========================================
"use client";

import React, { useState } from "react";
import { Search, Truck, FileText, X } from "lucide-react";

export interface TruckRecord {
  id: string | number;
  plateNumber: string;
  truckType: string;
  truckModel: string;
  capacity: string;
  lastChecked: string;
  status: string;
}

interface TruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: (record: TruckRecord) => void;
}

function TruckModal({ isOpen, onClose, onSubmitSuccess }: TruckModalProps) {
  const initialTruckState = {
    plateNumber: "",
    truckType: "",
    truckModel: "",
    capacity: "",
    lastChecked: "",
  };

  const [formData, setFormData] = useState(initialTruckState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setFormData(initialTruckState);
    setErrors({});
    onClose();
  };

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

    if (!formData.plateNumber.trim())
      newErrors.plateNumber = "Plate number is required.";
    if (!formData.truckType) newErrors.truckType = "Type of truck is required.";
    if (!formData.truckModel.trim())
      newErrors.truckModel = "Truck model is required.";
    if (!formData.capacity.trim()) newErrors.capacity = "Capacity is required.";
    if (!formData.lastChecked)
      newErrors.lastChecked = "Last checked date is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newRecord: TruckRecord = {
      id: Date.now(),
      plateNumber: formData.plateNumber,
      truckType: formData.truckType,
      truckModel: formData.truckModel,
      capacity: formData.capacity,
      lastChecked: formData.lastChecked,
      status: "Operational",
    };

    onSubmitSuccess(newRecord);
    setFormData(initialTruckState);
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-wide">
            New Truck Form
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
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
              Truck Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Plate Number *
                </label>
                <input
                  type="text"
                  name="plateNumber"
                  placeholder="e.g., ABC-1234"
                  value={formData.plateNumber}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.plateNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.plateNumber && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.plateNumber}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Type of Truck *
                </label>
                <select
                  name="truckType"
                  value={formData.truckType}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckType ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                >
                  <option value="" disabled>
                    Select truck type
                  </option>
                  <option value="Closed Van">Closed Van</option>
                  <option value="Wing Van">Wing Van</option>
                  <option value="Dry Van">Dry Van</option>
                  <option value="Refrigerated Truck">Refrigerated Truck</option>
                  <option value="Boom Truck">Boom Truck</option>
                  <option value="Flatbed Truck">Flatbed Truck</option>
                  <option value="Dump Truck">Dump Truck</option>
                  <option value="Trailer Truck">Trailer Truck</option>
                  <option value="Tanker Truck">Tanker Truck</option>
                  <option value="Pickup Truck">Pickup Truck</option>
                  <option value="Other">Other</option>
                </select>
                {errors.truckType && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.truckType}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Truck Model *
                </label>
                <input
                  type="text"
                  name="truckModel"
                  placeholder="e.g., Isuzu NPR / Fuso Canter"
                  value={formData.truckModel}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.truckModel ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.truckModel && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.truckModel}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Capacity *
                </label>
                <input
                  type="text"
                  name="capacity"
                  placeholder="e.g., 5 Tons or 5000 kg"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.capacity ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.capacity && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.capacity}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-black mb-1">
                  Last Checked (MM/DD/YYYY) *
                </label>
                <input
                  type="date"
                  name="lastChecked"
                  value={formData.lastChecked}
                  onChange={handleInputChange}
                  className={`w-full bg-white border rounded-md px-3 py-2 text-xs font-normal text-black focus:outline-none focus:ring-1 focus:ring-blue-600 ${errors.lastChecked ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                />
                {errors.lastChecked && (
                  <p className="text-red-500 text-[11px] mt-1">
                    {errors.lastChecked}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCloseModal}
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
              Add Truck
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FleetStatusPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [truckList, setTruckList] = useState<TruckRecord[]>([]);

  const handleModalSubmit = (newRecord: TruckRecord) => {
    setTruckList((prev) => [newRecord, ...prev]);
  };

  const filteredTrucks = truckList.filter(
    (truck) =>
      truck.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.truckType.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Fleet Status
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Monitor and manage fleet availability, maintenance logs, and truck
            asset statuses.
          </p>
        </div>

        <div className="flex justify-center sm:justify-start w-full sm:w-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-all duration-200 whitespace-nowrap"
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>Add Truck</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by plate number or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-162.5">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Plate Number</th>
                <th className="py-3.5 px-4 sm:px-6">Last Checked</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrucks.length > 0 ? (
                filteredTrucks.map((truck) => (
                  <tr
                    key={truck.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 text-sm text-slate-800"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                      {truck.plateNumber}{" "}
                      <span className="text-xs text-slate-500 font-normal">
                        ({truck.truckType})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">{truck.lastChecked}</td>
                    <td className="py-3.5 px-4 sm:px-6">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {truck.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        No trucks found
                      </p>
                      <p className="text-slate-600 text-xs mt-1 max-w-sm">
                        Truck records will appear here once added via the form
                        or connected to your backend database.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>Showing {filteredTrucks.length} entries</span>
          <div className="flex items-center gap-2">
            <button
              disabled
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <TruckModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmitSuccess={handleModalSubmit}
      />
    </div>
  );
}
