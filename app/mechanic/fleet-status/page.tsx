// ==========================================
// LOGISCO - MECHANIC FLEET STATUS PAGE
// ==========================================
"use client";

import type { EmployeeRow, TruckRow } from "@/types/database";
import type { TruckTrip } from "@/services/truck/truckService";
import UrlSearchSync from "@/components/UrlSearchSync";
import { authFetch } from "@/app/lib/apiClient";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import RowOpenButton from "@/components/RowOpenButton";
import { getStatusStyles } from "@/app/lib/truckStatusStyles";
import { bookingSummary, shownTruckStatus } from "@/app/lib/truckBooking";
import {
  Search,
  Truck,
  FileText,
  AlertTriangle,
  Loader2,
  Ban,
} from "lucide-react";
import type { EmployeeOption, HistoryLogRecord, TruckRecord } from "./_components/types";
import { LogDetailView } from "./_components/LogDetailView";
import { TruckSpecificHistoryView } from "./_components/TruckSpecificHistoryView";
import { TruckDetailView } from "./_components/TruckDetailView";
import { formatDisplayDate } from "./_components/dates";
import { TruckModal } from "./_components/TruckModal";
import { LogMaintenanceModal } from "./_components/LogMaintenanceModal";
import { useLogPhotos } from "./_components/useLogPhotos";


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

  // The logs with their photos, for whichever truck is on screen - see
  // useLogPhotos for why this is not a one-off fetch when a log is opened.
  const photoTruckID = selectedHistoryRecord?.truckID ?? selectedTruck?.id ?? statusConfirmTruck?.id ?? null;
  const { logs: logsWithPhotos, seed: seedLogPhotos } = useLogPhotos(maintenanceLogs, photoTruckID);
  const withPhotos = (log: HistoryLogRecord | null) =>
    log ? (logsWithPhotos.find((l) => String(l.id) === String(log.id)) ?? log) : null;
  const [mechanicsOptions, setMechanicsOptions] = useState<EmployeeOption[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const [archivedList, setArchivedList] = useState<TruckRecord[]>([]);

  const toTruckRecord = (truck: Partial<TruckRow> & { currentTrip?: TruckTrip | null }): TruckRecord => ({
    id: truck.truckID ?? "",
    // Carried so an edit keeps the code the truck has, rather than the form
    // inventing a new one from the plate.
    truckCode: truck.truckCode ?? undefined,
    plateNumber: truck.plateNumber ?? "",
    truckType: truck.truckType ?? "",
    truckModel: truck.model ?? "",
    capacity: truck.capacity === null || truck.capacity === undefined ? "" : String(truck.capacity),
    lastChecked: truck.lastChecked ?? "",
    status: truck.truckStatus || "Available",
    booking: truck.currentTrip ?? null,
  });

  // Kept in the order the server sends: most recently checked first. This used
  // to re-sort by Number(id), which for a UUID is NaN, so the list came out in
  // whatever order the sort happened to leave it.
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
      setFleetList((payload as Partial<TruckRow>[]).map(toTruckRecord));
    } catch (error) {
      console.error("Error fetching trucks:", error);
      showToast("Could not load the fleet. Check your connection and reload.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // The retired trucks. The fleet list only ever holds active ones - retiring
  // is a soft delete - so the archive has to be asked for separately.
  const fetchArchived = async () => {
    try {
      const response = await authFetch(`/api/fleet-status?archived=true`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      const payload = Array.isArray(result?.data) ? result.data : [];
      setArchivedList((payload as Partial<TruckRow>[]).map(toTruckRecord));
    } catch (error) {
      console.error("Error fetching archived trucks:", error);
      showToast("Could not load the disabled trucks.", "error");
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
      //
      // The service names the timestamp createdAt. Every comparison on this
      // screen reads created_at, which was therefore always undefined and fell
      // back to the date alone - so two logs written the same day tied, and the
      // reverse() here put the older one first. "The latest log", which decides
      // whose repair a truck is, was the earliest log of the day.
      const mappedLogs = (rawLogs as (HistoryLogRecord & { createdAt?: string })[]).map(
        (log) => ({ ...log, created_at: log.created_at ?? log.createdAt }),
      );

      const time = (log: HistoryLogRecord) => {
        const t = new Date(log.created_at || log.date).getTime();
        return Number.isNaN(t) ? 0 : t;
      };
      const sortedAllLogs = [...mappedLogs].sort((a, b) => time(b) - time(a));

      setMaintenanceLogs(sortedAllLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const fetchMechanics = async () => {
    try {
      // authFetch attaches the signed-in employee's token.
      // Active mechanics only, asked for by role: the first hundred employees of
      // every role, filtered here, missed mechanics past the hundredth and
      // offered ones who had left.
      const response = await authFetch(`/api/employees?page=1&limit=100&role=Mechanic&isActive=true`, {
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

  /** Reads the reason the server gave for refusing, when it gave one. */
  const serverMessage = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    return body?.message || fallback;
  };

  const executeStatusUpdate = async (
    truckRecord: TruckRecord,
    newStatus: string,
    { logOpened = false }: { logOpened?: boolean } = {},
  ) => {
    // Grabs the local date in YYYY-MM-DD format, ignoring UTC shifts
    const offset = new Date().getTimezoneOffset() * 60000;
    const today = new Date(Date.now() - offset).toISOString().split("T")[0];

    // Only what is changing. This sent the whole truck as this screen last saw
    // it, so a plate or model edited elsewhere since the list loaded was
    // quietly written back.
    //
    // logOpened says the maintenance log for this change has just been saved,
    // so the server does not open a second one when the truck is grounded.
    const payload = { status: newStatus, lastChecked: today, logOpened };

    try {
      const response = await authFetch(`/api/fleet-status/${truckRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        showToast(await serverMessage(response, "Failed to update the truck's status."), "error");
        return;
      }

      {
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
    // 4. Any other status
    else {
      await executeStatusUpdate(statusConfirmTruck, targetStatus);
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

      // An edit leaves the status out. The form carries the status the truck
      // had when this screen loaded, and sending it back put a truck that had
      // since gone out on a delivery back to Available.
      const { status, ...details } = record;
      const body = editingTruck ? details : { ...details, status };

      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // Kept open, so what was typed is not lost to a duplicate plate.
        showToast(await serverMessage(response, "Failed to save the truck."), "error");
        return;
      }

      const savedData = await response.json();
      if (editingTruck) {
        // The details as saved; the status stays whatever it already is.
        setFleetList((prev) =>
          prev.map((t) => (String(t.id) === String(record.id) ? { ...record, status: t.status, booking: t.booking } : t)),
        );
        if (selectedTruck && String(selectedTruck.id) === String(record.id))
          setSelectedTruck((prev) => (prev ? { ...record, status: prev.status, booking: prev.booking } : prev));
      } else {
        const newTruck: TruckRecord = {
          ...record,
          id: savedData.truckID || savedData.id,
          truckCode: savedData.truckCode ?? record.truckCode,
        };
        setFleetList((prev) => [newTruck, ...prev]);
      }
      showToast(
        editingTruck
          ? "Changes saved successfully."
          : "Truck added successfully.", "success");
      setEditingTruck(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving truck:", error);
      showToast("Error saving truck details.", "error");
    } finally {
      setIsSavingTruck(false);
    }
  };

  // Archiving is the server's soft delete: the truck leaves the fleet and every
  // booking list, and keeps its history. "Disable" and "Delete" both used to
  // sit here - one sent a status the server does not have and failed without a
  // word, the other did this - so there is one action now, and a way back.
  const handleArchiveTruck = async (id: string | number) => {
    try {
      const response = await authFetch(`/api/fleet-status/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        showToast(await serverMessage(response, "Failed to disable the truck."), "error");
        return;
      }
      const archived = fleetList.find((t) => String(t.id) === String(id));
      setFleetList((prev) => prev.filter((t) => String(t.id) !== String(id)));
      if (archived) {
        setArchivedList((prev) => [{ ...archived, status: "Out of Service" }, ...prev]);
      }
      setSelectedTruck(null);
      showToast("Truck disabled. It can be restored from Disabled Trucks.", "success");
    } catch (error) {
      console.error("Error archiving truck:", error);
      showToast("Error disabling the truck.", "error");
    }
  };

  const handleRestoreTruck = async (id: string | number) => {
    try {
      const response = await authFetch(`/api/fleet-status/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      if (!response.ok) {
        showToast(await serverMessage(response, "Failed to restore the truck."), "error");
        return;
      }
      const restored = toTruckRecord(await response.json());
      setArchivedList((prev) => prev.filter((t) => String(t.id) !== String(id)));
      setFleetList((prev) => [restored, ...prev]);
      setSelectedTruck(null);
      showToast("Truck restored. It is back in the fleet and available.", "success");
    } catch (error) {
      console.error("Error restoring truck:", error);
      showToast("Error restoring truck.", "error");
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

      if (!response.ok) {
        // Kept open with what was typed, rather than closed on a failure.
        showToast(await serverMessage(response, "Failed to save the maintenance log."), "error");
        return;
      }

      // The photos just saved show at once, from what the form holds, rather
      // than waiting to be fetched back.
      const saved = (await response.json().catch(() => null)) as { data?: { id?: string } } | null;
      const savedID = editingHistoryRecord?.id ?? saved?.data?.id;
      if (savedID) {
        seedLogPhotos(savedID, {
          preliminary: formData.preliminaryPhotoUrl,
          progress: formData.progressPhotoUrl,
          final: formData.photoUrl,
        });
      }

      // The log is saved; now the status change it was written for. It goes
      // with logOpened, so grounding the truck does not open a second, empty
      // log beside this one.
      if (statusConfirmTruck && pendingStatusTarget) {
        await executeStatusUpdate(statusConfirmTruck, pendingStatusTarget, { logOpened: true });
      }
      await fetchLogs();
      showToast(
        editingHistoryRecord
          ? "Changes saved successfully."
          : "Maintenance log saved successfully.", "success");

      setEditingHistoryRecord(null);
      setShowLogMaintenanceModal(false);
      setStatusConfirmTruck(null);
      setPendingStatusTarget("");
    } catch (error) {
      console.error("Error saving maintenance log:", error);
      showToast("Error saving the maintenance log.", "error");
    } finally {
      setIsSavingLog(false);
    }
  };

  const handleDeleteHistoryLog = async (id: string | number) => {
    try {
      const response = await authFetch(`/api/historyLogsM/${id}`, { method: "DELETE" });
      if (!response.ok) {
        showToast(await serverMessage(response, "Failed to delete the log."), "error");
        return;
      }
      setMaintenanceLogs((prev) =>
        prev.filter((log) => String(log.id) !== String(id)),
      );
      setSelectedHistoryRecord(null);
      showToast("Deleted successfully.", "success");
    } catch (error) {
      console.error("Error deleting log:", error);
      showToast("Error deleting the log.", "error");
    }
  };

  // "Disabled" was a status here that the server never stores (it has four:
  // Available, On Delivery, On Maintenance, Out of Service), so the archive was
  // always empty. Retired trucks come from their own request now.
  //
  // "Already Booked" is not stored either: a truck on a booking is "On
  // Delivery" on its record, and this list calls it booked until the crew
  // starts the trip.
  const activeFleet = fleetList;
  const disabledFleet = archivedList;
  const shownStatus = (t: TruckRecord) => shownTruckStatus(t.status, t.booking);

  const totalCount = activeFleet.length;
  const operationalCount = activeFleet.filter(
    (t) => t.status === "Available",
  ).length;
  const bookedCount = activeFleet.filter(
    (t) => shownStatus(t) === "Already Booked",
  ).length;
  const deliveryCount = activeFleet.filter(
    (t) => shownStatus(t) === "On Delivery",
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
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      truck.plateNumber.toLowerCase().includes(term) ||
      truck.truckType.toLowerCase().includes(term) ||
      (truck.booking?.orderCode ?? "").toLowerCase().includes(term) ||
      (truck.booking?.clientName ?? "").toLowerCase().includes(term);
    const matchesTab =
      selectedFilter === "All" ||
      shownStatus(truck).toLowerCase() === selectedFilter.toLowerCase();
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
    const latestTruckLog = logsWithPhotos.find(
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
          log={withPhotos(selectedHistoryRecord) ?? selectedHistoryRecord}
          // <-- UPDATED: Added `l &&` to safely bypass undefined logs
          truckLogs={logsWithPhotos.filter(
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
          logs={logsWithPhotos}
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
          logs={logsWithPhotos}
          onBack={() => setSelectedTruck(null)}
          onEdit={(truckRecord) => {
            setEditingTruck(truckRecord);
            setIsModalOpen(true);
          }}
          isArchived={showArchived}
          onArchiveClick={() => setTruckToDelete(selectedTruck.id)}
          onRestoreClick={() => void handleRestoreTruck(selectedTruck.id)}
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
          currentUserId={String(currentUser.employeeID)}
        />
      ) : (
        <>
          <div className="mb-6 flex flex-row flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {showArchived ? "Disabled Trucks" : "Fleet Status"}
              </h1>
              </div>
            <div className="flex flex-row gap-2">
              <button
                onClick={() => {
                  if (!showArchived) void fetchArchived();
                  setShowArchived(!showArchived);
                  setSelectedFilter("All");
                  setCurrentPage(1);
                }}
                className="w-auto sm:w-40 h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl shadow-sm transition-all duration-200 border border-slate-300 cursor-pointer px-3"
              >
                <Ban className="w-4 h-4 shrink-0" />
                <span>{showArchived ? "Active Fleet" : "Disabled Trucks"}</span>
              </button>

              {!showArchived && (
                <button
                  onClick={() => {
                    setEditingTruck(null);
                    setIsModalOpen(true);
                  }}
                  className="w-auto sm:w-40 h-9 sm:h-11 inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-700 hover:bg-black text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl shadow-md transition-all duration-200 cursor-pointer px-3"
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
                      Already Booked ({bookedCount})
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
                  placeholder="Search by Plate No, Type or Booking..."
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
                      const currentStyles = getStatusStyles(shownStatus(truck));
                      return (
                        <tr
                          key={truck.id || `truck-row-${index}`}
                          onClick={() => setSelectedTruck(truck)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="py-4 pl-4 sm:pl-12 md:pl-20 lg:pl-32 xl:pl-40 pr-2 text-left">
                            <div className="font-medium text-slate-900 sm:truncate">
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
                            {truck.booking && !showArchived && (
                              <div className="text-xs text-blue-700 mt-1 break-words">
                                {bookingSummary(truck.booking)}
                              </div>
                            )}
                          </td>
                          <td className="py-4 pr-4 sm:pr-12 md:pr-20 lg:pr-32 xl:pr-40 pl-2 text-right">
                            <div className="relative inline-block text-right z-10">
                              <div
                                className={`w-28 sm:w-36 h-8 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md border shadow-xs ${currentStyles.btn}`}
                              >
                                <span>{shownStatus(truck)}</span>
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
              {totalPages > 1 && (
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
              )}
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
        editData={withPhotos(editingHistoryRecord)}
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
              Disable Truck
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              The truck will be disabled: it leaves the fleet and can no longer
              be booked. Its maintenance history is kept, and it can be
              restored from Disabled Trucks.
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
                  void handleArchiveTruck(truckToDelete);
                  setTruckToDelete(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer"
              >
                Disable Truck
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
