// ==========================================
// LOGISCO - CREW DASHBOARD PAGE
// ==========================================
"use client";

import React, { useState, useEffect } from "react";
import { FileText, CheckCircle2, Clock, Eye, ArrowLeft, Truck, Camera, X, AlertTriangle, Navigation, MapPin, Search, Archive } from "lucide-react";

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

export interface DeliveryRecord {
  id: string | number;
  clientName: string;
  clientEmail?: string;
  bookingId: string;
  address: string;
  dateTime: string;
  status: string; 
  current_step?: number; 
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
  dispatchNote?: string; 
  pod_url?: string;      
  multiplePickups?: PickupRecord[];
  multipleDeliveries?: DeliveryDestinationRecord[];
  localUpdatedAt?: number;
}

interface CrewDashboardProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

type ViewMode = "list" | "update-status";
type TabFilter = "Active" | "Unconfirmed" | "Completed";

const generateDynamicStops = (delivery: DeliveryRecord) => {
  const stops = [];
  stops.push({ title: "Start Delivery", type: "base", reqPod: false });

  if (delivery.multiplePickups && delivery.multiplePickups.length > 0) {
    delivery.multiplePickups.forEach((p) => {
      stops.push({ title: `Pickup: ${p.warehouse}`, type: "pickup", reqPod: true, data: p });
    });
  } else {
    stops.push({ title: `Pickup: ${delivery.pickupAddress?.split(',')[0] || 'Base'}`, type: "pickup", reqPod: true });
  }

  if (delivery.multipleDeliveries && delivery.multipleDeliveries.length > 0) {
    delivery.multipleDeliveries.forEach((d) => {
      stops.push({ title: `Dropoff: ${d.branch}`, type: "delivery", reqPod: true, data: d });
    });
  } else {
    stops.push({ title: `Dropoff: ${delivery.clientName}`, type: "delivery", reqPod: true });
  }

  stops.push({ title: "Returned", type: "base", reqPod: false });
  return stops;
};

// Smart filter that strips out the redundant system-generated text
const formatDispatchNote = (note?: string, delivery?: DeliveryRecord) => {
  if (!note) return "No final remarks logged.";
  
  const formatted = note
    .replace(/\[DELIVERY DETAILS\]/gi, '\n[DELIVERY DETAILS]\n')
    .replace(/\[ASSIGNED CREW\]/gi, '\n[ASSIGNED CREW]\n')
    .replace(/(Priority:|Request Date:|Delivery Schedule:|Pickup:|Truck:|Driver:|Helper 1:|Helper 2:)/gi, '\n$1');

  return (
    <div className="space-y-1.5">
      {formatted.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          return (
            <div key={idx} className="font-bold text-emerald-800 text-[11px] tracking-wider uppercase mt-4 mb-2 border-b border-emerald-200/50 pb-1 first:mt-0">
              {trimmed.replace(/\[|\]/g, '')}
            </div>
          );
        }

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > -1) {
          const label = trimmed.substring(0, colonIdx + 1);
          let value = trimmed.substring(colonIdx + 1).trim();

          if (delivery) {
            if (label === 'Truck:' && delivery.assignedVehicle) value = delivery.assignedVehicle;
            if (label === 'Driver:' && delivery.driver) value = delivery.driver;
            if (label === 'Helper 1:' && delivery.helper) value = delivery.helper;
            if (label === 'Helper 2:' && delivery.helper2) value = delivery.helper2;
          }

          return (
            <div key={idx} className="text-xs text-slate-700 pl-2 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
              <span className="font-semibold text-slate-900 shrink-0 sm:w-32">{label}</span>
              <span className="break-words text-slate-600">{value}</span>
            </div>
          );
        }

        return <div key={idx} className="text-xs text-slate-700 pl-2">{trimmed}</div>;
      })}
    </div>
  );
};

export default function CrewDashboardPage({
  isOpen,
  setIsOpen,
}: CrewDashboardProps) {
  const [selectedFilter, setSelectedFilter] = useState<TabFilter>("Active");
  const [searchTerm, setSearchTerm] = useState("");

  const [deliveryList, setDeliveryList] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [showDeclineConfirmModal, setShowDeclineConfirmModal] = useState<boolean>(false);
  const [declineReason, setDeclineReason] = useState<string>("");
  const [isSubmittingResponse, setIsSubmittingResponse] = useState<boolean>(false);

  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [showStartConfirmModal, setShowStartConfirmModal] = useState<boolean>(false);
  const [showAcceptConfirmModal, setShowAcceptConfirmModal] = useState<boolean>(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);

  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [emergencyReason, setEmergencyReason] = useState<string>("Broken Truck");
  const [otherReason, setOtherReason] = useState<string>("");
  const [emergencyMessage, setEmergencyMessage] = useState<string>("");
  const [emergencyImage, setEmergencyImage] = useState<string | null>(null);
  const [emergencySubmitted, setEmergencySubmitted] = useState<boolean>(false);

  const [showTripReportModal, setShowTripReportModal] = useState<boolean>(false);
  const [tripRemarks, setTripRemarks] = useState<string>("");
  const [vehicleIssues, setVehicleIssues] = useState<string>("");
  const [showRemarksSuccess, setShowRemarksSuccess] = useState<boolean>(false);

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dynamicStops, setDynamicStops] = useState<any[]>([]);
  const [remarks, setRemarks] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [receiverName, setReceiverName] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
        setDeliveryList(data);
      } catch (error) {
        console.error("Error fetching dispatches:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyDispatches();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, searchTerm]);

  // Status Checkers
  const activeStatuses = ["start delivery", "in warehouse", "in transit", "arrived", "ongoing delivery", "accepted"];
  const completedStatuses = ["completed", "delivered", "returned", "foul trip", "declined"];

  const isActive = (status?: string) => status ? activeStatuses.includes(status.toLowerCase()) : false;
  const isCompleted = (status?: string) => status ? completedStatuses.includes(status.toLowerCase()) : false;
  const isSuccessfulFinish = (status?: string) => status ? ["completed", "delivered", "returned"].includes(status.toLowerCase()) : false;
  const isAbortedTrip = (status?: string) => status ? ["foul trip", "declined"].includes(status.toLowerCase()) : false;
  
  const isUnconfirmed = (status?: string) => {
    if (!status) return true;
    const s = status.toLowerCase();
    return s === "pending" || s === "assigned" || (!isActive(status) && !isCompleted(status));
  };
  
  const isAccepted = (status?: string) => isActive(status) || isCompleted(status);

  const getDisplayStatus = (delivery: DeliveryRecord) => {
    if (isUnconfirmed(delivery.status)) return "Awaiting Confirmation";
    if (isAbortedTrip(delivery.status)) return "Foul Trip / Aborted";
    if (isSuccessfulFinish(delivery.status)) return "Delivery Concluded";
    
    const currentStep = delivery.current_step || 0;
    if (delivery.status?.toLowerCase() === "accepted" && currentStep === 0) return "Accepted - Awaiting Start";
    if (currentStep === 1) return "Heading to Warehouse"; 
    if (currentStep > 1) return "Products Loaded - Delivering"; 
    
    return delivery.status;
  };

  const unconfirmedCount = deliveryList.filter((d) => isUnconfirmed(d.status)).length;
  const activeCount = deliveryList.filter((d) => isActive(d.status)).length;
  const completedCount = deliveryList.filter((d) => isCompleted(d.status)).length;

  const filteredDeliveries = deliveryList
    .filter((delivery) => {
      if (selectedFilter === "Active" && !isActive(delivery.status)) return false;
      if (selectedFilter === "Unconfirmed" && !isUnconfirmed(delivery.status)) return false;
      if (selectedFilter === "Completed" && !isCompleted(delivery.status)) return false;

      const searchLower = searchTerm.toLowerCase();
      if (searchTerm && !(
        delivery.bookingId.toLowerCase().includes(searchLower) ||
        delivery.clientName.toLowerCase().includes(searchLower) ||
        delivery.address.toLowerCase().includes(searchLower)
      )) return false;

      return true;
    })
    .sort((a, b) => {
      const modA = a.localUpdatedAt || 0;
      const modB = b.localUpdatedAt || 0;
      if (modA !== modB) return modB - modA;

      const timeA = new Date(`${a.scheduledDate} ${a.pickupTime || '00:00'}`).getTime() || Infinity;
      const timeB = new Date(`${b.scheduledDate} ${b.pickupTime || '00:00'}`).getTime() || Infinity;
      return selectedFilter === "Completed" ? timeB - timeA : timeA - timeB; 
    });

  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDeliveries = filteredDeliveries.slice(startIndex, endIndex);

  // Helper arrays for normalizing stops
  const getPickupsArray = (delivery: DeliveryRecord) => {
    if (delivery.multiplePickups && delivery.multiplePickups.length > 0) return delivery.multiplePickups;
    return [{
      warehouse: delivery.pickupAddress?.split(",")[0] || "Base",
      address: delivery.pickupAddress,
      contactPerson: delivery.contactPerson,
      contactNumber: delivery.contactNumber,
      pickupTime: delivery.pickupTime,
      quantity: delivery.quantity || "N/A"
    }];
  };

  const getDeliveriesArray = (delivery: DeliveryRecord) => {
    if (delivery.multipleDeliveries && delivery.multipleDeliveries.length > 0) return delivery.multipleDeliveries;
    return [{
      branch: delivery.clientName,
      address: delivery.deliveryAddress,
      contactPerson: delivery.contactPerson,
      contactNumber: delivery.contactNumber,
      deliveryTime: delivery.deliveryTime,
      quantity: delivery.quantity || "N/A"
    }];
  };

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
      setSelectedImage(URL.createObjectURL(file));
      setSelectedFile(file);
    }
  };

  const handleUpdateStatusSubmit = async () => {
    const isPodRequiredForStop = dynamicStops[currentStepIndex]?.reqPod;
    
    if (isPodRequiredForStop) {
      if (!selectedFile) {
        alert("Proof of delivery photo is required to complete this location.");
        return;
      }
      if (!receiverName.trim()) {
        alert("Receiver's Name is required to complete this location.");
        return;
      }
    }

    setShowSubmitConfirmModal(false);
    if (!selectedDelivery) return;

    setIsSubmittingResponse(true);

    try {
      const nextStep = currentStepIndex + 1;
      const isLastStep = nextStep === dynamicStops.length;
      
      let macroStatus = "In Transit"; 
      if (isLastStep) {
        macroStatus = "Completed";
      } else if (currentStepIndex > 0) {
        macroStatus = "In Transit"; // ALIGNED ENUM: Changed from "Ongoing Delivery" to match database schema
      }

      const sessionStr = localStorage.getItem("logisco_user_session") || sessionStorage.getItem("logisco_user_session");
      const token = sessionStr ? JSON.parse(sessionStr).token : "";

      const formData = new FormData();
      formData.append("dispatchID", String(selectedDelivery.id));
      formData.append("status", macroStatus);
      formData.append("current_step", String(nextStep));
      formData.append("remarks", remarks);
      
      // Explicitly pass the title so the backend doesn't crash trying to find an index that doesn't exist
      const currentStopTitle = dynamicStops[currentStepIndex]?.title || "Location Update";
      formData.append("title", currentStopTitle);
      
      if (receiverName) formData.append("receiverName", receiverName);
      if (selectedFile) formData.append("podImage", selectedFile);

      const response = await fetch("/api/crew/dispatches/status", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to update status");
      }

      setDeliveryList((prev) =>
        prev.map((d) => d.id === selectedDelivery.id ? { ...d, status: macroStatus, current_step: nextStep, localUpdatedAt: Date.now() } : d)
      );
      setSelectedDelivery({ ...selectedDelivery, status: macroStatus, current_step: nextStep, localUpdatedAt: Date.now() });

      if (isLastStep) {
        setShowTripReportModal(true);
      } else {
        alert(`Successfully arrived and updated: ${dynamicStops[currentStepIndex]?.title || 'Location'}`);
        setViewMode("list");
        setSelectedDelivery(null);
        setSelectedImage(null);
        setSelectedFile(null);
        setRemarks("");
        setReceiverName(""); 
      }
    } catch (error: any) {
      alert(`Status update failed: ${error.message}`);
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const handleSendEmergencyAlert = async () => {
    if (!selectedDelivery) return;

    try {
      const sessionStr = localStorage.getItem("logisco_user_session") || sessionStorage.getItem("logisco_user_session");
      const token = sessionStr ? JSON.parse(sessionStr).token : "";

      const formData = new FormData();
      formData.append("dispatchID", String(selectedDelivery.id));
      formData.append("issueType", emergencyReason === "Other" && otherReason ? otherReason : emergencyReason);
      formData.append("details", emergencyMessage);
      
      if (selectedFile) {
        formData.append("emergencyImage", selectedFile);
      }

      const response = await fetch("/api/crew/dispatches/emergency", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to send emergency alert");

      setEmergencySubmitted(true);
      
      setDeliveryList((prev) =>
        prev.map((d) => d.id === selectedDelivery.id ? { ...d, status: "Foul Trip", localUpdatedAt: Date.now() } : d)
      );

      setTimeout(() => {
        setEmergencySubmitted(false);
        setShowEmergencyModal(false);
        setEmergencyMessage("");
        setOtherReason("");
        if (emergencyImage) {
          URL.revokeObjectURL(emergencyImage);
          setEmergencyImage(null);
        }
        setViewMode("list");
        setSelectedDelivery(null);
      }, 2000);

    } catch (error: any) {
      alert(`Error sending alert: ${error.message}`);
    }
  };

  const completeTripWorkflow = () => {
    setShowTripReportModal(false);
    setTripRemarks("");
    setVehicleIssues("");
    setViewMode("list");
    setSelectedDelivery(null);
    setCurrentStepIndex(0);
  };

  const handleSendRemarks = async () => {
    if (!selectedDelivery) return;
    try {
      const sessionStr = localStorage.getItem("logisco_user_session") || sessionStorage.getItem("logisco_user_session");
      const token = sessionStr ? JSON.parse(sessionStr).token : "";

      const response = await fetch("/api/crew/dispatches/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          dispatchID: selectedDelivery.id,
          tripRemarks: tripRemarks,
          vehicleIssues: vehicleIssues
        })
      });

      if (!response.ok) throw new Error("Failed to save report");

      setShowRemarksSuccess(true);
      setTimeout(() => {
        setShowRemarksSuccess(false);
        completeTripWorkflow();
      }, 2000);
      
    } catch (error: any) {
      alert(`Error saving report: ${error.message}`);
    }
  };

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

      if (!response.ok) throw new Error("Failed to update status");

      setDeliveryList((prev) =>
        prev.map((d) => d.id === selectedDelivery.id ? { ...d, status: action === "accept" ? "Accepted" : "Declined", localUpdatedAt: Date.now() } : d)
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
    if (!status) return "bg-slate-100 text-slate-500 border border-slate-200";
    const s = status.toLowerCase();
    if (s === "aborted" || s === "foul trip" || s === "declined") return "bg-red-100 text-red-800 border border-red-300";
    if (isSuccessfulFinish(status)) return "bg-slate-100 text-slate-800 border border-slate-300";
    if (s === "ongoing delivery") return "bg-blue-100 text-blue-800 border border-blue-300";
    if (isActive(status)) return "bg-blue-100 text-blue-800 border border-blue-300";
    return "bg-amber-100 text-amber-800 border border-amber-300";
  };

  const renderModalActions = () => {
    if (!selectedDelivery) return null;

    if (isCompleted(selectedDelivery.status)) {
      return (
        <button
          onClick={() => setShowDetailsModal(false)}
          className="w-full sm:w-40 py-2.5 bg-slate-800 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
        >
          Close Details
        </button>
      );
    }
    
    if (isUnconfirmed(selectedDelivery.status)) {
      return (
        <>
          <button
            onClick={() => setShowDeclineConfirmModal(true)}
            className="w-full sm:w-40 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-xl text-sm shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            Decline
          </button>
          <button
            onClick={() => setShowAcceptConfirmModal(true)}
            className="w-full sm:w-40 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            Accept
          </button>
        </>
      );
    }
    
    if (selectedDelivery.status?.toLowerCase() === "accepted" && (selectedDelivery.current_step || 0) === 0) {
      return (
        <button
          onClick={() => setShowStartConfirmModal(true)}
          className="w-full sm:w-48 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
        >
          Start Delivery
        </button>
      );
    }
    
    return (
      <button
        onClick={() => {
          const calculatedStops = generateDynamicStops(selectedDelivery);
          setDynamicStops(calculatedStops);
          setCurrentStepIndex(selectedDelivery.current_step || 0);
          setShowDetailsModal(false);
          setViewMode("update-status");
        }}
        className="w-full sm:w-48 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
      >
        Update Status
      </button>
    );
  };

  return (
    <>
      {viewMode === "update-status" && selectedDelivery ? (
        <div className="p-3 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative">
          <div className="flex items-center justify-between mb-6 gap-2">
            <div className="flex items-center gap-3">
              <button onClick={() => setViewMode("list")} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0 whitespace-nowrap">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Delivery Route</h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Track locations and upload proofs of delivery.</p>
              </div>
            </div>
            <button onClick={() => setShowEmergencyModal(true)} className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <AlertTriangle className="w-4 h-4" />
              <span>Emergency</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">
            
            {/* DYNAMIC MAP SECTION */}
            <div className="bg-[#e0f2fe] rounded-2xl border border-slate-300 overflow-hidden shadow-sm flex flex-col">
              <div className="bg-white px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 z-10 relative">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600 animate-pulse" />
                  <span className="text-sm font-semibold text-slate-900">Live Tracker</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-600">Current Objective: <strong className="text-blue-600">{dynamicStops[currentStepIndex]?.title}</strong></span>
                </div>
              </div>

              <div className="relative w-full h-80 sm:h-100 md:h-120 bg-[#e0f2fe] overflow-hidden flex items-center justify-center font-sans">
                <div className="absolute inset-0 pointer-events-none opacity-60">
                  <svg className="w-full h-full" preserveAspectRatio="none">
                    <path d="M-10,15 L 30,25 L 40,-10 M 30,25 L 50,80 L 110,60 M 50,80 L 30,110 M 80,-10 L 70,40 L 110,30" stroke="#ffffff" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M-10,60 L 20,50 L 30,80 M 70,40 L 90,80 L 110,90" stroke="#ffffff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {dynamicStops.map((stop, index) => {
                  const total = Math.max(1, dynamicStops.length - 1);
                  const progress = index / total;
                  const x = 15 + (progress * 70);
                  const y = 50 + Math.sin(progress * Math.PI) * 30; 

                  const isNodeCompleted = isSuccessfulFinish(selectedDelivery.status) || index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;

                  return (
                    <div key={index} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center transition-all duration-700" style={{ left: `${x}%`, top: `${y}%` }}>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-slate-200 text-center whitespace-nowrap pointer-events-none">
                        <div className="text-xs font-bold text-slate-800">{stop.title}</div>
                        {isNodeCompleted && <div className="text-[9px] text-emerald-600 font-bold uppercase mt-0.5">Completed</div>}
                        {isCurrent && <div className="text-[9px] text-blue-600 font-bold uppercase mt-0.5 animate-pulse">Ongoing</div>}
                      </div>
                      
                      {stop.type === 'pickup' ? (
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg border-[3px] transition-colors ${isNodeCompleted ? 'bg-emerald-500 border-emerald-200' : isCurrent ? 'bg-blue-500 border-blue-200' : 'bg-slate-300 border-slate-100'}`}>
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-current" />
                        </div>
                      ) : stop.type === 'delivery' ? (
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg border transition-colors ${isNodeCompleted ? 'bg-emerald-50 border-emerald-500' : isCurrent ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-300'}`}>
                          <svg className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isNodeCompleted ? 'text-emerald-500' : isCurrent ? 'text-blue-500' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        </div>
                      ) : (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isNodeCompleted ? 'bg-emerald-500 border-emerald-200' : isCurrent ? 'bg-blue-500 border-blue-200' : 'bg-slate-800 border-slate-600'}`}>
                           <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}

                      {isCurrent && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-700 ease-in-out">
                          <div className="bg-[#2563eb] w-8 h-8 sm:w-9 sm:h-9 rounded-full border-[2.5px] border-white flex items-center justify-center shadow-xl">
                            <Truck className="w-4 h-4 text-white fill-current" strokeWidth={1} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Bottom Progress Bar */}
              <div className="bg-white px-2 sm:px-6 pt-12 pb-6 border-t border-slate-200 z-10 relative overflow-x-auto hide-scrollbar">
                <div className="relative flex justify-between items-center w-full min-w-[600px] max-w-4xl mx-auto px-4 sm:px-8">
                  <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0"></div>
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 h-1 bg-blue-600 z-0 transition-all duration-500" style={{ width: `calc(${ (currentStepIndex / (Math.max(1, dynamicStops.length - 1))) * 100 }% - 64px)` }}></div>

                  {dynamicStops.map((stop, index) => {
                    const isNodeCompleted = isSuccessfulFinish(selectedDelivery.status) || index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    
                    return (
                      <div key={index} className="relative z-10 flex flex-col items-center group px-0.5 w-16">
                        <span className={`text-[9px] sm:text-xs font-bold absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 text-center w-max whitespace-nowrap leading-tight transition-colors duration-300 ${isNodeCompleted ? 'text-emerald-600' : isCurrent ? 'text-blue-600 font-extrabold' : 'text-slate-400'}`}>
                          {stop.title.replace(/(Pickup: |Dropoff: )/, '')}
                        </span>
                        <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-all duration-300 flex items-center justify-center ${isNodeCompleted ? 'bg-emerald-500 ring-2 ring-emerald-100' : isCurrent ? 'bg-blue-600 ring-4 ring-blue-100 scale-125' : 'bg-slate-300'}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-900">
              {/* CURRENT OBJECTIVE DETAILS */}
              <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="border-b border-blue-200 pb-2 mb-4 font-bold text-blue-900 text-sm tracking-wide uppercase flex justify-between items-center">
                  <span>Current Objective Details</span>
                  {dynamicStops[currentStepIndex]?.title === 'Start Delivery' && <span className="bg-slate-100 text-slate-800 text-xs px-2 py-0.5 rounded-md font-semibold border border-slate-300">Awaiting Departure</span>}
                  {dynamicStops[currentStepIndex]?.type === 'pickup' && <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-md font-semibold border border-amber-300">Heading to Warehouse</span>}
                  {dynamicStops[currentStepIndex]?.type === 'delivery' && <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-md font-semibold border border-indigo-300">Products Loaded - Delivering</span>}
                  {dynamicStops[currentStepIndex]?.title === 'Returned' && <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-md font-semibold border border-emerald-300">Returning to Base</span>}
                </div>
                
                {dynamicStops[currentStepIndex]?.data ? (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div><p className="text-xs text-slate-500 font-medium">Location Name</p><p className="font-bold text-slate-900">{dynamicStops[currentStepIndex].data.warehouse || dynamicStops[currentStepIndex].data.branch}</p></div>
                     <div><p className="text-xs text-slate-500 font-medium">Address</p><p className="font-semibold text-slate-800">{dynamicStops[currentStepIndex].data.address}</p></div>
                     <div><p className="text-xs text-slate-500 font-medium">Contact Person</p><p className="font-semibold text-slate-800">{dynamicStops[currentStepIndex].data.contactPerson} | {dynamicStops[currentStepIndex].data.contactNumber}</p></div>
                     <div><p className="text-xs text-slate-500 font-medium">Quantity/Load</p><p className="font-semibold text-slate-800">{dynamicStops[currentStepIndex].data.quantity || selectedDelivery.quantity || 'N/A'}</p></div>
                   </div>
                ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div><p className="text-xs text-slate-500 font-medium">Location</p><p className="font-bold text-slate-900">{dynamicStops[currentStepIndex]?.title}</p></div>
                     <div><p className="text-xs text-slate-500 font-medium">Address</p><p className="font-semibold text-slate-800">{dynamicStops[currentStepIndex]?.type === 'pickup' ? selectedDelivery.pickupAddress : selectedDelivery.deliveryAddress}</p></div>
                     <div><p className="text-xs text-slate-500 font-medium">Contact Person</p><p className="font-semibold text-slate-800">{selectedDelivery.contactPerson} | {selectedDelivery.contactNumber}</p></div>
                     <div><p className="text-xs text-slate-500 font-medium">Product / Quantity</p><p className="font-semibold text-slate-800">{selectedDelivery.product} - {selectedDelivery.quantity || 'N/A'}</p></div>
                   </div>
                )}
              </div>

              {/* ORIGINAL PICKUP ADDRESSES LIST */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide flex items-center justify-between">
                  <span>Pickup Addresses</span>
                  <span className="text-xs text-slate-500 font-normal">Sequential Pickup Workflow</span>
                </div>
                <div className="space-y-4">
                  {getPickupsArray(selectedDelivery).map((pickup, idx) => {
                    const stopIndex = 1 + idx; 
                    const calculatedStep = selectedDelivery.current_step || 0;
                    const isNodeCompleted = isSuccessfulFinish(selectedDelivery.status) || calculatedStep > stopIndex;
                    const isNodeAborted = isAbortedTrip(selectedDelivery.status) && calculatedStep === stopIndex;
                    const isNodeOngoing = !isCompleted(selectedDelivery.status) && calculatedStep === stopIndex;
                    
                    let status = isNodeCompleted ? "Completed" : isNodeAborted ? "Aborted" : isNodeOngoing ? "Ongoing Delivery" : "Pending";

                    return (
                      <div key={idx} className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 text-sm ${isNodeCompleted ? 'border-emerald-200 bg-emerald-50/30' : isNodeAborted ? 'border-red-300 bg-red-50/30' : isNodeOngoing ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold truncate ${isNodeCompleted ? 'text-emerald-700' : isNodeAborted ? 'text-red-700' : 'text-blue-700'}`}>Pickup Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wider shrink-0 ${getStatusBadgeClass(status)}`}>{status}</span>
                        </div>
                        <span className="text-base font-bold text-slate-900 truncate">{pickup.warehouse}</span>
                        <span className="text-slate-700 truncate">{pickup.address}</span>
                        <span className="text-slate-700 truncate">{pickup.contactPerson} | ({pickup.contactNumber})</span>
                        <span className="text-slate-700 truncate">Delivery Time: {pickup.pickupTime}</span>
                        <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                        <span className="text-slate-700 truncate">Qty: {pickup.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DELIVERY ADDRESSES LIST */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                  Delivery Addresses
                </div>
                <div className="space-y-4">
                  {getDeliveriesArray(selectedDelivery).map((deliv, idx) => {
                    const pickupCount = getPickupsArray(selectedDelivery).length;
                    const stopIndex = 1 + pickupCount + idx;
                    const calculatedStep = selectedDelivery.current_step || 0;
                    
                    const isNodeCompleted = isSuccessfulFinish(selectedDelivery.status) || calculatedStep > stopIndex;
                    const isNodeAborted = isAbortedTrip(selectedDelivery.status) && calculatedStep === stopIndex;
                    const isNodeOngoing = !isCompleted(selectedDelivery.status) && calculatedStep === stopIndex;
                    
                    let status = isNodeCompleted ? "Completed" : isNodeAborted ? "Aborted" : isNodeOngoing ? "Ongoing Delivery" : "Pending";

                    return (
                      <div key={idx} className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 text-sm ${isNodeCompleted ? 'border-emerald-200 bg-emerald-50/30' : isNodeAborted ? 'border-red-300 bg-red-50/30' : isNodeOngoing ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold truncate ${isNodeCompleted ? 'text-emerald-700' : isNodeAborted ? 'text-red-700' : 'text-blue-700'}`}>Delivery Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wider shrink-0 ${getStatusBadgeClass(status)}`}>{status}</span>
                        </div>
                        <span className="text-base font-bold text-slate-900 truncate">{deliv.branch}</span>
                        <span className="text-slate-700 truncate">{deliv.address}</span>
                        <span className="text-slate-700 truncate">{deliv.contactPerson} | ({deliv.contactNumber})</span>
                        <span className="text-slate-700 truncate">Delivery Time: {deliv.deliveryTime}</span>
                        <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                        <span className="text-slate-700 truncate">Qty: {deliv.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COMPLETION SUMMARY */}
              {isCompleted(selectedDelivery.status) && (
                <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/50 shadow-xs mt-4">
                  <div className="border-b border-emerald-200 pb-2 mb-4 font-semibold text-emerald-900 text-sm tracking-wide flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Completion Summary
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-semibold text-emerald-800 mb-2">Final Remarks / Feedback</span>
                      <div className="w-full bg-white border border-emerald-200 rounded-md px-4 py-3 text-sm text-slate-800 shadow-sm leading-relaxed overflow-hidden">
                        {formatDispatchNote(selectedDelivery.dispatchNote || selectedDelivery.notes, selectedDelivery)}
                      </div>
                    </div>
                    {selectedDelivery.pod_url && (
                      <div>
                        <span className="block text-xs font-semibold text-emerald-800 mb-2">Final Proof of Delivery</span>
                        <img 
                          src={selectedDelivery.pod_url} 
                          alt="Global POD" 
                          className="w-full max-w-sm h-auto object-cover rounded-xl border border-emerald-200 shadow-sm" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Remarks (Only show if NOT completed) */}
              {!isCompleted(selectedDelivery.status) && (
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                  <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">Remarks & Notes</div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Remarks (Optional)</label>
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Ex. Arrived at the location, waiting for receiver..." className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-24"></textarea>
                  </div>
                </div>
              )}

              {/* POD (Only visible if required for this step and NOT completed) */}
              {!isCompleted(selectedDelivery.status) && dynamicStops[currentStepIndex]?.reqPod && (
                <div className="border border-blue-300 bg-blue-50/30 rounded-xl p-4 shadow-xs transition-colors">
                  <div className="border-b border-blue-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide flex items-center justify-between gap-2">
                    <span className="truncate">Proof of Location / Delivery</span>
                    <span className="text-xs font-semibold whitespace-nowrap shrink-0 text-red-500">
                      * Required for this location
                    </span>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Receiver&apos;s Name <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      value={receiverName} 
                      onChange={(e) => setReceiverName(e.target.value)} 
                      placeholder="Ex. Juan Dela Cruz" 
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      required
                    />
                  </div>

                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer bg-white hover:bg-blue-50 transition-colors overflow-hidden relative">
                    {selectedImage ? (
                      <img src={selectedImage} alt="POD Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                        <Camera className="w-8 h-8 text-blue-500 mb-2 stroke-[1.5]" />
                        <span className="text-xs font-semibold text-blue-700">Tap to upload photo</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            {/* View Mode Actions */}
            <div className="flex flex-col sm:flex-row justify-end pt-4 border-t border-slate-200 gap-3">
              {isCompleted(selectedDelivery.status) ? (
                <button
                  onClick={() => setViewMode("list")}
                  className="w-full sm:w-40 py-2.5 bg-slate-800 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  Close Route
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitConfirmModal(true)}
                  className="w-full sm:w-40 py-2.5 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  {currentStepIndex === dynamicStops.length - 1 ? "Complete Trip" : "Confirm Location"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ======================= LIST VIEW =======================
        <div className="p-3 sm:p-5 md:p-6 w-full max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans relative">
          <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 pl-1 lg:pl-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Crew Delivery Dashboard</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage your assigned delivery schedules and confirm pending bookings.</p>
            </div>
            
            <div className="relative w-full md:w-72 shrink-0">
              <input type="text" placeholder="Search Booking ID or Client..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 px-4 sm:px-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 w-full overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
                <button onClick={() => setSelectedFilter("Active")} className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${selectedFilter === "Active" ? "bg-blue-600 text-white shadow-md" : "bg-slate-100 text-slate-600"}`}><Truck className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Active ({activeCount})</span></button>
                <button onClick={() => setSelectedFilter("Unconfirmed")} className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${selectedFilter === "Unconfirmed" ? "bg-amber-600 text-white shadow-md" : "bg-amber-50 text-amber-700"}`}><Clock className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Unconfirmed ({unconfirmedCount})</span></button>
                <button onClick={() => setSelectedFilter("Completed")} className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${selectedFilter === "Completed" ? "bg-slate-800 text-white shadow-md" : "bg-slate-100 text-slate-600"}`}><Archive className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">History ({completedCount})</span></button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {isLoading ? (
                    <tr><td colSpan={2} className="py-10 text-center"><span className="text-sm font-semibold text-slate-500 animate-pulse">Loading dispatches...</span></td></tr>
                  ) : currentDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-10 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2"><FileText className="w-4 h-4" /></div>
                          <p className="text-sm font-semibold text-slate-800">{searchTerm ? "No matching deliveries found." : "No delivery records found"}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{searchTerm ? "Try a different search term." : "Try switching tabs to view other records."}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentDeliveries.map((delivery) => (
                      <tr key={delivery.id} onClick={() => handleRowClick(delivery)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                        <td className="py-3 pl-4 sm:pl-8 md:pl-16 pr-2 text-left w-2/3 overflow-hidden">
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base mb-0.5 truncate">{delivery.clientName}</div>
                          <div className="text-xs font-semibold text-slate-600 mb-0.5 whitespace-nowrap">{delivery.bookingId}</div>
                          <div className="text-xs text-slate-500 mb-0.5 truncate w-full" title={delivery.address}>{delivery.address}</div>
                          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">{delivery.dateTime}</div>
                        </td>
                        <td className="py-3 pr-4 sm:pr-8 md:pr-16 pl-2 align-top w-1/3">
                          <div className="flex flex-col items-end justify-start gap-1 h-full">
                            <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors text-right whitespace-nowrap"><Eye className="w-3.5 h-3.5 shrink-0" /><span>Click to View</span></div>
                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${getStatusBadgeClass(delivery.status)}`}>
                              {getDisplayStatus(delivery)}
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
                Showing {filteredDeliveries.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredDeliveries.length)} of {filteredDeliveries.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors whitespace-nowrap ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Previous</button>
                <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className={`px-3 py-1.5 border border-slate-200 rounded-lg font-medium transition-colors whitespace-nowrap ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Next</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODALS ======================= */}
      {/* 1. DELIVERY INFORMATION MODAL POPUP */}
      {showDetailsModal && selectedDelivery && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-3 sm:px-6 py-4 bg-[#000c31] text-white border-b border-slate-800 shrink-0 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Truck className="w-4 h-4 text-white" /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-sm md:text-lg font-bold text-white tracking-tight truncate leading-tight">Delivery Information</h2>
                  <p className="text-slate-300 text-[10px] sm:text-xs font-semibold mt-0.5 truncate">Order ID: <span className="font-semibold text-white">{selectedDelivery.bookingId}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {isAccepted(selectedDelivery.status) ? (
                  <span className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold shadow-sm whitespace-nowrap ${getStatusBadgeClass(selectedDelivery.status)}`}>{getDisplayStatus(selectedDelivery)}</span>
                ) : (
                  <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-400 text-slate-900 shadow-sm whitespace-nowrap">Awaiting Confirmation</span>
                )}
                <button type="button" onClick={() => setShowDetailsModal(false)} className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto text-sm text-slate-900 bg-slate-50/50 flex-1">
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">1. Client Information</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Company / Client Name</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.clientName}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.contactPerson}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Contact Number</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.contactNumber}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.clientEmail || "admin@client.com"}</div></div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-700 mb-1">Business Address</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.address}</div></div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">2. Booking Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Delivery Schedule</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.scheduledDate}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Product to Deliver</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.product}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.quantity || "3,500 lbs"}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Priority Level</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 truncate">{selectedDelivery.priorityLevel || "Standard"}</div></div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">3. Assigned Delivery Crew & Vehicle</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Truck Plate No.</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.assignedVehicle}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Driver</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.driver}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Helper #1</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.helper}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Helper #2</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs sm:text-sm text-slate-900 truncate">{selectedDelivery.helper2 || "None"}</div></div>
                </div>
              </div>

              {/* PICKUP ADDRESSES LIST */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide flex items-center justify-between">
                  <span>Pickup Addresses</span>
                  <span className="text-xs text-slate-500 font-normal">Sequential Pickup Workflow</span>
                </div>
                <div className="space-y-4">
                  {getPickupsArray(selectedDelivery).map((pickup, idx) => {
                    const stopIndex = 1 + idx; 
                    const calculatedStep = selectedDelivery.current_step || 0;
                    const isNodeCompleted = isSuccessfulFinish(selectedDelivery.status) || calculatedStep > stopIndex;
                    const isNodeAborted = isAbortedTrip(selectedDelivery.status) && calculatedStep === stopIndex;
                    const isNodeOngoing = !isCompleted(selectedDelivery.status) && calculatedStep === stopIndex;
                    
                    let status = isNodeCompleted ? "Completed" : isNodeAborted ? "Aborted" : isNodeOngoing ? "Ongoing Delivery" : "Pending";

                    return (
                      <div key={idx} className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 text-sm ${isNodeCompleted ? 'border-emerald-200 bg-emerald-50/30' : isNodeAborted ? 'border-red-300 bg-red-50/30' : isNodeOngoing ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold truncate ${isNodeCompleted ? 'text-emerald-700' : isNodeAborted ? 'text-red-700' : 'text-blue-700'}`}>Pickup Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wider shrink-0 ${getStatusBadgeClass(status)}`}>{status}</span>
                        </div>
                        <span className="text-base font-bold text-slate-900 truncate">{pickup.warehouse}</span>
                        <span className="text-slate-700 truncate">{pickup.address}</span>
                        <span className="text-slate-700 truncate">{pickup.contactPerson} | ({pickup.contactNumber})</span>
                        <span className="text-slate-700 truncate">Delivery Time: {pickup.pickupTime}</span>
                        <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                        <span className="text-slate-700 truncate">Qty: {pickup.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DELIVERY ADDRESSES LIST */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">
                  Delivery Addresses
                </div>
                <div className="space-y-4">
                  {getDeliveriesArray(selectedDelivery).map((deliv, idx) => {
                    const pickupCount = getPickupsArray(selectedDelivery).length;
                    const stopIndex = 1 + pickupCount + idx;
                    const calculatedStep = selectedDelivery.current_step || 0;
                    
                    const isNodeCompleted = isSuccessfulFinish(selectedDelivery.status) || calculatedStep > stopIndex;
                    const isNodeAborted = isAbortedTrip(selectedDelivery.status) && calculatedStep === stopIndex;
                    const isNodeOngoing = !isCompleted(selectedDelivery.status) && calculatedStep === stopIndex;
                    
                    let status = isNodeCompleted ? "Completed" : isNodeAborted ? "Aborted" : isNodeOngoing ? "Ongoing Delivery" : "Pending";

                    return (
                      <div key={idx} className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 text-sm ${isNodeCompleted ? 'border-emerald-200 bg-emerald-50/30' : isNodeAborted ? 'border-red-300 bg-red-50/30' : isNodeOngoing ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold truncate ${isNodeCompleted ? 'text-emerald-700' : isNodeAborted ? 'text-red-700' : 'text-blue-700'}`}>Delivery Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wider shrink-0 ${getStatusBadgeClass(status)}`}>{status}</span>
                        </div>
                        <span className="text-base font-bold text-slate-900 truncate">{deliv.branch}</span>
                        <span className="text-slate-700 truncate">{deliv.address}</span>
                        <span className="text-slate-700 truncate">{deliv.contactPerson} | ({deliv.contactNumber})</span>
                        <span className="text-slate-700 truncate">Delivery Time: {deliv.deliveryTime}</span>
                        <span className="text-slate-700 truncate">Product: {selectedDelivery.product}</span>
                        <span className="text-slate-700 truncate">Qty: {deliv.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COMPLETION SUMMARY */}
              {isCompleted(selectedDelivery.status) && (
                <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/50 shadow-xs mt-4">
                  <div className="border-b border-emerald-200 pb-2 mb-4 font-semibold text-emerald-900 text-sm tracking-wide flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Completion Summary
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-semibold text-emerald-800 mb-2">Final Remarks / Feedback</span>
                      <div className="w-full bg-white border border-emerald-200 rounded-md px-4 py-3 text-sm text-slate-800 shadow-sm leading-relaxed overflow-hidden">
                        {formatDispatchNote(selectedDelivery.dispatchNote || selectedDelivery.notes, selectedDelivery)}
                      </div>
                    </div>
                    {selectedDelivery.pod_url && (
                      <div>
                        <span className="block text-xs font-semibold text-emerald-800 mb-2">Final Proof of Delivery</span>
                        <img 
                          src={selectedDelivery.pod_url} 
                          alt="Global POD" 
                          className="w-full max-w-sm h-auto object-cover rounded-xl border border-emerald-200 shadow-sm" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Remarks (Only show if NOT completed) */}
              {!isCompleted(selectedDelivery.status) && (
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                  <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">Remarks & Notes</div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Remarks (Optional)</label>
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Ex. Arrived at the location, waiting for receiver..." className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-24"></textarea>
                  </div>
                </div>
              )}

              {/* POD (Only visible if required for this step and NOT completed) */}
              {!isCompleted(selectedDelivery.status) && dynamicStops[currentStepIndex]?.reqPod && (
                <div className="border border-blue-300 bg-blue-50/30 rounded-xl p-4 shadow-xs transition-colors">
                  <div className="border-b border-blue-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide flex items-center justify-between gap-2">
                    <span className="truncate">Proof of Location / Delivery</span>
                    <span className="text-xs font-semibold whitespace-nowrap shrink-0 text-red-500">
                      * Required for this location
                    </span>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Receiver&apos;s Name <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      value={receiverName} 
                      onChange={(e) => setReceiverName(e.target.value)} 
                      placeholder="Ex. Juan Dela Cruz" 
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      required
                    />
                  </div>

                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer bg-white hover:bg-blue-50 transition-colors overflow-hidden relative">
                    {selectedImage ? (
                      <img src={selectedImage} alt="POD Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                        <Camera className="w-8 h-8 text-blue-500 mb-2 stroke-[1.5]" />
                        <span className="text-xs font-semibold text-blue-700">Tap to upload photo</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            {/* Actions for Details Modal based on Status */}
            <div className="flex flex-col sm:flex-row justify-end pt-4 border-t border-slate-200 gap-3">
              {renderModalActions()}
            </div>
          </div>
        </div>
      )}

      {/* 2. UPDATE STATUS CONFIRMATION MODAL */}
      {showSubmitConfirmModal && selectedDelivery && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Location Update</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              Confirm arrival/completion for <strong className="text-blue-600">{dynamicStops[currentStepIndex]?.title}</strong>?
              {dynamicStops[currentStepIndex]?.reqPod && (!selectedImage || !receiverName.trim()) && <span className="block mt-2 text-red-500 font-semibold">Note: Proof of Delivery photo & Receiver&apos;s Name is required.</span>}
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowSubmitConfirmModal(false)} disabled={isSubmittingResponse} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
              <button onClick={handleUpdateStatusSubmit} disabled={isSubmittingResponse || (dynamicStops[currentStepIndex]?.reqPod && (!selectedImage || !receiverName.trim()))} className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50 hover:bg-black">
                {isSubmittingResponse ? "Updating..." : "Confirm Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. END OF TRIP REPORT MODAL */}
      {showTripReportModal && selectedDelivery && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Trip Completed!</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">Please submit any final remarks or log any vehicle issues observed during the trip.</p>
            <div className="space-y-4 mb-6">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Trip Remarks</label><textarea value={tripRemarks} onChange={(e) => setTripRemarks(e.target.value)} placeholder="How was the trip?" className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-20"></textarea></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Issues (If any)</label><textarea value={vehicleIssues} onChange={(e) => setVehicleIssues(e.target.value)} placeholder="Any unusual sounds, flat tires, etc." className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-20"></textarea></div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={completeTripWorkflow} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap">Skip & Close</button>
              <button onClick={handleSendRemarks} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap">
                {showRemarksSuccess ? "Saved!" : "Save Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. START / ACCEPT CONFIRMATION MODAL */}
      {(showStartConfirmModal || showAcceptConfirmModal) && selectedDelivery && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {showStartConfirmModal ? "Delivery Progress" : "Confirm Assignment"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-6">
              {showStartConfirmModal ? "Open tracking and update the status of this delivery?" : "Confirm this delivery assignment?"}
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowStartConfirmModal(false); setShowAcceptConfirmModal(false); }} disabled={isSubmittingResponse} className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-sm whitespace-nowrap disabled:opacity-50">No</button>
              <button onClick={() => {
                  if (showStartConfirmModal) {
                    setShowStartConfirmModal(false);
                    setShowDetailsModal(false);
                    
                    const calculatedStops = generateDynamicStops(selectedDelivery);
                    setDynamicStops(calculatedStops);
                    setCurrentStepIndex(selectedDelivery.current_step || 0);
                    setViewMode("update-status");
                  } else {
                    handleDispatchResponse("accept");
                  }
                }} disabled={isSubmittingResponse} className="flex-1 py-2.5 bg-emerald-600 text-white font-semibold responsive-btn rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50"
              >
                {isSubmittingResponse && !showStartConfirmModal ? "Accepting..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. DECLINE ASSIGNMENT MODAL */}
      {showDeclineConfirmModal && selectedDelivery && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Decline Assignment</h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">Are you sure you want to decline this dispatch? You must provide a valid reason.</p>
            <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Ex. Sick leave, Family emergency, Vehicle issues..." className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-24 mb-6" required></textarea>
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowDeclineConfirmModal(false); setDeclineReason(""); }} disabled={isSubmittingResponse} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDispatchResponse("decline")} disabled={isSubmittingResponse || !declineReason.trim()} className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50 hover:bg-red-700">
                {isSubmittingResponse ? "Submitting..." : "Submit Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 6. EMERGENCY MODAL */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
            <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Report Emergency
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">This will immediately notify dispatch and halt the delivery timeline.</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Type</label>
                <select value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600">
                  <option>Broken Truck</option>
                  <option>Accident</option>
                  <option>Medical Emergency</option>
                  <option>Severe Traffic/Roadblock</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Details</label>
                <textarea value={emergencyMessage} onChange={(e) => setEmergencyMessage(e.target.value)} placeholder="Describe the situation..." className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-20"></textarea>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowEmergencyModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
              <button onClick={handleSendEmergencyAlert} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap">
                {emergencySubmitted ? "Alert Sent!" : "Send Alert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}