// ==========================================
// LOGISCO - CREW DASHBOARD PAGE
// ==========================================
"use client";

import RowOpenButton from "@/components/RowOpenButton";
import { useToast } from "@/components/Toast";
import UrlSearchSync from "@/components/UrlSearchSync";
import { formatTime } from "@/app/lib/datetime";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { usePolling } from "@/app/lib/usePolling";
import { apiFetch, authFetch } from "@/app/lib/apiClient";
import {
  FileText,
  CheckCircle2,
  Clock,
  Eye,
  ArrowLeft,
  Truck,
  Camera,
  X,
  AlertTriangle,
  Navigation,
  Search,
  Archive,
  TrafficCone,
  MapPin,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { MapPoint } from "@/components/LiveRouteMap";
import { compressImage } from "@/app/lib/imageCompression";
import StallCheckInPrompt from "@/components/crew/StallCheckInPrompt";
import OpenIssueNotice from "@/components/crew/OpenIssueNotice";
import {
  DECLINE_CODES,
  DECLINE_CODES_NOT_COUNTED,
  STOP_STATUS,
  type DeclineCode,
} from "@/app/lib/enums";
import type { DeliveryRecord, RouteStop } from "./_components/types";
import {
  type PositionFix,
  isLiveTracking,
  setPositionListener,
  startLiveTracking,
  stopLiveTracking,
} from "./_components/liveTracking";
import { formatDispatchNote, generateDynamicStops, stopName } from "./_components/stops";


const LiveRouteMap = dynamic(() => import("@/components/LiveRouteMap"), {
  ssr: false,
  loading: () => <div className="h-80 sm:h-100 md:h-120 w-full animate-pulse bg-slate-100" />,
});

// Why a delivery stopped, and what happened when it did not. The office
// reads these to decide what to do, so they are chosen rather than typed.
const STOPPING_REASONS = [
  "Broken Truck",
  "Accident",
  "Medical Emergency",
  "Severe Traffic/Roadblock",
  "Other",
];

const CONTINUING_REASONS = [
  "Wrong product collected",
  "Missing items",
  "Damaged goods",
  "Receiver not available",
  "Cannot access the delivery point",
  "Heavy traffic - running late",
  "Other",
];

interface CrewDashboardProps {
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

type ViewMode = "list" | "update-status";
type TabFilter = "Active" | "Assigned" | "Completed";

export default function CrewDashboardPage({
  isOpen,
  setIsOpen,
}: CrewDashboardProps) {
  const showToast = useToast();
  const [selectedFilter, setSelectedFilter] = useState<TabFilter>("Active");
  const [searchTerm, setSearchTerm] = useState("");

  const [deliveryList, setDeliveryList] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [showDeclineConfirmModal, setShowDeclineConfirmModal] = useState<boolean>(false);
  const [declineReason, setDeclineReason] = useState<string>("");
  // A code as well as the typed words: "brakes", "brakes are gone" and
  // "unsafe" are one reason typed three ways, and no fair figure can be worked
  // out from free text. Three of the codes are not counted against the crew.
  const [declineCode, setDeclineCode] = useState<DeclineCode | "">("");
  const [isSubmittingResponse, setIsSubmittingResponse] = useState<boolean>(false);

  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRecord | null>(null);

  // The open trip, readable from the polling callback without making it depend
  // on the trip and restart the timer every time the crew tap something.
  // Written after the commit, not during the render, which is the only point at
  // which a ref is anybody's to touch.
  const openTripRef = useRef<DeliveryRecord | null>(null);
  useEffect(() => {
    openTripRef.current = selectedDelivery;
  }, [selectedDelivery]);

  // Which stop this screen is on, and the preview it is holding, for the same
  // reason: the poll has to compare against them without being rebuilt every
  // time the crew type a character.
  const stepIndexRef = useRef(0);
  const selectedImageRef = useRef<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // A search handed over from the header. Applied once the list has loaded,
  // because only then is it known which tab the match sits on.
  const [pendingUrlSearch, setPendingUrlSearch] = useState<string | null>(null);
  const applyUrlSearch = useCallback((query: string) => {
    setSearchTerm(query);
    setPendingUrlSearch(query);
    setShowDetailsModal(false);
    setSelectedDelivery(null);
    setViewMode("list");
  }, []);

  const [showStartConfirmModal, setShowStartConfirmModal] = useState<boolean>(false);
  const [showAcceptConfirmModal, setShowAcceptConfirmModal] = useState<boolean>(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState<boolean>(false);

  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  // Can the delivery carry on? A truck that will not start stops the trip; a
  // wrong product collected does not, and the crew sorts it out on the way.
  const [canContinue, setCanContinue] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState<string>("Broken Truck");
  // The report's own photo. The form used to send selectedFile - the proof of
  // delivery picked for the current stop - and had no photo field of its own.
  const [emergencyFile, setEmergencyFile] = useState<File | null>(null);
  const [isSendingEmergency, setIsSendingEmergency] = useState<boolean>(false);
  const [emergencyMessage, setEmergencyMessage] = useState<string>("");
  const [emergencyImage, setEmergencyImage] = useState<string | null>(null);
  const [emergencySubmitted, setEmergencySubmitted] = useState<boolean>(false);

  const [showTripReportModal, setShowTripReportModal] = useState<boolean>(false);
  const [tripRemarks, setTripRemarks] = useState<string>("");
  const [vehicleIssues, setVehicleIssues] = useState<string>("");
  const [showRemarksSuccess, setShowRemarksSuccess] = useState<boolean>(false);

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dynamicStops, setDynamicStops] = useState<RouteStop[]>([]);
  /** Stops this crew have reported arriving at, keyed by kind and id. */
  const [arrivedStops, setArrivedStops] = useState<Record<string, string>>({});
  const [isReportingArrival, setIsReportingArrival] = useState(false);
  const [driverPosition, setDriverPosition] = useState<PositionFix | null>(null);
  const [remarks, setRemarks] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    stepIndexRef.current = currentStepIndex;
    selectedImageRef.current = selectedImage;
  }, [currentStepIndex, selectedImage]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [receiverName, setReceiverName] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Polled, not loaded once: dispatch and the roadside mechanic change trips
  // from their side. A truck repaired on site resumes its trip, and the crew
  // used to keep seeing it as a foul trip until they reloaded the app.
  // isLoading starts true, so only the first answer clears the spinner.
  const fetchMyDispatches = useCallback(async () => {
      const startedAt = Date.now();
      try {
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
        
        const data: DeliveryRecord[] = await response.json();
        // A row this screen changed after the request left is newer than the
        // server's answer; keep it.
        setDeliveryList((prev) => {
          const local = new Map(prev.map((d) => [d.id, d]));
          return data.map((d) => {
            const mine = local.get(d.id);
            return mine?.localUpdatedAt && mine.localUpdatedAt > startedAt ? mine : d;
          });
        });
        // The open trip follows the server too, under the same rule as the
        // list: this screen's own change wins only while it is newer than the
        // answer we asked for.
        //
        // It used to stand still unless the server had brought it back from a
        // foul trip, which was a rule written for one person on a trip. With a
        // driver and a helper it froze whoever was not tapping: the helper
        // finished the pickup, the shared row moved on, and the driver went on
        // being shown a stop that was already done - and offered a button the
        // server would then refuse as "already progressed past that step".
        const open = openTripRef.current;
        if (open) {
          const fresh = data.find((d) => d.id === open.id);
          const mineIsNewer = Boolean(open.localUpdatedAt && open.localUpdatedAt > startedAt);
          if (fresh && !mineIsNewer) {
            setSelectedDelivery(fresh);
            setDynamicStops(generateDynamicStops(fresh));
            // Forward only. The other crew member finishing a stop moves
            // everybody on; nothing they do should drag this screen back to a
            // stop this one has already dealt with.
            const theirStep = fresh.current_step ?? 0;
            if (theirStep > stepIndexRef.current) {
              setCurrentStepIndex(theirStep);

              // Whatever was half filled in belonged to the stop they just
              // closed. Carrying a photograph and a receiver's name forward
              // would file them against the next stop instead, which is worse
              // than losing them - so it is cleared, and said out loud, because
              // a form emptying itself with no explanation reads as a crash.
              if (selectedImageRef.current) URL.revokeObjectURL(selectedImageRef.current);
              setSelectedImage(null);
              setSelectedFile(null);
              setReceiverName("");
              setRemarks("");
              showToast("The rest of the crew finished that stop. You are on the next one.", "info");
            }
          }
        }
      } catch (error) {
        console.error("Error fetching dispatches:", error);
      } finally {
        setIsLoading(false);
      }
  }, [showToast]);

  usePolling(() => void fetchMyDispatches(), 30000);

  useEffect(() => {
    // Back to page one whenever the list is filtered differently.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (isUnconfirmed(delivery.status)) return "Assigned";
    if (isAbortedTrip(delivery.status)) return "Foul Trip / Aborted";
    if (isSuccessfulFinish(delivery.status)) return "Delivery Concluded";
    
    const currentStep = delivery.current_step || 0;
    if (delivery.status?.toLowerCase() === "accepted" && currentStep === 0) return "Accepted - Awaiting Start";

    // Read off the trip's own steps. This was "Heading to Warehouse" for step 1
    // and "Products Loaded - Delivering" for everything after, so a second
    // collection read as delivering, and so did the drive back to base.
    const step = generateDynamicStops(delivery)[currentStep];
    const here = delivery.status?.toLowerCase() === "arrived";
    const place = step?.title.replace(/^(Pickup|Dropoff):\s*/i, "") ?? "";
    if (step?.type === "pickup") return here ? `Loading at ${place}` : `Heading to pickup: ${place}`;
    if (step?.type === "delivery") return here ? `At ${place}` : `Delivering to ${place}`;
    if (step?.title === "Returned") return "Returning to base";

    return delivery.status;
  };

  const unconfirmedCount = deliveryList.filter((d) => isUnconfirmed(d.status)).length;
  const activeCount = deliveryList.filter((d) => isActive(d.status)).length;
  const completedCount = deliveryList.filter((d) => isCompleted(d.status)).length;

  if (pendingUrlSearch !== null && !isLoading) {
    const needle = pendingUrlSearch.toLowerCase();
    const match = deliveryList.find(
      (d) =>
        d.bookingId.toLowerCase().includes(needle) ||
        d.clientName.toLowerCase().includes(needle) ||
        d.address.toLowerCase().includes(needle),
    );
    if (match) {
      // Same order the tab filter checks in.
      setSelectedFilter(
        isActive(match.status) ? "Active" : isCompleted(match.status) ? "Completed" : "Assigned",
      );
    }
    setPendingUrlSearch(null);
  }

  const filteredDeliveries = deliveryList
    .filter((delivery) => {
      if (selectedFilter === "Active" && !isActive(delivery.status)) return false;
      if (selectedFilter === "Assigned" && !isUnconfirmed(delivery.status)) return false;
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
    setPositionListener((fix) => setDriverPosition(fix));
    return () => {
      setPositionListener(null);
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

  // The road covered so far, drawn behind the pins the way the client's
  // tracking page draws it. Refreshed while a delivery is open.
  const [crewTrail, setCrewTrail] = useState<{ latitude: number; longitude: number }[]>([]);
  const openDeliveryID = viewMode === "update-status" ? selectedDelivery?.id : undefined;

  const loadTrail = useCallback(async () => {
    if (!openDeliveryID) return;
    try {
      const res = await apiFetch<{ data: { latitude: number; longitude: number }[] }>(
        `/api/crew/dispatches/location?dispatch_id=${openDeliveryID}`,
        { cache: "no-store" },
      );
      setCrewTrail(res.data ?? []);
    } catch (error) {
      console.error("Could not load the route travelled:", error);
    }
  }, [openDeliveryID]);

  usePolling(() => void loadTrail(), 30000, { enabled: Boolean(openDeliveryID) });

  // The road still ahead, drawn dashed under the trail. Polled far more slowly
  // than the position: it only changes when a stop is done or the truck has
  // gone a few hundred metres, and the server holds it for a few minutes.
  const [plannedRoute, setPlannedRoute] = useState<[number, number][]>([]);

  const loadPlannedRoute = useCallback(async () => {
    if (!openDeliveryID) return;
    try {
      const res = await apiFetch<{ data: { path: [number, number][] } | null }>(
        `/api/dispatch/${openDeliveryID}/route`,
        { cache: "no-store" },
      );
      setPlannedRoute(res.data?.path ?? []);
    } catch (error) {
      console.error("Could not load the route ahead:", error);
    }
  }, [openDeliveryID]);

  usePolling(() => void loadPlannedRoute(), 120000, { enabled: Boolean(openDeliveryID) });

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
      .filter((pickup) => pickup.latitude != null && pickup.longitude != null)
      .map((pickup, index) => ({
        id: `pickup-${pickup.pickupID ?? index}`,
        label: pickup.warehouse || "Pickup point",
        detail: pickup.pickupTime ? `Collect ${formatTime(String(pickup.pickupTime))}` : undefined,
        latitude: pickup.latitude as number,
        longitude: pickup.longitude as number,
        kind: "stop" as const,
        done: /deliver|complete/i.test(pickup.status ?? ""),
      })),
    ...(selectedDelivery?.multipleDeliveries ?? [])
      .filter((stop) => stop.latitude != null && stop.longitude != null)
      .map((stop, index) => ({
        id: `stop-${stop.branchID ?? index}`,
        label: stop.branch || "Delivery stop",
        detail: stop.deliveryTime ? `Expected ${formatTime(String(stop.deliveryTime))}` : undefined,
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
        showToast("Proof of delivery photo is required to complete this location.", "error");
        return;
      }
      if (!receiverName.trim()) {
        showToast("Receiver's Name is required to complete this location.", "error");
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
      const stopData = currentStop?.data;
      const currentStopBranchID = stopData && "branchID" in stopData ? stopData.branchID : undefined;
      const currentStopPickupID = stopData && "pickupID" in stopData ? stopData.pickupID : undefined;
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
        // On to the next stop, on the same screen. This went back to the list
        // after every stop, so the crew reopened the trip and tapped Update
        // Status at each one - and the screen that follows the shared trip, and
        // moves a helper on when the driver finishes a stop, was closed.
        showToast(`Done: ${dynamicStops[currentStepIndex]?.title || 'Location'}. On to the next stop.`, "success");
        setCurrentStepIndex(nextStep);
        if (selectedImage) URL.revokeObjectURL(selectedImage);
        setSelectedImage(null);
        setSelectedFile(null);
        setRemarks("");
        setReceiverName("");
      }
    } catch (error) {
      showToast(`Status update failed: ${error instanceof Error ? error.message : error}`, "error");
      // Most refusals here mean the other crew member got there first. The poll
      // would fix it within half a minute; asking now means the next thing they
      // see is the stop that is actually outstanding.
      void fetchMyDispatches();
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

      // The server's own words. It refuses a start when somebody assigned has
      // not accepted, and "Failed to update server" told the crew nothing about
      // who they were waiting for.
      if (!response.ok) {
        const refused = await response.json().catch(() => null);
        throw new Error(refused?.message || "Failed to update server");
      }

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

    } catch (error) {
      showToast(`${error instanceof Error ? error.message : error}`, "error");
      // A refusal nearly always means this screen is behind the shared row -
      // the other crew member has moved the trip on, or the office has. Go and
      // find out rather than leaving them to tap the same button again.
      void fetchMyDispatches();
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // Best available position for the report: the live fix if tracking is
  // running, otherwise one quick attempt. Never blocks the alert for long.
  const currentPosition = (): Promise<{ latitude: number; longitude: number } | null> => {
    if (driverPosition) return Promise.resolve({ latitude: driverPosition.latitude, longitude: driverPosition.longitude });
    if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 },
      );
    });
  };

  const handleEmergencyPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (emergencyImage) URL.revokeObjectURL(emergencyImage);
    setEmergencyImage(URL.createObjectURL(file));
    compressImage(file)
      .then(setEmergencyFile)
      .catch(() => setEmergencyFile(file));
  };

  const clearEmergencyPhoto = () => {
    if (emergencyImage) URL.revokeObjectURL(emergencyImage);
    setEmergencyImage(null);
    setEmergencyFile(null);
  };

  const handleSendEmergencyAlert = async () => {
    if (!selectedDelivery || isSendingEmergency) return;

    // "Other" used to arrive at dispatch as the single word "Other".
    if (emergencyReason === "Other" && !emergencyMessage.trim()) {
      showToast("Describe what happened - dispatch needs to know what to send.", "error");
      return;
    }

    setIsSendingEmergency(true);
    try {
      const sessionStr = localStorage.getItem("logisco_user_session") || sessionStorage.getItem("logisco_user_session");
      const token = sessionStr ? JSON.parse(sessionStr).token : "";

      const position = await currentPosition();

      const formData = new FormData();
      formData.append("dispatchID", String(selectedDelivery.id));
      formData.append("issueType", emergencyReason);
      formData.append("details", emergencyMessage.trim());
      formData.append("canContinue", canContinue ? "yes" : "no");
      if (position) {
        formData.append("latitude", String(position.latitude));
        formData.append("longitude", String(position.longitude));
      }
      if (emergencyFile) formData.append("emergencyImage", emergencyFile);

      const response = await fetch("/api/crew/dispatches/emergency", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send emergency alert");
      }

      setEmergencySubmitted(true);

      // A stopped trip ends here: tracking stops, the delivery becomes a foul
      // trip and the crew goes back to their list. A delivery that carries on
      // keeps its GPS, its status and the screen the crew was working in.
      if (!canContinue) {
        void stopLiveTracking();
        setDeliveryList((prev) =>
          prev.map((d) => (d.id === selectedDelivery.id ? { ...d, status: "Foul Trip", localUpdatedAt: Date.now() } : d)),
        );
      }

      setTimeout(() => {
        setEmergencySubmitted(false);
        setShowEmergencyModal(false);
        setEmergencyMessage("");
        clearEmergencyPhoto();
        if (!canContinue) {
          setViewMode("list");
          setSelectedDelivery(null);
        }
      }, 2000);

    } catch (error) {
      showToast(`Error sending alert: ${error instanceof Error ? error.message : error}`, "error");
    } finally {
      setIsSendingEmergency(false);
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
      
    } catch (error) {
      showToast(`Error saving report: ${error instanceof Error ? error.message : error}`, "error");
    }
  };

  const handleDispatchResponse = async (action: "accept" | "decline") => {
    if (!selectedDelivery) return;
    if (action === "decline" && !declineCode) {
      showToast("Please choose what the reason is.", "error");
      return;
    }
    if (action === "decline" && !declineReason.trim()) {
      showToast("Please provide a reason for declining.", "error");
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
          reason: action === "decline" ? declineReason : undefined,
          code: action === "decline" ? declineCode || undefined : undefined
        }),
      });

      if (!response.ok) {
        const refusal = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(refusal?.message || "Failed to update status");
      }
      const withdrew = action === "decline" && selectedDelivery.status?.toLowerCase() === "accepted";

      setDeliveryList((prev) =>
        prev.map((d) => d.id === selectedDelivery.id ? { ...d, status: action === "accept" ? "Accepted" : "Declined", localUpdatedAt: Date.now() } : d)
      );
      
      setShowAcceptConfirmModal(false);
      setShowDeclineConfirmModal(false);
      setShowDetailsModal(false);
      setDeclineReason("");
      showToast(withdrew ? "You have withdrawn. The office has been told." : `Assignment ${action}ed successfully.`, "success");
    } catch (error) {
      // String() rather than the bare value: a catch gives back unknown, and
      // alert() used to accept that and show the driver "[object Object]"
      // whenever what was thrown was not an Error.
      showToast(
        error instanceof Error ? error.message : String(error),
        "error",
      );
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
          className="w-full sm:w-40 min-h-tap sm:min-h-0 py-2 sm:py-2.5 bg-slate-800 hover:bg-black text-white font-semibold rounded-lg sm:rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
        >
          Close<span className="hidden sm:inline"> Details</span>
        </button>
      );
    }
    
    if (isUnconfirmed(selectedDelivery.status)) {
      return (
        <>
          <button
            onClick={() => setShowDeclineConfirmModal(true)}
            className="w-full sm:w-40 min-h-tap sm:min-h-0 py-2 sm:py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg sm:rounded-xl text-sm shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            Decline
          </button>
          <button
            onClick={() => setShowAcceptConfirmModal(true)}
            className="w-full sm:w-40 min-h-tap sm:min-h-0 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg sm:rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            Accept
          </button>
        </>
      );
    }
    
    if (selectedDelivery.status?.toLowerCase() === "accepted" && (selectedDelivery.current_step || 0) === 0) {
      // Accepting is not final: until the trip starts, somebody who can no
      // longer make it can withdraw, with a reason, and the office is told.
      const withdraw = (
        <button
          onClick={() => setShowDeclineConfirmModal(true)}
          className="w-full sm:w-40 min-h-tap sm:min-h-0 py-2 sm:py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg sm:rounded-xl text-sm shadow-sm transition-all cursor-pointer whitespace-nowrap"
        >
          Withdraw
        </button>
      );

      // Everybody assigned has to accept before the truck leaves. The server
      // refuses it either way; saying so here means the crew find out from the
      // screen rather than from a failed tap, and find out who they are
      // waiting for.
      const blocked = selectedDelivery.startBlockedReason;
      if (blocked) {
        return (
          <>
          {withdraw}
          <div className="w-full sm:w-72">
            <button
              type="button"
              disabled
              aria-describedby="start-blocked"
              className="w-full min-h-tap sm:min-h-0 py-2 sm:py-2.5 bg-slate-200 text-slate-500 font-semibold rounded-lg sm:rounded-xl text-sm border border-slate-300 cursor-not-allowed whitespace-nowrap"
            >
              Start Delivery
            </button>
            <p id="start-blocked" role="status" className="mt-1.5 text-xs font-medium text-amber-700 text-left">
              {blocked}
            </p>
          </div>
          </>
        );
      }

      return (
        <>
          {withdraw}
          <button
            onClick={() => setShowStartConfirmModal(true)}
            className="w-full sm:w-48 min-h-tap sm:min-h-0 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg sm:rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            Start Delivery
          </button>
        </>
      );
    }
    
    return (
      <button
        onClick={() => {
          const calculatedStops = generateDynamicStops(selectedDelivery);
          setDynamicStops(calculatedStops);
          setCurrentStepIndex(selectedDelivery.current_step || 0);
          // Resume GPS after an app restart or reload mid-trip.
          if (!isLiveTracking() && selectedDelivery.status?.toLowerCase() === "in transit") {
            void startLiveTracking(selectedDelivery.id);
          }
          setShowDetailsModal(false);
          setViewMode("update-status");
        }}
        className="w-full sm:w-48 min-h-tap sm:min-h-0 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg sm:rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
      >
        Update Status
      </button>
    );
  };

  // ---------------------------------------------------------------------------
  // "I am here", and what it gates
  // ---------------------------------------------------------------------------
  // The threshold that decides whether the office is told a truck has gone quiet
  // used to start from the last GPS movement, which could not tell an hour of
  // unloading from an hour broken down - the app reports only when the truck
  // rolls, so both arrive as silence. It was guessed at from how near a stop the
  // truck happened to be, and the guess had a hole: a delivery could start at the
  // depot, never leave, and never be mentioned to anybody.
  //
  // Reporting the arrival closes it. The clock stops while the crew are at a stop
  // they have told us about, and restarts when they finish it.
  //
  // The departure step is not a stop, so nothing is asked there.
  const activeStop = dynamicStops[currentStepIndex];
  const activeStopData = activeStop?.data;
  const activeStopKey = activeStopData
    ? "warehouse" in activeStopData
      ? `pickup:${activeStopData.pickupID ?? activeStopData.warehouse}`
      : `delivery:${activeStopData.branchID ?? activeStopData.branch}`
    : null;
  const stopWantsArrival =
    (activeStop?.type === "pickup" || activeStop?.type === "delivery") &&
    Boolean(activeStopData);
  const hasReportedArrival =
    !stopWantsArrival ||
    (activeStopKey !== null && Boolean(arrivedStops[activeStopKey])) ||
    // Survives a reload mid-stop: the server already knows.
    activeStopData?.status === STOP_STATUS.arrived;

  // Whether the handover is the job yet.
  //
  // Both tasks used to be on screen together: an arrival to declare and a proof
  // to upload, with the confirm button greyed out and the only explanation in a
  // title attribute, which a phone never shows. So the crew were looking at a
  // form they were meant to ignore and a dead button that would not say why,
  // and the obvious thing to try was the form. One at a time, in the order they
  // happen: say you are there, then record what you handed over.

  const reportArrival = async () => {
    if (!selectedDelivery || !activeStopData || !activeStopKey) return;

    setIsReportingArrival(true);
    try {
      const payload: Record<string, unknown> = { dispatchID: String(selectedDelivery.id) };
      if ("warehouse" in activeStopData) {
        if (activeStopData.pickupID == null) {
          // A booking made before PickupStops existed has no row to mark. Nothing
          // to report, and nothing gained by blocking the crew over it.
          setArrivedStops((prev) => ({ ...prev, [activeStopKey]: new Date().toISOString() }));
          return;
        }
        payload.pickupID = activeStopData.pickupID;
      } else {
        if (activeStopData.branchID == null) {
          setArrivedStops((prev) => ({ ...prev, [activeStopKey]: new Date().toISOString() }));
          return;
        }
        payload.branchID = activeStopData.branchID;
      }

      const response = await authFetch("/api/crew/dispatches/arrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        showToast(result.message ?? "Could not record that. Try again.", "error");
        return;
      }

      setArrivedStops((prev) => ({
        ...prev,
        [activeStopKey]: (result.arrivedAt as string) ?? new Date().toISOString(),
      }));
      showToast("Arrival recorded. Take your time here.", "success");
    } catch {
      showToast("No signal. Try again when you have one.", "error");
    } finally {
      setIsReportingArrival(false);
    }
  };

  return (
    <>
      <UrlSearchSync onQuery={applyUrlSearch} />
      {viewMode === "update-status" && selectedDelivery ? (
        <div className="p-3 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] font-sans relative">
          {/* The two report buttons take their own row on a phone; beside the
              title they ran off the screen and cut the Emergency button in half. */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 sm:gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setViewMode("list")} className="p-2 min-w-tap min-h-tap sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs cursor-pointer shrink-0 whitespace-nowrap">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Delivery Route</h1>
                <p className="text-sm text-slate-500 mt-0.5">Track locations and upload proofs of delivery.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto sm:shrink-0">
              <button
                onClick={() => {
                  // Opened on "yes, I can continue", because that is what this
                  // button is for. The modal still asks, and the driver can
                  // still say no - it is a starting point, not a decision.
                  setCanContinue(true);
                  setEmergencyReason(CONTINUING_REASONS[0]);
                  setShowEmergencyModal(true);
                }}
                className="flex-1 sm:flex-none justify-center min-h-tap md:min-h-0 px-3 sm:px-4 py-2 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-sm transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <TrafficCone className="w-4 h-4 shrink-0" />
                <span>Report a delay</span>
              </button>

              <button
                onClick={() => {
                  setCanContinue(false);
                  setEmergencyReason(STOPPING_REASONS[0]);
                  setShowEmergencyModal(true);
                }}
                className="flex-1 sm:flex-none justify-center min-h-tap md:min-h-0 px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Emergency</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">

            {/* Shows itself only once this device has stopped getting positions
                through, which is the only moment the question makes sense. */}
            <StallCheckInPrompt dispatchID={selectedDelivery.id} />

            {/* Anything they reported and have not cleared. Shows itself only
                when there is one, and clears in a tap - they are the ones who
                know it is sorted, and until now only the office could say so. */}
            <OpenIssueNotice
              dispatchID={selectedDelivery.id}
              onResolved={(message) => showToast(message, "success")}
            />

            {/* One tap on arrival, before any of the work at the stop.
                It is what stops the office being told a truck has gone quiet
                while the crew are standing at a delivery point unloading it. */}
            {stopWantsArrival && !hasReportedArrival && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Have you reached {stopName(activeStopData)}?
                </p>
                <p className="text-xs text-slate-700 mt-0.5">
                  Tell us when you get there. The office stops chasing the trip while you are
                  working, and your customer sees that you have arrived.
                </p>
                <p className="text-xs text-slate-600 mt-1.5">
                  The receiver&apos;s name and the photo come after this.
                </p>
                <button
                  type="button"
                  onClick={() => void reportArrival()}
                  disabled={isReportingArrival}
                  className="mt-3 w-full sm:w-auto min-h-tap sm:min-h-0 px-5 py-2 sm:py-3 sm:py-2.5 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg sm:rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-60"
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  {isReportingArrival ? "Sending..." : "I have arrived"}
                </button>
              </div>
            )}

            {stopWantsArrival && hasReportedArrival && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900">
                  Arrival recorded at {stopName(activeStopData)}. Nobody is counting the clock
                  against you while you are here.
                </p>
              </div>
            )}

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
                  trail={crewTrail}
                  plannedRoute={plannedRoute}
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
                     <div><p className="text-xs text-slate-500 font-medium">Location Name</p><p className="font-bold text-slate-900">{stopName(dynamicStops[currentStepIndex].data)}</p></div>
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
              {!isCompleted(selectedDelivery.status) && hasReportedArrival && (
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                  <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">Remarks & Notes</div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Remarks (Optional)</label>
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Ex. Arrived at the location, waiting for receiver..." className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-24"></textarea>
                  </div>
                </div>
              )}

              {/* POD (Only visible once they are there, and only if this stop
                  hands something over) */}
              {!isCompleted(selectedDelivery.status) && hasReportedArrival && dynamicStops[currentStepIndex]?.reqPod && (
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
                  className="w-full sm:w-48 min-h-tap sm:min-h-0 py-2.5 bg-slate-800 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  Back to Deliveries
                </button>
              ) : (
                <>
                {/* Said out loud, not in a title attribute: there is no hover on
                    a phone, so the reason the button was dead was invisible on
                    the only device this screen is used from. */}
                {!hasReportedArrival && (
                  <p role="status" className="text-xs font-semibold text-amber-700 text-center sm:self-center sm:text-right">
                    Tap &ldquo;I have arrived&rdquo; first.
                  </p>
                )}
                <button
                  onClick={() => setShowSubmitConfirmModal(true)}
                  // Finishing a stop the crew have not said they reached would
                  // leave the arrival unrecorded and the clock measuring from the
                  // wrong moment, so the order is enforced rather than suggested.
                  disabled={isSubmittingResponse || !hasReportedArrival}
                  className="w-full sm:w-64 min-h-tap sm:min-h-0 py-2.5 px-4 bg-blue-600 hover:bg-black text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer truncate disabled:opacity-50"
                >
                  {currentStepIndex >= dynamicStops.length - 1
                    ? "Complete Delivery"
                    : `Confirm: ${dynamicStops[currentStepIndex]?.title ?? "Update"}`}
                </button>
                </>
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
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-0 sm:right-3 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-auto sm:h-auto flex items-center justify-center text-slate-500 hover:text-slate-600 cursor-pointer" aria-label="Clear search"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Three equal columns rather than a scrolling strip: on a phone
                all three filters have to be reachable without swiping, since a
                driver is using this one-handed in a cab. Each keeps a 44px tap
                target on mobile and relaxes to the normal size from sm up. */}
            <div className="p-2 sm:p-4 border-b border-slate-100 w-full">
              <div className="grid grid-cols-3 gap-1 sm:gap-2 w-full">
                <button
                  onClick={() => setSelectedFilter("Active")}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 min-h-tap sm:min-h-0 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-semibold transition-all cursor-pointer truncate ${selectedFilter === "Active" ? "bg-blue-600 text-white shadow-md" : "bg-slate-100 text-slate-600"}`}
                >
                  <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Active ({activeCount})</span>
                </button>
                <button
                  onClick={() => setSelectedFilter("Assigned")}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 min-h-tap sm:min-h-0 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-semibold transition-all cursor-pointer truncate ${selectedFilter === "Assigned" ? "bg-amber-600 text-white shadow-md" : "bg-amber-50 text-amber-700"}`}
                >
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Assigned ({unconfirmedCount})</span>
                </button>
                <button
                  onClick={() => setSelectedFilter("Completed")}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 min-h-tap sm:min-h-0 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-semibold transition-all cursor-pointer truncate ${selectedFilter === "Completed" ? "bg-slate-800 text-white shadow-md" : "bg-slate-100 text-slate-600"}`}
                >
                  <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">History ({completedCount})</span>
                </button>
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
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-2"><FileText className="w-4 h-4" /></div>
                          <p className="text-sm font-semibold text-slate-800">{searchTerm ? "No matching deliveries found." : "No delivery records found"}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{searchTerm ? "Try a different search term." : "Try switching tabs to view other records."}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentDeliveries.map((delivery) => (
                      <tr data-pressable key={delivery.id} onClick={() => handleRowClick(delivery)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                        <td className="py-3 pl-4 sm:pl-8 md:pl-16 pr-2 text-left w-[72%] sm:w-2/3 overflow-hidden">
                          <RowOpenButton
                            label={`View delivery for ${delivery.clientName}`}
                            onOpen={() => handleRowClick(delivery)}
                            className="block w-full font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base mb-0.5 truncate"
                          >
                            {delivery.clientName}
                          </RowOpenButton>
                          <div className="text-xs font-semibold text-slate-600 mb-0.5 whitespace-nowrap">{delivery.bookingId}</div>
                          <div className="text-xs text-slate-500 mb-0.5 truncate w-full" title={delivery.address}>{delivery.address}</div>
                          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">{delivery.dateTime}</div>
                          {/* On a phone the stage gets its own line here; squeezed
                              into the right-hand third it wrapped four lines deep. */}
                          <span className={`sm:hidden inline-flex mt-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold leading-tight wrap-break-word max-w-full ${getStatusBadgeClass(delivery.status)}`}>
                            {getDisplayStatus(delivery)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 sm:pr-8 md:pr-16 pl-2 align-top w-[28%] sm:w-1/3">
                          <div className="flex flex-col items-end justify-start gap-1 h-full">
                            <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700 transition-colors text-right whitespace-nowrap"><Eye className="w-3.5 h-3.5 shrink-0" /><span>Click to View</span></div>
                            {/* The longest of these is "Products Loaded -
                                Delivering", which will not fit on one line in a
                                third of a phone screen. It wraps rather than
                                being cut off or forcing the row sideways. */}
                            <span className={`hidden sm:inline-flex items-center justify-center px-2 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold text-center wrap-break-word sm:whitespace-nowrap leading-tight ${getStatusBadgeClass(delivery.status)}`}>
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
              {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors whitespace-nowrap ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Previous</button>
                <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors whitespace-nowrap ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}>Next</button>
              </div>
              )}
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
                  {isAccepted(selectedDelivery.status) ? (
                    <span className={`sm:hidden inline-block mt-1.5 px-2.5 py-0.5 rounded-xl text-xs font-bold shadow-sm ${getStatusBadgeClass(selectedDelivery.status)}`}>{getDisplayStatus(selectedDelivery)}</span>
                  ) : (
                    <span className="sm:hidden inline-block mt-1.5 px-2.5 py-0.5 rounded-xl text-xs font-bold bg-amber-400 text-slate-900 shadow-sm">Assigned - accept or decline</span>
                  )}
                </div>
              </div>
              {/* On a phone the stage sits under the order ID instead: a long one
                  ("Heading to pickup: <warehouse>") pushed the close button out
                  of the header. */}
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {isAccepted(selectedDelivery.status) ? (
                  <span className={`hidden sm:inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-sm font-bold shadow-sm whitespace-nowrap ${getStatusBadgeClass(selectedDelivery.status)}`}>{getDisplayStatus(selectedDelivery)}</span>
                ) : (
                  <span className="hidden sm:inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-sm font-bold bg-amber-400 text-slate-900 shadow-sm whitespace-nowrap">Assigned - accept or decline</span>
                )}
                <button type="button" onClick={() => setShowDetailsModal(false)} className="p-1 min-w-tap min-h-tap sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto text-sm text-slate-900 bg-slate-50/50 flex-1">
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">1. Client Information</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Company / Client Name</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.clientName}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.contactPerson}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Contact Number</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.contactNumber}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.clientEmail || "No email on file"}</div></div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-700 mb-1">Business Address</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.address}</div></div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-slate-900 text-sm tracking-wide">2. Booking Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Delivery Schedule</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.scheduledDate}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Product to Deliver</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.product}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 truncate">{selectedDelivery.quantity || "Not recorded"}</div></div>
                  <div><label className="block text-xs font-medium text-slate-700 mb-1">Priority Level</label><div className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm font-semibold text-slate-900 truncate">{selectedDelivery.priorityLevel || "Not set"}</div></div>
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

            </div>

            {/* Actions for Details Modal based on Status */}
            <div className="flex flex-row justify-end pt-4 border-t border-slate-200 gap-2 sm:gap-3">
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
              <button onClick={() => setShowSubmitConfirmModal(false)} disabled={isSubmittingResponse} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
              <button onClick={handleUpdateStatusSubmit} disabled={isSubmittingResponse || (dynamicStops[currentStepIndex]?.reqPod && (!selectedImage || !receiverName.trim()))} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50 hover:bg-black">
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
              <button onClick={completeTripWorkflow} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap">Skip & Close</button>
              <button onClick={handleSendRemarks} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap">
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
              <button onClick={() => { setShowStartConfirmModal(false); setShowAcceptConfirmModal(false); }} disabled={isSubmittingResponse} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-sm whitespace-nowrap disabled:opacity-50">No</button>
              <button onClick={() => {
                  if (showStartConfirmModal) {
                    handleStartDelivery();
                  } else {
                    handleDispatchResponse("accept");
                  }
                }} disabled={isSubmittingResponse} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-emerald-600 text-white font-semibold responsive-btn rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50 hover:bg-emerald-700"
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
            {selectedDelivery.status?.toLowerCase() === "accepted" ? (
              <>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Withdraw from Delivery</h3>
                <p className="text-sm text-slate-600 mb-4">You accepted this delivery. If you can no longer do it, say why - the office will be told so they can send someone else.</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Decline Assignment</h3>
                <p className="text-sm text-slate-600 mb-4">Are you sure you want to decline this dispatch? You must provide a valid reason.</p>
              </>
            )}
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">What is the reason?</label>
            <select
              value={declineCode}
              onChange={(e) => setDeclineCode(e.target.value as DeclineCode | "")}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 mb-1.5 focus:outline-none focus:ring-2 focus:ring-red-600"
              required
            >
              <option value="">Choose one...</option>
              {(Object.keys(DECLINE_CODES) as DeclineCode[]).map((code) => (
                <option key={code} value={code}>
                  {DECLINE_CODES[code]}
                </option>
              ))}
            </select>
            {declineCode && DECLINE_CODES_NOT_COUNTED.includes(declineCode as DeclineCode) && (
              <p className="text-xs text-emerald-700 mb-3">
                This will not be counted against your record.
              </p>
            )}
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 mt-3">In your own words</label>
            <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Ex. Sick leave, Family emergency, Vehicle issues..." className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-24 mb-6" required></textarea>
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowDeclineConfirmModal(false); setDeclineReason(""); setDeclineCode(""); }} disabled={isSubmittingResponse} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDispatchResponse("decline")} disabled={isSubmittingResponse || !declineReason.trim() || !declineCode} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-50 hover:bg-red-700">
                {isSubmittingResponse
                  ? "Submitting..."
                  : selectedDelivery.status?.toLowerCase() === "accepted"
                    ? "Withdraw"
                    : "Submit Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 6. EMERGENCY MODAL */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
            <h3
              className={`text-lg font-bold mb-2 flex items-center gap-2 ${canContinue ? "text-amber-800" : "text-red-600"}`}
            >
              {canContinue ? (
                <TrafficCone className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              {canContinue ? "Report a delay" : "Report Emergency"}
            </h3>
            <p className="text-sm text-slate-600 mb-4">Dispatch is told either way. Whether the delivery stops depends on your answer below.</p>
            <div className="space-y-4 mb-6">
              <fieldset>
                <legend className="block text-xs font-semibold text-slate-700 mb-1">Can you carry on with this delivery?</legend>
                <div className="grid grid-cols-1 gap-2">
                  {([
                    [false, "No - the trip has to stop", "Dispatch will arrange a replacement. The truck and crew are freed."],
                    [true, "Yes - I can continue", "The delivery stays active. Dispatch is told, and the customer sees the reason on their tracking page."],
                  ] as const).map(([value, title, hint]) => (
                    <label
                      key={title}
                      className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${
                        canContinue === value
                          ? value
                            ? "border-amber-400 bg-amber-50/50"
                            : "border-red-500 bg-red-50/40"
                          : "border-slate-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="canContinue"
                        checked={canContinue === value}
                        onChange={() => {
                          setCanContinue(value);
                          setEmergencyReason((value ? CONTINUING_REASONS : STOPPING_REASONS)[0]);
                        }}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-bold text-slate-800">{title}</span>
                        <span className="block text-xs text-slate-500">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">What happened?</label>
                <select value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600">
                  {(canContinue ? CONTINUING_REASONS : STOPPING_REASONS).map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {emergencyReason === "Other" ? "What happened? (required)" : "Details"}
                </label>
                <textarea value={emergencyMessage} onChange={(e) => setEmergencyMessage(e.target.value)} placeholder={emergencyReason === "Other" ? "Describe what happened..." : "Describe the situation..."} className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-20"></textarea>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1">Photo (optional)</span>
                {emergencyImage ? (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={emergencyImage} alt="Emergency photo" className="w-full h-full object-cover" />
                    <button type="button" onClick={clearEmergencyPhoto} aria-label="Remove photo" className="absolute top-0.5 right-0.5 w-8 h-8 flex items-center justify-center bg-slate-900/70 text-white rounded-full">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex min-h-tap items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-600 cursor-pointer">
                    <Camera className="w-4 h-4 text-slate-500" />
                    Take or attach a photo
                    <input type="file" accept="image/*" capture="environment" onChange={handleEmergencyPhoto} className="hidden" />
                  </label>
                )}
              </div>
              <p className="text-xs text-slate-500">Your current location is sent with the report.</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowEmergencyModal(false)} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
              <button onClick={handleSendEmergencyAlert} disabled={isSendingEmergency || emergencySubmitted} className="flex-1 min-h-tap sm:min-h-0 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-md whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed">
                {emergencySubmitted
                  ? canContinue
                    ? "Reported - carry on"
                    : "Alert Sent!"
                  : isSendingEmergency
                    ? "Sending..."
                    : canContinue
                      ? "Report Issue"
                      : "Send Alert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
