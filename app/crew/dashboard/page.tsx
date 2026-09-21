// ==========================================
// LOGISCO - CREW DASHBOARD PAGE
// ==========================================
"use client";

import React, { useState, useEffect } from "react";
import { FileText, CheckCircle2, Clock, Eye, ArrowLeft, Truck, Camera, X, AlertTriangle, Navigation, Search, Archive } from "lucide-react";
import { registerPlugin, Capacitor } from '@capacitor/core';
import dynamic from "next/dynamic";
import { getAccessToken } from "@/app/lib/apiClient";
import type { MapPoint } from "@/components/LiveRouteMap";

const LiveRouteMap = dynamic(() => import("@/components/LiveRouteMap"), {
  ssr: false,
  loading: () => <div className="h-80 sm:h-100 md:h-120 w-full animate-pulse bg-slate-100" />,
});
import { compressImage } from "@/app/lib/imageCompression";

// Background Geolocation Setup
const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation');
let activeTrackingId: string | null = null;

// The tracking watchers live outside React; this lets the open screen show the
// driver's own position without waiting for a round trip through the server.
type PositionFix = { latitude: number; longitude: number };
let onPositionUpdate: ((fix: PositionFix) => void) | null = null;

// Browser geolocation can fire several times a second; one fix every 10s is
// plenty for the fleet map and keeps mobile data use low.
const WEB_PING_INTERVAL_MS = 10_000;
let lastWebPingAt = 0;

// Sends one GPS fix. The token is read per ping so tracking survives token
// refreshes. Returns false once the server reports the trip is closed.
async function postLocation(
  dispatchId: string | number,
  fix: { latitude: number; longitude: number; speed?: number | null; heading?: number | null },
): Promise<boolean> {
  const token = getAccessToken();
  if (!token) return true;

  try {
    const response = await fetch("/api/crew/dispatches/location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ dispatch_id: dispatchId, ...fix }),
    });
    return response.status !== 409;
  } catch {
    // Offline: drop this fix, the next one will update the pin.
    return true;
  }
}

async function stopLiveTracking() {
  if (activeTrackingId) {
    if (Capacitor.getPlatform() === 'web') {
      navigator.geolocation.clearWatch(parseInt(activeTrackingId));
    } else {
      await BackgroundGeolocation.removeWatcher({ id: activeTrackingId });
    }
    activeTrackingId = null;
    console.log("Live tracking stopped.");
  }
}

const startLiveTracking = async (dispatchId: string | number) => {
  try {
    // Never run two watchers at once.
    await stopLiveTracking();

    // === WEB BROWSER FALLBACK FOR TESTING ===
    if (Capacitor.getPlatform() === 'web') {
      console.log("Web platform detected. Using browser HTML5 GPS for testing.");

      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const now = Date.now();
          if (now - lastWebPingAt < WEB_PING_INTERVAL_MS) return;
          lastWebPingAt = now;

          onPositionUpdate?.({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });

          const stillOpen = await postLocation(dispatchId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed || 0,
            heading: position.coords.heading || 0,
          });
          if (!stillOpen) void stopLiveTracking();
        },
        (err) => console.warn("Web GPS Error:", err),
        { enableHighAccuracy: true }
      );

      activeTrackingId = watchId.toString();
      return;
    }

    // === NATIVE MOBILE TRACKING (ANDROID/IOS) ===
    activeTrackingId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Tracking active delivery route.",
        backgroundTitle: "Logisco Live GPS",
        requestPermissions: true,
        stale: false,
        distanceFilter: 15, // Pings every 15 meters of movement
      },
      async (location: any, error: any) => {
        if (error || !location) return;

        onPositionUpdate?.({
          latitude: location.latitude,
          longitude: location.longitude,
        });

        const stillOpen = await postLocation(dispatchId, {
          latitude: location.latitude,
          longitude: location.longitude,
          speed: location.speed,
          heading: location.bearing,
        });
        if (!stillOpen) void stopLiveTracking();
      }
    );
  } catch (err) {
    console.warn("Tracking initialization failed:", err);
  }
};

export interface PickupRecord {
  // Present for pickups that came from the PickupStops table. Bookings made
  // before that table existed have no id, and the crew app falls back to the
  // single pickup line the booking notes carry.
  pickupID?: number;
  warehouse: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  pickupTime: string;
  quantity: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryDestinationRecord {
  branchID?: number;
  branch: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  deliveryTime: string;
  quantity: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
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
  pickupCompletedAt?: string | null;
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
    stops.push({ title: `Pickup: ${delivery.pickupAddress?.split(',')[0] || 'Pickup point'}`, type: "pickup", reqPod: true });
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
            <div key={idx} className="font-bold text-emerald-800 text-xs tracking-wider uppercase mt-4 mb-2 border-b border-emerald-200/50 pb-1 first:mt-0">
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
  const [driverPosition, setDriverPosition] = useState<PositionFix | null>(null);
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
  // Cancelled and rejected are finished too: without them a cancelled trip
  // counted as unconfirmed and offered the driver accept/decline buttons.
  const completedStatuses = ["completed", "delivered", "returned", "foul trip", "declined", "cancelled", "rejected"];

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
      warehouse: delivery.pickupAddress?.split(",")[0] || "Pickup point",
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

  // Show the driver's position on the map as tracking reports it.
  useEffect(() => {
    onPositionUpdate = (fix) => setDriverPosition(fix);
    return () => {
      onPositionUpdate = null;
    };
  }, []);

  // One reading when the map opens, so the driver appears immediately rather
  // than after the first tracking ping.
  useEffect(() => {
    if (viewMode !== "update-status") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) =>
        setDriverPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => console.warn("Could not read current position:", error.message),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [viewMode]);

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
      // Shrink camera photos so uploads fit the server's request size limit.
      compressImage(file)
        .then(setSelectedFile)
        .catch(() => setSelectedFile(file));
    }
  };

  // The driver plus any stop with real coordinates. Stops booked before
  // addresses were geocoded have none, and are simply not plotted.
  const crewMapPoints: MapPoint[] = [
    ...(driverPosition
      ? [
          {
            id: "me",
            label: "Your location",
            detail: selectedDelivery?.assignedVehicle
              ? `Truck ${selectedDelivery.assignedVehicle}`
              : "Current position",
            latitude: driverPosition.latitude,
            longitude: driverPosition.longitude,
            kind: "truck" as const,
          },
        ]
      : []),
    ...(selectedDelivery?.multiplePickups ?? [])
      .filter((pickup: any) => pickup.latitude != null && pickup.longitude != null)
      .map((pickup: any, index: number) => ({
        id: `pickup-${pickup.pickupID ?? index}`,
        label: pickup.warehouse || "Pickup point",
        detail: pickup.pickupTime ? `Collect ${String(pickup.pickupTime).slice(0, 5)}` : undefined,
        latitude: pickup.latitude as number,
        longitude: pickup.longitude as number,
        kind: "stop" as const,
        done: /deliver|complete/i.test(pickup.status ?? ""),
      })),
    ...(selectedDelivery?.multipleDeliveries ?? [])
      .filter((stop: any) => stop.latitude != null && stop.longitude != null)
      .map((stop: any, index: number) => ({
        id: `stop-${stop.branchID ?? index}`,
        label: stop.branch || "Delivery stop",
        detail: stop.deliveryTime ? `Expected ${String(stop.deliveryTime).slice(0, 5)}` : undefined,
        latitude: stop.latitude as number,
        longitude: stop.longitude as number,
        kind: "stop" as const,
        done: /deliver|complete/i.test(stop.status ?? ""),
      })),
  ];

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
        macroStatus = "In Transit";
      }

      const sessionStr = localStorage.getItem("logisco_user_session") || sessionStorage.getItem("logisco_user_session");
      const token = sessionStr ? JSON.parse(sessionStr).token : "";

      const formData = new FormData();
      formData.append("dispatchID", String(selectedDelivery.id));
      formData.append("status", macroStatus);
      formData.append("current_step", String(nextStep));
      formData.append("remarks", remarks);
      
      const currentStopTitle = dynamicStops[currentStepIndex]?.title || "Location Update";
      formData.append("title", currentStopTitle);

      // Identifies the stop row being completed, so the server records the
      // progress against the itinerary instead of trusting this index.
      const currentStop = dynamicStops[currentStepIndex];
      const currentStopBranchID = (currentStop?.data as any)?.branchID;
      const currentStopPickupID = (currentStop?.data as any)?.pickupID;
      if (currentStop?.type === "pickup") {
        if (currentStopPickupID) formData.append("pickupID", String(currentStopPickupID));
      } else if (currentStopBranchID) {
        formData.append("branchID", String(currentStopBranchID));
      }
      
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
        void stopLiveTracking();
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

  const handleStartDelivery = async () => {
    if (!selectedDelivery) return;
    setIsSubmittingResponse(true);

    try {
      const sessionStr = localStorage.getItem("logisco_user_session") || sessionStorage.getItem("logisco_user_session");
      const token = sessionStr ? JSON.parse(sessionStr).token : "";

      // 1. Immediately push the database to Step 1 (In Transit to Pickup)
      const formData = new FormData();
      formData.append("dispatchID", String(selectedDelivery.id));
      formData.append("status", "In Transit");
      formData.append("current_step", "1");
      formData.append("title", "Departed Base");

      const response = await fetch("/api/crew/dispatches/status", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to update server");

      // 2. Start GPS Tracking
      void startLiveTracking(selectedDelivery.id);

      // 3. Update Local State to reflect "In Transit"
      const updatedDelivery = { ...selectedDelivery, status: "In Transit", current_step: 1, localUpdatedAt: Date.now() };
      
      setDeliveryList((prev) => prev.map((d) => d.id === selectedDelivery.id ? updatedDelivery : d));
      setSelectedDelivery(updatedDelivery);

      // 4. Switch the View directly to the Map
      setShowStartConfirmModal(false);
      setShowDetailsModal(false);
      
      const calculatedStops = generateDynamicStops(updatedDelivery);
      setDynamicStops(calculatedStops);
      setCurrentStepIndex(1); // Set directly to 1 (Heading to Pickup)
      setViewMode("update-status");

    } catch (error: any) {
      alert(`Failed to start route: ${error.message}`);
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
      void stopLiveTracking();
      
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
          className="w-full sm:w-40 min-h-11 sm:min-h-0 py-2.5 bg-slate-800 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
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
            className="w-full sm:w-40 min-h-11 sm:min-h-0 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-xl text-sm shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            Decline
          </button>
          <button
            onClick={() => setShowAcceptConfirmModal(true)}
            className="w-full sm:w-40 min-h-11 sm:min-h-0 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
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
          className="w-full sm:w-48 min-h-11 sm:min-h-0 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
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
          // Resume GPS after an app restart or reload mid-trip.
          if (!activeTrackingId && selectedDelivery.status?.toLowerCase() === "in transit") {
            void startLiveTracking(selectedDelivery.id);
          }
          setShowDetailsModal(false);
          setViewMode("update-status");
        }}
        className="w-full sm:w-48 min-h-11 sm:min-h-0 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
      >
        Update Status
      </button>
    );
  };

  return (
    <>
      {viewMode === "update-status" && selectedDelivery ? (
        <div className="p-3 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] font-sans relative">
          <div className="flex items-center justify-between mb-6 gap-2">
            <div className="flex items-center gap-3">
              <button onClick={() => setViewMode("list")} className="p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0 whitespace-nowrap">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Delivery Route</h1>
                <p className="text-sm text-slate-500 mt-0.5">Track locations and upload proofs of delivery.</p>
              </div>
            </div>
            <button onClick={() => setShowEmergencyModal(true)} className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap">
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

              <div className="relative w-full h-80 sm:h-100 md:h-120">
                <LiveRouteMap
                  points={crewMapPoints}
                  heightClass="h-80 sm:h-100 md:h-120"
                  emptyMessage="Waiting for a GPS signal. Start the delivery to begin tracking."
                />
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
                    
                    const status = isNodeCompleted ? "Completed" : isNodeAborted ? "Aborted" : isNodeOngoing ? "Ongoing Delivery" : "Pending";

                    return (
                      <div key={idx} className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 text-sm ${isNodeCompleted ? 'border-emerald-200 bg-emerald-50/30' : isNodeAborted ? 'border-red-300 bg-red-50/30' : isNodeOngoing ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold truncate ${isNodeCompleted ? 'text-emerald-700' : isNodeAborted ? 'text-red-700' : 'text-blue-700'}`}>Pickup Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs uppercase tracking-wider shrink-0 ${getStatusBadgeClass(status)}`}>{status}</span>
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
                    
                    const status = isNodeCompleted ? "Completed" : isNodeAborted ? "Aborted" : isNodeOngoing ? "Ongoing Delivery" : "Pending";

                    return (
                      <div key={idx} className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 text-sm ${isNodeCompleted ? 'border-emerald-200 bg-emerald-50/30' : isNodeAborted ? 'border-red-300 bg-red-50/30' : isNodeOngoing ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold truncate ${isNodeCompleted ? 'text-emerald-700' : isNodeAborted ? 'text-red-700' : 'text-blue-700'}`}>Delivery Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs uppercase tracking-wider shrink-0 ${getStatusBadgeClass(status)}`}>{status}</span>
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

            {/* View Mode Actions. On a phone this sits below a 320px map and
                the stop details, so it is pinned to the bottom of the screen:
                the driver should not scroll past everything at every stop to
                reach the one button they came for. The negative margins
                stretch it across the card padding; from sm up it returns to
                the normal flow. */}
            <div className="sticky bottom-0 z-20 -mx-4 -mb-4 px-4 pt-3 pb-4 bg-white/95 backdrop-blur-sm rounded-b-2xl shadow-[0_-4px_12px_rgba(15,23,42,0.06)] sm:static sm:mx-0 sm:mb-0 sm:px-0 sm:pt-4 sm:pb-0 sm:bg-transparent sm:backdrop-blur-none sm:rounded-none sm:shadow-none flex flex-col sm:flex-row justify-end border-t border-slate-200 gap-3">
              {isCompleted(selectedDelivery.status) ? (
                <button
                  onClick={() => {
                    setViewMode("list");
                    setSelectedDelivery(null);
                  }}
                  className="w-full sm:w-48 min-h-11 sm:min-h-0 py-2.5 bg-slate-800 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  Back to Deliveries
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitConfirmModal(true)}
                  disabled={isSubmittingResponse}
                  className="w-full sm:w-64 min-h-11 sm:min-h-0 py-2.5 px-4 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer truncate disabled:opacity-50"
                >
                  {currentStepIndex >= dynamicStops.length - 1
                    ? "Complete Delivery"
                    : `Confirm: ${dynamicStops[currentStepIndex]?.title ?? "Update"}`}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ======================= LIST VIEW =======================
        <div className="p-3 sm:p-5 md:p-6 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] font-sans relative">
          <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 pl-1 lg:pl-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Crew Delivery Dashboard</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage your assigned delivery schedules and confirm pending bookings.</p>
            </div>
            
            <div className="relative w-full md:w-72 shrink-0">
              <input type="text" placeholder="Search Booking ID or Client..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-11 sm:pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-0 sm:right-3 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-auto sm:h-auto flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Clear search"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 px-4 sm:px-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 w-full overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
                <button onClick={() => setSelectedFilter("Active")} className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${selectedFilter === "Active" ? "bg-blue-600 text-white shadow-md" : "bg-slate-100 text-slate-600"}`}><Truck className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Active ({activeCount})</span></button>
                <button onClick={() => setSelectedFilter("Unconfirmed")} className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${selectedFilter === "Unconfirmed" ? "bg-amber-600 text-white shadow-md" : "bg-amber-50 text-amber-700"}`}><Clock className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">Unconfirmed ({unconfirmedCount})</span></button>
                <button onClick={() => setSelectedFilter("Completed")} className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${selectedFilter === "Completed" ? "bg-slate-800 text-white shadow-md" : "bg-slate-100 text-slate-600"}`}><Archive className="w-4 h-4 shrink-0" /><span className="whitespace-nowrap">History ({completedCount})</span></button>
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
                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${getStatusBadgeClass(delivery.status)}`}>
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
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-3 sm:px-6 py-4 bg-[#000c31] text-white border-b border-slate-800 shrink-0 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Truck className="w-4 h-4 text-white" /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm md:text-lg font-bold text-white tracking-tight truncate leading-tight">Delivery Information</h2>
                  <p className="text-slate-300 text-xs sm:text-xs font-semibold mt-0.5 truncate">Order ID: <span className="font-semibold text-white">{selectedDelivery.bookingId}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {isAccepted(selectedDelivery.status) ? (
                  <span className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-sm font-bold shadow-sm whitespace-nowrap ${getStatusBadgeClass(selectedDelivery.status)}`}>{getDisplayStatus(selectedDelivery)}</span>
                ) : (
                  <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-sm font-bold bg-amber-400 text-slate-900 shadow-sm whitespace-nowrap">Awaiting Confirmation</span>
                )}
                <button type="button" onClick={() => setShowDetailsModal(false)} className="p-1 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto text-sm text-slate-900 bg-slate-50/50 flex-1">
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">1. Client Information</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Company / Client Name</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.clientName}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.contactPerson}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Contact Number</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.contactNumber}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.clientEmail || "admin@client.com"}</div></div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-700 mb-1">Business Address</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.address}</div></div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">2. Booking Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Delivery Schedule</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.scheduledDate}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Product to Deliver</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.product}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.quantity || "3,500 lbs"}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Priority Level</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm font-semibold text-slate-900 truncate">{selectedDelivery.priorityLevel || "Standard"}</div></div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">3. Assigned Delivery Crew & Vehicle</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Truck Plate No.</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.assignedVehicle}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Driver</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.driver}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Helper #1</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.helper}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Helper #2</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.helper2 || "None"}</div></div>
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
                    
                    const status = isNodeCompleted ? "Completed" : isNodeAborted ? "Aborted" : isNodeOngoing ? "Ongoing Delivery" : "Pending";

                    return (
                      <div key={idx} className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 text-sm ${isNodeCompleted ? 'border-emerald-200 bg-emerald-50/30' : isNodeAborted ? 'border-red-300 bg-red-50/30' : isNodeOngoing ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold truncate ${isNodeCompleted ? 'text-emerald-700' : isNodeAborted ? 'text-red-700' : 'text-blue-700'}`}>Pickup Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs uppercase tracking-wider shrink-0 ${getStatusBadgeClass(status)}`}>{status}</span>
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
                    
                    const status = isNodeCompleted ? "Completed" : isNodeAborted ? "Aborted" : isNodeOngoing ? "Ongoing Delivery" : "Pending";

                    return (
                      <div key={idx} className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 text-sm ${isNodeCompleted ? 'border-emerald-200 bg-emerald-50/30' : isNodeAborted ? 'border-red-300 bg-red-50/30' : isNodeOngoing ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold truncate ${isNodeCompleted ? 'text-emerald-700' : isNodeAborted ? 'text-red-700' : 'text-blue-700'}`}>Delivery Address #{idx + 1}</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-semibold text-xs uppercase tracking-wider shrink-0 ${getStatusBadgeClass(status)}`}>{status}</span>
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
            <p className="text-sm text-slate-600 mb-6">
              Confirm arrival/completion for <strong className="text-blue-600">{dynamicStops[currentStepIndex]?.title}</strong>?
              {dynamicStops[currentStepIndex]?.reqPod && (!selectedImage || !receiverName.trim()) && <span className="block mt-2 text-red-500 font-semibold">Note: Proof of Delivery photo & Receiver&apos;s Name is required.</span>}
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowSubmitConfirmModal(false)} disabled={isSubmittingResponse} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
              <button onClick={handleUpdateStatusSubmit} disabled={isSubmittingResponse || (dynamicStops[currentStepIndex]?.reqPod && (!selectedImage || !receiverName.trim()))} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50 hover:bg-black">
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
            <p className="text-sm text-slate-600 mb-4">Please submit any final remarks or log any vehicle issues observed during the trip.</p>
            <div className="space-y-4 mb-6">
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Trip Remarks</label><textarea value={tripRemarks} onChange={(e) => setTripRemarks(e.target.value)} placeholder="How was the trip?" className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-20"></textarea></div>
              <div><label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Issues (If any)</label><textarea value={vehicleIssues} onChange={(e) => setVehicleIssues(e.target.value)} placeholder="Any unusual sounds, flat tires, etc." className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-20"></textarea></div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={completeTripWorkflow} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap">Skip & Close</button>
              <button onClick={handleSendRemarks} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap">
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
            <p className="text-sm text-slate-600 mb-6">
              {showStartConfirmModal ? "Open tracking and update the status of this delivery?" : "Confirm this delivery assignment?"}
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowStartConfirmModal(false); setShowAcceptConfirmModal(false); }} disabled={isSubmittingResponse} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-sm whitespace-nowrap disabled:opacity-50">No</button>
              <button onClick={() => {
                  if (showStartConfirmModal) {
                    handleStartDelivery();
                  } else {
                    handleDispatchResponse("accept");
                  }
                }} disabled={isSubmittingResponse} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-emerald-600 text-white font-semibold responsive-btn rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50 hover:bg-emerald-700"
              >
                {isSubmittingResponse && !showStartConfirmModal ? "Accepting..." : isSubmittingResponse && showStartConfirmModal ? "Starting..." : "Yes"}
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
            <p className="text-sm text-slate-600 mb-4">Are you sure you want to decline this dispatch? You must provide a valid reason.</p>
            <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Ex. Sick leave, Family emergency, Vehicle issues..." className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-24 mb-6" required></textarea>
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowDeclineConfirmModal(false); setDeclineReason(""); }} disabled={isSubmittingResponse} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDispatchResponse("decline")} disabled={isSubmittingResponse || !declineReason.trim()} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50 hover:bg-red-700">
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
            <p className="text-sm text-slate-600 mb-4">This will immediately notify dispatch and halt the delivery timeline.</p>
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
              <button onClick={() => setShowEmergencyModal(false)} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
              <button onClick={handleSendEmergencyAlert} className="flex-1 min-h-11 sm:min-h-0 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap">
                {emergencySubmitted ? "Alert Sent!" : "Send Alert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}