/* eslint-disable react-hooks/exhaustive-deps */
// ==========================================
// MAIN DASHBOARD PAGE FOR ADMIN USERS
// ==========================================
"use client";
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { formatTime } from "@/app/lib/datetime";
import { apiFetch } from "@/app/lib/apiClient";
import { DELIVERY_STATUS, FINISHED_DELIVERY_STATUSES, HELPER_STATUS } from "@/app/lib/enums";

// A trip that has left the yard and has not finished yet.
const ON_THE_ROAD_STATUSES: string[] = [
  DELIVERY_STATUS.startDelivery,
  DELIVERY_STATUS.inWarehouse,
  DELIVERY_STATUS.inTransit,
  DELIVERY_STATUS.arrived,
];
import Link from "next/link";
import BookingFormModal, { type BookingFormResult } from "@/components/booking/BookingFormModal";
import SubconTripModal from "@/components/subcon/SubconTripModal";
import { parseQuantity } from "@/app/lib/bookingRules";
import FoulTripDetailsModal, { attachIncident, type FoulTripRow } from "@/components/foulTrip/FoulTripDetailsModal";
import type { IncidentView } from "@/services/foulTrip/foulTripService";
import { mapOrderToBookingView, toFeedBooking } from "@/app/lib/bookingView";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Truck,
  X,
  Search,
  Filter,
  ChevronDown,
  Copy,
} from "lucide-react";

// ==========================================
// SESSION & API FETCH
// ==========================================

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
  trackingToken?: string;
  /** The booking just made, so its link can be emailed again. */
  orderID?: string;
}

function SuccessModal({ isOpen, onClose, orderCode, trackingToken, orderID }: SuccessModalProps) {
  const [copied, setCopied] = useState(false);
  // The link is emailed to the client when the booking is made. This says
  // where it went, and sends it again - a wrong address, or a client who
  // never received it.
  const [emailState, setEmailState] = useState<{ status: "idle" | "sending" | "sent" | "failed"; message: string }>({
    status: "idle",
    message: "",
  });

  if (!isOpen) return null;

  // Customer-facing tracking link for this order.
  const trackingLink =
    trackingToken && typeof window !== "undefined"
      ? `${window.location.origin}/client-view?token=${trackingToken}`
      : "";

  const emailTrackingLink = async () => {
    if (!orderID) return;
    setEmailState({ status: "sending", message: "" });
    try {
      const res = await apiFetch<{ data: { email: string | null } }>(`/api/bookings/${orderID}/tracking-email`, {
        method: "POST",
      });
      setEmailState({ status: "sent", message: `Sent to ${res.data?.email ?? "the client"}.` });
    } catch (error) {
      setEmailState({
        status: "failed",
        message: error instanceof Error ? error.message : "Could not send it.",
      });
    }
  };

  const copyTrackingLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this tracking link:", trackingLink);
    }
  };

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
        <p className="text-xs text-slate-600 mb-4">
          Your booking has been generated successfully.
        </p>

        {trackingLink && (
          <div className="mb-6 text-left">
            <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">
              Customer tracking link
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={trackingLink}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={copyTrackingLink}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={emailTrackingLink}
                disabled={!orderID || emailState.status === "sending"}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {emailState.status === "sending" ? "Sending…" : "Email it to the client"}
              </button>
              {emailState.message && (
                <span className={`text-xs ${emailState.status === "failed" ? "text-red-600" : "text-emerald-700"}`}>
                  {emailState.message}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-[11px] text-slate-500 mt-1.5">
              The client is emailed this link automatically when the booking is made.
            </p>
          </div>
        )}

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

  // Pickups are rows now. Bookings made before the PickupStops table still
  // carry theirs as a "Pickup: <place> @ <time>" line inside the notes.
  const pickupLine = notes.match(/Pickup:\s*(.*)/)?.[1] || "N/A @ N/A";
  const pickupParts = pickupLine.split(" @ ");
  const pickupAddr = pickupParts[0]?.trim() || "N/A";
  const pickupTime = pickupParts[1]?.trim() || "N/A";

  const pickupRows: any[] = raw.PickupStops || raw.pickupstops || [];
  const pickups =
    pickupRows.length > 0
      ? [...pickupRows]
          .sort((a, b) => (a.sequence ?? a.pickupID ?? 0) - (b.sequence ?? b.pickupID ?? 0))
          .map((p) => ({
            warehouseName: p.warehouseName || "Origin Location",
            address: p.pickupAddress || p.warehouseName || "N/A",
            contactPerson: p.contactPerson || cPerson,
            contactNum: p.contactNum || cNum,
            expectedTime: p.expectedTime ? formatTime(String(p.expectedTime)) : "N/A",
            collected: /deliver|complete/i.test(p.stopStatus ?? ""),
          }))
      : [
          {
            warehouseName: "Origin Location",
            address: pickupAddr,
            contactPerson: cPerson,
            contactNum: cNum,
            expectedTime: pickupTime,
            collected: false,
          },
        ];

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
            sequence: 1,
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

        <div className="p-6 max-h-[80dvh] overflow-y-auto text-sm text-slate-900">
          
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
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Company Name
                  </label>
                  <input readOnly value={cName} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Contact Person
                  </label>
                  <input readOnly value={cPerson} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Contact Number
                  </label>
                  <input readOnly value={cNum} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Email Address
                  </label>
                  <input readOnly value={cEmail} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
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
                    {pickups.map((p: any, idx: number) => {
                      // The stop row is what says whether the cargo was
                      // collected. currentStep is still consulted so that
                      // trips finished before pickups were rows still read
                      // as picked up rather than pending forever.
                      const collected =
                        p.collected || category === "Completed" || currentStep > 1;
                      const enRoute = !collected && currentStep === 1;

                      return (
                        <tr
                          key={idx}
                          className="border-b border-slate-200 font-medium text-slate-700"
                        >
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {p.warehouseName}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {p.address}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {p.contactPerson}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {p.contactNum}
                          </td>
                          <td className="p-2 border-r border-slate-200 bg-slate-50">
                            {p.expectedTime}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center bg-slate-50">
                            {quantity}
                          </td>
                          <td className="p-2 text-center bg-slate-50">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider ${
                                collected
                                  ? "bg-green-100 text-green-700 border border-green-200"
                                  : enRoute
                                    ? "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {collected
                                ? "Picked Up"
                                : enRoute
                                  ? "En Route to Pickup"
                                  : "Awaiting Pickup"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
                      // The stop carries its own status. The step index is
                      // only a fallback for trips that finished before the
                      // crew app started recording stop completions, and it
                      // assumes exactly one pickup, which is not true of
                      // every booking.
                      const stopStepIndex = pickups.length + 1 + idx;
                      const isStopDelivered =
                        /deliver|complete/i.test(d.stopStatus ?? "") ||
                        category === "Completed" ||
                        currentStep > stopStepIndex;
                      const isStopOngoing =
                        !isStopDelivered &&
                        category === "In-Transit" &&
                        currentStep === stopStepIndex;
                      
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
                              className={`px-2 py-1 rounded-full text-xs sm:text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
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
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Request Date
                  </label>
                  <input readOnly value={reqDate} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Delivery Schedule
                  </label>
                  <input readOnly value={delSchedule} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Product To Deliver
                  </label>
                  <input readOnly value={product} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
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
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Truck Plate No.
                  </label>
                  <input readOnly value={truck} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Driver
                  </label>
                  <input readOnly value={driver} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
                    Helper #1
                  </label>
                  <input readOnly value={h1} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs sm:text-[11px] font-medium text-slate-500 mb-1">
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
                      {/* A partner may send the proof as a PDF. */}
                      {/\.pdf(\?|$)/i.test(podUrl) ? (
                        <a href={podUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline">
                          <FileText className="w-4 h-4" /> View proof of delivery (PDF)
                        </a>
                      ) : (
                        <img
                          src={podUrl}
                          alt="Uploaded Proof"
                          className={`w-full max-w-sm h-auto object-cover rounded-xl border shadow-sm ${category === "Foul Trip" ? "border-red-200" : "border-emerald-200"}`}
                        />
                      )}
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg relative p-6 sm:p-10 flex flex-col items-center text-center max-h-[90dvh]">
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
            <div className="border border-slate-300 rounded-lg shadow-sm overflow-y-auto max-h-[40dvh] feed-scrollbar">
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
              <p className="text-gray-500 text-xs sm:text-[11px] font-bold tracking-wider mt-0.5">
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
              if (b.isSubcon && b.dispatchStatus !== "Completed") {
                displayStatus = b.dispatchStatus === "Accepted" ? "Sub-con: awaiting pickup" : `Sub-con: ${b.dispatchStatus}`;
              } else if (tabConfig.name === "Pending Bookings") {
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
                        className={`px-3 py-1 ${styles.badgeBg} ${styles.badgeText} rounded-full text-xs sm:text-[11px] font-bold whitespace-nowrap`}
                      >
                        {displayStatus}
                      </span>
                      <span className="text-gray-500 text-xs sm:text-[11px] font-medium whitespace-nowrap">
                        {b.dateTime}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mt-4 pt-4 border-t border-gray-200/80">
                    <div className="min-w-0">
                      <span className="text-gray-500 text-xs sm:text-[11px] uppercase tracking-wider font-semibold block mb-1 truncate">
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
                      <span className="text-gray-500 text-xs sm:text-[11px] uppercase tracking-wider font-semibold block mb-1 truncate">
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
                      <span className="text-gray-500 text-xs sm:text-[11px] uppercase tracking-wider font-semibold block mb-1 truncate">
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
  const [generatedTrackingToken, setGeneratedTrackingToken] = useState("");
  const [generatedOrderID, setGeneratedOrderID] = useState("");

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
      // The dashboard only shows recent work per bucket, so fetch the stages
      // it renders instead of every order ever created.
      const DASHBOARD_STAGES = [
        "unassigned",
        "departing",
        "in-transit",
        "completed",
        "foul-trip",
      ];

      const stageResults = await Promise.all(
        DASHBOARD_STAGES.map((stage) =>
          apiFetch<any[]>(`/api/bookings?stage=${stage}&limit=100`).catch(() => []),
        ),
      );

      // An order can only be in one stage, but dedupe defensively.
      const seenOrderIDs = new Set<string>();
      const orders = stageResults.flat().filter((order: any) => {
        const key = String(order?.orderID ?? order?.orderCode ?? "");
        if (!key || seenOrderIDs.has(key)) return false;
        seenOrderIDs.add(key);
        return true;
      });
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

          // A partner's trip: no truck or crew of ours; its driver and plate
          // were typed in when it was handed over.
          const isSubcon = Boolean(
            dispatchRecord &&
              (dispatchRecord.subConID ||
                (!dispatchRecord.truckID && /Subcontractor:/.test(dispatchRecord.dispatchNote || ""))),
          );
          const partnerName =
            (Array.isArray(dispatchRecord?.SubContractor) ? dispatchRecord.SubContractor[0] : dispatchRecord?.SubContractor)?.companyName ||
            /Subcontractor:\s*([^\n]*)/.exec(dispatchRecord?.dispatchNote || "")?.[1]?.trim() ||
            "Partner";

          const truck =
            dispatchRecord?.partnerPlate ||
            dispatchRecord?.Truck?.plateNumber ||
            o.notes?.match(/Truck:\s*(.*)/)?.[1] ||
            "Unassigned";

          const driverMatch = o.notes?.match(/Driver:\s*(.*)/);
          const driver =
            dispatchRecord?.partnerDriver ||
            dispatchRecord?.Driver?.employeeName ||
            (driverMatch ? driverMatch[1].trim() : "Unassigned");

          const helperMatch = o.notes?.match(/Helper 1:\s*(.*)/);
          const helper = isSubcon
            ? `Sub-con: ${partnerName}`
            : dispatchRecord?.Helper1?.employeeName ||
            (helperMatch ? helperMatch[1].trim() : "None");

          const driverHasConfirmed =
            dispatchStatus === DELIVERY_STATUS.accepted ||
            ON_THE_ROAD_STATUSES.includes(dispatchStatus);

          const driverConfirmed = Boolean(
            o.driverConfirmed || o.driver_confirmed || driverHasConfirmed,
          );

          // Each helper carries their own status. This used to be inferred
          // from the dispatch status, so every helper was reported as
          // confirmed the moment the driver accepted - including helpers who
          // had not replied at all, and a trip could leave showing a crew
          // that had never confirmed.
          const helperRows: any[] = Array.isArray(dispatchRecord?.DispatchHelper)
            ? dispatchRecord.DispatchHelper
            : [];
          const helperConfirmed = Boolean(
            o.helperConfirmed ||
              o.helper_confirmed ||
              (helperRows.length > 0 &&
                helperRows.every((row) => row?.status === HELPER_STATUS.accepted)),
          );

          // The dispatch status decides the bucket. The first stop's status
          // used to be consulted at the same level, which put a trip whose
          // first drop-off was done into "Completed" while the truck was
          // still on the road with four stops to go. It is now only a
          // fallback for orders that have no dispatch at all. The list also
          // checked for "Ongoing Delivery", which is not one of the statuses
          // delivery_status can hold.
          let category = "Pending Bookings";
          const stopStatus = (
            stopsArr[0]?.stopStatus || "pending"
          ).toLowerCase();

          if (dispatchRecord?.status) {
            if (
              dispatchStatus === DELIVERY_STATUS.rejected ||
              dispatchStatus === DELIVERY_STATUS.foulTrip ||
              dispatchStatus === DELIVERY_STATUS.cancelled
            ) {
              category = "Foul Trip";
            } else if (FINISHED_DELIVERY_STATUSES.includes(dispatchStatus)) {
              category = "Completed";
            } else if (ON_THE_ROAD_STATUSES.includes(dispatchStatus)) {
              category = "In-Transit";
            }
          } else if (
            stopStatus.includes("foul") ||
            stopStatus.includes("fail") ||
            stopStatus.includes("cancel")
          ) {
            category = "Foul Trip";
          } else if (
            stopStatus.includes("complete") ||
            stopStatus.includes("delivered")
          ) {
            category = "Completed";
          } else if (
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
            isSubcon,
            partnerName,
            dispatchID: dispatchRecord?.dispatchID ?? null,
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
      // Independent requests: run them together, not one after another.
      const [clientRes, truckRes, empRes, subconRes] = await Promise.all([
        apiFetch<{ data: any[] }>("/api/clients").catch(() => ({ data: [] })),
        apiFetch<any>("/api/fleet-status").catch(() => ({ data: [] })),
        apiFetch<any>("/api/employees").catch(() => ({ data: [] })),
        apiFetch<{ data: any[] }>("/api/subcontractors").catch(() => ({ data: [] })),
      ]);

      setClients(clientRes.data || []);

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
  // A foul trip that still needs recovery opens the same screen as the Foul
  // Trip feed, with its recovery options. Anything else in the bucket
  // (rejected, cancelled) has nothing to act on and opens read-only.
  const [foulTripRow, setFoulTripRow] = useState<FoulTripRow | null>(null);
  const [foulTripNotice, setFoulTripNotice] = useState("");

  const [subconTripID, setSubconTripID] = useState<string | null>(null);

  const handleViewOrder = async (order: any) => {
    if (order.isSubcon && order.dispatchID && order.statusCategory !== "Foul Trip") {
      setSubconTripID(order.dispatchID);
      return;
    }
    if (order.statusCategory === "Foul Trip") {
      try {
        const foul = await apiFetch<{ open: IncidentView[] }>("/api/foul-trips", { cache: "no-store" });
        const booking = toFeedBooking(mapOrderToBookingView(order.rawOrder));
        const incident = foul.open.find((i) => i.orderCode === booking.orderId);
        if (incident) {
          setFoulTripRow(attachIncident(booking, incident));
          return;
        }
      } catch (error) {
        console.error("Failed to load the foul trip:", error);
      }
    }
    setSelectedOrderForView(order);
    setIsViewOrderModalOpen(true);
  };

  const handleFoulTripDone = (message: string) => {
    setFoulTripRow(null);
    setFoulTripNotice(message);
    window.setTimeout(() => setFoulTripNotice(""), 5000);
    void fetchOrders();
  };

  const handleModalSubmit = async (data: BookingFormResult) => {
    try {
      let detailedNotes = "";
      if (!data.clientID) {
        detailedNotes += `[ON-CALL CUSTOMER]\nName: ${data.clientName}\nContact: ${data.contactPerson} (${data.contactNumber})\n${data.emailAddress && data.emailAddress !== "N/A" ? `Email: ${data.emailAddress}\n` : ""}\n`;
      }

      // A booking saved without a truck or driver says so, rather than an
      // empty "Truck:" line.
      const driverName = (!data.unassigned && data.resolvedNames.driver) || "Unassigned";
      const helper1Name = data.resolvedNames.helper1 || "None";
      const helper2Name = data.resolvedNames.helper2 || "None";
      const truckName = (!data.unassigned && data.resolvedNames.truck) || "Unassigned";

      detailedNotes += `[DELIVERY DETAILS]\nPriority: ${data.priorityLevel}\nRequest Date: ${data.requestDate || new Date().toISOString().split("T")[0]}\nDelivery Schedule: ${data.deliverySchedule}\nPickup: ${data.pickupList[0]?.warehouseAddress} @ ${data.pickupList[0]?.pickupTime}\n`;

      if (data.subconPartner) {
        detailedNotes += `\n[SUBCON ASSIGNMENT]\nPartner: ${data.subconPartnerName}\nTruck/Plate: ${data.truckPlate || "TBD"}\nDriver: ${data.driver || "TBD"}\n`;
      } else {
        detailedNotes += `\n[ASSIGNED CREW]\nTruck: ${truckName}\nDriver: ${driverName}\nHelper 1: ${helper1Name}\nHelper 2: ${helper2Name}\n`;
      }

      if (data.notes) {
        detailedNotes += `\n[NOTES]\n${data.notes}`;
      }

      const stops = data.deliveryList.map((d) => ({
        branchName: d.branchName || d.deliveryAddress || "Branch",
        contactPerson: d.contactPerson || data.contactPerson,
        contactNum: d.contactNumber || data.contactNumber,
        expectedTime: d.deliveryTime || "12:00:00",
        // Geocoded server-side so the stop shows on the tracking map.
        deliveryAddress: d.deliveryAddress || undefined,
        quantity: parseQuantity(d.quantity) ?? undefined,
      }));

      // The order's total is what is delivered across every stop. It used
      // to be the first pickup's quantity alone.
      const sum = (rows: { quantity: string }[]) =>
        rows.reduce((total, row) => total + (parseQuantity(row.quantity) ?? 0), 0);
      const totalQuantity = sum(data.deliveryList) || sum(data.pickupList) || 1;

      const payload = {
        clientID: data.clientID || null,
        notes: detailedNotes,
        items: [
          {
            productName: data.product,
            productType: "General",
            quantity: totalQuantity,
            weightPerItem: 0,
          },
        ],
        stops: stops,
        // Every pickup, not just the first. They used to be flattened into
        // the "Pickup:" line of the notes above, which kept one and lost the
        // rest; that line is still written so older screens keep rendering.
        pickups: data.pickupList
          .filter((p) => p.warehouseName?.trim())
          .map((p) => ({
            warehouseID: p.warehouseID || null,
            warehouseName: p.warehouseName.trim(),
            pickupAddress: p.warehouseAddress?.trim() || undefined,
            contactPerson: p.contactPerson?.trim() || undefined,
            contactNum: p.contactNumber?.trim() || undefined,
            expectedTime: p.pickupTime || undefined,
            quantity: parseQuantity(p.quantity) ?? undefined,
          })),
      };

      const res = await apiFetch<any>("/api/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const newOrderID = res.orderID;

      if (data.subconPartner) {
        try {
          await apiFetch("/api/subcon-trips", {
            method: "POST",
            body: JSON.stringify({
              orderID: newOrderID,
              subConID: data.subconPartner,
              driverName: data.driver || undefined,
              plateNumber: data.truckPlate || undefined,
              contactNumber: data.partnerContact || undefined,
              helpers: [data.helper1, data.helper2].filter(Boolean),
            }),
          });
        } catch (partnerError) {
          const reason = partnerError instanceof Error ? partnerError.message : "unknown error";
          alert(`Booking created, but handing it to ${data.subconPartnerName || "the partner"} failed: ${reason}`);
        }
      } else if (!data.unassigned) {
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
      setGeneratedTrackingToken(res.trackingToken || "");
      setGeneratedOrderID(res.orderID || "");
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
          <p className="text-sm text-slate-700 mt-1">
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
              <div className="max-h-[68dvh] overflow-y-auto pr-1 space-y-4 feed-scrollbar">
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
                      <label className="block text-xs sm:text-[10px] font-semibold text-slate-500 mb-1">
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
                      <label className="block text-xs sm:text-[10px] font-semibold text-slate-500 mb-1">
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
      <SubconTripModal dispatchID={subconTripID} onClose={() => setSubconTripID(null)} onChanged={() => void fetchOrders()} />
      {foulTripNotice && (
        <div role="status" className="fixed bottom-6 right-6 z-70 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 shadow-lg">
          {foulTripNotice}
        </div>
      )}
      <FoulTripDetailsModal
        isOpen={foulTripRow !== null}
        onClose={() => setFoulTripRow(null)}
        onProceedSuccess={handleFoulTripDone}
        booking={foulTripRow}
      />
      <ViewOrderModal
        isOpen={isViewOrderModalOpen}
        onClose={() => setIsViewOrderModalOpen(false)}
        order={selectedOrderForView}
      />

      <BookingFormModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        variant={selectedClientForBooking ? "registered" : "on-call"}
        clients={clients}
        trucks={trucks}
        drivers={drivers}
        helpers={helpers}
        subcontractors={subcontractors}
        preSelectedClientID={selectedClientForBooking}
        onSubmitSuccess={handleModalSubmit}
      />

      <BookingFormModal
        variant="new-client"
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
        trackingToken={generatedTrackingToken}
        orderID={generatedOrderID}
      />
    </div>
  );
}