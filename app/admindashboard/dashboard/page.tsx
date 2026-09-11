/* eslint-disable react-hooks/exhaustive-deps */
// ==========================================
// MAIN DASHBOARD PAGE FOR ADMIN USERS
// ==========================================
"use client";
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
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
  Filter,
  ChevronDown,
} from "lucide-react";

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
    route: "/admindashboard/feeds/pending",
  },
  {
    name: "In-Transit",
    icon: Truck,
    color: "blue",
    statusLabel: "In-Transit",
    route: "/admindashboard/feeds/in-transit",
  },
  {
    name: "Completed",
    icon: CheckCircle2,
    color: "green",
    statusLabel: "Delivered",
    route: "/admindashboard/feeds/completed",
  },
  {
    name: "Foul Trip",
    icon: AlertTriangle,
    color: "red",
    statusLabel: "Foul Trip",
    route: "/admindashboard/feeds/foul-trip",
  },
];

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
        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">
          Booking Generated Successfully!
        </h3>
        <p className="text-sm font-semibold text-blue-600 mb-3">
          Order ID: {orderCode}
        </p>
        <p className="text-xs text-slate-600 mb-6">
          Your booking has been generated successfully.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm transition-colors shadow-md"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ==========================================
// VIEW BOOKING MODAL (READ-ONLY)
// ==========================================

function ViewOrderModal({
  isOpen,
  onClose,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}) {
  if (!isOpen || !order) return null;

  const raw = order.rawOrder || {};
  const notes = raw.notes || "";
  const category = order.statusCategory;
  const currentStep = order.currentStep || 0;

  const clientInfo = raw.Client || raw.client || {};
  const cName =
    clientInfo.company ||
    clientInfo.companyName ||
    notes.match(/Name:\s*(.*)/)?.[1] ||
    order.client ||
    "Walk-in Customer";
  const cPerson =
    clientInfo.contactName ||
    clientInfo.contactPerson ||
    notes.match(/Contact:\s*(.*?)\s*\(/)?.[1] ||
    "N/A";
  const cNum =
    clientInfo.contact ||
    clientInfo.contactNumber ||
    notes.match(/\((.*?)\)/)?.[1] ||
    "N/A";
  const cEmail =
    clientInfo.emailAdd || clientInfo.emailAddress || clientInfo.email || "N/A";
  const cAddr =
    clientInfo.businessAdd ||
    clientInfo.businessAddress ||
    clientInfo.address ||
    "N/A";

  const priority = notes.match(/Priority:\s*(.*)/)?.[1] || "Standard";
  const reqDate =
    notes.match(/Request Date:\s*(.*)/)?.[1] ||
    new Date(raw.createdAt).toLocaleDateString();
  const delSchedule = notes.match(/Delivery Schedule:\s*(.*)/)?.[1] || "N/A";

  const pickupLine = notes.match(/Pickup:\s*(.*)/)?.[1] || "N/A @ N/A";
  const pickupParts = pickupLine.split(" @ ");
  const pickupAddr = pickupParts[0]?.trim() || "N/A";
  const pickupTime = pickupParts[1]?.trim() || "N/A";

  const dispatchRecord = Array.isArray(raw.DispatchOrder)
    ? raw.DispatchOrder[0]
    : raw.DispatchOrder || raw.dispatch_order;

  const dispatchNote = dispatchRecord?.dispatchNote || "";
  const podUrl = dispatchRecord?.pod_url || "";

  const truck =
    dispatchRecord?.Truck?.plateNumber ||
    notes.match(/Truck:\s*(.*)/)?.[1] ||
    "Unassigned";
  const driver =
    dispatchRecord?.Driver?.employeeName ||
    notes.match(/Driver:\s*(.*)/)?.[1] ||
    "Unassigned";
  const h1 =
    dispatchRecord?.Helper1?.employeeName ||
    notes.match(/Helper 1:\s*(.*)/)?.[1] ||
    "None";
  const h2 =
    dispatchRecord?.Helper2?.employeeName ||
    notes.match(/Helper 2:\s*(.*)/)?.[1] ||
    "None";

  const actualNotesParts = notes.split("[NOTES]");
  const actualNotes =
    actualNotesParts.length > 1 ? actualNotesParts[1].trim() : "None";

  const itemsArr =
    raw.OrderDetails || raw.orderdetails || raw.order_details || [];
  const product = itemsArr[0]?.productName || order.product || "Multiple Items";
  const quantity = itemsArr[0]?.quantity || 1;

  const stopsArr = raw.BranchStops || raw.branchstops || raw.branch_stops || [];
  const deliveries =
    stopsArr.length > 0
      ? stopsArr
      : [
          {
            branchName: "N/A",
            deliveryAddress: "N/A",
            contactPerson: cPerson,
            contactNum: cNum,
            expectedTime: "N/A",
            quantity: quantity,
            stopStatus: "Pending",
          },
        ];

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 cursor-default focus:outline-none";

  const headerColors = {
    "Pending Bookings": "bg-[#000c31] border-slate-800",
    "In-Transit": "bg-blue-600 border-blue-800",
    Completed: "bg-green-600 border-green-800",
    "Foul Trip": "bg-red-600 border-red-800",
  };
  const headerClass =
    headerColors[category as keyof typeof headerColors] ||
    headerColors["Pending Bookings"];

  // Determine dynamic Status Banner Configuration
  let bannerBg = "bg-slate-50 border-slate-200 text-slate-800";
  let bannerContent = null;

  if (category === "Pending Bookings") {
    const hasDriver = driver && driver !== "Unassigned" && driver !== "N/A";
    
    if (!hasDriver) {
      bannerBg = "bg-amber-50 border-amber-200 text-amber-800";
      bannerContent = <><AlertTriangle className="w-5 h-5 text-amber-600" /> Assign Crew</>;
    } else if (dispatchRecord?.status === "Accepted") {
      bannerBg = "bg-blue-50 border-blue-200 text-blue-800";
      bannerContent = <><Clock className="w-5 h-5 text-blue-600" /> Waiting Crew Dispatch</>;
    } else {
      bannerBg = "bg-orange-50 border-orange-200 text-orange-800";
      bannerContent = <><Clock className="w-5 h-5 text-orange-600" /> Pending Crew</>;
    }
  } else if (category === "In-Transit") {
    bannerBg = "bg-blue-50 border-blue-200 text-blue-800";
    bannerContent = (
      <>
        <Truck className="w-5 h-5 text-blue-600 animate-pulse" />
        {currentStep === 1
          ? "Heading to Warehouse (Pickup in Progress)"
          : currentStep > 1
            ? "Products Loaded (Delivering to Destination)"
            : "Awaiting Departure from Base"}
      </>
    );
  } else if (category === "Completed") {
    bannerBg = "bg-green-50 border-green-200 text-green-800";
    bannerContent = (
      <>
        <CheckCircle2 className="w-5 h-5 text-green-600" /> Delivery Completed
      </>
    );
  } else if (category === "Foul Trip") {
    bannerBg = "bg-red-50 border-red-200 text-red-800";
    bannerContent = (
      <>
        <AlertTriangle className="w-5 h-5 text-red-600" /> Foul Trip / Cancelled
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
        <div
          className={`flex items-center justify-between px-6 py-4 text-white border-b transition-colors ${headerClass}`}
        >
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Booking Details: {order.orderId}
            </h2>
            <p className="text-xs font-medium opacity-80 mt-0.5">
              Created on {new Date(raw.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-black/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto text-sm text-slate-900">
          
          {/* DYNAMIC STATUS BANNER */}
          <div className={`px-4 py-3 rounded-xl mb-6 flex items-center gap-2 text-sm font-bold shadow-sm border ${bannerBg}`}>
            {bannerContent}
          </div>

          <div className="space-y-6">
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                1. Client Information
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Company Name
                  </label>
                  <input readOnly value={cName} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Contact Person
                  </label>
                  <input readOnly value={cPerson} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Contact Number
                  </label>
                  <input readOnly value={cNum} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Email Address
                  </label>
                  <input readOnly value={cEmail} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Business Address
                  </label>
                  <input readOnly value={cAddr} className={inputClass} />
                </div>
              </div>
            </div>

            {/* PICKUP ADDRESS TABLE WITH LIVE CARGO STATUS */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex justify-between items-center">
                <span>2. Pickup Address</span>
                <span className="text-xs text-slate-500 font-normal">Warehouse Cargo Status</span>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs min-w-150">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                      <th className="p-2.5 border-r border-slate-200 w-[18%]">
                        Warehouse Name
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[24%]">
                        Address
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Person
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Number
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[10%]">
                        Pick Up Time
                      </th>
                      <th className="p-2.5 border-r border-slate-200 text-center w-[8%]">
                        Quantity
                      </th>
                      <th className="p-2.5 text-center w-[10%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200 font-medium text-slate-700">
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        Origin Location
                      </td>
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        {pickupAddr}
                      </td>
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        {cPerson}
                      </td>
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        {cNum}
                      </td>
                      <td className="p-2 border-r border-slate-200 bg-slate-50">
                        {pickupTime}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center bg-slate-50">
                        {quantity}
                      </td>
                      <td className="p-2 text-center bg-slate-50">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            category === "Completed" || currentStep > 1
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : currentStep === 1
                                ? "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {category === "Completed" || currentStep > 1
                            ? "Picked Up"
                            : currentStep === 1
                              ? "En Route to Pickup"
                              : "Awaiting Pickup"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* DELIVERY ITINERARY WITH DYNAMIC PROGRESS */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                3. Delivery Itinerary & Status
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs min-w-150">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-black font-semibold">
                      <th className="p-2.5 border-r border-slate-200 w-[20%]">
                        Branch Name
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[20%]">
                        Delivery Address
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Person
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Number
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[10%]">
                        Expected Time
                      </th>
                      <th className="p-2.5 border-r border-slate-200 text-center w-[10%]">
                        Quantity
                      </th>
                      <th className="p-2.5 text-center w-[10%]">Stop Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d: any, idx: number) => {
                      const stopStepIndex = 2 + idx; 
                      const isStopDelivered = category === "Completed" || currentStep > stopStepIndex;
                      const isStopOngoing = category === "In-Transit" && currentStep === stopStepIndex;
                      
                      let stopLabel = isStopDelivered
                        ? "Delivered"
                        : isStopOngoing
                          ? "Ongoing Delivery"
                          : "Pending";

                      let badgeClass = "bg-orange-100 text-orange-700";
                      if (isStopDelivered) badgeClass = "bg-green-100 text-green-700";
                      else if (isStopOngoing) badgeClass = "bg-blue-100 text-blue-700 animate-pulse";
                      else if (category === "Foul Trip") badgeClass = "bg-red-100 text-red-700";

                      return (
                        <tr
                          key={idx}
                          className="border-b border-slate-200 font-medium text-slate-700"
                        >
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.branchName || "Branch"}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.deliveryAddress || d.branchName || "N/A"}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.contactPerson || cPerson}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.contactNum || d.contactNumber || cNum}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {d.expectedTime || "N/A"}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center bg-slate-50">
                            {d.quantity || quantity}
                          </td>
                          <td className="p-2 text-center bg-slate-50">
                            <span
                              className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
                            >
                              {stopLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                4. Booking Details & Schedule
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Request Date
                  </label>
                  <input readOnly value={reqDate} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Delivery Schedule
                  </label>
                  <input readOnly value={delSchedule} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Product To Deliver
                  </label>
                  <input readOnly value={product} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Priority Level
                  </label>
                  <input readOnly value={priority} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                5. Assigned Delivery Crew & Vehicle
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Truck Plate No.
                  </label>
                  <input readOnly value={truck} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Driver
                  </label>
                  <input readOnly value={driver} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Helper #1
                  </label>
                  <input readOnly value={h1} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Helper #2
                  </label>
                  <input readOnly value={h2} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                6. Notes / Instructions
              </div>
              <textarea
                readOnly
                rows={3}
                value={actualNotes}
                className="w-full resize-y bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none cursor-default"
              />
            </div>
            
            {/* 7. COMPLETION / EMERGENCY SUMMARY PANEL */}
            {(category === "Completed" || category === "Foul Trip") && (dispatchNote || podUrl) && (
              <div className={`border rounded-xl p-4 shadow-xs ${category === "Foul Trip" ? 'border-red-200 bg-red-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
                <div className={`border-b pb-2 mb-4 font-semibold text-sm tracking-wide flex items-center gap-2 ${category === "Foul Trip" ? 'border-red-200 text-red-900' : 'border-emerald-200 text-emerald-900'}`}>
                  {category === "Foul Trip" ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {category === "Foul Trip" ? "7. Emergency / Abort Summary" : "7. Completion Summary"}
                </div>
                <div className="space-y-4">
                  {dispatchNote && (
                    <div>
                      <span className={`block text-xs font-semibold mb-2 ${category === "Foul Trip" ? 'text-red-800' : 'text-emerald-800'}`}>Crew Remarks / Feedback</span>
                      <div className={`w-full bg-white border rounded-md px-4 py-3 text-sm shadow-sm leading-relaxed overflow-hidden whitespace-pre-wrap ${category === "Foul Trip" ? 'border-red-200 text-red-900 font-medium' : 'border-emerald-200 text-slate-800'}`}>
                        {dispatchNote.replace(/\[DELIVERY DETAILS\][\s\S]*?(?=\[|$)/gi, '').replace(/\[ASSIGNED CREW\][\s\S]*?(?=\[|$)/gi, '').trim() || "No additional remarks logged."}
                      </div>
                    </div>
                  )}
                  {podUrl && (
                    <div>
                      <span className={`block text-xs font-semibold mb-2 ${category === "Foul Trip" ? 'text-red-800' : 'text-emerald-800'}`}>Attached Proof / Photo</span>
                      <img 
                        src={podUrl} 
                        alt="Uploaded Proof" 
                        className={`w-full max-w-sm h-auto object-cover rounded-xl border shadow-sm ${category === "Foul Trip" ? 'border-red-200' : 'border-emerald-200'}`} 
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className={`w-full sm:w-auto px-8 py-2.5 text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer ${
              category === "In-Transit"
                ? "bg-blue-600 hover:bg-blue-700"
                : category === "Completed"
                  ? "bg-green-600 hover:bg-green-700"
                  : category === "Foul Trip"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#000c31] hover:bg-slate-800"
            }`}
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

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
    : clients;

  const handleClose = () => {
    setSearchTerm("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg relative p-6 sm:p-10 flex flex-col items-center text-center max-h-[90vh]">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 tracking-tight shrink-0">
          Select Registered Client
        </h2>
        <div className="relative w-full max-w-md mb-5 shrink-0">
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
          <div className="w-full max-w-md mb-6 animate-fade-in overflow-hidden flex flex-col">
            <div className="text-left font-bold text-slate-800 text-xs mb-1.5 ml-1 shrink-0">
              {searchTerm.trim() ? "Results" : "All Registered Clients"}
            </div>
            <div className="border border-slate-300 rounded-lg shadow-sm overflow-y-auto max-h-[40vh] feed-scrollbar">
              <table className="w-full text-left border-collapse bg-white relative">
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
          className="mt-2 bg-blue-600 hover:bg-black px-6 py-2.5 text-white font-bold rounded-lg text-sm shadow-md transition-colors duration-200 w-full sm:w-auto shrink-0"
        >
          Create Booking for New Client
        </button>
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
  subcontractors: any[];
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
  subcontractors,
  preSelectedClientID,
  onSubmitSuccess,
}: BookingModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const initialFormState = {
    clientID: "",
    clientName: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
    requestDate: currentDate,
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
    subconPartner: "",
    truckPlate: "",
    driver: "",
    helper1: "",
    helper2: "",
    notes: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [isSubconMode, setIsSubconMode] = useState(false);
  const [availableTrucks, setAvailableTrucks] = useState<any[]>(trucks);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>(drivers);
  const [availableHelpers, setAvailableHelpers] = useState<any[]>(helpers);
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
  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    setAvailableTrucks(trucks);
    setAvailableDrivers(drivers);
    setAvailableHelpers(helpers);
  }, [trucks, drivers, helpers]);

  useEffect(() => {
    const fetchAvailable = async () => {
      if (!formData.deliverySchedule) return;
      try {
        const res = await apiFetch<any>(
          `/api/dispatch/available-resources?date=${formData.deliverySchedule}`,
        );
        if (res && res.data) {
          const fetchedTrucks = (res.data.trucks || []).map((t: any) => ({
            ...t,
            truckID: t.truckID || t.id,
            plateNumber: t.plateNumber || t.plate_number || "Unknown",
          }));
          const fetchedDrivers = (res.data.drivers || []).map((d: any) => ({
            ...d,
            employeeID: d.employeeID || d.id,
            employeeName:
              d.employeeName ||
              `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
              "Unknown",
          }));
          const fetchedHelpers = (res.data.helpers || []).map((h: any) => ({
            ...h,
            employeeID: h.employeeID || h.id,
            employeeName:
              h.employeeName ||
              `${h.firstName || ""} ${h.lastName || ""}`.trim() ||
              "Unknown",
          }));

          setAvailableTrucks(fetchedTrucks);
          setAvailableDrivers(fetchedDrivers);
          setAvailableHelpers(fetchedHelpers);

          // Auto-populate the first available resources
          setFormData((prev) => ({
            ...prev,
            truckPlate: fetchedTrucks.length > 0 ? fetchedTrucks[0].truckID : "",
            driver: fetchedDrivers.length > 0 ? fetchedDrivers[0].employeeID : "",
            helper1: fetchedHelpers.length > 0 ? fetchedHelpers[0].employeeID : "",
            helper2: fetchedHelpers.length > 1 ? fetchedHelpers[1].employeeID : "",
          }));
        }
      } catch (error) {
        console.error("Failed to load resources for this date:", error);
      }
    };
    fetchAvailable();
  }, [formData.deliverySchedule]);

  useEffect(() => {
    if (isOpen) {
      setIsSubconMode(false);
      if (preSelectedClientID) {
        const client = clients.find((c) => c.clientID === preSelectedClientID);
        setFormData({
          ...initialFormState,
          clientID: preSelectedClientID,
          clientName: client ? client.company : "",
          contactPerson: client ? client.contactName : "",
          contactNumber: client ? client.contact : "",
          emailAddress: client ? client.emailAdd || client.emailAddress || "" : "",
          businessAddress: client ? client.businessAdd || client.businessAddress || "" : "",
          requestDate: new Date().toISOString().split("T")[0],
          deliverySchedule: "",
        });
      } else {
        setFormData({
          ...initialFormState,
          requestDate: new Date().toISOString().split("T")[0],
          deliverySchedule: "",
        });
      }
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
  }, [isOpen, preSelectedClientID, clients]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePickupChange = (index: number, field: string, value: string) => {
    const updated = [...pickupList];
    updated[index][field] = value;
    setPickupList(updated);
    if (errors[`pickup_${index}_${field}`])
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`pickup_${index}_${field}`];
        return newErrors;
      });
  };

  const handleDeliveryChange = (index: number, field: string, value: string) => {
    const updated = [...deliveryList];
    updated[index][field] = value;
    setDeliveryList(updated);
    if (errors[`delivery_${index}_${field}`])
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`delivery_${index}_${field}`];
        return newErrors;
      });
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
        deliveryTime: "",
        quantity: "",
      },
    ]);
  const removeDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryList(deliveryList.filter((_, idx) => idx !== index));
    setDeleteConfirm((prev) => ({ ...prev, [`delivery-${index}`]: false }));
  };

  const handleWarehouseSelect = (index: number, selectedName: string) => {
    const selectedClientRecord = preSelectedClientID
      ? clients.find((c) => c.clientID === preSelectedClientID)
      : null;
    const registeredWarehouses =
      selectedClientRecord?.Warehouse || selectedClientRecord?.warehouses || [];
    const matchedWarehouse = registeredWarehouses.find(
      (w: any) => (w.whName || w.warehouseName) === selectedName
    );
    const updated = [...pickupList];
    updated[index] = {
      ...updated[index],
      warehouseName: selectedName,
      warehouseAddress: matchedWarehouse
        ? matchedWarehouse.warehouseLoc || matchedWarehouse.warehouseAddress || ""
        : "",
      contactPerson: matchedWarehouse ? matchedWarehouse.contactPerson || "" : "",
      contactNumber: matchedWarehouse
        ? matchedWarehouse.contactNum || matchedWarehouse.contactNumber || ""
        : "",
    };
    setPickupList(updated);
    setErrors((prev) => {
      const newErrors = { ...prev };
      ["warehouseName", "warehouseAddress", "contactPerson", "contactNumber"].forEach(
        (field) => delete newErrors[`pickup_${index}_${field}`]
      );
      return newErrors;
    });
  };

  const handleBranchSelect = (index: number, selectedName: string) => {
    const selectedClientRecord = preSelectedClientID
      ? clients.find((c) => c.clientID === preSelectedClientID)
      : null;
    const registeredBranches =
      selectedClientRecord?.Branch || selectedClientRecord?.branches || [];
    const matchedBranch = registeredBranches.find(
      (b: any) => b.branchName === selectedName
    );
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
    setErrors((prev) => {
      const newErrors = { ...prev };
      ["branchName", "deliveryAddress", "contactPerson", "contactNumber"].forEach(
        (field) => delete newErrors[`delivery_${index}_${field}`]
      );
      return newErrors;
    });
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};
    if (!formData.clientName.trim()) newErrors.clientName = "Client Name is required.";
    if (!formData.contactPerson.trim()) newErrors.contactPerson = "Contact person is required.";
    if (!formData.contactNumber.trim()) newErrors.contactNumber = "Contact number is required.";
    if (!formData.deliverySchedule) newErrors.deliverySchedule = "Delivery schedule is required.";
    if (!formData.product.trim()) newErrors.product = "Product description is required.";
    if (!formData.priorityLevel) newErrors.priorityLevel = "Priority level is required.";

    pickupList.forEach((p, idx) => {
      if (!p.warehouseName.trim()) newErrors[`pickup_${idx}_warehouseName`] = "Required";
      if (!p.warehouseAddress.trim()) newErrors[`pickup_${idx}_warehouseAddress`] = "Required";
      if (!p.contactPerson.trim()) newErrors[`pickup_${idx}_contactPerson`] = "Required";
      if (!p.contactNumber.trim()) newErrors[`pickup_${idx}_contactNumber`] = "Required";
      if (!p.pickupTime) newErrors[`pickup_${idx}_pickupTime`] = "Required";
      if (!p.quantity.toString().trim()) newErrors[`pickup_${idx}_quantity`] = "Required";
    });

    deliveryList.forEach((d, idx) => {
      if (!d.branchName.trim()) newErrors[`delivery_${idx}_branchName`] = "Required";
      if (!d.deliveryAddress.trim()) newErrors[`delivery_${idx}_deliveryAddress`] = "Required";
      if (!d.contactPerson.trim()) newErrors[`delivery_${idx}_contactPerson`] = "Required";
      if (!d.contactNumber.trim()) newErrors[`delivery_${idx}_contactNumber`] = "Required";
      if (!d.deliveryTime) newErrors[`delivery_${idx}_deliveryTime`] = "Required";
      if (!d.quantity.toString().trim()) newErrors[`delivery_${idx}_quantity`] = "Required";
    });

    if (isSubconMode && !formData.subconPartner)
      newErrors.subconPartner = "Subcon partner is required.";
    if (!isSubconMode && !formData.truckPlate)
      newErrors.truckPlate = "Truck plate number is required.";
    if (!isSubconMode && !formData.driver)
      newErrors.driver = "Driver assignment is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const selectedTruck = availableTrucks.find((t) => t.truckID === formData.truckPlate);
    const selectedDriver = availableDrivers.find((d) => d.employeeID === formData.driver);
    const selectedHelper1 = availableHelpers.find((h) => h.employeeID === formData.helper1);
    const selectedHelper2 = availableHelpers.find((h) => h.employeeID === formData.helper2);

    onSubmitSuccess({
      ...formData,
      emailAddress: formData.emailAddress.trim() || "N/A",
      businessAddress: formData.businessAddress.trim() || "N/A",
      pickupList,
      deliveryList,
      resolvedNames: {
        truck: selectedTruck ? selectedTruck.plateNumber : formData.truckPlate,
        driver: selectedDriver ? selectedDriver.employeeName : formData.driver,
        helper1: selectedHelper1 ? selectedHelper1.employeeName : formData.helper1,
        helper2: selectedHelper2 ? selectedHelper2.employeeName : formData.helper2,
      },
    });
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
    <>
      <style>{`.btn-booking-cancel { background-color: oklch(63.7% 0.237 25.331); } .btn-booking-cancel:hover { background-color: black !important; color: white !important; } .btn-booking-generate { background-color: oklch(54.6% 0.245 262.881); } .btn-booking-generate:hover { background-color: black !important; color: white !important; }`}</style>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
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
            {/* Client Info */}
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
                    Company Name *
                  </label>
                  {preSelectedClientID ? (
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold text-slate-700 truncate">
                      {formData.clientName}
                    </div>
                  ) : (
                    <input
                      type="text"
                      name="clientName"
                      placeholder="e.g., Acme Corp"
                      value={formData.clientName}
                      onChange={handleChange}
                      className={`w-full border rounded-md px-3 py-2 text-xs ${errors.clientName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                    />
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
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.contactPerson ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Contact Number *
                  </label>
                  <input
                    type="text"
                    name="contactNumber"
                    placeholder="e.g., 09123456789"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Email Address
                  </label>
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
                  <label className="block text-xs font-medium text-black mb-1">
                    Business Address
                  </label>
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
                <span className="font-semibold text-black text-sm tracking-wide">
                  2. Pickup Addresses *
                </span>
                <button
                  type="button"
                  onClick={addPickupRow}
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
                      <th className="p-2.5 border-r border-slate-200 w-[20%]">
                        Warehouse Name *
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[25%]">
                        Address *
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
                        Quantity*
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
                          {preSelectedClientID ? (
                            <select
                              value={row.warehouseName}
                              onChange={(e) => handleWarehouseSelect(idx, e.target.value)}
                              className="w-full bg-transparent border rounded px-1.5 py-1"
                            >
                              <option value="">Select Warehouse</option>
                              {registeredWarehouses.map((w: any, i: number) => (
                                <option key={i} value={w.whName || w.warehouseName}>
                                  {w.whName || w.warehouseName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Warehouse Name"
                              value={row.warehouseName}
                              onChange={(e) => handlePickupChange(idx, "warehouseName", e.target.value)}
                              className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_warehouseName`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                            />
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Full Address"
                            value={row.warehouseAddress}
                            onChange={(e) => handlePickupChange(idx, "warehouseAddress", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_warehouseAddress`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Contact Person"
                            value={row.contactPerson}
                            onChange={(e) => handlePickupChange(idx, "contactPerson", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_contactPerson`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="09XX-XXX-XXXX"
                            value={row.contactNumber}
                            onChange={(e) => handlePickupChange(idx, "contactNumber", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_contactNumber`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="time"
                            value={row.pickupTime}
                            onChange={(e) => handlePickupChange(idx, "pickupTime", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_pickupTime`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="number"
                            placeholder="0"
                            value={row.quantity}
                            onChange={(e) => handlePickupChange(idx, "quantity", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 min-w-15 ${errors[`pickup_${idx}_quantity`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removePickupRow(idx)}
                            disabled={pickupList.length === 1}
                            className="p-1.5 hover:text-red-700 disabled:opacity-50"
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
                        Quantity*
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
                          {preSelectedClientID ? (
                            <select
                              value={row.branchName}
                              onChange={(e) => handleBranchSelect(idx, e.target.value)}
                              className="w-full bg-transparent border rounded px-1.5 py-1"
                            >
                              <option value="">Select Branch</option>
                              {registeredBranches.map((b: any, i: number) => (
                                <option key={i} value={b.branchName}>
                                  {b.branchName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Branch Name"
                              value={row.branchName}
                              onChange={(e) => handleDeliveryChange(idx, "branchName", e.target.value)}
                              className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_branchName`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                            />
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Full Address"
                            value={row.deliveryAddress}
                            onChange={(e) => handleDeliveryChange(idx, "deliveryAddress", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_deliveryAddress`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Contact Person"
                            value={row.contactPerson}
                            onChange={(e) => handleDeliveryChange(idx, "contactPerson", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_contactPerson`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="09XX-XXX-XXXX"
                            value={row.contactNumber}
                            onChange={(e) => handleDeliveryChange(idx, "contactNumber", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_contactNumber`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="time"
                            value={row.deliveryTime}
                            onChange={(e) => handleDeliveryChange(idx, "deliveryTime", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_deliveryTime`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="number"
                            placeholder="0"
                            value={row.quantity}
                            onChange={(e) => handleDeliveryChange(idx, "quantity", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-1 min-w-15 ${errors[`delivery_${idx}_quantity`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeDeliveryRow(idx)}
                            disabled={deliveryList.length === 1}
                            className="p-1.5 hover:text-red-700 disabled:opacity-50"
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
                    placeholder="e.g., 50 boxes of tile"
                    value={formData.product}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.product ? "border-red-500" : "border-slate-300"}`}
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
                  5. Assign Delivery Crews & Vehicle{" "}
                  {isSubconMode && "(Subcon)"}
                </span>
                <div className="flex gap-4">
                  {isSubconMode ? (
                    <button
                      type="button"
                      onClick={() => setIsSubconMode(false)}
                      className="text-xs text-blue-600 underline hover:text-blue-800"
                    >
                      Assign to Own Resources
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSubconMode(true)}
                      className="text-xs text-blue-600 underline hover:text-blue-800"
                    >
                      Assign to Subcon Partner
                    </button>
                  )}
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
                      className={`w-full border rounded-md px-3 py-2 text-xs ${errors.subconPartner ? "border-red-500" : "border-slate-300"}`}
                    >
                      <option value="" disabled>
                        Select partner
                      </option>
                      {subcontractors.map((s: any) => (
                        <option
                          key={s.id || s.companyName}
                          value={s.companyName}
                        >
                          {s.companyName}
                        </option>
                      ))}
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
                      <option value="" disabled>
                        Select truck
                      </option>
                      {availableTrucks.map((t) => (
                        <option key={t.truckID} value={t.truckID}>
                          {t.plateNumber} ({t.model})
                        </option>
                      ))}
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
                      <option value="" disabled>
                        Select driver
                      </option>
                      {availableDrivers.map((d) => (
                        <option key={d.employeeID} value={d.employeeID}>
                          {d.employeeName}
                        </option>
                      ))}
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
                      {availableHelpers.map((h) => (
                        <option key={h.employeeID} value={h.employeeID}>
                          {h.employeeName}
                        </option>
                      ))}
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
                      {availableHelpers.map((h) => (
                        <option key={h.employeeID} value={h.employeeID}>
                          {h.employeeName}
                        </option>
                      ))}
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
                className="px-6 py-2.5 bg-slate-200 text-slate-800 font-semibold rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm"
              >
                Generate Booking
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
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
  subcontractors: any[];
  onSubmitSuccess: (data: any) => void;
}

function NewClientBookingModal({
  isOpen,
  onClose,
  trucks,
  drivers,
  helpers,
  subcontractors,
  onSubmitSuccess,
}: NewClientBookingModalProps) {
  const currentDate = new Date().toISOString().split("T")[0];
  const initialFormState = {
    clientName: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
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

  const [formData, setFormData] = useState(initialFormState);
  const [isSubconMode, setIsSubconMode] = useState(false);
  const [availableTrucks, setAvailableTrucks] = useState<any[]>(trucks);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>(drivers);
  const [availableHelpers, setAvailableHelpers] = useState<any[]>(helpers);
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
    setAvailableTrucks(trucks);
    setAvailableDrivers(drivers);
    setAvailableHelpers(helpers);
  }, [trucks, drivers, helpers]);

  useEffect(() => {
    const fetchAvailable = async () => {
      if (!formData.deliverySchedule) return;
      try {
        const res = await apiFetch<any>(
          `/api/dispatch/available-resources?date=${formData.deliverySchedule}`,
        );
        if (res && res.data) {
          const fetchedTrucks = (res.data.trucks || []).map((t: any) => ({
            ...t,
            truckID: t.truckID || t.id,
            plateNumber: t.plateNumber || t.plate_number || "Unknown",
          }));
          const fetchedDrivers = (res.data.drivers || []).map((d: any) => ({
            ...d,
            employeeID: d.employeeID || d.id,
            employeeName:
              d.employeeName ||
              `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
              "Unknown",
          }));
          const fetchedHelpers = (res.data.helpers || []).map((h: any) => ({
            ...h,
            employeeID: h.employeeID || h.id,
            employeeName:
              h.employeeName ||
              `${h.firstName || ""} ${h.lastName || ""}`.trim() ||
              "Unknown",
          }));

          setAvailableTrucks(fetchedTrucks);
          setAvailableDrivers(fetchedDrivers);
          setAvailableHelpers(fetchedHelpers);

          // Auto-populate the first available resources
          setFormData((prev) => ({
            ...prev,
            truckPlate: fetchedTrucks.length > 0 ? fetchedTrucks[0].truckID : "",
            driver: fetchedDrivers.length > 0 ? fetchedDrivers[0].employeeID : "",
            helper1: fetchedHelpers.length > 0 ? fetchedHelpers[0].employeeID : "",
            helper2: fetchedHelpers.length > 1 ? fetchedHelpers[1].employeeID : "",
          }));
        }
      } catch (error) {
        console.error("Failed to load resources for this date:", error);
      }
    };
    fetchAvailable();
  }, [formData.deliverySchedule]);

  useEffect(() => {
    if (isOpen) {
      setIsSubconMode(false);
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
  }, [isOpen]);

  if (!isOpen) return null;

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
    if (errors[`pickup_${index}_${field}`])
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`pickup_${index}_${field}`];
        return newErrors;
      });
  };

  const handleDeliveryChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    const updated = [...deliveryList];
    updated[index][field] = value;
    setDeliveryList(updated);
    if (errors[`delivery_${index}_${field}`])
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`delivery_${index}_${field}`];
        return newErrors;
      });
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
        deliveryTime: "",
        quantity: "",
      },
    ]);
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
    if (!formData.deliverySchedule)
      newErrors.deliverySchedule = "Delivery schedule is required.";
    if (!formData.product.trim())
      newErrors.product = "Product description is required.";
    if (!formData.priorityLevel)
      newErrors.priorityLevel = "Priority level is required.";

    pickupList.forEach((p, idx) => {
      if (!p.warehouseName.trim())
        newErrors[`pickup_${idx}_warehouseName`] = "Required";
      if (!p.warehouseAddress.trim())
        newErrors[`pickup_${idx}_warehouseAddress`] = "Required";
      if (!p.contactPerson.trim())
        newErrors[`pickup_${idx}_contactPerson`] = "Required";
      if (!p.contactNumber.trim())
        newErrors[`pickup_${idx}_contactNumber`] = "Required";
      if (!p.pickupTime) newErrors[`pickup_${idx}_pickupTime`] = "Required";
      if (!p.quantity.toString().trim())
        newErrors[`pickup_${idx}_quantity`] = "Required";
    });

    deliveryList.forEach((d, idx) => {
      if (!d.branchName.trim())
        newErrors[`delivery_${idx}_branchName`] = "Required";
      if (!d.deliveryAddress.trim())
        newErrors[`delivery_${idx}_deliveryAddress`] = "Required";
      if (!d.contactPerson.trim())
        newErrors[`delivery_${idx}_contactPerson`] = "Required";
      if (!d.contactNumber.trim())
        newErrors[`delivery_${idx}_contactNumber`] = "Required";
      if (!d.deliveryTime)
        newErrors[`delivery_${idx}_deliveryTime`] = "Required";
      if (!d.quantity.toString().trim())
        newErrors[`delivery_${idx}_quantity`] = "Required";
    });

    if (isSubconMode && !formData.subconPartner)
      newErrors.subconPartner = "Subcon partner is required.";
    if (!isSubconMode && !formData.truckPlate)
      newErrors.truckPlate = "Truck plate number is required.";
    if (!isSubconMode && !formData.driver)
      newErrors.driver = "Driver assignment is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const selectedTruck = availableTrucks.find(
      (t) => t.truckID === formData.truckPlate,
    );
    const selectedDriver = availableDrivers.find(
      (d) => d.employeeID === formData.driver,
    );
    const selectedHelper1 = availableHelpers.find(
      (h) => h.employeeID === formData.helper1,
    );
    const selectedHelper2 = availableHelpers.find(
      (h) => h.employeeID === formData.helper2,
    );

    onSubmitSuccess({
      ...formData,
      emailAddress: formData.emailAddress.trim() || "N/A",
      businessAddress: formData.businessAddress.trim() || "N/A",
      pickupList,
      deliveryList,
      resolvedNames: {
        truck: selectedTruck ? selectedTruck.plateNumber : formData.truckPlate,
        driver: selectedDriver ? selectedDriver.employeeName : formData.driver,
        helper1: selectedHelper1
          ? selectedHelper1.employeeName
          : formData.helper1,
        helper2: selectedHelper2
          ? selectedHelper2.employeeName
          : formData.helper2,
      },
    });
    onClose();
  };

  return (
    <>
      <style>{`.btn-booking-cancel { background-color: oklch(63.7% 0.237 25.331); } .btn-booking-cancel:hover { background-color: black !important; color: white !important; } .btn-booking-generate { background-color: oklch(54.6% 0.245 262.881); } .btn-booking-generate:hover { background-color: black !important; color: white !important; }`}</style>
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
            {/* Client Info */}
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
                    Company Name *
                  </label>
                  <input
                    type="text"
                    name="clientName"
                    placeholder="e.g., Acme Corp"
                    value={formData.clientName}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.clientName ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
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
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.contactPerson ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Contact Number *
                  </label>
                  <input
                    type="text"
                    name="contactNumber"
                    placeholder="e.g., 09123456789"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.contactNumber ? "border-red-500 bg-red-50/20" : "border-slate-300"}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Email Address
                  </label>
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
                  <label className="block text-xs font-medium text-black mb-1">
                    Business Address
                  </label>
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
                <span className="font-semibold text-black text-sm tracking-wide">
                  2. Pickup Addresses *
                </span>
                <button
                  type="button"
                  onClick={addPickupRow}
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
                      <th className="p-2.5 border-r border-slate-200 w-[20%]">
                        Warehouse Name *
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[25%]">
                        Address *
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Person *
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[15%]">
                        Contact Number *
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-[12%]">
                        Time *
                      </th>
                      <th className="p-2.5 border-r border-slate-200 w-24 text-center">
                        Qty*
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
                          <input
                            type="text"
                            placeholder="Warehouse Name"
                            value={row.warehouseName}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "warehouseName",
                                e.target.value,
                              )
                            }
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_warehouseName`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Full Address"
                            value={row.warehouseAddress}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "warehouseAddress",
                                e.target.value,
                              )
                            }
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_warehouseAddress`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_contactPerson`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="09XX-XXX-XXXX"
                            value={row.contactNumber}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "contactNumber",
                                e.target.value,
                              )
                            }
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_contactNumber`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`pickup_${idx}_pickupTime`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="number"
                            placeholder="0"
                            value={row.quantity}
                            onChange={(e) =>
                              handlePickupChange(
                                idx,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className={`w-full bg-transparent border rounded px-1.5 py-1 min-w-15 ${errors[`pickup_${idx}_quantity`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removePickupRow(idx)}
                            disabled={pickupList.length === 1}
                            className="p-1.5 hover:text-red-700 disabled:opacity-50"
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
                        Quantity*
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
                          <input
                            type="text"
                            placeholder="Branch Name"
                            value={row.branchName}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "branchName",
                                e.target.value,
                              )
                            }
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_branchName`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="Full Address"
                            value={row.deliveryAddress}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "deliveryAddress",
                                e.target.value,
                              )
                            }
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_deliveryAddress`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_contactPerson`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="09XX-XXX-XXXX"
                            value={row.contactNumber}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "contactNumber",
                                e.target.value,
                              )
                            }
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_contactNumber`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
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
                            className={`w-full bg-transparent border rounded px-1.5 py-1 ${errors[`delivery_${idx}_deliveryTime`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="number"
                            placeholder="0"
                            value={row.quantity}
                            onChange={(e) =>
                              handleDeliveryChange(
                                idx,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className={`w-full bg-transparent border rounded px-1.5 py-1 min-w-15 ${errors[`delivery_${idx}_quantity`] ? "border-red-500 bg-red-50" : "border-slate-200"}`}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeDeliveryRow(idx)}
                            disabled={deliveryList.length === 1}
                            className="p-1.5 hover:text-red-700 disabled:opacity-50"
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
                    placeholder="e.g., 50 boxes of tile"
                    value={formData.product}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.product ? "border-red-500" : "border-slate-300"}`}
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
                  5. Assign Delivery Crews & Vehicle{" "}
                  {isSubconMode && "(Subcon)"}
                </span>
                <div className="flex gap-4">
                  {isSubconMode ? (
                    <button
                      type="button"
                      onClick={() => setIsSubconMode(false)}
                      className="text-xs text-blue-600 underline hover:text-blue-800"
                    >
                      Assign to Own Resources
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSubconMode(true)}
                      className="text-xs text-blue-600 underline hover:text-blue-800"
                    >
                      Assign to Subcon Partner
                    </button>
                  )}
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
                      className={`w-full border rounded-md px-3 py-2 text-xs ${errors.subconPartner ? "border-red-500" : "border-slate-300"}`}
                    >
                      <option value="" disabled>
                        Select partner
                      </option>
                      {subcontractors.map((s: any) => (
                        <option
                          key={s.id || s.companyName}
                          value={s.companyName}
                        >
                          {s.companyName}
                        </option>
                      ))}
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
                      <option value="" disabled>
                        Select truck
                      </option>
                      {availableTrucks.map((t) => (
                        <option key={t.truckID} value={t.truckID}>
                          {t.plateNumber} ({t.model})
                        </option>
                      ))}
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
                      <option value="" disabled>
                        Select driver
                      </option>
                      {availableDrivers.map((d) => (
                        <option key={d.employeeID} value={d.employeeID}>
                          {d.employeeName}
                        </option>
                      ))}
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
                      {availableHelpers.map((h) => (
                        <option key={h.employeeID} value={h.employeeID}>
                          {h.employeeName}
                        </option>
                      ))}
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
                      {availableHelpers.map((h) => (
                        <option key={h.employeeID} value={h.employeeID}>
                          {h.employeeName}
                        </option>
                      ))}
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
                className="px-6 py-2.5 bg-slate-200 text-slate-800 font-semibold rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm"
              >
                Generate Booking
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
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

function FeedTable({ tabConfig, bookings, onViewOrder, isLoading }: any) {
  const styles = COLOR_STYLES[tabConfig.color as keyof typeof COLOR_STYLES];
  const data = bookings || [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center space-x-3">
          <div
            className={`w-9 h-9 rounded-xl ${styles.iconBg} flex items-center justify-center ${styles.iconText} shrink-0`}
          >
            <tabConfig.icon className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {tabConfig.name} Feed ({data.length})
          </h3>
        </div>
        <Link
          href={tabConfig.route}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          View All
        </Link>
      </div>
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto max-h-105 feed-scrollbar">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-sm font-semibold">Loading data records...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-2 opacity-20" />
            <p>No data found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {data.map((b: any) => {
              let displayStatus = tabConfig.statusLabel;
              if (tabConfig.name === "Pending Bookings") {
                const ds = b.dispatchStatus;
                const drv = b.driver;
                const hasDriver = drv && drv !== "Unassigned" && drv !== "N/A";
                
                if (!hasDriver) {
                  displayStatus = "Assign Crew";
                } else if (ds === "Accepted") {
                  displayStatus = "Waiting Crew Dispatch";
                } else {
                  displayStatus = "Pending Crew";
                }
              }
              return (
                <div
                  key={b.orderId}
                  onClick={() => onViewOrder(b)}
                  className="cursor-pointer bg-gray-50/50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-200 group"
                  title="Click to view details"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0 pr-2">
                      <h4 className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-base truncate transition-colors inline-block">
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
                        {displayStatus}
                      </span>
                      <span className="text-gray-500 text-[11px] font-medium whitespace-nowrap">
                        {b.dateTime}
                      </span>
                    </div>
                  </div>
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
                        {b.helper || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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

  const [isLoading, setIsLoading] = useState(true);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dashboardFilters, setDashboardFilters] = useState<{
    dateRange: string;
    customStartDate: string;
    customEndDate: string;
    crewIds: string[];
    clientIds: string[];
  }>({
    dateRange: "thisMonth",
    customStartDate: "",
    customEndDate: "",
    crewIds: [],
    clientIds: [],
  });

  // Separate dropdown open states & independent search states
  const [isCrewDropdownOpen, setIsCrewDropdownOpen] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [crewSearchTerm, setCrewSearchTerm] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isNewClientBookingOpen, setIsNewClientBookingOpen] = useState(false);
  const [isClientSearchModalOpen, setIsClientSearchModalOpen] = useState(false);
  const [selectedClientForBooking, setSelectedClientForBooking] = useState("");
  const [isViewOrderModalOpen, setIsViewOrderModalOpen] = useState(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState<any>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [generatedOrderCode, setGeneratedOrderCode] = useState("");

  const [clients, setClients] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [helpers, setHelpers] = useState<any[]>([]);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);

  const [bookingsData, setBookingsData] = useState<{ [key: string]: any[] }>({
    "Pending Bookings": [],
    "In-Transit": [],
    Completed: [],
    "Foul Trip": [],
  });

  const fetchOrders = useCallback(async () => {
    try {
      const orders = await apiFetch<any[]>("/api/bookings");
      const categorized: { [key: string]: any[] } = {
        "Pending Bookings": [],
        "In-Transit": [],
        Completed: [],
        "Foul Trip": [],
      };

      if (Array.isArray(orders)) {
        orders.forEach((o: any) => {
          const clientObj = o.Client || o.client || {};
          let displayClient = clientObj.company || clientObj.companyName;
          if (!displayClient) {
            const match = o.notes?.match(/Name:\s*(.*)/);
            displayClient = match ? `Walk-in: ${match[1]}` : "Walk-in Customer";
          }

          const detailsArr =
            o.OrderDetails || o.orderdetails || o.order_details || [];
          const product = detailsArr[0]?.productName || "Multiple Items";
          const stopsArr =
            o.BranchStops || o.branchstops || o.branch_stops || [];
          const rawTime = stopsArr[0]?.expectedTime || "";
          const requestDateMatch = o.notes?.match(/Request Date:\s*(.*)/);
          const reqDate = requestDateMatch
            ? requestDateMatch[1].trim()
            : new Date(o.createdAt).toLocaleDateString();
          const dateTime = rawTime
            ? `${reqDate} @ ${rawTime}`
            : new Date(o.createdAt).toLocaleString();

          const dispatchRecord = Array.isArray(o.DispatchOrder)
            ? o.DispatchOrder[0]
            : o.DispatchOrder || o.dispatch_order;
          const dispatchStatus = dispatchRecord?.status || "Pending";
          const currentStep = Number(dispatchRecord?.current_step || dispatchRecord?.currentStep || 0);

          const truck =
            dispatchRecord?.Truck?.plateNumber ||
            o.notes?.match(/Truck:\s*(.*)/)?.[1] ||
            "Unassigned";

          const driverMatch = o.notes?.match(/Driver:\s*(.*)/);
          const driver =
            dispatchRecord?.Driver?.employeeName ||
            (driverMatch ? driverMatch[1].trim() : "Unassigned");

          const helperMatch = o.notes?.match(/Helper 1:\s*(.*)/);
          const helper =
            dispatchRecord?.Helper1?.employeeName ||
            (helperMatch ? helperMatch[1].trim() : "None");

          const driverConfirmed = Boolean(
            o.driverConfirmed ||
            o.driver_confirmed ||
            dispatchStatus === "Accepted" ||
            dispatchStatus === "In Transit",
          );
          const helperConfirmed = Boolean(
            o.helperConfirmed ||
            o.helper_confirmed ||
            dispatchStatus === "Accepted" ||
            dispatchStatus === "In Transit",
          );

          let category = "Pending Bookings";
          const stopStatus = (
            stopsArr[0]?.stopStatus || "pending"
          ).toLowerCase();

          if (
            dispatchStatus === "Rejected" ||
            dispatchStatus === "Foul Trip" ||
            stopStatus.includes("foul") ||
            stopStatus.includes("fail") ||
            stopStatus.includes("cancel")
          ) {
            category = "Foul Trip";
          } else if (
            dispatchStatus === "Completed" ||
            stopStatus.includes("complete") ||
            stopStatus.includes("delivered")
          ) {
            category = "Completed";
          } else if (
            dispatchStatus === "In Transit" ||
            dispatchStatus === "Arrived" ||
            dispatchStatus === "Ongoing Delivery" ||
            stopStatus.includes("transit") ||
            stopStatus.includes("progress")
          ) {
            category = "In-Transit";
          }

          categorized[category].push({
            orderId: o.orderCode || o.orderID,
            client: displayClient,
            product,
            driver,
            helper,
            dateTime,
            driverConfirmed,
            helperConfirmed,
            dispatchStatus,
            currentStep,
            rawOrder: o,
            statusCategory: category,
          });
        });
      }

      // Sort each category by highest update/creation date
      Object.keys(categorized).forEach((cat) => {
        categorized[cat].sort((a, b) => {
          return new Date(b.rawOrder.updatedAt || b.rawOrder.createdAt).getTime() - new Date(a.rawOrder.updatedAt || a.rawOrder.createdAt).getTime();
        });
      });

      setBookingsData(categorized);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);

    try {
      const clientRes = await apiFetch<{ data: any[] }>("/api/clients");
      setClients(clientRes.data || []);

      const truckRes = await apiFetch<any>("/api/fleet-status");
      const allTrucks = truckRes.data || truckRes || [];
      const mappedTrucks = allTrucks.map((t: any) => ({
        ...t,
        truckID: t.truckID || t.id,
        plateNumber: t.plateNumber || t.plate_number || "Unknown Plate",
        model: t.model || "Unknown Model",
        isActive: t.isActive !== undefined ? t.isActive : t.status === "Active",
        truckStatus: t.truckStatus || t.status || "Available",
      }));
      setTrucks(
        mappedTrucks.filter(
          (t: any) => t.isActive && t.truckStatus === "Available",
        ),
      );

      const empRes = await apiFetch<any>("/api/employees");
      const allEmployees = empRes.data || empRes || [];
      const mappedEmployees = allEmployees.map((e: any) => ({
        ...e,
        employeeID: e.employeeID || e.id,
        employeeName:
          e.employeeName ||
          (e.firstName ? `${e.firstName} ${e.lastName}` : "Unknown Name"),
        isActive: e.isActive !== undefined ? e.isActive : e.status === "Active",
        availability: e.availability || "Available",
      }));

      setDrivers(
        mappedEmployees.filter(
          (e: any) =>
            e.role === "Driver" && e.isActive && e.availability === "Available",
        ),
      );
      setHelpers(
        mappedEmployees.filter(
          (e: any) =>
            e.role === "Helper" && e.isActive && e.availability === "Available",
        ),
      );

      const subconRes = await apiFetch<{ data: any[] }>(
        "/api/subcontractors",
      ).catch(() => ({ data: [] }));
      setSubcontractors(subconRes.data || []);
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    }
    await fetchOrders();

    setIsLoading(false);
  }, [fetchOrders]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleNavigate = (tabName: string) => {
    sectionRefs.current[tabName]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const handleViewOrder = (order: any) => {
    setSelectedOrderForView(order);
    setIsViewOrderModalOpen(true);
  };

  const handleModalSubmit = async (data: any) => {
    try {
      let detailedNotes = "";
      if (!data.clientID) {
        detailedNotes += `[ON-CALL CUSTOMER]\nName: ${data.clientName}\nContact: ${data.contactPerson} (${data.contactNumber})\n\n`;
      }

      const driverName = data.resolvedNames?.driver || data.driver;
      const helper1Name = data.resolvedNames?.helper1 || data.helper1 || "None";
      const helper2Name = data.resolvedNames?.helper2 || data.helper2 || "None";
      const truckName = data.resolvedNames?.truck || data.truckPlate;

      detailedNotes += `[DELIVERY DETAILS]\nPriority: ${data.priorityLevel}\nRequest Date: ${data.requestDate || new Date().toISOString().split("T")[0]}\nDelivery Schedule: ${data.deliverySchedule}\nPickup: ${data.pickupAddress || data.pickupList?.[0]?.warehouseAddress} @ ${data.pickupTime || data.pickupList?.[0]?.pickupTime}\n`;

      if (data.subconPartner) {
        detailedNotes += `\n[SUBCON ASSIGNMENT]\nPartner: ${data.subconPartner}\nTruck/Plate: ${data.truckPlate || "TBD"}\nDriver: ${data.driver || "TBD"}\n`;
      } else {
        detailedNotes += `\n[ASSIGNED CREW]\nTruck: ${truckName}\nDriver: ${driverName}\nHelper 1: ${helper1Name}\nHelper 2: ${helper2Name}\n`;
      }

      if (data.notes) {
        detailedNotes += `\n[NOTES]\n${data.notes}`;
      }

      const stops =
        data.deliveryList && data.deliveryList.length > 0
          ? data.deliveryList.map((d: any) => ({
              branchName: d.branchName || d.deliveryAddress || "Branch",
              contactPerson: d.contactPerson || data.contactPerson,
              contactNum: d.contactNumber || data.contactNumber,
              expectedTime: d.deliveryTime || "12:00:00",
            }))
          : [
              {
                branchName: data.deliveryAddress || "N/A",
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
            quantity: Number(
              data.quantity || data.pickupList?.[0]?.quantity || 1,
            ),
            weightPerItem: 0,
          },
        ],
        stops: stops,
      };

      const res = await apiFetch<any>("/api/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const newOrderID = res.orderID;

      if (!data.subconPartner && data.truckPlate && data.driver) {
        try {
          await apiFetch(`/api/dispatch/${newOrderID}/assign`, {
            method: "POST",
            body: JSON.stringify({
              truckID: data.truckPlate,
              driverID: data.driver,
              helper1ID: data.helper1 || undefined,
              helper2ID: data.helper2 || undefined,
              totalCargoWeight: 0,
            }),
          });
          console.log("Resources locked successfully!");
        } catch (assignError: any) {
          alert(
            `Booking created, but assignment failed: ${assignError.message}`,
          );
        }
      }

      setGeneratedOrderCode(res.orderCode);
      setIsSuccessModalOpen(true);
      await fetchOrders();
    } catch (err: any) {
      console.error(err);
      alert(`🚨 FAILED 🚨\n\nReason: ${err.message}`);
    }
  };

  // Convert real db clients and drivers to format needed for the dropdowns
  const activeClientsForFilter = useMemo(() => 
    clients.map(c => ({ id: c.clientID || c.id, name: c.company || c.companyName || "Unknown" })), 
  [clients]);

  const activeCrewsForFilter = useMemo(() => 
    drivers.map(d => ({ id: d.employeeID, name: d.employeeName })), 
  [drivers]);

  // Apply Search inside Filter Modals
  const filteredCrews = activeCrewsForFilter.filter((c) =>
    c.name.toLowerCase().includes(crewSearchTerm.toLowerCase()),
  );
  
  const filteredClients = activeClientsForFilter.filter((cl) =>
    cl.name.toLowerCase().includes(clientSearchTerm.toLowerCase()),
  );

  // Apply Filter Logic to Data
  const filteredBookingsData = useMemo(() => {
    const result: { [key: string]: any[] } = {
      "Pending Bookings": [],
      "In-Transit": [],
      "Completed": [],
      "Foul Trip": [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    Object.keys(bookingsData).forEach(cat => {
      result[cat] = bookingsData[cat].filter((b: any) => {
        // 1. Client Filter
        if (dashboardFilters.clientIds.length > 0) {
          const bookingClientId = b.rawOrder?.clientID || b.rawOrder?.client?.id || b.rawOrder?.client_id;
          const matchById = dashboardFilters.clientIds.includes(bookingClientId);
          const clientObj = activeClientsForFilter.find(c => dashboardFilters.clientIds.includes(c.id));
          const matchByName = clientObj && clientObj.name === b.client;
          
          if (!matchById && !matchByName) return false;
        }

        // 2. Crew Filter
        if (dashboardFilters.crewIds.length > 0) {
          const dispatchRecord = Array.isArray(b.rawOrder?.DispatchOrder) ? b.rawOrder.DispatchOrder[0] : (b.rawOrder?.DispatchOrder || b.rawOrder?.dispatch_order);
          const driverId = dispatchRecord?.driverID;
          const matchById = dashboardFilters.crewIds.includes(driverId);
          const driverObj = activeCrewsForFilter.find(c => dashboardFilters.crewIds.includes(c.id));
          const matchByName = driverObj && driverObj.name === b.driver;

          if (!matchById && !matchByName) return false;
        }

        // 3. Date Filter
        if (dashboardFilters.dateRange) {
          const reqDateStr = b.rawOrder?.notes?.match(/Delivery Schedule:\s*(.*)/)?.[1] 
                          || b.rawOrder?.notes?.match(/Request Date:\s*(.*)/)?.[1] 
                          || b.rawOrder?.createdAt;
          const bDate = new Date(reqDateStr);
          if (isNaN(bDate.getTime())) return true;
          bDate.setHours(0,0,0,0);

          if (dashboardFilters.dateRange === "Today") {
            if (bDate.getTime() !== today.getTime()) return false;
          } else if (dashboardFilters.dateRange === "tomorrow") {
            const tmrw = new Date(today);
            tmrw.setDate(tmrw.getDate() + 1);
            if (bDate.getTime() !== tmrw.getTime()) return false;
          } else if (dashboardFilters.dateRange === "last7") {
            const last7 = new Date(today);
            last7.setDate(last7.getDate() - 7);
            if (bDate < last7 || bDate > today) return false;
          } else if (dashboardFilters.dateRange === "last30") {
            const last30 = new Date(today);
            last30.setDate(last30.getDate() - 30);
            if (bDate < last30 || bDate > today) return false;
          } else if (dashboardFilters.dateRange === "thisWeek") {
            const firstDay = new Date(today);
            firstDay.setDate(today.getDate() - today.getDay());
            if (bDate < firstDay) return false;
          } else if (dashboardFilters.dateRange === "thisMonth") {
            if (bDate.getMonth() !== today.getMonth() || bDate.getFullYear() !== today.getFullYear()) return false;
          } else if (dashboardFilters.dateRange === "thisYear") {
            if (bDate.getFullYear() !== today.getFullYear()) return false;
          } else if (dashboardFilters.dateRange === "custom") {
            if (dashboardFilters.customStartDate) {
              const sDate = new Date(dashboardFilters.customStartDate);
              sDate.setHours(0,0,0,0);
              if (bDate < sDate) return false;
            }
            if (dashboardFilters.customEndDate) {
              const eDate = new Date(dashboardFilters.customEndDate);
              eDate.setHours(0,0,0,0);
              if (bDate > eDate) return false;
            }
          }
        }
        return true;
      });
    });
    return result;
  }, [bookingsData, dashboardFilters, activeClientsForFilter, activeCrewsForFilter]);

  const selectedCrewLabel =
    dashboardFilters.crewIds.length > 0
      ? `${dashboardFilters.crewIds.length} Selected`
      : "All Crews";
  const selectedClientLabel =
    dashboardFilters.clientIds.length > 0
      ? `${dashboardFilters.clientIds.length} Selected`
      : "All Clients";

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto">
      <style>{`.feed-scrollbar::-webkit-scrollbar { width: 6px; } .feed-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 4px; } .feed-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; } .feed-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }`}</style>

      {/* HEADER SECTION WITH FILTER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
          <p className="text-xs sm:text-sm text-slate-700 mt-1">
            Track pending bookings, in-transit deliveries, completed trips, and
            foul trips at a glance.
          </p>
        </div>

        {/* Buttons Flex Container */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto relative z-10">
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

          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`h-11 px-4 inline-flex items-center justify-center border text-sm font-semibold rounded-xl transition-colors duration-200 shadow-sm whitespace-nowrap ${
              isFilterOpen
                ? "bg-slate-100 border-slate-300 text-slate-800"
                : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700"
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          {/* Filter Dropdown Panel */}
          {isFilterOpen && (
            <div className="absolute top-full mt-1.5 right-0 w-56 sm:w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3 animate-fade-in">
              <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1.5">
                <h3 className="font-bold text-xs text-slate-800">Filters</h3>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Main Panel Scrollable Container */}
              <div className="max-h-[68vh] overflow-y-auto pr-1 space-y-4 feed-scrollbar">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Date
                  </label>
                  <select
                    value={dashboardFilters.dateRange}
                    onChange={(e) =>
                      setDashboardFilters((f) => ({
                        ...f,
                        dateRange: e.target.value,
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Time</option>
                    <option value="Today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="last7">Last 7 Days</option>
                    <option value="last30">Last 30 Days</option>
                    <option value="thisWeek">This Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="thisYear">This Year</option>
                    <option value="upToDate">Up to Date</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                {dashboardFilters.dateRange === "custom" && (
                  <div className="flex gap-3">
                    <div className="w-1/2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={dashboardFilters.customStartDate}
                        onChange={(e) =>
                          setDashboardFilters((f) => ({
                            ...f,
                            customStartDate: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="w-1/2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={dashboardFilters.customEndDate}
                        onChange={(e) =>
                          setDashboardFilters((f) => ({
                            ...f,
                            customEndDate: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Assigned Crew Dropdown with Dedicated Search & Scrollbar */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Assigned Crew
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCrewDropdownOpen(!isCrewDropdownOpen);
                        setIsClientDropdownOpen(false);
                      }}
                      className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className="truncate pr-2">{selectedCrewLabel}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          isCrewDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isCrewDropdownOpen && (
                      <div className="mt-1.5 p-2 bg-white border border-slate-200 rounded-lg shadow-lg">
                        {/* Dedicated Crew Search Field */}
                        <div className="relative mb-2">
                          <input
                            type="text"
                            value={crewSearchTerm}
                            onChange={(e) => setCrewSearchTerm(e.target.value)}
                            placeholder="Search crew..."
                            className="w-full border border-slate-300 rounded-md pl-3 pr-8 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        </div>

                        {/* Scrollable Crew Options with Checkboxes */}
                        <div className="max-h-40 overflow-y-auto feed-scrollbar space-y-0.5">
                          <div
                            onClick={() => {
                              setDashboardFilters((f) => ({
                                ...f,
                                crewIds: [],
                              }));
                            }}
                            className={`px-2 py-1.5 rounded text-xs cursor-pointer flex items-center ${
                              dashboardFilters.crewIds.length === 0
                                ? "bg-blue-50 text-blue-600 font-semibold"
                                : "text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={dashboardFilters.crewIds.length === 0}
                              readOnly
                              className="mr-2 cursor-pointer shrink-0"
                            />
                            <span className="truncate">All Crews</span>
                          </div>
                          {filteredCrews.length > 0 ? (
                            filteredCrews.map((c) => {
                              const isSelected =
                                dashboardFilters.crewIds.includes(c.id);
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    setDashboardFilters((f) => {
                                      const newIds = isSelected
                                        ? f.crewIds.filter((id) => id !== c.id)
                                        : [...f.crewIds, c.id];
                                      return { ...f, crewIds: newIds };
                                    });
                                  }}
                                  className={`px-2 py-1.5 rounded text-xs cursor-pointer flex items-center ${
                                    isSelected
                                      ? "bg-blue-50 text-blue-600 font-semibold"
                                      : "text-slate-700 hover:bg-slate-100"
                                  }`}
                                  title={c.name}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    readOnly
                                    className="mr-2 cursor-pointer shrink-0"
                                  />
                                  <span className="truncate">{c.name}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-2 py-2 text-xs text-slate-400 text-center">
                              No crews found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Client Dropdown with Dedicated Search & Scrollbar */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Client
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsClientDropdownOpen(!isClientDropdownOpen);
                        setIsCrewDropdownOpen(false);
                      }}
                      className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className="truncate pr-2">
                        {selectedClientLabel}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          isClientDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isClientDropdownOpen && (
                      <div className="mt-1.5 p-2 bg-white border border-slate-200 rounded-lg shadow-lg">
                        {/* Dedicated Client Search Field */}
                        <div className="relative mb-2">
                          <input
                            type="text"
                            value={clientSearchTerm}
                            onChange={(e) =>
                              setClientSearchTerm(e.target.value)
                            }
                            placeholder="Search client..."
                            className="w-full border border-slate-300 rounded-md pl-3 pr-8 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        </div>

                        {/* Scrollable Client Options with Checkboxes */}
                        <div className="max-h-40 overflow-y-auto feed-scrollbar space-y-0.5">
                          <div
                            onClick={() => {
                              setDashboardFilters((f) => ({
                                ...f,
                                clientIds: [],
                              }));
                            }}
                            className={`px-2 py-1.5 rounded text-xs cursor-pointer flex items-center ${
                              dashboardFilters.clientIds.length === 0
                                ? "bg-blue-50 text-blue-600 font-semibold"
                                : "text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={dashboardFilters.clientIds.length === 0}
                              readOnly
                              className="mr-2 cursor-pointer shrink-0"
                            />
                            <span className="truncate">All Clients</span>
                          </div>
                          {filteredClients.length > 0 ? (
                            filteredClients.map((cl) => {
                              const isSelected =
                                dashboardFilters.clientIds.includes(cl.id);
                              return (
                                <div
                                  key={cl.id}
                                  onClick={() => {
                                    setDashboardFilters((f) => {
                                      const newIds = isSelected
                                        ? f.clientIds.filter(
                                            (id) => id !== cl.id,
                                          )
                                        : [...f.clientIds, cl.id];
                                      return { ...f, clientIds: newIds };
                                    });
                                  }}
                                  className={`px-2 py-1.5 rounded text-xs cursor-pointer flex items-center ${
                                    isSelected
                                      ? "bg-blue-50 text-blue-600 font-semibold"
                                      : "text-slate-700 hover:bg-slate-100"
                                  }`}
                                  title={cl.name}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    readOnly
                                    className="mr-2 cursor-pointer shrink-0"
                                  />
                                  <span className="truncate">{cl.name}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-2 py-2 text-xs text-slate-400 text-center">
                              No clients found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => {
                    setDashboardFilters({
                      dateRange: "thisMonth",
                      customStartDate: "",
                      customEndDate: "",
                      crewIds: [],
                      clientIds: [],
                    });
                    setCrewSearchTerm("");
                    setClientSearchTerm("");
                    setIsCrewDropdownOpen(false);
                    setIsClientDropdownOpen(false);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => {
                    setIsCrewDropdownOpen(false);
                    setIsClientDropdownOpen(false);
                    setIsFilterOpen(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <KPIGrid bookingsData={filteredBookingsData} onNavigate={handleNavigate} />

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
              bookings={filteredBookingsData[tab.name]}
              onViewOrder={handleViewOrder}
              tabConfig={tab}
              isLoading={isLoading}
            />
          </div>
        ))}
      </div>

      {/* MODALS */}
      <ViewOrderModal
        isOpen={isViewOrderModalOpen}
        onClose={() => setIsViewOrderModalOpen(false)}
        order={selectedOrderForView}
      />

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        clients={clients}
        trucks={trucks}
        drivers={drivers}
        helpers={helpers}
        subcontractors={subcontractors}
        preSelectedClientID={selectedClientForBooking}
        onSubmitSuccess={handleModalSubmit}
      />

      <NewClientBookingModal
        isOpen={isNewClientBookingOpen}
        onClose={() => setIsNewClientBookingOpen(false)}
        trucks={trucks}
        drivers={drivers}
        helpers={helpers}
        subcontractors={subcontractors}
        onSubmitSuccess={handleModalSubmit}
      />

      <ClientSearchModal
        isOpen={isClientSearchModalOpen}
        onClose={() => setIsClientSearchModalOpen(false)}
        clients={clients}
        onSelectClient={(clientID: string) => {
          setSelectedClientForBooking(clientID);
          setIsClientSearchModalOpen(false);
          setIsBookingModalOpen(true);
        }}
        onOpenNewClientBooking={() => {
          setIsNewClientBookingOpen(true);
        }}
      />

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        orderCode={generatedOrderCode}
      />
    </div>
  );
}