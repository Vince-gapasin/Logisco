// ==========================================
// LOGISCO - CREW DASHBOARD PAGE
// ==========================================
"use client";

import React, { useState, useEffect } from "react";
import { FileText, CheckCircle2, Clock, Eye, ArrowLeft, Truck, Camera, X, AlertTriangle, Navigation, MapPin } from "lucide-react";

export interface PickupRecord {
  warehouse: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  pickupTime: string;
  quantity: string;
  status?: "Pending" | "Ongoing Delivery" | "Completed";
}

export interface DeliveryDestinationRecord {
  branch: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  deliveryTime: string;
  quantity: string;
  status?: "Pending" | "Ongoing Delivery" | "Completed";
}

export interface DeliveryRecord {
  id: string | number;
  clientName: string;
  clientEmail?: string;
  bookingId: string;
  address: string;
  dateTime: string;
  status: string; // Made flexible to handle DB variations
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
  confirmBy?: string;
  multiplePickups?: PickupRecord[];
  multipleDeliveries?: DeliveryDestinationRecord[];
}

interface CrewDashboardProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

type ViewMode = "list" | "update-status";

export default function CrewDashboardPage({
  isOpen,
  setIsOpen,
}: CrewDashboardProps) {
  const [selectedFilter, setSelectedFilter] = useState<"My Deliveries" | "Unconfirmed">("My Deliveries");

  // Fetch / Loading States
  const [deliveryList, setDeliveryList] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Action states for backend integration
  const [showDeclineConfirmModal, setShowDeclineConfirmModal] = useState<boolean>(false);
  const [declineReason, setDeclineReason] = useState<string>("");
  const [isSubmittingResponse, setIsSubmittingResponse] = useState<boolean>(false);

  // State to manage modal popup and views
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Confirmation modal states
  const [showStartConfirmModal, setShowStartConfirmModal] = useState<boolean>(false);
  const [showAcceptConfirmModal, setShowAcceptConfirmModal] = useState<boolean>(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);

  // Emergency Modal State
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [emergencyReason, setEmergencyReason] = useState<string>("Broken Truck");
  const [otherReason, setOtherReason] = useState<string>("");
  const [emergencyMessage, setEmergencyMessage] = useState<string>("");
  const [emergencyImage, setEmergencyImage] = useState<string | null>(null);
  const [emergencySubmitted, setEmergencySubmitted] = useState<boolean>(false);

  // Trip Report & Vehicle Problem States
  const [showTripReportModal, setShowTripReportModal] = useState<boolean>(false);
  const [tripReportNoIssue, setTripReportNoIssue] = useState<boolean>(false);
  const [showVehicleProblemModal, setShowVehicleProblemModal] = useState<boolean>(false);
  
  // Success Confirmation States
  const [showRemarksSuccess, setShowRemarksSuccess] = useState<boolean>(false);
  const [showProblemSuccess, setShowProblemSuccess] = useState<boolean>(false);

  // Trip Report inputs
  const [tripRemarks, setTripRemarks] = useState<string>("");
  const [tripNotes, setTripNotes] = useState<string>("");
  const [vehicleIssues, setVehicleIssues] = useState<string>("");
  const [vehicleNotes, setVehicleNotes] = useState<string>("");

  // Update Status specific states
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const stages = ["Start Delivery", "In Warehouse", "In Transit", "Arrived", "Delivered", "Returned"];

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ==========================================
  // FETCH REAL DATA ON MOUNT
  // ==========================================
  useEffect(() => {
    const fetchMyDispatches = async () => {
      try {
        setIsLoading(true);
        const sessionStr = localStorage.getItem("logisco_user_session") || sessionStorage.getItem("logisco_user_session");
        const token = sessionStr ? JSON.parse(sessionStr).token : "";

        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch("/api/crew/dispatches", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error("Failed to fetch dispatches");
        
        const data = await response.json();
        console.log("📦 Fetched Deliveries from API:", data);
        setDeliveryList(data);
      } catch (error) {
        console.error("Error fetching dispatches:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyDispatches();
  }, []);

  // Reset page to 1 when switching tabs
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter]);

  // ==========================================
  // BULLETPROOF STATUS HELPERS
  // ==========================================
  const isAccepted = (status?: string) => {
    if (!status) return false;
    const s = String(status).trim().toLowerCase();
    return s === "accepted" || s === "in transit" || s === "ongoing delivery" || s === "completed";
  };

  const isUnconfirmed = (status?: string) => {
    // If it is NOT actively moving or accepted, it catches it as unconfirmed
    return !isAccepted(status);
  };

  // Category counts using strict logic
  const myDeliveriesCount = deliveryList.filter((d) => isAccepted(d.status)).length;
  const unconfirmedCount = deliveryList.filter((d) => isUnconfirmed(d.status)).length;

  // Filter logic based on tabs only
  const filteredDeliveries = deliveryList.filter((delivery) => {
    return selectedFilter === "My Deliveries"
      ? isAccepted(delivery.status)
      : isUnconfirmed(delivery.status);
  });

  // Pagination Math
  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDeliveries = filteredDeliveries.slice(startIndex, endIndex);

  // Handle row click to open popup modal
  const handleRowClick = (delivery: DeliveryRecord) => {
    setSelectedDelivery(delivery);
    setShowDetailsModal(true);
    setShowStartConfirmModal(false);
    setShowAcceptConfirmModal(false);
    setShowDeclineConfirmModal(false);
    setShowSubmitConfirmModal(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
    }
  };

  const handleEmergencyImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setEmergencyImage(imageUrl);
    }
  };

  const handleUpdateStatusSubmit = () => {
    setShowSubmitConfirmModal(false);
    
    if (currentStageIndex === 5) {
      setShowTripReportModal(true);
    } else {
      alert(`Status updated successfully to: ${stages[currentStageIndex]}`);
      setViewMode("list");
      setSelectedDelivery(null);
    }
  };

  const handleSetStage = (index: number) => {
    setCurrentStageIndex(index);
  };

  const handleSendEmergencyAlert = () => {
    setEmergencySubmitted(true);
    setTimeout(() => {
      setEmergencySubmitted(false);
      setShowEmergencyModal(false);
      setEmergencyMessage("");
      setOtherReason("");
      if (emergencyImage) {
        URL.revokeObjectURL(emergencyImage);
        setEmergencyImage(null);
      }
    }, 2000);
  };

  const completeTripWorkflow = () => {
    setShowTripReportModal(false);
    setShowVehicleProblemModal(false);
    setTripReportNoIssue(false);
    setTripRemarks("");
    setTripNotes("");
    setVehicleIssues("");
    setVehicleNotes("");
    
    setViewMode("list");
    setSelectedDelivery(null);
    setCurrentStageIndex(0);
  };

  const handleSendRemarks = () => {
    setShowRemarksSuccess(true);
    setTimeout(() => {
      setShowRemarksSuccess(false);
      completeTripWorkflow();
    }, 2000);
  };

  const handleSendProblem = () => {
    if (vehicleIssues.trim() !== "") {
      setShowProblemSuccess(true);
      setTimeout(() => {
        setShowProblemSuccess(false);
        completeTripWorkflow();
      }, 2000);
    } else {
      alert("Please fill out the Issues Observed field.");
    }
  };

  // API Integration: Accept or Decline a Dispatch Order
  const handleDispatchResponse = async (action: "accept" | "decline") => {
    if (!selectedDelivery) return;
    if (action === "decline" && !declineReason.trim()) {
      alert("Please provide a reason for declining.");
      return;
    }

    setIsSubmittingResponse(true);
    try {
      const sessionStr = localStorage.getItem("logisco_user_session") || sessionStorage.getItem("logisco_user_session");
      const token = sessionStr ? JSON.parse(sessionStr).token : "";

      const response = await fetch("/api/crew/dispatches/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          dispatchID: selectedDelivery.id, 
          action,
          reason: action === "decline" ? declineReason : undefined
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to update status");
      }

      setDeliveryList((prev) =>
        prev.map((d) =>
          d.id === selectedDelivery.id ? { ...d, status: action === "accept" ? "Accepted" : "Declined" } : d
        )
      );
      
      setShowAcceptConfirmModal(false);
      setShowDeclineConfirmModal(false);
      setShowDetailsModal(false);
      setDeclineReason("");
      
      alert(`Assignment ${action}ed successfully.`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-100 text-emerald-800 border border-emerald-300";
      case "Ongoing Delivery":
        return "bg-blue-100 text-blue-800 border border-blue-300";
      default:
        return "bg-amber-100 text-amber-800 border border-amber-300";
    }
  };

  // ==========================================
  // SHARED STATUS LOGIC HOISTED
  // ==========================================
  const hasTwoPickups = selectedDelivery ? (selectedDelivery.multiplePickups?.length || 0) > 1 : false;
  let pickup1Status: "Pending" | "Ongoing Delivery" | "Completed" = "Pending";
  let pickup2Status: "Pending" | "Ongoing Delivery" | "Completed" = "Pending";

  if (selectedDelivery) {
    if (!hasTwoPickups) {
      if (currentStageIndex === 0) {
        pickup1Status = "Ongoing Delivery";
      } else if (currentStageIndex === 1) {
        pickup1Status = "Ongoing Delivery";
      } else {
        pickup1Status = "Completed";
      }
    } else {
      if (currentStageIndex === 0) {
        pickup1Status = "Ongoing Delivery";
        pickup2Status = "Pending";
      } else if (currentStageIndex === 1) {
        pickup1Status = "Completed";
        pickup2Status = "Ongoing Delivery";
      } else {
        pickup1Status = "Completed";
        pickup2Status = "Completed";
      }
    }

    // Force Pending UI if we are just looking at the preview modal
    if (viewMode === "list") {
      pickup1Status = "Pending";
      pickup2Status = "Pending";
    }
  }

  // ==========================================
  // UPDATE STATUS PAGE VIEW
  // ==========================================
  if (viewMode === "update-status" && selectedDelivery) {
    let currentStopName = "Pickup #1";
    let currentStopStatus: "Pending" | "Ongoing Delivery" | "Completed" = pickup1Status;
    
    if (hasTwoPickups && pickup1Status === "Completed" && pickup2Status !== "Completed") {
      currentStopName = "Pickup #2";
      currentStopStatus = pickup2Status;
    } else if ((hasTwoPickups && pickup2Status === "Completed") || (!hasTwoPickups && pickup1Status === "Completed")) {
      const delivs = selectedDelivery.multipleDeliveries || [];
      const firstDelivDone = currentStageIndex >= 3;
      if (!firstDelivDone && delivs.length > 0) {
        currentStopName = `Delivery #1 (${delivs[0].branch})`;
        currentStopStatus = "Ongoing Delivery";
      } else if (delivs.length > 1 && currentStageIndex < 4) {
        currentStopName = `Delivery #2 (${delivs[1].branch})`;
        currentStopStatus = "Ongoing Delivery";
      } else {
        currentStopName = "Completed";
        currentStopStatus = "Completed";
      }
    }

    const mapStops: Array<{ id: string, type: 'pickup' | 'delivery', title: string, name: string, status: string, x: number, y: number }> = [];
    
    // Add Pickups
    if (hasTwoPickups) {
      mapStops.push({ id: 'p1', type: 'pickup', title: 'Pickup #1', name: selectedDelivery.multiplePickups![0].warehouse, status: pickup1Status, x: 20, y: 55 });
      mapStops.push({ id: 'p2', type: 'pickup', title: 'Pickup #2', name: selectedDelivery.multiplePickups![1].warehouse, status: pickup2Status, x: 40, y: 40 });
    } else {
      mapStops.push({ id: 'p1', type: 'pickup', title: 'Pickup #1', name: selectedDelivery.multiplePickups?.[0]?.warehouse || selectedDelivery.pickupAddress, status: pickup1Status, x: 25, y: 50 });
    }

    // Add Deliveries
    selectedDelivery.multipleDeliveries?.forEach((deliv, idx) => {
      let delivStatus = "Pending";
      const bothPickupsDone = hasTwoPickups ? (pickup2Status === "Completed") : (pickup1Status === "Completed");

      if (!bothPickupsDone) {
        delivStatus = "Pending";
      } else {
        if (idx === 0) {
          delivStatus = currentStageIndex >= 3 ? "Completed" : "Ongoing Delivery";
        } else {
          const prevDone = currentStageIndex >= (3 + idx);
          delivStatus = prevDone ? "Completed" : (currentStageIndex >= (3 + idx - 1) ? "Ongoing Delivery" : "Pending");
        }
      }
      
      const positions = [ {x: 65, y: 60}, {x: 80, y: 40}, {x: 50, y: 70} ];
      mapStops.push({ 
        id: `d${idx+1}`, 
        type: 'delivery', 
        title: `Delivery #${idx+1}`, 
        name: deliv.branch, 
        status: delivStatus, 
        x: positions[idx % positions.length].x, 
        y: positions[idx % positions.length].y 
      });
    });

    let truckX = mapStops[0].x;
    let truckY = mapStops[0].y;

    if (currentStageIndex === 0) {
      truckX = mapStops[0].x;
      truckY = mapStops[0].y;
    } else if (currentStageIndex === 1) {
      const activeIdx = mapStops.findIndex(s => s.status === 'Ongoing Delivery');
      const idx = activeIdx !== -1 ? activeIdx : 0;
      truckX = mapStops[idx].x;
      truckY = mapStops[idx].y;
    } else if (currentStageIndex === 2) {
      const nextIdx = mapStops.findIndex(s => s.status === 'Ongoing Delivery' || s.status === 'Pending');
      if (nextIdx > 0) {
        const prev = mapStops[nextIdx - 1];
        const next = mapStops[nextIdx];
        truckX = prev.x + (next.x - prev.x) * 0.45; 
        truckY = prev.y + (next.y - prev.y) * 0.45;
      } else {
        truckX = mapStops[0].x;
        truckY = mapStops[0].y;
      }
    } else if (currentStageIndex === 3) {
      const activeIdx = mapStops.findIndex(s => s.status === 'Ongoing Delivery');
      const idx = activeIdx !== -1 ? activeIdx : mapStops.length - 1;
      truckX = mapStops[idx].x;
      truckY = mapStops[idx].y;
    } else if (currentStageIndex >= 4) {
      const last = mapStops[mapStops.length - 1];
      truckX = last.x;
      truckY = last.y;
    }

    const fullPathD = `M ${mapStops[0].x} ${mapStops[0].y} ` + mapStops.slice(1).map(s => `L ${s.x} ${s.y}`).join(' ');
    
    let activePathD = `M ${mapStops[0].x} ${mapStops[0].y}`;
    const nextIdx = mapStops.findIndex(s => s.status === 'Ongoing Delivery' || s.status === 'Pending');

    if (currentStageIndex >= 4 || mapStops.every(s => s.status === 'Completed')) {
        activePathD = fullPathD;
    } else {
        for (let i = 1; i <= nextIdx; i++) {
            if (i === nextIdx) {
                activePathD += ` L ${truckX} ${truckY}`;
            } else {
                activePathD += ` L ${mapStops[i].x} ${mapStops[i].y}`;
            }
        }
    }

    return (
      <div className="p-3 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative">
        <div className="flex items-center justify-between mb-6 gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode("list")}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Update Delivery Status
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Modify current delivery progress and upload proof of delivery.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Emergency</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">
          
          {/* MAP-BASED DELIVERY TRACKING SECTION */}
          <div className="bg-[#e0f2fe] rounded-2xl border border-slate-300 overflow-hidden shadow-sm flex flex-col">
            <div className="bg-white px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 z-10 relative">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600 animate-pulse" />
                <span className="text-sm font-semibold text-slate-900">Tracking Deliveries</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600">Next: <strong className="text-blue-600">{currentStopName}</strong></span>
              </div>
            </div>

            <div className="relative w-full h-80 sm:h-100 md:h-120 bg-[#e0f2fe] overflow-hidden flex items-center justify-center font-sans">
              
              <div className="absolute inset-0 pointer-events-none opacity-60">
                <svg className="w-full h-full" preserveAspectRatio="none">
                  <path d="M-10,15 L 30,25 L 40,-10 M 30,25 L 50,80 L 110,60 M 50,80 L 30,110 M 80,-10 L 70,40 L 110,30" stroke="#ffffff" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M-10,60 L 20,50 L 30,80 M 70,40 L 90,80 L 110,90" stroke="#ffffff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 20,-10 L 25,100 M 90,-10 L 80,110" stroke="#ffffff" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d={fullPathD} fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={activePathD} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl shadow-md border border-slate-200 text-xs font-medium text-slate-800">
                  {selectedDelivery.bookingId}
                </div>
                <div className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl shadow-md border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-600" /> Unit: {selectedDelivery.assignedVehicle}
                </div>
              </div>

              {mapStops.map((stop) => (
                <div 
                  key={stop.id} 
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
                  style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-slate-200 text-center whitespace-nowrap pointer-events-none">
                    <div className="text-xs font-bold text-slate-800">{stop.title}</div>
                  </div>
                  
                  {stop.type === 'pickup' ? (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#3b82f6] flex items-center justify-center shadow-lg border-[3px] border-[#bfdbfe]">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-current" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-lg border border-slate-200">
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                    </div>
                  )}
                </div>
              ))}

              <div 
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-700 ease-in-out"
                style={{ left: `${truckX}%`, top: `${truckY}%` }}
              >
                <div className="bg-[#2563eb] w-8 h-8 sm:w-9 sm:h-9 rounded-full border-[2.5px] border-white flex items-center justify-center shadow-xl">
                  <Truck className="w-4 h-4 text-white fill-current" strokeWidth={1} />
                </div>
              </div>
              
            </div>

            <div className="bg-white px-2 sm:px-6 pt-12 pb-6 border-t border-slate-200 z-10 relative">
              <div className="relative flex justify-between items-center w-full max-w-4xl mx-auto px-4 sm:px-8">
                <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0"></div>
                <div className="absolute left-8 top-1/2 -translate-y-1/2 h-1 bg-blue-600 z-0 transition-all duration-500" style={{ width: `calc(${ (currentStageIndex / (stages.length - 1)) * 100 }% - 64px)` }}></div>

                {stages.map((stage, index) => {
                  const isActive = index <= currentStageIndex;
                  const isCurrent = index === currentStageIndex;
                  return (
                    <div key={stage} className="relative z-10 flex flex-col items-center cursor-pointer group px-0.5" onClick={() => handleSetStage(index)}>
                      <span className={`text-[9px] sm:text-xs font-bold absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 text-center w-16 sm:w-max whitespace-normal sm:whitespace-nowrap leading-tight transition-colors duration-300 ${isActive ? 'text-slate-900 font-extrabold' : 'text-slate-400'}`}>
                        {stage === "Start Delivery" ? (
                          <>
                            <span className="block sm:hidden leading-none mb-0.5">Start</span>
                            <span className="block sm:hidden leading-none">Delivery</span>
                            <span className="hidden sm:inline">Start Delivery</span>
                          </>
                        ) : stage === "In Warehouse" ? (
                          <>
                            <span className="block sm:hidden leading-none mb-0.5">In</span>
                            <span className="block sm:hidden leading-none">Warehouse</span>
                            <span className="hidden sm:inline">In Warehouse</span>
                          </>
                        ) : stage}
                      </span>
                      <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-all duration-300 flex items-center justify-center ${isActive ? 'bg-blue-600' : 'bg-slate-300'} ${isCurrent ? 'ring-4 ring-blue-100 scale-125' : 'group-hover:scale-110'}`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4 text-sm text-slate-900">
            {/* Pickup Addresses Section */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide flex items-center justify-between">
                <span>Pickup Addresses</span>
                <span className="text-xs text-slate-500 font-normal">Sequential Pickup Workflow</span>
              </div>
              <div className="space-y-4">
                {selectedDelivery.multiplePickups && selectedDelivery.multiplePickups.length > 0 ? (
                  selectedDelivery.multiplePickups.map((pickup, idx) => {
                    const status = idx === 0 ? pickup1Status : pickup2Status;
                    return (
                      <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 text-sm">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-blue-600 font-bold truncate">Pickup Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs whitespace-nowrap shrink-0 ${getStatusBadgeClass(status)}`}>
                            {status}
                          </span>
                        </div>
                        <span className="text-base font-bold text-slate-900 truncate">{pickup.warehouse}</span>
                        <span className="text-slate-700 truncate">{pickup.address}</span>
                        <span className="text-slate-700 truncate">{pickup.contactPerson} | ({pickup.contactNumber})</span>
                        <span className="text-slate-700 truncate">Delivery Time: {pickup.pickupTime}</span>
                        <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                        <span className="text-slate-700 truncate">Qty: {pickup.quantity}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-blue-600 font-bold truncate">Pickup Address #1</span>
                      <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs whitespace-nowrap shrink-0 ${getStatusBadgeClass(pickup1Status)}`}>
                        {pickup1Status}
                      </span>
                    </div>
                    <span className="text-base font-bold text-slate-900 truncate">{selectedDelivery.pickupAddress.split(",")[0] || "Jollibee Commissary"}</span>
                    <span className="text-slate-700 truncate">{selectedDelivery.pickupAddress}</span>
                    <span className="text-slate-700 truncate">{selectedDelivery.contactPerson} | ({selectedDelivery.contactNumber})</span>
                    <span className="text-slate-700 truncate">Delivery Time: {selectedDelivery.pickupTime}</span>
                    <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                    <span className="text-slate-700 truncate">Qty: {selectedDelivery.quantity || "3,500 lbs"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Addresses */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                Delivery Addresses
              </div>
              <div className="space-y-4">
                {selectedDelivery.multipleDeliveries && selectedDelivery.multipleDeliveries.length > 0 ? (
                  selectedDelivery.multipleDeliveries.map((deliv, idx) => {
                    let delivStatus: "Pending" | "Ongoing Delivery" | "Completed" = "Pending";
                    const bothPickupsDone = hasTwoPickups ? (pickup2Status === "Completed") : (pickup1Status === "Completed");

                    if (!bothPickupsDone) {
                      delivStatus = "Pending";
                    } else {
                      if (idx === 0) {
                        delivStatus = currentStageIndex >= 3 ? "Completed" : "Ongoing Delivery";
                      } else {
                        const prevDone = currentStageIndex >= (3 + idx);
                        delivStatus = prevDone ? "Completed" : (currentStageIndex >= (3 + idx - 1) ? "Ongoing Delivery" : "Pending");
                      }
                    }

                    return (
                      <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 text-sm">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-blue-600 font-bold truncate">Delivery Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs whitespace-nowrap shrink-0 ${getStatusBadgeClass(delivStatus)}`}>
                            {delivStatus}
                          </span>
                        </div>
                        <span className="text-base font-bold text-slate-900 truncate">{deliv.branch}</span>
                        <span className="text-slate-700 truncate">{deliv.address}</span>
                        <span className="text-slate-700 truncate">{deliv.contactPerson} | ({deliv.contactNumber})</span>
                        <span className="text-slate-700 truncate">Delivery Time: {deliv.deliveryTime}</span>
                        <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                        <span className="text-slate-700 truncate">Qty: {deliv.quantity}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-blue-600 font-bold truncate">Delivery Address #1</span>
                      <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs whitespace-nowrap shrink-0 ${getStatusBadgeClass(pickup1Status === "Completed" ? (currentStageIndex >= 3 ? "Completed" : "Ongoing Delivery") : "Pending")}`}>
                        {pickup1Status === "Completed" ? (currentStageIndex >= 3 ? "Completed" : "Ongoing Delivery") : "Pending"}
                      </span>
                    </div>
                    <span className="text-base font-bold text-slate-900 truncate">{selectedDelivery.clientName}</span>
                    <span className="text-slate-700 truncate">{selectedDelivery.deliveryAddress}</span>
                    <span className="text-slate-700 truncate">{selectedDelivery.contactPerson} | ({selectedDelivery.contactNumber})</span>
                    <span className="text-slate-700 truncate">Delivery Time: {selectedDelivery.deliveryTime}</span>
                    <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                    <span className="text-slate-700 truncate">Qty: {selectedDelivery.quantity || "3,500 lbs"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Remarks & Notes */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                Remarks & Notes
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Remarks (Optional)</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Ex. On the way to the warehouse address"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-24"
                />
              </div>
            </div>

            {/* Proof of Delivery */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide flex items-center justify-between gap-2">
                <span className="truncate">Proof of Delivery</span>
                <span className="text-xs text-slate-500 font-normal whitespace-nowrap shrink-0">(POD required)</span>
              </div>
              <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden relative">
                {selectedImage ? (
                  <img src={selectedImage} alt="POD Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                    <Camera className="w-8 h-8 text-slate-400 mb-2 stroke-[1.5]" />
                    <span className="text-xs font-semibold text-slate-700">Tap to upload photo</span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end pt-4 border-t border-slate-200">
            <button
              onClick={() => setShowSubmitConfirmModal(true)}
              className="w-full sm:w-40 py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              Update Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // CREW DASHBOARD VIEW (LIST)
  // ==========================================
  return (
    <div className="p-3 sm:p-5 md:p-6 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 pl-1 lg:pl-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Crew Delivery Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your assigned delivery schedules and confirm pending bookings.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 px-4 sm:px-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 w-full overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setSelectedFilter("My Deliveries")}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                selectedFilter === "My Deliveries"
                  ? "bg-blue-600 text-white hover:bg-black shadow-md shadow-blue-600/20"
                  : "bg-slate-100 text-slate-600 hover:bg-black hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">My Deliveries ({myDeliveriesCount})</span>
            </button>

            <button
              onClick={() => setSelectedFilter("Unconfirmed")}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                selectedFilter === "Unconfirmed"
                  ? "bg-amber-600 text-white hover:bg-black shadow-md shadow-amber-600/20"
                  : "bg-amber-50 text-amber-700 hover:bg-black hover:text-white border border-amber-200/50"
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">Unconfirmed ({unconfirmedCount})</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={2} className="py-10 text-center">
                    <div className="flex justify-center items-center">
                      <span className="text-sm font-semibold text-slate-500 animate-pulse">Loading dispatches...</span>
                    </div>
                  </td>
                </tr>
              ) : currentDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-10 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                        <FileText className="w-4 h-4" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        No delivery records found
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Try switching tabs to view other records.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentDeliveries.map((delivery) => (
                  <tr
                    key={delivery.id}
                    onClick={() => handleRowClick(delivery)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 pl-4 sm:pl-8 md:pl-16 pr-2 text-left w-2/3 overflow-hidden">
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base mb-0.5 truncate">
                        {delivery.clientName}
                      </div>
                      <div className="text-xs font-semibold text-slate-600 mb-0.5 whitespace-nowrap">
                        {delivery.bookingId}
                      </div>
                      <div className="text-xs text-slate-500 mb-0.5 truncate w-full" title={delivery.address}>
                        {delivery.address}
                      </div>
                      <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                        {delivery.dateTime}
                      </div>
                    </td>

                    <td className="py-3 pr-4 sm:pr-8 md:pr-16 pl-2 align-top w-1/3">
                      <div className="flex flex-col items-end justify-start gap-1 h-full">
                        <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors text-right whitespace-nowrap">
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span className="whitespace-nowrap">Click to View</span>
                        </div>
                        <span
                          className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                            isAccepted(delivery.status)
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isUnconfirmed(delivery.status) ? "Awaiting Confirmation" : delivery.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 px-4 sm:px-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-700 bg-white">
          <span className="whitespace-nowrap">
            Showing {filteredDeliveries.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredDeliveries.length)} of{" "}
            {filteredDeliveries.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors whitespace-nowrap ${
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
              className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors whitespace-nowrap ${
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

      {/* DELIVERY INFORMATION MODAL POPUP */}
      {showDetailsModal && selectedDelivery && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto max-h-[80vh] flex flex-col">
            
            <div className="flex items-center justify-between px-3 sm:px-6 py-4 bg-[#000c31] text-white border-b border-slate-800 shrink-0 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-sm md:text-lg font-bold text-white tracking-tight truncate leading-tight">
                    Delivery Information
                  </h2>
                  <p className="text-slate-300 text-[10px] sm:text-xs font-semibold mt-0.5 truncate">
                    Order ID: <span className="font-semibold text-white">{selectedDelivery.bookingId}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {isAccepted(selectedDelivery.status) ? (
                  <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-500 text-white shadow-sm whitespace-nowrap">
                    {selectedDelivery.status}
                  </span>
                ) : (
                  <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-400 text-slate-900 shadow-sm whitespace-nowrap">
                    Awaiting Confirmation
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto text-sm text-slate-900 bg-slate-50/50 flex-1">
              
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                  1. Client Information
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Company / Client Name</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.clientName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.contactPerson}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Contact Number</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.contactNumber}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.clientEmail || "admin@client.com"}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Business Address</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.address}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                  2. Booking Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Delivery Schedule</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.scheduledDate}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Product to Deliver</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.product}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.quantity || "3,500 lbs"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Priority Level</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      {selectedDelivery.priorityLevel || "Standard"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                  3. Assigned Delivery Crew & Vehicle
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Truck Plate No.</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.assignedVehicle}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Driver</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.driver}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Helper #1</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.helper}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Helper #2</label>
                    <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">
                      {selectedDelivery.helper2 || "None"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                  4. Pickup Addresses
                </div>
                <div className="space-y-4">
                  {selectedDelivery.multiplePickups && selectedDelivery.multiplePickups.length > 0 ? (
                    selectedDelivery.multiplePickups.map((pickup, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-blue-600 font-bold truncate">Pickup Address #{idx + 1}</span>
                          <span className="px-2.5 py-0.5 rounded-full font-semibold text-xs bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap shrink-0">
                            Pending
                          </span>
                        </div>
                        <span className="text-base font-bold text-slate-900 truncate">{pickup.warehouse}</span>
                        <span className="text-slate-700 truncate">{pickup.address}</span>
                        <span className="text-slate-700 truncate">{pickup.contactPerson} | ({pickup.contactNumber})</span>
                        <span className="text-slate-700 truncate">Delivery Time: {pickup.pickupTime}</span>
                        <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                        <span className="text-slate-700 truncate">Qty: {pickup.quantity}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-blue-600 font-bold truncate">Pickup Address #1</span>
                        <span className="px-2.5 py-0.5 rounded-full font-semibold text-xs bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap shrink-0">
                          Pending
                        </span>
                      </div>
                      <span className="text-base font-bold text-slate-900 truncate">{selectedDelivery.pickupAddress.split(",")[0] || "Jollibee Commissary"}</span>
                      <span className="text-slate-700 truncate">{selectedDelivery.pickupAddress}</span>
                      <span className="text-slate-700 truncate">{selectedDelivery.contactPerson} | ({selectedDelivery.contactNumber})</span>
                      <span className="text-slate-700 truncate">Delivery Time: {selectedDelivery.pickupTime}</span>
                      <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                      <span className="text-slate-700 truncate">Qty: {selectedDelivery.quantity || "3,500 lbs"}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                  5. Delivery Address
                </div>
                <div className="space-y-4">
                  {selectedDelivery.multipleDeliveries && selectedDelivery.multipleDeliveries.length > 0 ? (
                    selectedDelivery.multipleDeliveries.map((deliv, idx) => {
                      let delivStatus: "Pending" | "Ongoing Delivery" | "Completed" = "Pending";
                      const bothPickupsDone = hasTwoPickups ? (pickup2Status === "Completed") : (pickup1Status === "Completed");

                      if (!bothPickupsDone) {
                        delivStatus = "Pending";
                      } else {
                        if (idx === 0) {
                          delivStatus = currentStageIndex >= 3 ? "Completed" : "Ongoing Delivery";
                        } else {
                          const prevDone = currentStageIndex >= (3 + idx);
                          delivStatus = prevDone ? "Completed" : (currentStageIndex >= (3 + idx - 1) ? "Ongoing Delivery" : "Pending");
                        }
                      }

                      return (
                        <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 text-sm">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-blue-600 font-bold truncate">Delivery Address #{idx + 1}</span>
                            <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs whitespace-nowrap shrink-0 ${getStatusBadgeClass(delivStatus)}`}>
                              {delivStatus}
                            </span>
                          </div>
                          <span className="text-base font-bold text-slate-900 truncate">{deliv.branch}</span>
                          <span className="text-slate-700 truncate">{deliv.address}</span>
                          <span className="text-slate-700 truncate">{deliv.contactPerson} | ({deliv.contactNumber})</span>
                          <span className="text-slate-700 truncate">Delivery Time: {deliv.deliveryTime}</span>
                          <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                          <span className="text-slate-700 truncate">Qty: {deliv.quantity}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-blue-600 font-bold truncate">Delivery Address #1</span>
                        <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs whitespace-nowrap shrink-0 ${getStatusBadgeClass(pickup1Status === "Completed" ? (currentStageIndex >= 3 ? "Completed" : "Ongoing Delivery") : "Pending")}`}>
                          {pickup1Status === "Completed" ? (currentStageIndex >= 3 ? "Completed" : "Ongoing Delivery") : "Pending"}
                        </span>
                      </div>
                      <span className="text-base font-bold text-slate-900 truncate">{selectedDelivery.clientName}</span>
                      <span className="text-slate-700 truncate">{selectedDelivery.deliveryAddress}</span>
                      <span className="text-slate-700 truncate">{selectedDelivery.contactPerson} | ({selectedDelivery.contactNumber})</span>
                      <span className="text-slate-700 truncate">Delivery Time: {selectedDelivery.deliveryTime}</span>
                      <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                      <span className="text-slate-700 truncate">Qty: {selectedDelivery.quantity || "3,500 lbs"}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                  6. Notes / Instructions
                </div>
                <div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 min-h-16 leading-relaxed">
                  {selectedDelivery.notes}
                </div>
              </div>

            </div>

            <div className="px-4 sm:px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              {isUnconfirmed(selectedDelivery.status) ? (
                <>
                  <span className="text-xs sm:text-sm text-red-500 font-semibold text-center sm:text-left truncate">
                    Please confirm by {selectedDelivery.confirmBy || "the required date"}.
                  </span>
                  <div className="flex w-full sm:w-auto gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowDeclineConfirmModal(true)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Decline Assignment
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAcceptConfirmModal(true)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Accept Assignment
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex justify-end w-full">
                  <button
                    type="button"
                    onClick={() => setShowStartConfirmModal(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
                  >
                    Start Delivery
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Start / Accept Confirmation Modal */}
      {(showStartConfirmModal || showAcceptConfirmModal) && selectedDelivery && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {showStartConfirmModal ? "Start Delivery" : "Confirm Assignment"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              {showStartConfirmModal ? "Are you sure you want to start this delivery?" : "Confirm this delivery assignment?"}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowStartConfirmModal(false);
                  setShowAcceptConfirmModal(false);
                }}
                disabled={isSubmittingResponse}
                className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-sm whitespace-nowrap disabled:opacity-50"
              >
                No
              </button>
              <button
                onClick={() => {
                  if (showStartConfirmModal) {
                    setShowStartConfirmModal(false);
                    setShowDetailsModal(false);
                    setCurrentStageIndex(0);
                    setViewMode("update-status");
                  } else {
                    handleDispatchResponse("accept");
                  }
                }}
                disabled={isSubmittingResponse}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-semibold responsive-btn rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50"
              >
                {isSubmittingResponse && !showStartConfirmModal ? "Accepting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Assignment Modal */}
      {showDeclineConfirmModal && selectedDelivery && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Decline Assignment</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              Are you sure you want to decline this dispatch? You must provide a valid reason.
            </p>
            
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Ex. Sick leave, Family emergency, Vehicle issues..."
              className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-24 mb-6"
              required
            />

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowDeclineConfirmModal(false);
                  setDeclineReason("");
                }}
                disabled={isSubmittingResponse}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDispatchResponse("decline")}
                disabled={isSubmittingResponse || !declineReason.trim()}
                className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50 hover:bg-red-700"
              >
                {isSubmittingResponse ? "Submitting..." : "Submit Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}