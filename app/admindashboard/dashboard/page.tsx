/* eslint-disable react-hooks/exhaustive-deps */
// ==========================================
// MAIN DASHBOARD PAGE FOR ADMIN USERS
// ==========================================
"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { ApiError, apiFetch } from "@/app/lib/apiClient";
import { useChangeCheck } from "@/app/lib/useChangeCheck";
import type {
  ClientRow,
  EmployeeRow,
  SubContractorRow,
  TruckRow,
} from "@/types/database";
import {
  DELIVERY_STATUS,
  isDeliveryFinished,
  hasDriverAccepted,
  haveHelpersAccepted,
} from "@/app/lib/enums";
import { assignableCrew } from "@/app/lib/crewEligibility";
import { useRouter } from "next/navigation";
import BookingFormModal, { type BookingFormResult, type BookingSubmitOutcome } from "@/components/booking/BookingFormModal";
import SubconTripModal from "@/components/subcon/SubconTripModal";
import { parseQuantity } from "@/app/lib/bookingRules";
import FoulTripDetailsModal, { attachIncident, type FoulTripRow } from "@/components/foulTrip/FoulTripDetailsModal";
import type { IncidentView } from "@/services/foulTrip/foulTripService";
import { useToast } from "@/components/Toast";
import { liveDispatchOf, mapOrderToBookingView, toFeedBooking, type OrderWithRelations } from "@/app/lib/bookingView";
import {
  X,
  Search,
  Filter,
  ChevronDown,
} from "lucide-react";
import {
  type DashboardBooking,
  FEED_ROUTE,
  ON_THE_ROAD_STATUSES,
  TABS,
} from "./_components/feeds";
import { KPIGrid } from "./_components/KPIGrid";
import { FeedTable } from "./_components/FeedTable";
import { ViewOrderModal } from "./_components/ViewOrderModal";
import { ClientSearchModal } from "./_components/ClientSearchModal";
import { SuccessModal } from "./_components/SuccessModal";
import { formatDate, formatTime } from "@/app/lib/datetime";
import { truckOf } from "@/app/lib/formerTruck";


// ==========================================
// MAIN DASHBOARD PAGE COMPONENT
// ==========================================

export default function AdminDashboardPage() {
  const showToast = useToast();
  const router = useRouter();
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
  const [selectedOrderForView, setSelectedOrderForView] = useState<DashboardBooking | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [generatedOrderCode, setGeneratedOrderCode] = useState("");
  const [generatedTrackingToken, setGeneratedTrackingToken] = useState("");
  const [generatedOrderID, setGeneratedOrderID] = useState("");

  const [clients, setClients] = useState<Partial<ClientRow>[]>([]);
  const [trucks, setTrucks] = useState<Partial<TruckRow>[]>([]);
  const [drivers, setDrivers] = useState<Partial<EmployeeRow>[]>([]);
  const [helpers, setHelpers] = useState<Partial<EmployeeRow>[]>([]);
  const [subcontractors, setSubcontractors] = useState<Partial<SubContractorRow>[]>([]);
  /** Every active driver, for the crew filter - not only the ones free right now. */
  const [allDrivers, setAllDrivers] = useState<Partial<EmployeeRow>[]>([]);

  const [bookingsData, setBookingsData] = useState<Record<string, DashboardBooking[]>>({
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

      // One request for every stage: the server reads them in parallel and
      // leaves out any that fail, as the per-stage requests used to. Never
      // from the cache: this runs when the board is known to have changed,
      // and a copy from a minute ago would be compared as if it were current.
      const stageOrders = await apiFetch<OrderWithRelations[]>(
        `/api/bookings?stages=${DASHBOARD_STAGES.join(",")}&limit=100`,
        { cache: "no-store" },
      );

      // An order can only be in one stage, but dedupe defensively.
      const seenOrderIDs = new Set<string>();
      const orders = stageOrders.filter((order) => {
        const key = String(order?.orderID ?? order?.orderCode ?? "");
        if (!key || seenOrderIDs.has(key)) return false;
        seenOrderIDs.add(key);
        return true;
      });
      const categorized: Record<string, DashboardBooking[]> = {
        "Pending Bookings": [],
        "In-Transit": [],
        Completed: [],
        "Foul Trip": [],
      };

      if (Array.isArray(orders)) {
        orders.forEach((o) => {
          const clientObj = (Array.isArray(o.Client) ? o.Client[0] : o.Client) ?? {};
          let displayClient = clientObj.company;
          if (!displayClient) {
            const match = o.notes?.match(/Name:\s*(.*)/);
            displayClient = match ? `Walk-in: ${match[1]}` : "Walk-in Customer";
          }

          const detailsArr = Array.isArray(o.OrderDetails) ? o.OrderDetails : o.OrderDetails ? [o.OrderDetails] : [];
          const product = detailsArr[0]?.productName || "Multiple Items";
          const stopsArr = Array.isArray(o.BranchStops) ? o.BranchStops : o.BranchStops ? [o.BranchStops] : [];
          const rawTime = stopsArr[0]?.expectedTime || "";
          // The day it is to be delivered, which is what the time beside it is
          // for. This read "Request Date" - the day the booking was taken - so
          // a delivery booked today for Friday showed as due today.
          const scheduleMatch = o.notes?.match(/Delivery Schedule:\s*(.*)/);
          const requestDateMatch = o.notes?.match(/Request Date:\s*(.*)/);
          const created = o.createdAt ? new Date(o.createdAt) : null;
          const reqDate =
            scheduleMatch?.[1]?.trim() ||
            requestDateMatch?.[1]?.trim() ||
            (o.createdAt ?? "");
          const dateTime = rawTime
            ? `${formatDate(reqDate)} · ${formatTime(rawTime)}`
            : formatDate(reqDate);

          // The trip it is on now, not the first one it ever had.
          const dispatchRecord = liveDispatchOf(o.DispatchOrder);
          const dispatchStatus = dispatchRecord?.status || "Pending";
          const currentStep = Number(dispatchRecord?.current_step || 0);

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

          // The truck as it is, or as it was if it has since been deleted.
          const tripTruck = truckOf(dispatchRecord);
          const tripDriver = Array.isArray(dispatchRecord?.Driver) ? dispatchRecord?.Driver[0] : dispatchRecord?.Driver;

          const truck =
            dispatchRecord?.partnerPlate ||
            tripTruck?.plateNumber ||
            o.notes?.match(/Truck:\s*(.*)/)?.[1] ||
            "Unassigned";

          const driverMatch = o.notes?.match(/Driver:\s*(.*)/);
          const driver =
            dispatchRecord?.partnerDriver ||
            tripDriver?.employeeName ||
            (driverMatch ? driverMatch[1].trim() : "Unassigned");

          // The first helper on the trip, from the helper rows rather than a
          // Helper1 embed no query has ever returned.
          const firstHelperRow = (
            Array.isArray(dispatchRecord?.DispatchHelper)
              ? dispatchRecord.DispatchHelper
              : dispatchRecord?.DispatchHelper
                ? [dispatchRecord.DispatchHelper]
                : []
          )[0];
          const firstHelper = Array.isArray(firstHelperRow?.Helper)
            ? firstHelperRow.Helper[0]
            : firstHelperRow?.Helper;

          const helperMatch = o.notes?.match(/Helper 1:\s*(.*)/);
          const helper = isSubcon
            ? `Sub-con: ${partnerName}`
            : firstHelper?.employeeName || (helperMatch ? helperMatch[1].trim() : "None");

          // Read from the trip and its helper rows, which is where it is
          // recorded. The Order columns this also used to look at -
          // driverConfirmed, driver_confirmed - do not exist in the database
          // and never have, so they were only ever undefined.
          const driverConfirmed = hasDriverAccepted(dispatchStatus);

          // Each helper carries their own status. This used to be inferred
          // from the dispatch status, so every helper was reported as
          // confirmed the moment the driver accepted - including helpers who
          // had not replied at all, and a trip could leave showing a crew
          // that had never confirmed.
          const helperConfirmed = haveHelpersAccepted(
            Array.isArray(dispatchRecord?.DispatchHelper) ? dispatchRecord.DispatchHelper : [],
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
            if (dispatchStatus === DELIVERY_STATUS.rejected) {
              // A crew declined. Nothing went wrong with the delivery - it
              // simply needs assigning again, so it belongs with the bookings
              // waiting for a crew rather than among the foul trips.
              category = "Pending Bookings";
            } else if (
              dispatchStatus === DELIVERY_STATUS.foulTrip ||
              dispatchStatus === DELIVERY_STATUS.cancelled
            ) {
              category = "Foul Trip";
            } else if (isDeliveryFinished(dispatchStatus)) {
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
            orderId: o.orderCode || o.orderID || "",
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
          // A booking a crew has just declined needs a coordinator now, and
          // the order row's own date does not move when that happens.
          const declined = Number(b.dispatchStatus === "Rejected") - Number(a.dispatchStatus === "Rejected");
          if (declined !== 0) return declined;
          // By when the booking was made. An order carries no updatedAt -
          // this used to ask for one first, and never got it.
          return new Date(b.rawOrder.createdAt ?? 0).getTime() - new Date(a.rawOrder.createdAt ?? 0).getTime();
        });
      });

      setBookingsData(categorized);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  }, []);

  // The board keeps itself current: every few seconds it asks whether
  // anything on it has changed - a crew accepting, a truck leaving, a trip
  // finishing - and fetches the bookings again only if so. It used to be
  // loaded once, and showed whatever was true when the page was opened.
  const checkBoard = useCallback(
    async () => (await apiFetch<{ version: string }>("/api/bookings/version", { cache: "no-store" })).version,
    [],
  );
  const { refresh: refreshOrders } = useChangeCheck({ version: checkBoard, reload: fetchOrders });

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);

    try {
      // Independent requests: run them together, not one after another.
      const [clientRes, truckRes, empRes, subconRes] = await Promise.all([
        apiFetch<{ data: Partial<ClientRow>[] }>("/api/clients").catch(() => ({ data: [] })),
        apiFetch<{ data: Partial<TruckRow>[] }>("/api/fleet-status").catch(() => ({ data: [] })),
        // Every active employee. Without a limit this was the first ten by name,
        // so the crew lists and the filter were missing everyone after them.
        apiFetch<{ data: Partial<EmployeeRow>[] }>("/api/employees?limit=100&isActive=true").catch(() => ({ data: [] })),
        apiFetch<{ data: Partial<SubContractorRow>[] }>("/api/subcontractors").catch(() => ({ data: [] })),
      ]);

      setClients(clientRes.data || []);

      // Straight from the tables. These used to be rebuilt first, filling in
      // an id, a plate, a name, an active flag and an availability from
      // columns that do not exist - t.id, t.plate_number, e.firstName,
      // e.status - so every default was reached only when the real column was
      // empty, which none of them are.
      const allTrucks = truckRes.data ?? [];
      setTrucks(allTrucks.filter((truck) => truck.isActive && truck.truckStatus === "Available"));

      // The fallback lists, used by the booking form before a date is chosen
      // and if the by-date request fails. Through the same rule the assignment
      // enforces, so this cannot offer somebody the save will refuse - it used
      // to ask only for an active employee in the right role, which let
      // through anybody whose account had never been set up.
      const allEmployees = (empRes.data ?? []).filter(
        (employee) => employee.availability === "Available",
      );

      setDrivers(assignableCrew(allEmployees, "Driver"));
      setHelpers(assignableCrew(allEmployees, "Helper"));
      // The crew filter: every driver who could be on a trip, busy or not. Same
      // rule as above minus availability, so somebody whose account was never
      // set up - and so was never on a delivery - is not offered as a filter.
      setAllDrivers(assignableCrew(empRes.data ?? [], "Driver"));

      setSubcontractors(subconRes.data || []);
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    }

    await refreshOrders();
    setIsLoading(false);
  }, [refreshOrders]);

  useEffect(() => {
    // Everything on this screen is set from a response, not in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDashboardData();
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

  const handleViewOrder = async (order: DashboardBooking) => {
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

    // Every bucket has one detail screen, the one its View All list opens, and
    // this card opens that same screen. It used to open a read-only summary of
    // its own instead, so the same booking looked like two different things
    // depending on where it was clicked - and a declined one could not be
    // assigned from here at all.
    const feed = FEED_ROUTE[order.statusCategory as string];
    if (feed) {
      router.push(`${feed}?open=${encodeURIComponent(order.orderId)}`);
      return;
    }

    // A cancelled booking sits in the Foul Trip bucket but no feed lists it.
    setSelectedOrderForView(order);
    setIsViewOrderModalOpen(true);
  };

  const handleFoulTripDone = (message: string) => {
    setFoulTripRow(null);
    setFoulTripNotice(message);
    window.setTimeout(() => setFoulTripNotice(""), 5000);
    void refreshOrders();
  };

  const handleModalSubmit = async (data: BookingFormResult): Promise<BookingSubmitOutcome> => {
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

      // Today in the browser's own time zone. toISOString() is UTC, which in
      // Manila is still yesterday until 8 in the morning.
      const now = new Date();
      const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];
      detailedNotes += `[DELIVERY DETAILS]\nPriority: ${data.priorityLevel}\nRequest Date: ${data.requestDate || localToday}\nDelivery Schedule: ${data.deliverySchedule}\nPickup: ${data.pickupList[0]?.warehouseAddress} @ ${data.pickupList[0]?.pickupTime}\n`;

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
        // Sent as typed. It used to fall back to noon, which turned a missing
        // time into a promise nobody made; the server refuses a blank instead.
        expectedTime: d.deliveryTime,
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
        // Sent as its own field. It is still written into the notes above for
        // the screens that read it from there, but the server validates and
        // stores this one.
        deliverySchedule: data.deliverySchedule,
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
        acknowledgeTightSchedule: data.acknowledgeTightSchedule === true,
      };

      const res = await apiFetch<{
        orderCode?: string;
        trackingToken?: string;
        orderID?: string;
        warning?: string | null;
      }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const newOrderID = res.orderID;

      // A tight schedule is asked about before it is saved; what is left here
      // is a booking whose times could not be checked at all.
      if (res.warning) showToast(res.warning, "info");

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
          showToast(`Booking created, but handing it to ${data.subconPartnerName || "the partner"} failed: ${reason}`, "error");
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
        } catch (assignError) {
          showToast(
            `Booking created, but assignment failed: ${assignError instanceof Error ? assignError.message : assignError}`,
            "error",
          );
        }
      }

      setGeneratedOrderCode(res.orderCode ?? "");
      setGeneratedTrackingToken(res.trackingToken || "");
      setGeneratedOrderID(res.orderID || "");
      setIsSuccessModalOpen(true);
      await refreshOrders();
      return null;
    } catch (err) {
      // Nothing was saved: the crew may run late on these times, and the
      // coordinator chooses whether to change them, book anyway, or cancel.
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { needsConfirmation?: string } | null;
        if (body?.needsConfirmation === "tightSchedule") return { confirmTightSchedule: err.message };
      }
      console.error(err);
      // Handed back to the form, which stays open holding everything that was
      // typed. It used to be thrown over the dashboard as a toast, with the
      // form already closed behind it and the work gone.
      return err instanceof Error ? err.message : "The booking could not be saved.";
    }
  };

  // Convert real db clients and drivers to format needed for the dropdowns
  const activeClientsForFilter = useMemo(() => 
    clients.map(c => ({ id: c.clientID ?? "", name: c.company || "Unknown" })), 
  [clients]);

  // Every active driver. This was the drivers free to assign right now, so a
  // driver out on a delivery could not be filtered by - the one time you would.
  const activeCrewsForFilter = useMemo(() =>
    allDrivers.map(d => ({ id: d.employeeID ?? "", name: d.employeeName ?? "Unknown" })),
  [allDrivers]);

  // Apply Search inside Filter Modals
  const filteredCrews = activeCrewsForFilter.filter((c) =>
    c.name.toLowerCase().includes(crewSearchTerm.toLowerCase()),
  );
  
  const filteredClients = activeClientsForFilter.filter((cl) =>
    cl.name.toLowerCase().includes(clientSearchTerm.toLowerCase()),
  );

  // Apply Filter Logic to Data
  const filteredBookingsData = useMemo(() => {
    const result: Record<string, DashboardBooking[]> = {
      "Pending Bookings": [],
      "In-Transit": [],
      "Completed": [],
      "Foul Trip": [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    Object.keys(bookingsData).forEach(cat => {
      result[cat] = bookingsData[cat].filter((b) => {
        // 1. Client Filter
        if (dashboardFilters.clientIds.length > 0) {
          const bookingClientId = b.rawOrder?.clientID;
          const matchById = dashboardFilters.clientIds.includes(bookingClientId ?? "");
          // Any selected client, not only the first one picked.
          const matchByName = activeClientsForFilter.some(
            (c) => dashboardFilters.clientIds.includes(c.id) && c.name === b.client,
          );
          
          if (!matchById && !matchByName) return false;
        }

        // 2. Crew Filter
        if (dashboardFilters.crewIds.length > 0) {
          const dispatchRecord = liveDispatchOf(b.rawOrder?.DispatchOrder);
          const driverId = dispatchRecord?.driverID;
          const matchById = dashboardFilters.crewIds.includes(driverId ?? "");
          const matchByName = activeCrewsForFilter.some(
            (c) => dashboardFilters.crewIds.includes(c.id) && c.name === b.driver,
          );

          if (!matchById && !matchByName) return false;
        }

        // 3. Date Filter
        if (dashboardFilters.dateRange) {
          const reqDateStr = b.rawOrder?.notes?.match(/Delivery Schedule:\s*(.*)/)?.[1] 
                          || b.rawOrder?.notes?.match(/Request Date:\s*(.*)/)?.[1] 
                          || b.rawOrder?.createdAt;
          const bDate = new Date(reqDateStr ?? "");
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
            // And the end of it: without this, every booking scheduled for any
            // later week counted as this week's.
            const lastDay = new Date(firstDay);
            lastDay.setDate(firstDay.getDate() + 6);
            if (bDate < firstDay || bDate > lastDay) return false;
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
      <div className="flex flex-row flex-wrap justify-between items-center gap-3 sm:gap-4 mb-6 relative z-20">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
          </div>

        {/* Buttons Flex Container */}
        <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-3 sm:relative">
          <button
            onClick={() => {
              setSelectedClientForBooking("");
              setIsBookingModalOpen(true);
            }}
            className="w-auto sm:w-40 h-9 sm:h-11 inline-flex items-center justify-center bg-green-500 hover:bg-black text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl transition-colors duration-200 shadow-md whitespace-nowrap px-3 sm:px-4"
          >
            + On-Call Booking
          </button>
          <button
            onClick={() => setIsClientSearchModalOpen(true)}
            className="w-auto sm:w-40 h-9 sm:h-11 inline-flex items-center justify-center bg-blue-600 hover:bg-black text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl transition-colors duration-200 shadow-md whitespace-nowrap px-3 sm:px-4"
          >
            + New Booking
          </button>

          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`w-auto sm:w-auto h-9 sm:h-11 inline-flex items-center justify-center border text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl transition-colors duration-200 shadow-sm whitespace-nowrap px-3 sm:px-4 ${ isFilterOpen ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700" } px-3 sm:px-4`}
            title="Filters"
          >
            <Filter className="w-4 h-4 sm:mr-2 shrink-0" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          {/* Filter Dropdown Panel */}
          {isFilterOpen && (
            <div className="absolute top-full mt-2 inset-x-0 sm:inset-x-auto sm:right-0 sm:w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3 animate-fade-in origin-top-right">
              <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1.5">
                <h3 className="font-bold text-xs text-slate-800">Filters</h3>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
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
                    className="min-h-tap md:pointer-fine:min-h-0 w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="min-h-tap md:pointer-fine:min-h-0 w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-base sm:text-sm text-left flex items-center justify-between text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className="truncate pr-2">{selectedCrewLabel}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 transition-transform ${
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
                            className="w-full border border-slate-300 rounded-md pl-3 pr-8 py-1.5 text-xs text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
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
                            <div className="px-2 py-2 text-xs text-slate-500 text-center">
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
                      className="min-h-tap md:pointer-fine:min-h-0 w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-base sm:text-sm text-left flex items-center justify-between text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className="truncate pr-2">
                        {selectedClientLabel}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 transition-transform ${
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
                            className="w-full border border-slate-300 rounded-md pl-3 pr-8 py-1.5 text-xs text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
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
                            <div className="px-2 py-2 text-xs text-slate-500 text-center">
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
                  className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => {
                    setIsCrewDropdownOpen(false);
                    setIsClientDropdownOpen(false);
                    setIsFilterOpen(false);
                  }}
                  className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
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
      <SubconTripModal dispatchID={subconTripID} onClose={() => setSubconTripID(null)} onChanged={() => void refreshOrders()} />
      {foulTripNotice && (
        <div role="status" className="fixed bottom-[calc(1.5rem+var(--safe-bottom))] right-6 z-70 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 shadow-lg">
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
