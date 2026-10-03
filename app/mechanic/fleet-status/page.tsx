// ==========================================
// LOGISCO - MECHANIC FLEET STATUS PAGE
// ==========================================
"use client";

import type { EmployeeRow, TruckRow } from "@/types/database";
import UrlSearchSync from "@/components/UrlSearchSync";
import { authFetch } from "@/app/lib/apiClient";
import { fetchLogPhotos, mergeLogPhotos } from "@/app/lib/logPhotos";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import RowOpenButton from "@/components/RowOpenButton";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";
import {
  Search,
  Truck,
  FileText,
  AlertTriangle,
  Loader2,
  Archive,
} from "lucide-react";
import type { EmployeeOption, HistoryLogRecord, TruckRecord } from "./_components/types";
import { LogDetailView } from "./_components/LogDetailView";
import { TruckSpecificHistoryView } from "./_components/TruckSpecificHistoryView";
import { TruckDetailView } from "./_components/TruckDetailView";
import { formatDisplayDate } from "./_components/dates";
import { TruckModal } from "./_components/TruckModal";
import { LogMaintenanceModal } from "./_components/LogMaintenanceModal";


// ==========================================
// MECHANIC FLEET STATUS PAGE (MAIN)
// ==========================================
interface MechanicFleetStatusProps {
  isOpen?: boolean;
  setIsopen?: (open: boolean) => void;
}

export default function MechanicFleetStatusPage({
  isOpen,
  setIsopen,
}: MechanicFleetStatusProps) {
  const showToast = useToast();
  // 1. Dynamic state for the logged-in mechanic
  const [currentUser, setCurrentUser] = useState({
    employeeID: "",
    employeeName: "Loading...",
  });

  // 2. Fetch the real user session on component mount
  useEffect(() => {
    // FIX: Check both storages using the exact key from your login page
    const storedUser =
      localStorage.getItem("logisco_user_session") ||
      sessionStorage.getItem("logisco_user_session");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);

        // 3. Strict Role Validation: Only assign if the user is actually a mechanic
        if (
          parsedUser.role &&
          parsedUser.role.toLowerCase().includes("mechanic")
        ) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCurrentUser({
            employeeID: String(parsedUser.id || parsedUser.employeeID),
            employeeName:
              parsedUser.employeeName || parsedUser.name || "Unknown Mechanic",
          });
        } else {
          setCurrentUser({ employeeID: "", employeeName: "Unauthorized Role" });
        }
      } catch (error) {
        console.error("Failed to parse user session", error);
        setCurrentUser({ employeeID: "", employeeName: "Error loading data" });
      }
    } else {
      // Catch-all if you test the page without logging in first
      setCurrentUser({ employeeID: "", employeeName: "No user session found" });
    }
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"All" | "On Maintenance" | "Available" | "Already Booked" | "On Delivery" | "Out of Service">("All");
  const [showArchived, setShowArchived] = useState(false);

  const [isSavingTruck, setIsSavingTruck] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);

  const [truckToDelete, setTruckToDelete] = useState<string | number | null>(
    null,
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<TruckRecord | null>(null);
  const [editingTruck, setEditingTruck] = useState<TruckRecord | null>(null);

  const [showStatusSelectModal, setShowStatusSelectModal] = useState(false);
  const [statusConfirmTruck, setStatusConfirmTruck] =
    useState<TruckRecord | null>(null);
  const [pendingStatusTarget, setPendingStatusTarget] = useState<string>("");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // States to manage History and Maintenance modals
  const [showTruckHistoryView, setShowTruckHistoryView] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] =
    useState<HistoryLogRecord | null>(null);
  const [editingHistoryRecord, setEditingHistoryRecord] =
    useState<HistoryLogRecord | null>(null);
  const [showLogMaintenanceModal, setShowLogMaintenanceModal] = useState(false);
  const [maintenanceFormType, setMaintenanceFormType] = useState<
    "inspection" | "update" | "log"
  >("log");



  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  useEffect(() => {
    // Back to page one whenever the list is filtered differently.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  const [fleetList, setFleetList] = useState<TruckRecord[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<HistoryLogRecord[]>(
    [],
  );

  const requestedPhotoIDs = useRef<Set<string>>(new Set());

  // Photos are excluded from the list payload; load them for the truck whose
  // history is open, covering every log shown in its detail view.
  useEffect(() => {
    if (!selectedHistoryRecord) return;

    const truckLogIDs = maintenanceLogs
      .filter((log) => log && String(log.truckID) === String(selectedHistoryRecord.truckID))
      .filter((log) =>
        (log.hasPreliminaryPhoto && !log.preliminaryPhotoUrl) ||
        (log.hasProgressPhoto && !log.progressPhotoUrl) ||
        (log.hasFinalPhoto && !log.photoUrl),
      )
      .map((log) => log.id);

    // Only request each log once: a log flagged as having a photo whose row
    // turns out to be empty must not be retried on every render.
    const pending = truckLogIDs.filter((id) => !requestedPhotoIDs.current.has(String(id)));
    if (pending.length === 0) return;
    pending.forEach((id) => requestedPhotoIDs.current.add(String(id)));

    let active = true;
    fetchLogPhotos(pending)
      .then((photos) => {
        if (!active || Object.keys(photos).length === 0) return;
        setMaintenanceLogs((prev) => mergeLogPhotos(prev, photos));
        setSelectedHistoryRecord((prev) =>
          prev ? mergeLogPhotos([prev], photos)[0] : prev,
        );
      })
      .catch((error) => console.error("Failed to load photos:", error));

    return () => {
      active = false;
    };
  }, [selectedHistoryRecord, maintenanceLogs]);
  const [mechanicsOptions, setMechanicsOptions] = useState<EmployeeOption[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrucks = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/fleet-status`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      const payload = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : [];
      const mappedData: TruckRecord[] = (payload as Partial<TruckRow>[]).map((truck) => ({
        id: truck.truckID ?? "",
        plateNumber: truck.plateNumber ?? "",
        truckType: truck.truckType ?? "",
        truckModel: truck.model ?? "",
        capacity: truck.capacity === null || truck.capacity === undefined ? "" : String(truck.capacity),
        lastChecked: truck.lastChecked ?? "",
        status: truck.truckStatus || "Available",
      }));

      // Forces highest ID (newest) to the top and resolves the TS (a, b) error
      const sortedData = mappedData.sort(
        (a: TruckRecord, b: TruckRecord) => Number(b.id) - Number(a.id),
      );

      setFleetList(sortedData);
    } catch (error) {
      console.error("Error fetching trucks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await authFetch(`/api/historyLogsM?t=${Date.now()}`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      // Safely extract the array whether the API wraps it in 'data', 'logs', or returns it directly
      const rawLogs = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.logs)
            ? result.logs
            : [];

      // /api/historyLogsM returns a log already flattened - its mechanics,
      // notes and photos folded into one record by the service. This screen
      // used to fold them again, looking for LogMechanics, LogNotes and
      // LogPhotos that the endpoint does not send, so every one of those
      // lookups came back undefined and each field was carried by the
      // fallback beside it.
      const mappedLogs = rawLogs as HistoryLogRecord[];

      const sortedAllLogs = [...mappedLogs].reverse().sort((a, b) => {
        const timeA = new Date(a.created_at || a.date).getTime();
        const timeB = new Date(b.created_at || b.date).getTime();
        const diff = timeB - timeA;
        return diff !== 0 && !isNaN(diff) ? diff : 0;
      });

      setMaintenanceLogs(sortedAllLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const fetchMechanics = async () => {
    try {
      // authFetch attaches the signed-in employee's token.
      const response = await authFetch(`/api/employees?page=1&limit=100`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      const employees = result.data || [];
      
      const mappedMechanics: EmployeeOption[] = (employees as Partial<EmployeeRow>[])
        .filter((emp) => emp.role?.toLowerCase().includes("mechanic"))
        .map((emp) => ({
          employeeID: emp.employeeID ?? "",
          employeeName: emp.employeeName ?? "",
          role: emp.role ?? "",
        }));

      setMechanicsOptions(mappedMechanics);
    } catch (error) {
      console.error("CRITICAL ERROR FETCHING MECHANICS:", error);
      setMechanicsOptions([]); 
    }
  };

  // The first load, from below the three functions it calls rather than above
  // them. Each sets state from a response, not during the effect itself.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchTrucks();
    void fetchLogs();
    void fetchMechanics();
    // Once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const executeStatusUpdate = async (
    truckRecord: TruckRecord,
    newStatus: string,
  ) => {
    // Grabs the local date in YYYY-MM-DD format, ignoring UTC shifts
    const offset = new Date().getTimezoneOffset() * 60000;
    const today = new Date(Date.now() - offset).toISOString().split("T")[0];

    // Inject the new status AND the fresh lastChecked date into the payload
    const fullPayload = {
      ...truckRecord,
      status: newStatus,
      lastChecked: today,
    };

    try {
      const response = await authFetch(`/api/fleet-status/${truckRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPayload),
      });

      if (response.ok) {
        // Update the frontend list with both the new status and the new date
        setFleetList((prev) =>
          prev.map((truck) =>
            String(truck.id) === String(truckRecord.id)
              ? { ...truck, status: newStatus, lastChecked: today }
              : truck,
          ),
        );

        // Update the detailed view if the truck is currently selected
        if (
          selectedTruck &&
          String(selectedTruck.id) === String(truckRecord.id)
        ) {
          setSelectedTruck((prev) =>
            prev ? { ...prev, status: newStatus, lastChecked: today } : null,
          );
        }

        showToast("Status updated successfully.", "success");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("Failed to update status on server.", "error");
    }
  };

  const handleSelectStatusOption = (statusOption: string) => {
    if (!statusConfirmTruck) return;
    if (statusConfirmTruck.status === statusOption) {
      setShowStatusSelectModal(false);
      setStatusConfirmTruck(null);
      return;
    }
    setPendingStatusTarget(statusOption);
    setShowStatusSelectModal(false);
    setShowConfirmationModal(true);
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusConfirmTruck || !pendingStatusTarget) return;

    setShowConfirmationModal(false);

    const currentStatus = statusConfirmTruck.status;
    const targetStatus = pendingStatusTarget;

    // 1. Transitioning BETWEEN "On Maintenance" and "Out of Service"
    if (
      (currentStatus === "On Maintenance" &&
        targetStatus === "Out of Service") ||
      (currentStatus === "Out of Service" && targetStatus === "On Maintenance")
    ) {
      setMaintenanceFormType("update");
      setEditingHistoryRecord(null); // Creates a new progress row in the same cycle
      setShowLogMaintenanceModal(true);
    }
    // 2. Transitioning to "Available" (Final Log)
    else if (targetStatus === "Available") {
      setMaintenanceFormType("log");
      setEditingHistoryRecord(null);
      setShowLogMaintenanceModal(true);
    }
    // 3. Entering Maintenance from a normal status (Preliminary Inspection)
    else if (
      targetStatus === "On Maintenance" ||
      targetStatus === "Out of Service"
    ) {
      setMaintenanceFormType("inspection");
      setEditingHistoryRecord(null);
      setShowLogMaintenanceModal(true);
    }
    // 4. Standard status updates (e.g., to On Delivery)
    else {
      await executeStatusUpdate(statusConfirmTruck, targetStatus);

      if (targetStatus === "Disabled") {
        setSelectedTruck(null);
      }

      setStatusConfirmTruck(null);
      setPendingStatusTarget("");
    }
  };

  const handleModalSubmit = async (record: TruckRecord) => {
    if (isSavingTruck) return; 
    setIsSavingTruck(true);
    
    try {
      const url = editingTruck
        ? `/api/fleet-status/${record.id}`
        : `/api/fleet-status`;
      const method = editingTruck ? "PUT" : "POST";

      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });

      if (response.ok) {
        const savedData = await response.json();
        if (editingTruck) {
          setFleetList((prev) =>
            prev.map((t) => (String(t.id) === String(record.id) ? record : t)),
          );
          if (selectedTruck && String(selectedTruck.id) === String(record.id))
            setSelectedTruck(record);
        } else {
          const newTruck: TruckRecord = {
            ...record,
            id: savedData.truckID || savedData.id,
          };
          setFleetList((prev) => [newTruck, ...prev]);
        }
        showToast(
          editingTruck
            ? "Changes saved successfully."
            : "Truck added successfully.", "success");
      } else {
        showToast("Failed to save truck. Check your server connection.", "error");
      }
    } catch (error) { 
      console.error("Error saving truck:", error); 
      showToast("Error saving truck details.", "error"); 
    } finally {
      setIsSavingTruck(false);
      setEditingTruck(null); 
      setIsModalOpen(false);
    }
  };

  const handleDeleteTruck = async (id: string | number) => {
    try {
      const response = await authFetch(`/api/fleet-status/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setFleetList((prev) => prev.filter((t) => String(t.id) !== String(id)));
        setSelectedTruck(null);
        showToast("Truck deleted successfully.", "success");
      }
    } catch (error) {
      console.error("Error deleting truck:", error);
      showToast("Error deleting truck.", "error");
    }
  };

  const handleMaintenanceLogSubmit = async (formData: Record<string, string>) => {
    if (isSavingLog) return; // Prevent double submission
    setIsSavingLog(true);
    try {
      const finalPayload = {
        ...formData,
        // FORCE BACKEND TO SAVE IDs REGARDLESS OF SCHEMA CASING
        primary_mechanic_id: formData.primaryMechanicID,
        primaryMechanicId: formData.primaryMechanicID,
        additional_mechanic_id: formData.additionalMechanicID,
        additionalMechanicId: formData.additionalMechanicID,
        truck_id: formData.truckID,

        statusBefore: editingHistoryRecord
          ? editingHistoryRecord.statusBefore
          : statusConfirmTruck?.status || selectedTruck?.status || "Available",
        statusAfter: pendingStatusTarget
          ? pendingStatusTarget
          : editingHistoryRecord
            ? editingHistoryRecord.statusAfter
            : selectedTruck?.status || "Available",
      };

      const url = editingHistoryRecord
        ? `/api/historyLogsM/${editingHistoryRecord.id}`
        : `/api/historyLogsM`;
      const method = editingHistoryRecord ? "PUT" : "POST";

      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      });

      if (response.ok) {
        await fetchLogs();
        showToast(
          editingHistoryRecord
            ? "Changes saved successfully."
            : "Maintenance log saved successfully.", "success");

        // EXECUTE DELAYED STATUS UPDATE: Update the truck unconditionally if a target is set
        if (statusConfirmTruck && pendingStatusTarget) {
          await executeStatusUpdate(statusConfirmTruck, pendingStatusTarget);
        }
      } else {
        showToast("Failed to save maintenance log.", "error");
      }
    } catch (error) { 
      console.error("Error saving maintenance log:", error); 
    } finally { 
      setIsSavingLog(false); // Reset saving state
      setEditingHistoryRecord(null); 
      setShowLogMaintenanceModal(false); 
      setStatusConfirmTruck(null);
      setPendingStatusTarget("");
    }
  };

  const handleDeleteHistoryLog = async (id: string | number) => {
    try {
      await authFetch(`/api/historyLogsM/${id}`, { method: "DELETE" });
      setMaintenanceLogs((prev) =>
        prev.filter((log) => String(log.id) !== String(id)),
      );
      setSelectedHistoryRecord(null);
      showToast("Deleted successfully.", "success");
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  const activeFleet = fleetList.filter((t) => t.status !== "Disabled");
  const disabledFleet = fleetList.filter((t) => t.status === "Disabled");

  const totalCount = activeFleet.length;
  const operationalCount = activeFleet.filter(
    (t) => t.status === "Available",
  ).length;
  const alreadyBookedCount = activeFleet.filter(
    (t) => t.status === "Already Booked",
  ).length;
  const deliveryCount = activeFleet.filter(
    (t) => t.status === "On Delivery",
  ).length;
  const maintenanceCount = activeFleet.filter(
    (t) => t.status === "On Maintenance",
  ).length;
  const outOfServiceCount = activeFleet.filter(
    (t) => t.status === "Out of Service",
  ).length;
  const disabledCount = disabledFleet.length;

  // Swap to the disabled array if the Archive view is toggled on
  const baseFleet = showArchived ? disabledFleet : activeFleet;

  const filteredFleet = baseFleet.filter((truck) => {
    const matchesSearch =
      truck.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.truckType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab =
      selectedFilter === "All" ||
      truck.status.toLowerCase() === selectedFilter.toLowerCase();
    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredFleet.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFleet = filteredFleet.slice(startIndex, endIndex);

  const trucksOptionsForModal = fleetList.map((t) => ({
    truckID: t.id,
    plateNumber: t.plateNumber,
    truckType: t.truckType,
  }));

  // --- NEW: Calculate the inherited additional mechanic from the active maintenance cycle ---
  const activeModalTruckId = statusConfirmTruck?.id || selectedTruck?.id;
  const activeModalTruckStatus =
    statusConfirmTruck?.status || selectedTruck?.status;
  const isCurrentlyUnderMaintenance =
    activeModalTruckStatus === "On Maintenance" ||
    activeModalTruckStatus === "Out of Service";

  let inheritedAdditionalMechanicID = "";
  if (isCurrentlyUnderMaintenance) {
    // <-- UPDATED: Added `l &&` to safely bypass undefined logs
    const latestTruckLog = maintenanceLogs.find(
      (l) => l && String(l.truckID) === String(activeModalTruckId),
    );
    inheritedAdditionalMechanicID = String(
      latestTruckLog?.additionalMechanicID || "",
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto bg-slate-50 min-h-[100dvh] relative">
      {/* View Routing Logic */}
      {selectedHistoryRecord ? (
        <LogDetailView
          log={selectedHistoryRecord}
          // <-- UPDATED: Added `l &&` to safely bypass undefined logs
          truckLogs={maintenanceLogs.filter(
            (l) =>
              l && String(l.truckID) === String(selectedHistoryRecord.truckID),
          )}
          onBack={() => setSelectedHistoryRecord(null)}
          onEdit={(logRecord) => {
            setEditingHistoryRecord(logRecord);
            // Auto-detect the correct form type to open based on the fields of the specific row you clicked edit on
            if (logRecord.driversReport || logRecord.preliminaryRemarks) {
              setMaintenanceFormType("inspection");
            } else if (logRecord.additionalIssue || logRecord.progressRemarks) {
              setMaintenanceFormType("update");
            } else {
              setMaintenanceFormType("log");
            }
            setShowLogMaintenanceModal(true);
          }}
          onDelete={handleDeleteHistoryLog}
          currentUserId={String(currentUser.employeeID)} // <-- ADD THIS
        />
      ) : showTruckHistoryView && selectedTruck ? (
        <TruckSpecificHistoryView
          truck={selectedTruck}
          logs={maintenanceLogs}
          onBack={() => setShowTruckHistoryView(false)}
          onSelectLog={(log) => setSelectedHistoryRecord(log)}
          onEditLog={(log) => {
            setEditingHistoryRecord(log);
            setMaintenanceFormType("log");
            setShowLogMaintenanceModal(true);
          }}
          onDeleteLog={handleDeleteHistoryLog}
        />
      ) : selectedTruck ? (
        <TruckDetailView
          truck={selectedTruck}
          logs={maintenanceLogs}
          onBack={() => setSelectedTruck(null)}
          onEdit={(truckRecord) => {
            setEditingTruck(truckRecord);
            setIsModalOpen(true);
          }}
          onDelete={() => setTruckToDelete(selectedTruck.id)}
          onUpdateStatusClick={() => {
            setStatusConfirmTruck(selectedTruck);
            setPendingStatusTarget("");
            setShowStatusSelectModal(true);
          }}
          onHistoryClick={() => setShowTruckHistoryView(true)}
          onLogMaintenanceClick={() => {
            setStatusConfirmTruck(selectedTruck);
            setPendingStatusTarget("");
            setMaintenanceFormType("update");
            setEditingHistoryRecord(null); // Force a NEW row for the progress update
            setShowLogMaintenanceModal(true);
          }}
          // --- 1. ADD THIS BLOCK ---
          onDisableClick={() => {
            setStatusConfirmTruck(selectedTruck);
            setPendingStatusTarget("Disabled");
            setShowConfirmationModal(true);
          }}
          currentUserId={String(currentUser.employeeID)}
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {showArchived ? "Archived Trucks" : "Fleet Status"}
              </h1>
              </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:w-auto w-full">
              <button
                onClick={() => {
                  setShowArchived(!showArchived);
                  setSelectedFilter("All");
                  setCurrentPage(1);
                }}
                className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl shadow-sm transition-all duration-200 border border-slate-300 cursor-pointer"
              >
                <Archive className="w-4 h-4 shrink-0" />
                <span>{showArchived ? "Active Fleet" : "Archived Trucks"}</span>
              </button>

              {!showArchived && (
                <button
                  onClick={() => {
                    setEditingTruck(null);
                    setIsModalOpen(true);
                  }}
                  className="w-full sm:w-40 h-11 inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-md transition-all duration-200 cursor-pointer"
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>Add Truck</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                <button
                  onClick={() => setSelectedFilter("All")}
                  className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "All" ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"}`}
                >
                  All ({showArchived ? disabledCount : totalCount})
                </button>

                {/* Hide active status tabs when viewing the archive */}
                {!showArchived && (
                  <>
                    <button
                      onClick={() => setSelectedFilter("On Maintenance")}
                      className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "On Maintenance" ? getStatusStyles("On Maintenance").tabActive : getStatusStyles("On Maintenance").bgLight}`}
                    >
                      On Maintenance ({maintenanceCount})
                    </button>
                    <button
                      onClick={() => setSelectedFilter("Available")}
                      className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "Available" ? getStatusStyles("Available").tabActive : getStatusStyles("Available").bgLight}`}
                    >
                      Available ({operationalCount})
                    </button>
                    <button
                      onClick={() => setSelectedFilter("Already Booked")}
                      className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "Already Booked" ? getStatusStyles("Already Booked").tabActive : getStatusStyles("Already Booked").bgLight}`}
                    >
                      Already Booked ({alreadyBookedCount})
                    </button>
                    <button
                      onClick={() => setSelectedFilter("On Delivery")}
                      className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "On Delivery" ? getStatusStyles("On Delivery").tabActive : getStatusStyles("On Delivery").bgLight}`}
                    >
                      On Delivery ({deliveryCount})
                    </button>
                    <button
                      onClick={() => setSelectedFilter("Out of Service")}
                      className={`min-h-tap md:min-h-0 inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${selectedFilter === "Out of Service" ? getStatusStyles("Out of Service").tabActive : getStatusStyles("Out of Service").bgLight}`}
                    >
                      Out of Service ({outOfServiceCount})
                    </button>
                  </>
                )}
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <UrlSearchSync onQuery={setSearchTerm} />
                <input
                  type="text"
                  placeholder="Search by Plate No or Type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto relative z-10 pb-32 min-h-75">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 w-1/2 text-left">
                      Plate Number
                    </th>
                    <th className="py-3.5 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 w-1/2 text-right">
                      Current Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="py-16 sm:py-20 text-center font-medium text-slate-500"
                      >
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                        Loading fleet records...
                      </td>
                    </tr>
                  ) : paginatedFleet.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-16 sm:py-20 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                            <FileText className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-semibold text-slate-800">
                            No fleet records found
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedFleet.map((truck, index) => {
                      const currentStyles = getStatusStyles(truck.status);
                      return (
                        <tr
                          key={truck.id || `truck-row-${index}`}
                          onClick={() => setSelectedTruck(truck)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="py-4 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 text-left">
                            <div className="font-medium text-slate-900 truncate">
                              <RowOpenButton
                                label={`View truck ${truck.plateNumber}`}
                                onOpen={() => setSelectedTruck(truck)}
                                className="max-w-full truncate"
                              >
                                {truck.plateNumber}
                              </RowOpenButton>
                              <span className="text-xs text-slate-500 font-normal ml-1 sm:ml-2">
                                — {truck.truckType}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Last Checked:{" "}
                              {formatDisplayDate(truck.lastChecked)}
                            </div>
                          </td>
                          <td className="py-4 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 text-right">
                            <div className="relative inline-block text-right z-10">
                              <div
                                className={`w-36 h-8 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md border shadow-xs ${currentStyles.btn}`}
                              >
                                <span>{truck.status}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 bg-white">
              <span>
                Showing {filteredFleet.length === 0 ? 0 : startIndex + 1} to{" "}
                {Math.min(endIndex, filteredFleet.length)} of{" "}
                {filteredFleet.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === 1 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={`min-h-tap md:min-h-0 px-4 py-1.5 inline-flex items-center justify-center border border-slate-200 rounded-lg font-medium transition-colors ${currentPage === totalPages || totalPages === 0 ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"}`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showStatusSelectModal && statusConfirmTruck && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Update Status
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Current Status:{" "}
              <strong className="text-slate-800">
                {statusConfirmTruck.status}
              </strong>
            </p>
            <div className="space-y-2 mb-6">
              {[
                { label: "Available", dotColor: "bg-blue-500" },
                { label: "On Maintenance", dotColor: "bg-amber-500" },
                { label: "Out of Service", dotColor: "bg-rose-500" },
              ].map(({ label, dotColor }) => {
                const isCurrent = statusConfirmTruck.status === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSelectStatusOption(label)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${isCurrent ? "bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-slate-400/30" : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${dotColor}`}
                      />
                      {label}
                    </span>
                    {isCurrent && (
                      <span className="text-xs sm:text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowStatusSelectModal(false);
                  setStatusConfirmTruck(null);
                  setPendingStatusTarget("");
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmationModal && statusConfirmTruck && pendingStatusTarget && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${getStatusStyles(pendingStatusTarget).modalIcon}`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Confirm Status Change
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to change this truck&apos;s status to{" "}
              <span className="font-semibold text-slate-900">
                {pendingStatusTarget}
              </span>
              ?
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmationModal(false);
                  setStatusConfirmTruck(null);
                  setPendingStatusTarget("");
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                className={`flex-1 py-2.5 text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer ${getStatusStyles(pendingStatusTarget).modalBtn}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <TruckModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingTruck(null); }} 
        onSubmitSuccess={handleModalSubmit} 
        editData={editingTruck} 
        existingFleet={fleetList} 
        isSaving={isSavingTruck}
      />

      <LogMaintenanceModal
        isOpen={showLogMaintenanceModal}
        onClose={() => {
          setShowLogMaintenanceModal(false);
          setEditingHistoryRecord(null);
          setStatusConfirmTruck(null);
          setPendingStatusTarget("");
        }}
        onSubmitSuccess={handleMaintenanceLogSubmit}
        editData={editingHistoryRecord}
        trucksOptions={trucksOptionsForModal}
        mechanicsOptions={mechanicsOptions}
        preselectedTruckId={statusConfirmTruck?.id || selectedTruck?.id}
        formType={maintenanceFormType}
        loggedInMechanic={currentUser}
        inheritedAdditionalMechanicID={inheritedAdditionalMechanicID}
        isSaving={isSavingLog}
      />

      {truckToDelete && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center relative my-auto">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Truck Record
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete this truck? This action is
              permanent and cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTruckToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteTruck(truckToDelete);
                  setTruckToDelete(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
