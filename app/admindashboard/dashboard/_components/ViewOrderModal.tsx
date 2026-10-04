"use client";

import { formatTime } from "@/app/lib/datetime";
import StopProofList, { type ProofBearingStop } from "@/components/booking/StopProofList";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  X,
} from "lucide-react";
import type { DashboardBooking } from "./feeds";
import { liveDispatchOf } from "@/app/lib/bookingView";

// ==========================================
// VIEW BOOKING MODAL (READ-ONLY)
// ==========================================

export function ViewOrderModal({
  isOpen,
  onClose,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  order: DashboardBooking | null;
}) {
  if (!isOpen || !order) return null;

  const raw = order.rawOrder || {};
  const notes = raw.notes || "";
  const category = order.statusCategory;
  const currentStep = order.currentStep || 0;

  const clientInfo = (Array.isArray(raw.Client) ? raw.Client[0] : raw.Client) ?? {};
  const cName =
    clientInfo.company ||
    notes.match(/Name:\s*(.*)/)?.[1] ||
    order.client ||
    "Walk-in Customer";
  const cPerson = clientInfo.contactName || notes.match(/Contact:\s*(.*?)\s*\(/)?.[1] || "N/A";
  const cNum = clientInfo.contact || notes.match(/\((.*?)\)/)?.[1] || "N/A";
  const cEmail = clientInfo.emailAdd || "N/A";
  const cAddr = clientInfo.businessAdd || "N/A";

  const priority = notes.match(/Priority:\s*(.*)/)?.[1] || "Standard";
  const reqDate =
    notes.match(/Request Date:\s*(.*)/)?.[1] ||
    (raw.createdAt ? new Date(raw.createdAt).toLocaleDateString() : "N/A");
  const delSchedule = notes.match(/Delivery Schedule:\s*(.*)/)?.[1] || "N/A";

  // Pickups are rows now. Bookings made before the PickupStops table still
  // carry theirs as a "Pickup: <place> @ <time>" line inside the notes.
  const pickupLine = notes.match(/Pickup:\s*(.*)/)?.[1] || "N/A @ N/A";
  const pickupParts = pickupLine.split(" @ ");
  const pickupAddr = pickupParts[0]?.trim() || "N/A";
  const pickupTime = pickupParts[1]?.trim() || "N/A";

  const pickupRows = Array.isArray(raw.PickupStops) ? raw.PickupStops : raw.PickupStops ? [raw.PickupStops] : [];
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
            expectedTime: formatTime(pickupTime) || "N/A",
            collected: false,
          },
        ];

  const dispatchRecord = liveDispatchOf(raw.DispatchOrder);

  const dispatchNote = dispatchRecord?.dispatchNote || "";
  const podUrl = dispatchRecord?.pod_url || "";

  // Whether any stop carries a proof row. Counted here rather than inside the
  // panel so the panel's own condition can ask about it.
  const hasStopProofs = [
    ...(Array.isArray(raw.PickupStops) ? raw.PickupStops : raw.PickupStops ? [raw.PickupStops] : []),
    ...(Array.isArray(raw.BranchStops) ? raw.BranchStops : raw.BranchStops ? [raw.BranchStops] : []),
  ].some((stop) => {
    const proofs = (stop as { POD?: unknown }).POD;
    return Array.isArray(proofs) && proofs.length > 0;
  });

  const dispatchTruck = Array.isArray(dispatchRecord?.Truck) ? dispatchRecord?.Truck[0] : dispatchRecord?.Truck;
  const dispatchDriver = Array.isArray(dispatchRecord?.Driver) ? dispatchRecord?.Driver[0] : dispatchRecord?.Driver;

  const truck = dispatchTruck?.plateNumber || notes.match(/Truck:\s*(.*)/)?.[1] || "Unassigned";
  const driver = dispatchDriver?.employeeName || notes.match(/Driver:\s*(.*)/)?.[1] || "Unassigned";

  // Helpers are their own rows. Helper1 and Helper2 were read as embeds on
  // the trip, which no query returns, so both names came from the notes.
  const helperNames = (
    Array.isArray(dispatchRecord?.DispatchHelper)
      ? dispatchRecord.DispatchHelper
      : dispatchRecord?.DispatchHelper
        ? [dispatchRecord.DispatchHelper]
        : []
  ).map((row) => {
    const person = Array.isArray(row?.Helper) ? row.Helper[0] : row?.Helper;
    return person?.employeeName ?? "";
  });

  const h1 = helperNames[0] || notes.match(/Helper 1:\s*(.*)/)?.[1] || "None";
  const h2 = helperNames[1] || notes.match(/Helper 2:\s*(.*)/)?.[1] || "None";

  const actualNotesParts = notes.split("[NOTES]");
  const actualNotes =
    actualNotesParts.length > 1 ? actualNotesParts[1].trim() : "None";

  const itemsArr = Array.isArray(raw.OrderDetails) ? raw.OrderDetails : raw.OrderDetails ? [raw.OrderDetails] : [];
  const product = itemsArr[0]?.productName || order.product || "Multiple Items";
  const quantity = itemsArr[0]?.quantity || 1;

  const stopsArr = Array.isArray(raw.BranchStops) ? raw.BranchStops : raw.BranchStops ? [raw.BranchStops] : [];
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
              Created on {raw.createdAt ? new Date(raw.createdAt).toLocaleString() : "an unknown date"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-w-tap min-h-tap md:min-w-0 md:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-black/20 transition-colors"
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
              <div className="lg:overflow-x-auto lg:border lg:border-slate-200 lg:rounded-lg">
                <table role="table" className="w-full text-left border-collapse text-xs lg:min-w-150 block lg:table">
                  <thead role="rowgroup" className="hidden lg:table-header-group">
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
                  <tbody role="rowgroup" className="block lg:table-row-group space-y-2 lg:space-y-0">
                    {pickups.map((p, idx) => {
                      // The stop row is what says whether the cargo was
                      // collected. currentStep is still consulted so that
                      // trips finished before pickups were rows still read
                      // as picked up rather than pending forever.
                      const collected =
                        p.collected || category === "Completed" || currentStep > 1;
                      const enRoute = !collected && currentStep === 1;

                      return (
                        <tr
                          role="row"
                          key={idx}
                          className="block lg:table-row border border-slate-200 rounded-lg p-3 bg-slate-50 lg:p-0 lg:bg-transparent lg:border-0 lg:border-b lg:rounded-none font-medium text-slate-700"
                        >
                          <td role="cell" className="block lg:table-cell pb-2 mb-1 border-b border-slate-200 font-semibold text-slate-900 text-sm lg:text-xs lg:font-medium lg:text-slate-700 lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50">
                            {p.warehouseName}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50"><span className="lg:hidden text-slate-500">Address</span>
                            {p.address}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50"><span className="lg:hidden text-slate-500">Contact Person</span>
                            {p.contactPerson}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50"><span className="lg:hidden text-slate-500">Contact Number</span>
                            {p.contactNum}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50"><span className="lg:hidden text-slate-500">Pick Up Time</span>
                            {p.expectedTime}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:text-center lg:bg-slate-50"><span className="lg:hidden text-slate-500">Quantity</span>
                            {quantity}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:text-center lg:bg-slate-50"><span className="lg:hidden text-slate-500">Status</span>
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
              <div className="lg:overflow-x-auto lg:border lg:border-slate-200 lg:rounded-lg">
                <table role="table" className="w-full text-left border-collapse text-xs lg:min-w-150 block lg:table">
                  <thead role="rowgroup" className="hidden lg:table-header-group">
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
                  <tbody role="rowgroup" className="block lg:table-row-group space-y-2 lg:space-y-0">
                    {deliveries.map((d, idx) => {
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
                      
                      const stopLabel = isStopDelivered
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
                          role="row"
                          key={idx}
                          className="block lg:table-row border border-slate-200 rounded-lg p-3 bg-slate-50 lg:p-0 lg:bg-transparent lg:border-0 lg:border-b lg:rounded-none font-medium text-slate-700"
                        >
                          <td role="cell" className="block lg:table-cell pb-2 mb-1 border-b border-slate-200 font-semibold text-slate-900 text-sm lg:text-xs lg:font-medium lg:text-slate-700 lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50">
                            {d.branchName || "Branch"}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50"><span className="lg:hidden text-slate-500">Delivery Address</span>
                            {d.deliveryAddress || d.branchName || "N/A"}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50"><span className="lg:hidden text-slate-500">Contact Person</span>
                            {d.contactPerson || cPerson}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50"><span className="lg:hidden text-slate-500">Contact Number</span>
                            {d.contactNum || cNum}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:bg-slate-50"><span className="lg:hidden text-slate-500">Expected Time</span>
                            {formatTime(d.expectedTime) || "N/A"}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:border-r lg:border-slate-200 lg:text-center lg:bg-slate-50"><span className="lg:hidden text-slate-500">Quantity</span>
                            {d.quantity || quantity}
                          </td>
                          <td role="cell" className="grid grid-cols-[40%_60%] items-center justify-items-start gap-2 py-1 lg:table-cell lg:p-2 lg:text-center lg:bg-slate-50"><span className="lg:hidden text-slate-500">Stop Status</span>
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
            {/* Gated on there being something to show. It used to test podUrl,
                which is the single overwritten column - so once proofs are kept
                per stop and that column is left alone, the panel would have
                hidden the very records it exists to show. */}
            {(category === "Completed" || category === "Foul Trip") &&
              (dispatchNote || podUrl || hasStopProofs) && (
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
                  {/* Every proof on the trip, one per stop, warehouses included.
                      This showed DispatchOrder.pod_url, a single column the crew
                      app overwrote at every stop - so a four-stop delivery
                      displayed its last photograph and looked complete. The POD
                      rows are the record, and they come down with the booking
                      already. */}
                  <div>
                    <span
                      className={`block text-xs font-semibold mb-2 ${category === "Foul Trip" ? "text-red-800" : "text-emerald-800"}`}
                    >
                      Proof of Delivery
                    </span>
                    <StopProofList
                      pickups={pickupRows as ProofBearingStop[]}
                      deliveries={stopsArr as ProofBearingStop[]}
                      tripProof={podUrl || null}
                    />
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className={`w-auto sm:w-auto px-3.5 sm:px-8 py-2 sm:py-2.5 text-white font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm transition-colors shadow-md cursor-pointer ${ category === "In-Transit" ? "bg-blue-600 hover:bg-blue-700" : category === "Completed" ? "bg-green-600 hover:bg-green-700" : category === "Foul Trip" ? "bg-red-600 hover:bg-red-700" : "bg-[#000c31] hover:bg-slate-800" } px-3 sm:px-4`}
          >
            Close<span className="hidden sm:inline"> Details</span>
          </button>
        </div>
      </div>
    </div>
  );
}
