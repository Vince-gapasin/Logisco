// ==========================================
// LOGISCO - CLIENT TRACKER VIEW PAGE
// ==========================================
"use client";

import React, { useState } from "react";
import { Truck, User, MapPin, Clock } from "lucide-react";

export interface TrackerData {
  orderNumber: string;
  truckNumber: string;
  plateNumber: string;
  driverName: string;
  driverContact: string;
  currentLocation: string;
  destination: string;
  estimatedArrival: string;
  deliveryStatus: string;
  isCompleted: boolean;
  isExpired: boolean;
  latestUpdates: {
    time: string;
    description: string;
    status: "completed" | "current" | "upcoming";
  }[];
}

export default function ClientTrackerPage() {
  const [deliveryData] = useState<TrackerData>({
    orderNumber: "ORD - 1095",
    truckNumber: "NDR",
    plateNumber: "4821",
    driverName: "Nathan Flores",
    driverContact: "0927-511-6402",
    currentLocation: "Jollibee Santa Mesa",
    destination: "Branch 2 Delivery Destination",
    estimatedArrival: "3:45 PM",
    deliveryStatus: "Estimated Arrival by 3:45 PM",
    isCompleted: false,
    isExpired: false,
    latestUpdates: [
      { time: "1:00 PM", description: "Truck departed from Marilao Warehouse", status: "completed" },
      { time: "1:30 PM", description: "Truck In Transit", status: "completed" },
      { time: "2:00 PM", description: "Delivery completed at Branch 1.", status: "completed" },
      { time: "2:30 PM", description: "In transit to the next delivery destination (Branch 2)", status: "current" },
      { time: "3:50 PM", description: "Delivery Completed", status: "upcoming" },
    ],
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto min-h-screen bg-[#f8fafc] font-sans text-slate-900 flex flex-col">
      
      {/* Main Website Container */}
      <div className="w-full max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        
        {deliveryData.isExpired ? (
          /* ========================================================
              EXPIRED LINK STATE VIEW
          ======================================================== */
          <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 sm:p-12 min-h-100 text-center">
            <div className="bg-black text-white px-6 py-4 rounded-xl shadow-md max-w-md w-full flex flex-col gap-1 items-center">
              <p className="text-sm sm:text-base font-semibold tracking-tight">Oops, this link has expired.</p>
              <p className="text-xs text-slate-400">You might want to contact the coordinator</p>
            </div>
          </div>
        ) : (
          /* ========================================================
              ACTIVE & COMPLETED STATES VIEW
          ======================================================== */
          <div className="flex flex-col flex-1 bg-white">
            
            {/* Live Route / Map Section */}
            <div className="bg-slate-100 border-b border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-white px-4 sm:px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 z-10">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 animate-pulse" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900">Live Route Tracking — {deliveryData.orderNumber}</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="font-semibold text-slate-600">Status: <strong className="text-blue-600">{deliveryData.isCompleted ? "Delivery Completed" : "In Transit"}</strong></span>
                </div>
              </div>

              <div className="relative w-full h-65 sm:h-87.5 md:h-100 bg-[#e5e3df] overflow-hidden flex items-center justify-center font-sans">
                
                {/* City Grid Map Background */}
                <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
                  backgroundImage: `
                    linear-gradient(to right, #ffffff 4px, transparent 4px),
                    linear-gradient(to bottom, #ffffff 4px, transparent 4px)
                  `,
                  backgroundSize: '10% 10%',
                  backgroundPosition: '-2px -2px'
                }}></div>

                {/* Map Route Connecting Line */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M 25 50 L 50 30 L 75 60" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 25 50 L 50 30 L 75 60" fill="none" stroke="#3b82f6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                {/* Top Overlay Unit Badge */}
                <div className="absolute top-3 right-3 flex items-start z-10 pointer-events-none">
                  <div className="bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg shadow-xs border border-slate-200 text-xs font-bold text-blue-600 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Unit: {deliveryData.truckNumber} - {deliveryData.plateNumber}
                  </div>
                </div>

                {/* Origin / Current Location Marker */}
                <div className="absolute left-[25%] top-[50%] transform -translate-x-1/2 -translate-y-full flex flex-col items-center z-10">
                  <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md shadow-xs border border-slate-200 text-center mb-1 pointer-events-none whitespace-nowrap">
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-800">Current Location</div>
                    <div className="text-[10px] font-medium text-slate-600">{deliveryData.currentLocation}</div>
                  </div>
                  <div className="w-6 h-6 flex items-center justify-center rounded-full shadow-md border-2 bg-emerald-500 border-white text-white">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Destination Marker */}
                <div className="absolute left-[75%] top-[60%] transform -translate-x-1/2 -translate-y-full flex flex-col items-center z-10">
                  <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md shadow-xs border border-slate-200 text-center mb-1 pointer-events-none whitespace-nowrap">
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-800">Destination</div>
                    <div className="text-[10px] font-medium text-slate-600">{deliveryData.destination}</div>
                  </div>
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full shadow-md border-2 ${deliveryData.isCompleted ? 'bg-emerald-500 border-white text-white' : 'bg-blue-600 border-white text-white animate-bounce'}`}>
                    <MapPin className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>

                {/* Driver Info / Status Widget */}
                <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
                  <div className="bg-white/95 backdrop-blur-xs px-3 py-2 rounded-lg shadow-xs border border-slate-200 text-xs font-semibold text-slate-800 flex flex-col items-end gap-0.5">
                    <span>Driver: {deliveryData.driverName} ({deliveryData.driverContact})</span>
                    <span className="text-[11px] text-slate-500 font-medium">{deliveryData.isCompleted ? "Delivery Route Completed" : "GPS Live Tracking Active"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Container */}
            <div className="flex flex-col p-4 sm:p-6 md:p-8 gap-5 bg-slate-50/50 flex-1">
              
              {/* Delivery Status Banner */}
              <div className="w-full">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {deliveryData.isCompleted ? "Delivery Completed" : "Estimated Arrival by 3:45 PM"}
                </h1>
              </div>

              {/* Multi-column Grid Layout for Desktop: Booking Details & Latest Updates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Booking Details Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-sm font-semibold text-slate-900">Booking Details</span>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                      {deliveryData.orderNumber}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 pt-0.5">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500">Truck / Plate No.</div>
                        <div className="text-sm font-medium text-slate-900">
                          {deliveryData.truckNumber} - {deliveryData.plateNumber}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500">Driver</div>
                        <div className="text-sm font-medium text-slate-900">
                          {deliveryData.driverName} - {deliveryData.driverContact}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Latest Updates Timeline Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Clock className="w-4 h-4 text-slate-700" />
                    <span className="text-sm font-semibold text-slate-900">Latest Updates</span>
                  </div>

                  <div className="flex flex-col pl-2.5 pt-1 space-y-4 relative">
                    <div className="absolute left-4.25 top-3 bottom-3 w-0.5 bg-slate-200 z-0"></div>

                    {deliveryData.latestUpdates.map((update, index) => {
                      const itemStatus = deliveryData.isCompleted ? "completed" : update.status;

                      return (
                        <div key={index} className="flex items-start gap-3.5 relative z-10">
                          <div className="mt-0.5 shrink-0">
                            {itemStatus === "completed" ? (
                              <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-xs flex items-center justify-center"></div>
                            ) : itemStatus === "current" ? (
                              <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border-4 border-blue-100 shadow-xs"></div>
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full bg-slate-300 border-2 border-white"></div>
                            )}
                          </div>

                          <div className="flex flex-col text-sm">
                            <span className={`text-sm font-medium ${itemStatus === "current" ? "text-blue-700 font-semibold" : "text-slate-900"}`}>
                              {update.time}
                            </span>
                            <span className={`text-xs text-slate-600 mt-0.5 ${itemStatus === "current" ? "font-semibold text-slate-900" : ""}`}>
                              {deliveryData.isCompleted && index === deliveryData.latestUpdates.length - 1 ? "Delivery Completed" : update.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
