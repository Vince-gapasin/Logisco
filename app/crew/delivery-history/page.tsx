// ==========================================
// LOGISCO - DELIVERY HISTORY PAGE
// ==========================================
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { FileText, Eye, ArrowLeft, Truck, X, AlertTriangle, Camera } from "lucide-react";

export interface PickupRecord {
  warehouse: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  pickupTime: string;
  quantity: string;
}

export interface DeliveryDestinationRecord {
  branch: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  deliveryTime: string;
  quantity: string;
}

export interface DeliveryHistoryRecord {
  id: string | number;
  clientName: string;
  clientEmail?: string;
  bookingId: string;
  address: string;
  dateTime: string;
  status: "Completed";
  // Detailed fields
  scheduledDate: string;
  pickupTime: string;
  deliveryTime: string;
  pickupAddress: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
  driver: string;
  helper: string;
  helper2?: string;
  assignedVehicle: string;
  product: string;
  quantity?: string;
  priorityLevel?: string;
  notes: string;
  multiplePickups?: PickupRecord[];
  multipleDeliveries?: DeliveryDestinationRecord[];
}

export default function DeliveryHistoryPage() {
  // State to manage navigation between list and details view
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryHistoryRecord | null>(null);

  // Report modal states
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportCategory, setReportCategory] = useState<string>("Delivery Delay");
  const [reportDetails, setReportDetails] = useState<string>("");
  const [otherReason, setOtherReason] = useState<string>("");
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Completed trips for the signed-in crew member.
  const [deliveryList, setDeliveryList] = useState<DeliveryHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const records = await apiFetch<any[]>("/api/crew/dispatches");
      const completed = (records ?? [])
        .filter((record) => String(record.status ?? "").toLowerCase() === "completed")
        .map((record) => ({
          ...record,
          status: "Completed" as const,
          dateTime: record.scheduledDate
            ? `${new Date(record.scheduledDate).toLocaleDateString("en-PH", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}${record.timeWindow ? ` • ${record.timeWindow}` : ""}`
            : "Date not recorded",
          scheduledDate: record.scheduledDate || "Not scheduled",
          multipleDeliveries: (record.multipleDeliveries ?? []).map((stop: any) => ({
            branch: stop.branch,
            address: stop.address,
            contactPerson: stop.contactPerson,
            contactNumber: stop.contactNumber,
            deliveryTime: stop.deliveryTime ? String(stop.deliveryTime).slice(0, 5) : "",
            quantity: stop.quantity ?? "",
          })),
        })) as DeliveryHistoryRecord[];

      setDeliveryList(completed);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load delivery history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);


  // Pagination Math
  const totalPages = Math.ceil(deliveryList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDeliveries = deliveryList.slice(startIndex, endIndex);

  // Handle row click to open the full-page details view
  const handleRowClick = (delivery: DeliveryHistoryRecord) => {
    setSelectedDelivery(delivery);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setReportImage(imageUrl);
    }
  };

  const handleSendReport = async () => {
    if (!selectedDelivery) return;

    const category = reportCategory === "Other" && otherReason ? otherReason : reportCategory;
    const isVehicleIssue = /vehicle|truck|breakdown/i.test(category);

    try {
      await apiFetch("/api/crew/dispatches/report", {
        method: "POST",
        body: JSON.stringify({
          dispatchID: selectedDelivery.id,
          tripRemarks: `[${category}] ${reportDetails}`.trim(),
          vehicleIssues: isVehicleIssue ? reportDetails : "",
        }),
      });

      setReportSubmitted(true);
      setTimeout(() => {
        setReportSubmitted(false);
        setShowReportModal(false);
        setReportDetails("");
        setOtherReason("");
        setReportImage(null);
      }, 2000);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send report.");
    }
  };

  // ==========================================
  // DELIVERY DETAILS FULL VIEW
  // ==========================================
  if (selectedDelivery) {
    return (
      <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans animate-fade-in">
        {/* Header with Back button and Report Button (Absolute positioning for mobile) */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3 pr-24 sm:pr-0">
            <button
              onClick={() => setSelectedDelivery(null)}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Back to History List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Delivery Information Record
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Complete profile and history details for booking {selectedDelivery.bookingId}.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowReportModal(true)}
            className="absolute top-0 right-0 sm:static px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Report</span>
          </button>
        </div>

        {/* Main Card Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          {/* Profile Summary Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shrink-0">
                <Truck className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {selectedDelivery.bookingId} — {selectedDelivery.clientName}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    {selectedDelivery.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Content Sections */}
          <div className="space-y-6 text-sm text-slate-900">
            
            {/* 1. Client Information */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                1. Client Information
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Company / Client Name</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.clientName}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Contact Person</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.contactPerson}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Contact Number</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.contactNumber}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Email Address</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">
                    {selectedDelivery.clientEmail || "admin@client.com"}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-black mb-1">Business Address</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 truncate">
                    {selectedDelivery.address}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Booking Details */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                2. Booking Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Delivery Schedule</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.scheduledDate}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Product Delivered</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.product}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Quantity</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.quantity || "3,500 lbs"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Priority Level</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-semibold text-slate-900">
                    {selectedDelivery.priorityLevel || "Standard"}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Assigned Delivery Crew & Vehicle */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                3. Assigned Delivery Crew & Vehicle
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Truck Plate No.</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.assignedVehicle}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Driver</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.driver}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Helper #1</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.helper}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Helper #2</label>
                  <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900">
                    {selectedDelivery.helper2 || "None"}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Pickup Address (Single Pickup Only) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                4. Pickup Address
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1 text-xs">
                <span className="font-semibold text-slate-900">{selectedDelivery.multiplePickups?.[0]?.warehouse || selectedDelivery.pickupAddress}</span>
                <span className="text-slate-600">{selectedDelivery.multiplePickups?.[0]?.address || selectedDelivery.pickupAddress}</span>
                <span className="text-slate-600">Contact: {selectedDelivery.multiplePickups?.[0]?.contactPerson || selectedDelivery.contactPerson} ({selectedDelivery.multiplePickups?.[0]?.contactNumber || selectedDelivery.contactNumber})</span>
                <span className="text-slate-600">Pickup time: {selectedDelivery.multiplePickups?.[0]?.pickupTime || selectedDelivery.pickupTime}</span>
              </div>
            </div>

            {/* 5. Delivery Address (Multiple Destinations Support) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                5. Delivery Address
              </div>
              <div className="space-y-3">
                {selectedDelivery.multipleDeliveries && selectedDelivery.multipleDeliveries.length > 0 ? (
                  selectedDelivery.multipleDeliveries.map((deliv, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1 text-xs">
                      <span className="text-blue-600 font-bold mb-0.5">Delivery Address #{idx + 1}</span>
                      <span className="font-semibold text-slate-900">{deliv.branch}</span>
                      <span className="text-slate-600">{deliv.address}</span>
                      <span className="text-slate-600">Contact: {deliv.contactPerson} ({deliv.contactNumber})</span>
                      <span className="text-slate-600">Delivery time: {deliv.deliveryTime}</span>
                      <span className="text-slate-600 font-medium">Quantity: {deliv.quantity}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1 text-xs">
                    <span className="text-blue-600 font-bold mb-0.5">Delivery Address #1</span>
                    <span className="font-semibold text-slate-900">{selectedDelivery.clientName}</span>
                    <span className="text-slate-600">{selectedDelivery.deliveryAddress}</span>
                    <span className="text-slate-600">Contact: {selectedDelivery.contactPerson} ({selectedDelivery.contactNumber})</span>
                    <span className="text-slate-600">Delivery time: {selectedDelivery.deliveryTime}</span>
                    <span className="text-slate-600 font-medium">Quantity: {selectedDelivery.quantity || "3,500 lbs"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 6. Notes / Instructions */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                6. Notes / Instructions
              </div>
              <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 min-h-12.5 leading-relaxed">
                {selectedDelivery.notes}
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================
            REPORT POPUP MODAL (INSIDE RECORD VIEW)
        ======================================================== */}
        {showReportModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-slate-900">Report an Issue</h3>
                <button onClick={() => setShowReportModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {reportSubmitted ? (
                <div className="py-8 text-center text-emerald-600 font-bold text-base">
                  Report submitted successfully.
                </div>
              ) : (
                <>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p><strong className="text-slate-900">Booking ID:</strong> {selectedDelivery.bookingId}</p>
                    <p><strong className="text-slate-900">Report Type:</strong> {reportCategory}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-2">What would you like to report?</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {["Booking Issue", "Delivery Delay", "Wrong / Missing Items", "Damaged Items", "Vehicle Issue", "Customer / Receiver Issue", "Other"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setReportCategory(cat)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                            reportCategory === cat
                              ? "bg-red-50 border-red-600 text-red-700 ring-1 ring-red-600"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    {reportCategory === "Other" && (
                      <div className="mt-2.5">
                        <input
                          type="text"
                          value={otherReason}
                          onChange={(e) => setOtherReason(e.target.value)}
                          placeholder="Please specify other issue..."
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">Additional Details</label>
                    <textarea
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Please describe the issue or provide additional information..."
                      className="w-full border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-22.5"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">Attach Image for Proof</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer transition-colors w-full">
                        <Camera className="w-4 h-4 text-slate-500" />
                        <span>{reportImage ? "Change Image" : "Upload Image"}</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    </div>
                    {reportImage && (
                      <div className="relative mt-2 w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                        <img src={reportImage} alt="Proof preview" className="w-full h-full object-cover" />
                        <button onClick={() => setReportImage(null)} className="absolute top-1 right-1 bg-slate-900/70 text-white rounded-full p-0.5 hover:bg-slate-900">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => setShowReportModal(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendReport}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-black text-white font-semibold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                    >
                      Submit Report
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // DELIVERY HISTORY VIEW (LIST)
  // ==========================================
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            My Delivery History
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            View all past delivery history records.
          </p>
        </div>
      </div>

      {/* Data Container Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-6 w-[60%]">Delivery Information</th>
                <th className="py-3.5 px-6 w-[40%] text-right">Status & Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
              {currentDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-16 sm:py-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-slate-900 font-medium text-sm">
                        {isLoading ? "Loading delivery history..." : "No history found"}
                      </p>
                      {loadError && (
                        <p className="text-red-600 text-xs mt-2">{loadError}</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentDeliveries.map((delivery) => (
                  <tr
                    key={delivery.id}
                    onClick={() => handleRowClick(delivery)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-4 px-6 w-[60%] overflow-hidden">
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base mb-1 truncate">
                        {delivery.clientName}
                      </div>
                      <div className="text-xs font-semibold text-slate-600 mb-1">
                        {delivery.bookingId}
                      </div>
                      <div className="text-xs text-slate-500 mb-1 truncate w-full" title={delivery.address}>
                        {delivery.address}
                      </div>
                      <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                        {delivery.dateTime}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-right align-middle w-[40%]">
                      <div className="flex flex-col items-end justify-center gap-1.5 sm:gap-2">
                        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:underline whitespace-nowrap">
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>Click to View</span>
                        </span>
                        <span className="inline-flex items-center justify-center px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap">
                          {delivery.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
          <span>
            Showing {deliveryList.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, deliveryList.length)} of{" "}
            {deliveryList.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage === 1
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Previous
            </button>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors ${
                currentPage === totalPages || totalPages === 0
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}