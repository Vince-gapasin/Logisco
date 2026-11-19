"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import type {
  BranchRow,
  ClientRow,
  EmployeeRow,
  SubContractorRow,
  TruckRow,
  WarehouseRow,
} from "@/types/database";
import {
  addDays,
  addressKey,
  daysBetween,
  CLOCK_RULE,
  findAddressClashes,
  isQuarterHour,
  isRealDate,
  isTooFarAhead,
  isValidClockTime,
  MAX_DAYS_AHEAD,
  normalizePhone,
  parseQuantity,
  PHONE_RULE,
  QUARTER_HOUR_RULE,
  sanitizePhoneInput,
  sanitizeQuantityInput,
  TOO_FAR_RULE,
} from "@/app/lib/bookingRules";
import SelectMenu from "@/components/SelectMenu";
import TimePicker, { formatClock } from "@/components/TimePicker";
import CrewPicker, { suggestCrew, type CrewChoice, type CrewPerson, type CrewTruck } from "@/components/booking/CrewPicker";
import RowDeleteButton from "@/components/booking/RowDeleteButton";
import StopDayField from "@/components/booking/StopDayField";
import { formErrorsFromIssues, type BookingIssue } from "@/app/lib/bookingIssues";
import {
  checkStopSchedule,
  EARLIER_RULE,
  EARLIER_SAME_DAY_RULE,
  MAX_RUN_DAYS,
  MIN_STOP_GAP_MINUTES,
  SAME_TIME_RULE,
  stopMoment,
  TOO_SOON_RULE,
} from "@/app/lib/stopSchedule";
import { clockMinutes } from "@/app/lib/deliveryFeasibility";
import { clockInManila, formatShortDay, todayInManila } from "@/app/lib/datetime";
import {
  cleanProductName,
  DEFAULT_UNIT,
  itemKey,
  loadBalance,
  MAX_ITEM_QUANTITY,
  MAX_ITEMS_PER_STOP,
  MAX_PRODUCT_NAME,
  productTotals,
  STOCK_UNITS,
  type StockUnit,
  type StopItem,
} from "@/app/lib/stopItems";

// One booking form for every way a booking starts: a registered client, an
// on-call (walk-in) customer, or a new client. The on-call and new-client
// forms were two copies of the same 1,000 lines, so every fix had to be made
// twice and they had drifted.

export type BookingFormVariant = "registered" | "on-call" | "new-client";

/** One product on a stop as typed: "Buns", "50", trays. */
export interface ItemRow {
  productName: string;
  quantity: string;
  unit: StockUnit;
}

export interface PickupRow {
  warehouseID?: string | null;
  warehouseName: string;
  warehouseAddress: string;
  contactPerson: string;
  contactNumber: string;
  pickupTime: string;
  /** YYYY-MM-DD, or "" for the same day as the stop before it. */
  date: string;
  /** What is loaded here. */
  items: ItemRow[];
}
export interface DeliveryRow {
  branchName: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
  deliveryTime: string;
  /** YYYY-MM-DD, or "" for the same day as the stop before it. */
  date: string;
  /** What is dropped here. */
  items: ItemRow[];
}

/** A stop's products as the server takes them. Only call once the form has passed its checks. */
export function itemsOf(rows: ItemRow[]): StopItem[] {
  return rows.map((row) => ({
    productName: cleanProductName(row.productName),
    quantity: parseQuantity(row.quantity) ?? 0,
    unit: row.unit,
  }));
}

export interface BookingFormResult {
  clientID: string;
  clientName: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  businessAddress: string;
  requestDate: string;
  deliverySchedule: string;
  product: string;
  priorityLevel: string;
  /** The partner's subConID when handed to a sub-contractor. */
  subconPartner: string;
  subconPartnerName: string;
  partnerContact: string;
  truckPlate: string;
  driver: string;
  helper1: string;
  helper2: string;
  notes: string;
  pickupList: PickupRow[];
  deliveryList: DeliveryRow[];
  /** No truck or no driver: the booking waits in Unassigned Bookings. */
  unassigned: boolean;
  resolvedNames: { truck: string; driver: string; helper1: string; helper2: string };
  /** Set once the coordinator has chosen to keep times the crew may run late on. */
  acknowledgeTightSchedule?: boolean;
}

/**
 * What came of a save: null when the booking was made, a message when it was
 * refused, or the server asking whether to keep times the crew may run late on.
 */
export type BookingSubmitOutcome =
  | string
  | null
  | { confirmTightSchedule: string }
  /** Refused by the server's rules, each issue with the field it is about. */
  | { refused: BookingIssue[] };

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: BookingFormVariant;
  clients?: ClientWithAddresses[];
  trucks: Partial<TruckRow>[];
  drivers: Partial<EmployeeRow>[];
  helpers: Partial<EmployeeRow>[];
  subcontractors: Partial<SubContractorRow>[];
  preSelectedClientID?: string;
  /** Returns a message when the booking was refused, so the form can stay up. */
  onSubmitSuccess: (data: BookingFormResult) => void | Promise<BookingSubmitOutcome>;
}

const TITLES: Record<BookingFormVariant, string> = {
  registered: "Registered Client Booking",
  "on-call": "On-Call Booking Form",
  "new-client": "New Client Booking Form",
};
const BADGES: Record<BookingFormVariant, string | null> = {
  registered: null,
  "on-call": "Walk-in / On-Call",
  "new-client": "New Client",
};

const emptyItem = (): ItemRow => ({ productName: "", quantity: "", unit: DEFAULT_UNIT });

const emptyPickup = (): PickupRow => ({
  warehouseName: "",
  warehouseAddress: "",
  contactPerson: "",
  contactNumber: "",
  pickupTime: "",
  date: "",
  items: [emptyItem()],
});
const emptyDelivery = (): DeliveryRow => ({
  branchName: "",
  deliveryAddress: "",
  contactPerson: "",
  contactNumber: "",
  deliveryTime: "",
  date: "",
  items: [emptyItem()],
});

// Today in Manila, the same day the server judges "in the past" by.
// toISOString() is UTC, which until 8 in the morning is still yesterday -
// so the date picker offered yesterday and the server then refused it.
const today = () => todayInManila();

function initialForm() {
  return {
    clientID: "",
    clientName: "",
    contactPerson: "",
    contactNumber: "",
    emailAddress: "",
    businessAddress: "",
    requestDate: today(),
    deliverySchedule: "",
    product: "",
    priorityLevel: "",
    subconPartner: "",
    partnerContact: "",
    truckPlate: "",
    driver: "",
    helper1: "",
    helper2: "",
    notes: "",
  };
}

// Straight across: the columns are called what they are called.
// A client as the booking form needs it: the record plus the addresses it can
// be collected from and delivered to.
export interface ClientWithAddresses extends Partial<ClientRow> {
  Warehouse?: Partial<WarehouseRow>[];
  Branch?: Partial<BranchRow>[];
}

const toTruck = (t: Partial<TruckRow>): CrewTruck => ({
  truckID: t.truckID ?? "",
  plateNumber: t.plateNumber ?? "Unknown",
  model: t.model ?? null,
});
const toPerson = (p: Partial<EmployeeRow>): CrewPerson => ({
  employeeID: p.employeeID ?? "",
  employeeName: p.employeeName ?? "Unknown",
});

// Red border for a field with an error; the message is shown under it
// unless it is only "Required". The same box as the client fields above.
const fieldClass = (hasError: boolean) =>
  `w-full border rounded-md px-3 py-2 text-xs bg-white ${hasError ? "border-red-500 bg-red-50/20" : "border-slate-300"}`;

function CellError({ message }: { message?: string }) {
  if (!message || message === "Required") return null;
  return <p className="mt-1 text-[11px] leading-tight text-red-600">{message}</p>;
}

// One pickup or delivery: a card whose fields reflow with the screen. Two
// columns on a phone held wide (date beside time; one on a narrow phone, where
// the 16px phone inputs leave no room for both), six on a tablet, twelve on a laptop,
// so nothing scrolls sideways and every field keeps its own label.
function StopCard({
  title,
  onDelete,
  canDelete,
  children,
}: {
  title: string;
  onDelete: () => void;
  canDelete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-slate-200 bg-slate-50 pl-3 pr-1 py-1 text-slate-500">
        <span className="text-xs font-semibold text-slate-900">{title}</span>
        <RowDeleteButton onConfirm={onDelete} disabled={!canDelete} />
      </div>
      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 sm:grid-cols-6 lg:grid-cols-12 gap-3 p-3">{children}</div>
    </div>
  );
}

function StopField({ label, span, children }: { label: string; span: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${span}`}>
      <label className="block text-xs font-medium text-black">
        {label}
        <span className="mt-1 block">{children}</span>
      </label>
    </div>
  );
}

// Mounted only while open, so every opening starts from a blank form.
export default function BookingFormModal(props: BookingFormModalProps) {
  if (!props.isOpen) return null;
  return <BookingForm {...props} />;
}

function BookingForm({
  onClose,
  variant,
  clients = [],
  trucks,
  drivers,
  helpers,
  subcontractors,
  preSelectedClientID,
  onSubmitSuccess,
}: BookingFormModalProps) {
  const currentDate = today();
  const registered = variant === "registered" && Boolean(preSelectedClientID);

  const clientRecord = registered ? clients.find((c) => c.clientID === preSelectedClientID) : null;

  const [formData, setFormData] = useState(() => ({
    ...initialForm(),
    ...(clientRecord
      ? {
          clientID: preSelectedClientID ?? "",
          clientName: clientRecord.company ?? "",
          contactPerson: clientRecord.contactName ?? "",
          contactNumber: clientRecord.contact ?? "",
          emailAddress: clientRecord.emailAdd ?? "",
          businessAddress: clientRecord.businessAdd ?? "",
        }
      : {}),
  }));
  const [isSubconMode, setIsSubconMode] = useState(false);
  const subconRef = useRef(false);
  useEffect(() => {
    subconRef.current = isSubconMode;
  }, [isSubconMode]);
  // Who is free on the chosen date, once loaded; until then the lists the
  // dashboard already had.
  // Lists are absent when that load failed.
  const [freeCrew, setFreeCrew] = useState<{
    date: string;
    trucks?: CrewTruck[];
    drivers?: CrewPerson[];
    helpers?: CrewPerson[];
  } | null>(null);
  const [pickupList, setPickupList] = useState<PickupRow[]>([emptyPickup()]);
  const [deliveryList, setDeliveryList] = useState<DeliveryRow[]>([emptyDelivery()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Products this client has booked before, offered as the office types one.
  // Only a nicety: a failed load leaves the boxes as plain text.
  const [clientProducts, setClientProducts] = useState<{ productName: string; unit: StockUnit }[]>([]);
  useEffect(() => {
    if (!formData.clientID) return;
    let cancelled = false;
    apiFetch<{ products?: { productName: string; unit: StockUnit }[] }>(`/api/clients/${formData.clientID}/products`)
      .then((res) => {
        if (!cancelled) setClientProducts(res.products ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [formData.clientID]);

  // A refusal from the server, kept on the form rather than thrown over the
  // dashboard behind it, and whether the save is still in flight.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmUnassigned, setConfirmUnassigned] = useState<BookingFormResult | null>(null);
  // The server held the booking back: the crew may arrive late on these times.
  const [confirmTight, setConfirmTight] = useState<{ result: BookingFormResult; message: string } | null>(null);

  const availableTrucks = useMemo(() => freeCrew?.trucks ?? (trucks ?? []).map(toTruck), [freeCrew, trucks]);
  const availableDrivers = useMemo(() => freeCrew?.drivers ?? (drivers ?? []).map(toPerson), [freeCrew, drivers]);
  const availableHelpers = useMemo(() => freeCrew?.helpers ?? (helpers ?? []).map(toPerson), [freeCrew, helpers]);
  const loadingCrew = Boolean(formData.deliverySchedule) && freeCrew?.date !== formData.deliverySchedule;

  // Crew fields the coordinator has set by hand. A suggestion never
  // overrides those while they are still free.
  const touched = useRef<Partial<Record<keyof CrewChoice, boolean>>>({});
  const crewRef = useRef<CrewChoice>({ truckPlate: "", driver: "", helper1: "", helper2: "" });
  useEffect(() => {
    crewRef.current = {
      truckPlate: formData.truckPlate,
      driver: formData.driver,
      helper1: formData.helper1,
      helper2: formData.helper2,
    };
  }, [formData.truckPlate, formData.driver, formData.helper1, formData.helper2]);

  // Once a date is chosen: who is free, and a suggested crew. Choices made
  // by hand are kept while they are still free.
  useEffect(() => {
    const date = formData.deliverySchedule;
    if (!date) return;
    let live = true;
    apiFetch<{ data?: { trucks?: Partial<TruckRow>[]; drivers?: Partial<EmployeeRow>[]; helpers?: Partial<EmployeeRow>[] } }>(
      `/api/dispatch/available-resources?date=${date}`,
      { cache: "no-store" },
    )
      .then((res) => {
        if (!live) return;
        const next = {
          date,
          trucks: (res?.data?.trucks || []).map(toTruck),
          drivers: (res?.data?.drivers || []).map(toPerson),
          helpers: (res?.data?.helpers || []).map(toPerson),
        };
        setFreeCrew(next);
        const picked = suggestCrew(crewRef.current, touched.current, next.trucks, next.drivers, next.helpers);
        // A partner trip has its own driver and plate, typed in.
        if (!subconRef.current) setFormData((prev) => ({ ...prev, ...picked }));
      })
      .catch((error) => {
        console.error("Failed to load resources for this date:", error);
        if (!live) return;
        // Still suggest a crew, from the lists the dashboard already has.
        setFreeCrew({ date });
        const picked = suggestCrew(
          crewRef.current,
          touched.current,
          (trucks ?? []).map(toTruck),
          (drivers ?? []).map(toPerson),
          (helpers ?? []).map(toPerson),
        );
        // A partner trip has its own driver and plate, typed in.
        if (!subconRef.current) setFormData((prev) => ({ ...prev, ...picked }));
      });
    return () => {
      live = false;
    };
    // The dashboard's lists are only a fallback; a change to them should not
    // reload who is free.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.deliverySchedule]);

  const registeredWarehouses: Partial<WarehouseRow>[] = clientRecord?.Warehouse ?? [];
  const registeredBranches: Partial<BranchRow>[] = clientRecord?.Branch ?? [];

  // Addresses already in use, so a dropdown can grey them out: a warehouse
  // picked on another pickup row, or one whose address is a delivery's.
  const usedAddresses = useMemo(
    () => ({
      pickups: pickupList.map((p) => addressKey(p.warehouseAddress)),
      deliveries: deliveryList.map((d) => addressKey(d.deliveryAddress)),
      key: addressKey,
    }),
    [pickupList, deliveryList],
  );

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // The booking's date is the run's first day: the first pickup's date.
  // Moving it moves every stop given a later day by the same number of days,
  // so a three-day run stays three days rather than ending up before it starts.
  const changeBookingDate = (value: string) => {
    if (isRealDate(formData.deliverySchedule) && isRealDate(value)) {
      const shift = daysBetween(formData.deliverySchedule, value);
      const move = <Row extends { date: string }>(rows: Row[]) =>
        rows.map((row) => (isRealDate(row.date) ? { ...row, date: addDays(row.date, shift) } : row));
      setPickupList(move);
      setDeliveryList(move);
    }
    setFormData((prev) => ({ ...prev, deliverySchedule: value }));
    clearError("deliverySchedule");
    clearError("pickup_0_date");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    const value = name === "contactNumber" || name === "partnerContact" ? sanitizePhoneInput(e.target.value) : e.target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError(name);
  };

  // Every stop in the order the truck drives them, collections first, with
  // the day each falls on. Read on every render, so the "Day 2" under a time
  // is always the day the booking will be saved with.
  const routeStops = () => [
    ...pickupList.map((row) => ({ date: row.date, time: row.pickupTime })),
    ...deliveryList.map((row) => ({ date: row.date, time: row.deliveryTime })),
  ];
  const schedule = checkStopSchedule(routeStops(), { bookingDate: formData.deliverySchedule || null });
  const runLastDay = isRealDate(formData.deliverySchedule) ? addDays(formData.deliverySchedule, MAX_RUN_DAYS - 1) : "";

  const pickupCount = pickupList.length;
  const stopName = (index: number) => (index < pickupCount ? `Pickup ${index + 1}` : `Branch ${index - pickupCount + 1}`);
  const stopTime = (index: number) =>
    (index < pickupCount ? pickupList[index]?.pickupTime : deliveryList[index - pickupCount]?.deliveryTime) ?? "";
  const keyFor = (index: number, field: "date" | "time") =>
    index < pickupCount
      ? `pickup_${index}_${field === "date" ? "date" : "pickupTime"}`
      : `delivery_${index - pickupCount}_${field === "date" ? "date" : "deliveryTime"}`;
  // The stop a stop has to come after: the latest one before it with a date
  // and time - the one checkStopSchedule measures it against.
  const stopBefore = (index: number) => {
    let latest = -1;
    for (let i = 0; i < index; i++) {
      const moment = schedule.moments[i];
      if (moment !== null && (latest === -1 || moment > (schedule.moments[latest] as number))) latest = i;
    }
    return latest;
  };

  // When each stop is due, checked as the times and days are picked rather
  // than when Generate Booking is pressed: a drop at the same minute as its
  // collection is wrong the moment both are on the form. Same rules as the
  // server, from the same function; the form only adds which stop it clashes
  // with, so the coordinator knows which of the two to move.
  const liveStopErrors: Record<string, string> = {};
  for (const issue of schedule.issues) {
    const before = stopBefore(issue.index);
    let message = issue.message;
    if (issue.field === "time" && before !== -1) {
      const at = formatClock(stopTime(before));
      const when = schedule.dates[before] === schedule.dates[issue.index] ? at : `${formatShortDay(schedule.dates[before])}, ${at}`;
      if (issue.message === SAME_TIME_RULE) message = `Same time as ${stopName(before)} (${when}) - pick a later time`;
      else if (issue.message === EARLIER_SAME_DAY_RULE) message = `Before ${stopName(before)} (${when}) - pick a later time, or the next day`;
      else if (issue.message === EARLIER_RULE) message = `Before ${stopName(before)} (${when})`;
      else if (issue.message === TOO_SOON_RULE) {
        const gap = (schedule.moments[issue.index] as number) - (schedule.moments[before] as number);
        message = `Only ${gap} min after ${stopName(before)} (${when}) - allow at least 1 hour`;
      }
    }
    liveStopErrors[keyFor(issue.index, issue.field)] ??= message;
  }
  // What a stop's date or time shows: the live check while it finds something,
  // else what the last submit or the server said about that field.
  const stopError = (key: string) => liveStopErrors[key] ?? errors[key];

  // The earliest a stop's time can be picked: not a time already gone today,
  // and not within an hour of the stop before it - which can reach past
  // midnight into this stop's day.
  const timeLimitFor = (index: number): { min?: string; note?: string } => {
    const date = schedule.dates[index];
    let floor = date === todayInManila() ? (clockMinutes(clockInManila()) ?? -1) : -1;
    let note: string | undefined;
    const before = stopBefore(index);
    const dayStart = stopMoment(date ?? "", "00:00");
    if (before !== -1 && dayStart !== null) {
      const earliest = (schedule.moments[before] as number) + MIN_STOP_GAP_MINUTES - dayStart;
      if (earliest > 0 && earliest > floor) {
        floor = earliest;
        const at = formatClock(stopTime(before));
        const when = schedule.dates[before] === date ? at : `${formatShortDay(schedule.dates[before])}, ${at}`;
        note =
          earliest >= 24 * 60
            ? `${stopName(before)} is at ${when} - this stop needs at least 1 hour after it, so move it to the next day.`
            : `${stopName(before)} is at ${when} - this stop needs at least 1 hour after it.`;
      }
    }
    if (floor < 0) return {};
    // Past 23:45 nothing on this day is left; 23:59 greys out every slot.
    const capped = Math.min(floor, 24 * 60 - 1);
    return { min: `${String(Math.floor(capped / 60)).padStart(2, "0")}:${String(capped % 60).padStart(2, "0")}`, note };
  };

  const setCrew = (field: keyof CrewChoice, value: string) => {
    touched.current[field] = true;
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  const cleanCell = (field: string, value: string) =>
    field === "contactNumber" ? sanitizePhoneInput(value) : field === "quantity" ? sanitizeQuantityInput(value) : value;

  const handlePickupChange = (index: number, field: keyof PickupRow, value: string) => {
    setPickupList((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: cleanCell(field, value) } : row)));
    clearError(`pickup_${index}_${field}`);
  };
  const handleDeliveryChange = (index: number, field: keyof DeliveryRow, value: string) => {
    setDeliveryList((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: cleanCell(field, value) } : row)));
    clearError(`delivery_${index}_${field}`);
  };

  // Errors are keyed by row position, so they are cleared when a row goes.
  const removePickupRow = (index: number) => {
    if (pickupList.length === 1) return;
    // Removing the first pickup makes the next one the run's first stop, and
    // the first stop's day is the booking's. A day chosen for it becomes the
    // booking's date rather than sitting on the row disagreeing with it.
    const nextFirst = index === 0 ? pickupList[1] : null;
    if (nextFirst && isRealDate(nextFirst.date)) {
      setFormData((prev) => ({ ...prev, deliverySchedule: nextFirst.date }));
    }
    setPickupList((rows) =>
      rows.filter((_, i) => i !== index).map((row, i) => (i === 0 && index === 0 ? { ...row, date: "" } : row)),
    );
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("pickup_"))));
  };
  const removeDeliveryRow = (index: number) => {
    if (deliveryList.length === 1) return;
    setDeliveryList((rows) => rows.filter((_, i) => i !== index));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("delivery_"))));
  };

  // ---- Products on a stop ---------------------------------------------------

  type Section = "pickup" | "delivery";
  const setItems = (section: Section, stop: number, change: (items: ItemRow[]) => ItemRow[]) => {
    const apply = <T extends { items: ItemRow[] }>(rows: T[]) =>
      rows.map((row, i) => (i === stop ? { ...row, items: change(row.items) } : row));
    if (section === "pickup") setPickupList(apply);
    else setDeliveryList(apply);
  };

  // Errors on product lines are keyed by position, so they all go when a line
  // is added or removed rather than landing on the wrong one.
  const clearItemErrors = (section: Section, stop: number) =>
    setErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`${section}_${stop}_item`))),
    );

  const productSuggestions = useMemo(() => {
    const units = new Map<string, StockUnit>();
    for (const product of clientProducts) units.set(product.productName.toLowerCase(), product.unit);
    // Names typed on this booking come first: a drop-off is usually something
    // the pickup above it loaded.
    const typed = [...pickupList, ...deliveryList].flatMap((row) => row.items).filter((item) => item.productName.trim());
    const names = new Map<string, string>();
    for (const item of typed) {
      const name = cleanProductName(item.productName);
      if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
      if (!units.has(name.toLowerCase())) units.set(name.toLowerCase(), item.unit);
    }
    for (const product of clientProducts) {
      if (!names.has(product.productName.toLowerCase())) names.set(product.productName.toLowerCase(), product.productName);
    }
    return { names: [...names.values()], units };
  }, [clientProducts, pickupList, deliveryList]);

  const handleItemChange = (section: Section, stop: number, line: number, field: keyof ItemRow, value: string) => {
    setItems(section, stop, (items) =>
      items.map((item, i) => {
        if (i !== line) return item;
        if (field === "quantity") return { ...item, quantity: sanitizeQuantityInput(value) };
        if (field === "unit") return { ...item, unit: value as StockUnit };
        // A product booked before brings its usual unit, unless one was chosen.
        const known = productSuggestions.units.get(cleanProductName(value).toLowerCase());
        return { ...item, productName: value, unit: known && item.unit === DEFAULT_UNIT ? known : item.unit };
      }),
    );
    clearError(`${section}_${stop}_item_${line}_${field}`);
    clearError(`${section}_${stop}_items`);
  };

  const addItem = (section: Section, stop: number) => {
    setItems(section, stop, (items) => (items.length >= MAX_ITEMS_PER_STOP ? items : [...items, emptyItem()]));
    clearItemErrors(section, stop);
  };

  const removeItem = (section: Section, stop: number, line: number) => {
    setItems(section, stop, (items) => (items.length === 1 ? [emptyItem()] : items.filter((_, i) => i !== line)));
    clearItemErrors(section, stop);
  };

  // What the pickups load, product by product: offered on a drop-off so the
  // office only types how many go there.
  const pickupProducts = productTotals(
    pickupList.map((row) => row.items.filter((item) => item.productName.trim()).map((item) => ({
      productName: item.productName,
      quantity: parseQuantity(item.quantity) ?? 0,
      unit: item.unit,
    }))),
  );

  const fillFromPickups = (stop: number) => {
    setItems("delivery", stop, (items) => {
      const kept = items.filter((item) => item.productName.trim());
      const have = new Set(kept.map((item) => itemKey(item)));
      const added = pickupProducts
        .filter((product) => !have.has(itemKey(product)))
        .map((product) => ({ productName: product.productName, quantity: "", unit: product.unit }));
      return [...kept, ...added].slice(0, MAX_ITEMS_PER_STOP);
    });
    clearItemErrors("delivery", stop);
  };

  const handleWarehouseSelect = (index: number, selectedName: string) => {
    const match = registeredWarehouses.find((w) => w.whName === selectedName);
    setPickupList((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              warehouseID: match?.warehouseID ?? null,
              warehouseName: selectedName,
              warehouseAddress: match?.warehouseLoc ?? "",
              contactPerson: match?.contactPerson ?? "",
              contactNumber: match?.contactNum ?? "",
            }
          : row,
      ),
    );
    ["warehouseName", "warehouseAddress", "contactPerson", "contactNumber"].forEach((f) => clearError(`pickup_${index}_${f}`));
  };

  const handleBranchSelect = (index: number, selectedName: string) => {
    const match = registeredBranches.find((b) => b.branchName === selectedName);
    setDeliveryList((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              branchName: selectedName,
              deliveryAddress: match?.deliveryAddress ?? "",
              contactPerson: match?.contactPerson ?? "",
              contactNumber: match?.contactNumber ?? "",
            }
          : row,
      ),
    );
    ["branchName", "deliveryAddress", "contactPerson", "contactNumber"].forEach((f) => clearError(`delivery_${index}_${f}`));
  };

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const phone = (key: string, value: string) => {
      if (!value.trim()) next[key] = key.includes("_") ? "Required" : "Contact number is required.";
      else if (!normalizePhone(value)) next[key] = PHONE_RULE;
    };
    // Every line named and counted, at least one line, no product twice.
    const products = (prefix: string, items: ItemRow[]) => {
      const named = items.filter((item) => item.productName.trim() || item.quantity.trim());
      if (named.length === 0) {
        next[`${prefix}_items`] = "Add at least one product";
        return;
      }
      const seen = new Set<string>();
      items.forEach((item, line) => {
        const key = `${prefix}_item_${line}`;
        if (!item.productName.trim() && !item.quantity.trim()) return; // a blank spare line
        const name = cleanProductName(item.productName);
        if (!name) next[`${key}_productName`] = "Required";
        else if (name.length > MAX_PRODUCT_NAME) next[`${key}_productName`] = `Under ${MAX_PRODUCT_NAME} characters`;
        else if (seen.has(itemKey(item))) next[`${key}_productName`] = "Listed twice on this stop";
        seen.add(itemKey(item));
        const amount = parseQuantity(item.quantity);
        if (!item.quantity.trim()) next[`${key}_quantity`] = "Required";
        else if (amount === null) next[`${key}_quantity`] = "At least 1";
        else if (amount > MAX_ITEM_QUANTITY) next[`${key}_quantity`] = "Too large";
      });
    };
    const clock = (key: string, value: string) => {
      if (!value.trim()) next[key] = "Required";
      else if (!isValidClockTime(value)) next[key] = CLOCK_RULE;
      else if (!isQuarterHour(value)) next[key] = QUARTER_HOUR_RULE;
    };

    if (!formData.clientName.trim()) next.clientName = "Company / client name is required.";
    if (!formData.contactPerson.trim()) next.contactPerson = "Contact person is required.";
    phone("contactNumber", formData.contactNumber);
    // The date box's min and max hold only for the picker; a date typed in, or
    // a form left open past midnight, still reaches here.
    if (!formData.deliverySchedule) next.deliverySchedule = "Pick the date of the first pickup.";
    else if (!isRealDate(formData.deliverySchedule)) next.deliverySchedule = "That date does not exist.";
    else if (formData.deliverySchedule < todayInManila()) next.deliverySchedule = "That date has already passed.";
    else if (isTooFarAhead(formData.deliverySchedule, todayInManila())) next.deliverySchedule = `${TOO_FAR_RULE}.`;
    if (!formData.priorityLevel) next.priorityLevel = "Priority level is required.";

    pickupList.forEach((p, i) => {
      if (!p.warehouseName.trim()) next[`pickup_${i}_warehouseName`] = "Required";
      if (!p.warehouseAddress.trim()) next[`pickup_${i}_warehouseAddress`] = "Required";
      if (!p.contactPerson.trim()) next[`pickup_${i}_contactPerson`] = "Required";
      phone(`pickup_${i}_contactNumber`, p.contactNumber);
      clock(`pickup_${i}_pickupTime`, p.pickupTime);
      products(`pickup_${i}`, p.items);
    });
    deliveryList.forEach((d, i) => {
      if (!d.branchName.trim()) next[`delivery_${i}_branchName`] = "Required";
      if (!d.deliveryAddress.trim()) next[`delivery_${i}_deliveryAddress`] = "Required";
      if (!d.contactPerson.trim()) next[`delivery_${i}_contactPerson`] = "Required";
      phone(`delivery_${i}_contactNumber`, d.contactNumber);
      clock(`delivery_${i}_deliveryTime`, d.deliveryTime);
      products(`delivery_${i}`, d.items);
    });

    for (const clash of findAddressClashes(
      pickupList.map((p) => ({ address: p.warehouseAddress })),
      deliveryList.map((d) => ({ address: d.deliveryAddress })),
    )) {
      const key = clash.section === "pickup" ? `pickup_${clash.index}_warehouseAddress` : `delivery_${clash.index}_deliveryAddress`;
      next[key] = clash.message;
    }

    // When each stop is due, in the order the truck drives them: collections
    // first, then drops. Checked here, on the fields that are wrong, rather
    // than coming back as a sentence over the dashboard - and by the same rule
    // the server uses, from the same function, because two copies of a rule
    // this subtle drift.
    //
    // Nothing is read as overnight any more. A stop earlier on the clock than
    // the one before it, on the same day, is refused until it is given the
    // next day on purpose: that guess let 03:05 typed for 15:05 through as a
    // run nobody meant.
    //
    // They are shown live (liveStopErrors) and go the moment either stop is
    // moved, so they are not copied into the saved errors: a copy there stayed
    // red on the later stop after the earlier one had been fixed.
    const checked = checkStopSchedule(routeStops(), { bookingDate: formData.deliverySchedule || null });
    const scheduleBlocked = checked.issues.length > 0;

    if (isSubconMode && !formData.subconPartner) next.subconPartner = "Subcon partner is required.";
    if (isSubconMode && formData.partnerContact.trim() && !normalizePhone(formData.partnerContact)) next.partnerContact = PHONE_RULE;

    // Set every time, empty included. Errors were only ever replaced when the
    // form found new ones, so cells the server had refused stayed red - and
    // "Check the fields marked in red" stayed up - after the coordinator had
    // fixed what was wrong and the form had nothing left to say.
    setErrors(next);
    if (Object.keys(next).length > 0 || scheduleBlocked) return;

    const truck = availableTrucks.find((t) => t.truckID === formData.truckPlate);
    const driver = availableDrivers.find((d) => d.employeeID === formData.driver);
    const helper1 = availableHelpers.find((h) => h.employeeID === formData.helper1);
    const helper2 = availableHelpers.find((h) => h.employeeID === formData.helper2);
    const unassigned = !isSubconMode && (!formData.truckPlate || !formData.driver);

    // Blank spare lines are left out; what is left has passed the checks above.
    const filled = (items: ItemRow[]) => items.filter((item) => item.productName.trim());
    const cleanPickups = pickupList.map((p) => ({ ...p, items: filled(p.items) }));
    const cleanDeliveries = deliveryList.map((d) => ({ ...d, items: filled(d.items) }));
    // The one line the rest of the system still shows for a booking's cargo.
    const productLine = productTotals([...cleanPickups, ...cleanDeliveries].map((row) => itemsOf(row.items)))
      .map((item) => item.productName)
      .join(", ");

    const result: BookingFormResult = {
      ...formData,
      product: productLine,
      subconPartner: isSubconMode ? formData.subconPartner : "",
      subconPartnerName: isSubconMode
        ? (subcontractors.find((p) => p.subConID === formData.subconPartner)?.companyName ?? "")
        : "",
      partnerContact: isSubconMode ? (normalizePhone(formData.partnerContact) ?? "") : "",
      contactNumber: normalizePhone(formData.contactNumber) ?? formData.contactNumber,
      emailAddress: formData.emailAddress.trim() || "N/A",
      businessAddress: formData.businessAddress.trim() || "N/A",
      // Each stop with the day it resolved to, own or followed, so the server
      // reads a dated booking and holds it to the same rules.
      pickupList: cleanPickups.map((p, i) => ({
        ...p,
        date: checked.dates[i] ?? "",
        contactNumber: normalizePhone(p.contactNumber) ?? p.contactNumber,
      })),
      deliveryList: cleanDeliveries.map((d, i) => ({
        ...d,
        date: checked.dates[pickupCount + i] ?? "",
        contactNumber: normalizePhone(d.contactNumber) ?? d.contactNumber,
      })),
      unassigned,
      resolvedNames: {
        truck: isSubconMode ? formData.truckPlate : (truck?.plateNumber ?? ""),
        driver: isSubconMode ? formData.driver : (driver?.employeeName ?? ""),
        helper1: isSubconMode ? formData.helper1 : (helper1?.employeeName ?? ""),
        helper2: isSubconMode ? formData.helper2 : (helper2?.employeeName ?? ""),
      },
    };

    // Without a truck and a driver the booking cannot be dispatched yet;
    // say so before creating it.
    if (unassigned) {
      setConfirmUnassigned(result);
      return;
    }
    await submit(result);
  };

  // Closed only once the booking is actually made. It used to close here and
  // let the request run on behind it, so anything the server refused took the
  // whole form with it and the coordinator typed it again from memory.
  const submit = async (result: BookingFormResult) => {
    setSubmitError(null);
    setSaving(true);
    try {
      const outcome = await onSubmitSuccess(result);
      if (outcome && typeof outcome === "object" && "refused" in outcome) {
        // On the cells it is about, as if the form had found it itself.
        const { errors: refused, summary } = formErrorsFromIssues(outcome.refused);
        setErrors(refused);
        setSubmitError(summary);
        return;
      }
      if (outcome && typeof outcome === "object") {
        setConfirmTight({ result, message: outcome.confirmTightSchedule });
        return;
      }
      if (outcome) {
        setSubmitError(outcome);
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // By id: the trip is linked to the partner. A new partner is added under
  // Clients & Partners first.
  const partnerOptions = subcontractors
    .filter((p) => p.isActive !== false && p.subConID)
    .map((p) => ({
      value: String(p.subConID),
      label: p.companyName ?? "Partner",
      detail: p.contactNumber || null,
    }));

  // The partner's driver and plate are typed, the crew picker's are ids;
  // switching clears one for the other.
  const switchMode = () => {
    const toSubcon = !isSubconMode;
    setIsSubconMode(toSubcon);
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !["subconPartner", "partnerContact"].includes(k))));
    if (toSubcon) {
      touched.current = {};
      setFormData((prev) => ({ ...prev, truckPlate: "", driver: "", helper1: "", helper2: "" }));
    } else {
      const picked = suggestCrew(
        { truckPlate: "", driver: "", helper1: "", helper2: "" },
        {},
        availableTrucks,
        availableDrivers,
        availableHelpers,
      );
      setFormData((prev) => ({ ...prev, subconPartner: "", partnerContact: "", ...(prev.deliverySchedule ? picked : { truckPlate: "", driver: "", helper1: "", helper2: "" }) }));
    }
  };

  const errorCount = Object.keys({ ...errors, ...liveStopErrors }).length;
  const badge = BADGES[variant];
  const inputClass = (key: string) =>
    `w-full border rounded-md px-3 py-2 text-xs ${errors[key] ? "border-red-500 bg-red-50/20" : "border-slate-300"}`;

  return (
    <>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto">
          <div className="flex items-center justify-between px-6 py-4 bg-[#000c31] text-white border-b border-slate-800">
            <h2 className="text-xl font-bold text-white tracking-wide">{TITLES[variant]}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={validateAndSubmit} noValidate className="p-4 sm:p-6 space-y-6 max-h-[80dvh] overflow-y-auto text-sm text-slate-900">
            {/* What the server refused, said here rather than over the
                dashboard - the form is still open and still holds everything
                that was typed into it. */}
            {submitError && (
              <div
                role="alert"
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800"
              >
                {submitError}
              </div>
            )}

            {/* Client Info */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide flex justify-between">
                <span>1. Client Information</span>
                {badge && (
                  <span className="text-xs sm:text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {badge}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Company / Client Name *</label>
                  {registered ? (
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold text-slate-700 truncate">
                      {formData.clientName}
                    </div>
                  ) : (
                    <input
                      type="text"
                      name="clientName"
                      placeholder="Company or Client Name"
                      value={formData.clientName}
                      onChange={handleChange}
                      className={inputClass("clientName")}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Contact Person *</label>
                  <input
                    type="text"
                    name="contactPerson"
                    placeholder="e.g., Juan Dela Cruz"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    className={inputClass("contactPerson")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Contact Number *</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    name="contactNumber"
                    placeholder="e.g., 09123456789"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    className={inputClass("contactNumber")}
                  />
                  {errors.contactNumber && <p className="mt-1 text-[11px] leading-tight text-red-600">{errors.contactNumber}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-black mb-1">Email Address</label>
                  <input
                    type="email"
                    name="emailAddress"
                    placeholder="company@email.com"
                    value={formData.emailAddress}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-medium text-black mb-1">Business Address</label>
                  <input
                    type="text"
                    name="businessAddress"
                    placeholder="Enter full business address"
                    value={formData.businessAddress}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Pickup */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                <span className="font-semibold text-black text-sm tracking-wide">2. Pickup Addresses *</span>
                <button
                  type="button"
                  onClick={() => setPickupList((rows) => [...rows, emptyPickup()])}
                  className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-medium rounded-lg text-xs shadow-sm px-3 sm:px-4 py-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" /> New Pickup
                </button>
              </div>
              <div className="space-y-3">
                {pickupList.map((row, idx) => (
                  <StopCard
                    key={idx}
                    title={`Pickup ${idx + 1}`}
                    onDelete={() => removePickupRow(idx)}
                    canDelete={pickupList.length > 1}
                  >
                    <StopField label="Warehouse Name *" span="min-[440px]:col-span-2 sm:col-span-3 lg:col-span-4">
                      {registered ? (
                        <select
                          value={row.warehouseName}
                          onChange={(e) => handleWarehouseSelect(idx, e.target.value)}
                          className={fieldClass(Boolean(errors[`pickup_${idx}_warehouseName`]))}
                        >
                          <option value="">Select Warehouse</option>
                          {registeredWarehouses.map((w, i) => {
                            const name = w.whName;
                            const key = usedAddresses.key(w.warehouseLoc ?? "");
                            const inUse =
                              name !== row.warehouseName &&
                              (pickupList.some((p, j) => j !== idx && p.warehouseName === name) ||
                                (key !== "" && usedAddresses.deliveries.includes(key)));
                            return (
                              <option key={i} value={name} disabled={inUse}>
                                {name}
                                {inUse ? " (already used)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Warehouse Name"
                          value={row.warehouseName}
                          onChange={(e) => handlePickupChange(idx, "warehouseName", e.target.value)}
                          className={fieldClass(Boolean(errors[`pickup_${idx}_warehouseName`]))}
                        />
                      )}
                    </StopField>
                    <StopField label="Address *" span="min-[440px]:col-span-2 sm:col-span-3 lg:col-span-8">
                      <input
                        type="text"
                        placeholder="Full Address"
                        value={row.warehouseAddress}
                        onChange={(e) => handlePickupChange(idx, "warehouseAddress", e.target.value)}
                        className={fieldClass(Boolean(errors[`pickup_${idx}_warehouseAddress`]))}
                      />
                      <CellError message={errors[`pickup_${idx}_warehouseAddress`]} />
                    </StopField>
                    <StopField label="Contact Person *" span="min-[440px]:col-span-2 sm:col-span-3 lg:col-span-3">
                      <input
                        type="text"
                        placeholder="Contact Person"
                        value={row.contactPerson}
                        onChange={(e) => handlePickupChange(idx, "contactPerson", e.target.value)}
                        className={fieldClass(Boolean(errors[`pickup_${idx}_contactPerson`]))}
                      />
                    </StopField>
                    <StopField label="Contact Number *" span="min-[440px]:col-span-2 sm:col-span-3 lg:col-span-3">
                      <input
                        type="tel"
                        inputMode="tel"
                        placeholder="09XXXXXXXXX"
                        value={row.contactNumber}
                        onChange={(e) => handlePickupChange(idx, "contactNumber", e.target.value)}
                        className={fieldClass(Boolean(errors[`pickup_${idx}_contactNumber`]))}
                      />
                      <CellError message={errors[`pickup_${idx}_contactNumber`] && "11 digits, starting 09"} />
                    </StopField>
                    <div className="min-w-0 sm:col-span-2 lg:col-span-2">
                      <StopDayField
                        label="Pickup Date *"
                        date={idx === 0 ? formData.deliverySchedule : (schedule.dates[idx] ?? "")}
                        firstDay={formData.deliverySchedule}
                        // The first pickup opens the run: its day is the booking's, and
                        // can be any bookable day. Every later stop is on or after the
                        // one before it, within the week.
                        min={idx === 0 ? currentDate : (schedule.dates[idx - 1] || currentDate)}
                        max={idx === 0 ? addDays(currentDate, MAX_DAYS_AHEAD) : runLastDay}
                        onChange={(v) => (idx === 0 ? changeBookingDate(v) : handlePickupChange(idx, "date", v))}
                        error={idx === 0 ? errors.deliverySchedule || stopError(`pickup_0_date`) : stopError(`pickup_${idx}_date`)}
                      />
                    </div>
                    <StopField label="Pickup Time *" span="sm:col-span-2 lg:col-span-2">
                      <TimePicker
                        size="compact"
                        value={row.pickupTime}
                        onChange={(v) => handlePickupChange(idx, "pickupTime", v)}
                        invalid={Boolean(stopError(`pickup_${idx}_pickupTime`))}
                        {...timeLimitFor(idx)}
                      />
                      <CellError message={stopError(`pickup_${idx}_pickupTime`)} />
                    </StopField>
                    <StopProducts
                      label="Products to load *"
                      prefix={`pickup_${idx}`}
                      items={row.items}
                      errors={errors}
                      onChange={(line, field, value) => handleItemChange("pickup", idx, line, field, value)}
                      onAdd={() => addItem("pickup", idx)}
                      onRemove={(line) => removeItem("pickup", idx, line)}
                    />
                  </StopCard>
                ))}
              </div>
            </div>

            {/* Delivery */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                <span className="font-semibold text-black text-sm tracking-wide">3. Delivery Address *</span>
                <button
                  type="button"
                  onClick={() => setDeliveryList((rows) => [...rows, emptyDelivery()])}
                  className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-medium rounded-lg text-xs shadow-sm px-3 sm:px-4 py-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" /> Branch
                </button>
              </div>
              <div className="space-y-3">
                {deliveryList.map((row, idx) => (
                  <StopCard
                    key={idx}
                    title={`Branch ${idx + 1}`}
                    onDelete={() => removeDeliveryRow(idx)}
                    canDelete={deliveryList.length > 1}
                  >
                    <StopField label="Branch Name *" span="min-[440px]:col-span-2 sm:col-span-3 lg:col-span-4">
                      {registered ? (
                        <select
                          value={row.branchName}
                          onChange={(e) => handleBranchSelect(idx, e.target.value)}
                          className={fieldClass(Boolean(errors[`delivery_${idx}_branchName`]))}
                        >
                          <option value="">Select Branch</option>
                          {registeredBranches.map((b, i) => {
                            const key = usedAddresses.key(b.deliveryAddress ?? "");
                            const inUse =
                              b.branchName !== row.branchName &&
                              (deliveryList.some((d, j) => j !== idx && d.branchName === b.branchName) ||
                                (key !== "" && usedAddresses.pickups.includes(key)));
                            return (
                              <option key={i} value={b.branchName} disabled={inUse}>
                                {b.branchName}
                                {inUse ? " (already used)" : ""}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Branch Name"
                          value={row.branchName}
                          onChange={(e) => handleDeliveryChange(idx, "branchName", e.target.value)}
                          className={fieldClass(Boolean(errors[`delivery_${idx}_branchName`]))}
                        />
                      )}
                    </StopField>
                    <StopField label="Delivery Address *" span="min-[440px]:col-span-2 sm:col-span-3 lg:col-span-8">
                      <input
                        type="text"
                        placeholder="Full Address"
                        value={row.deliveryAddress}
                        onChange={(e) => handleDeliveryChange(idx, "deliveryAddress", e.target.value)}
                        className={fieldClass(Boolean(errors[`delivery_${idx}_deliveryAddress`]))}
                      />
                      <CellError message={errors[`delivery_${idx}_deliveryAddress`]} />
                    </StopField>
                    <StopField label="Contact Person *" span="min-[440px]:col-span-2 sm:col-span-3 lg:col-span-3">
                      <input
                        type="text"
                        placeholder="Contact Person"
                        value={row.contactPerson}
                        onChange={(e) => handleDeliveryChange(idx, "contactPerson", e.target.value)}
                        className={fieldClass(Boolean(errors[`delivery_${idx}_contactPerson`]))}
                      />
                    </StopField>
                    <StopField label="Contact Number *" span="min-[440px]:col-span-2 sm:col-span-3 lg:col-span-3">
                      <input
                        type="tel"
                        inputMode="tel"
                        placeholder="09XXXXXXXXX"
                        value={row.contactNumber}
                        onChange={(e) => handleDeliveryChange(idx, "contactNumber", e.target.value)}
                        className={fieldClass(Boolean(errors[`delivery_${idx}_contactNumber`]))}
                      />
                      <CellError message={errors[`delivery_${idx}_contactNumber`] && "11 digits, starting 09"} />
                    </StopField>
                    <div className="min-w-0 sm:col-span-2 lg:col-span-2">
                      <StopDayField
                        label="Delivery Date *"
                        date={schedule.dates[pickupList.length + idx] ?? ""}
                        firstDay={formData.deliverySchedule}
                        min={schedule.dates[pickupList.length + idx - 1] || currentDate}
                        max={runLastDay}
                        onChange={(v) => handleDeliveryChange(idx, "date", v)}
                        error={stopError(`delivery_${idx}_date`)}
                      />
                    </div>
                    <StopField label="Delivery Time *" span="sm:col-span-2 lg:col-span-2">
                      <TimePicker
                        size="compact"
                        value={row.deliveryTime}
                        onChange={(v) => handleDeliveryChange(idx, "deliveryTime", v)}
                        invalid={Boolean(stopError(`delivery_${idx}_deliveryTime`))}
                        {...timeLimitFor(pickupCount + idx)}
                      />
                      <CellError message={stopError(`delivery_${idx}_deliveryTime`)} />
                    </StopField>
                    <StopProducts
                      label="Products to drop off *"
                      prefix={`delivery_${idx}`}
                      items={row.items}
                      errors={errors}
                      onChange={(line, field, value) => handleItemChange("delivery", idx, line, field, value)}
                      onAdd={() => addItem("delivery", idx)}
                      onRemove={(line) => removeItem("delivery", idx, line)}
                      extraAction={
                        pickupProducts.length > 0 &&
                        pickupProducts.some((product) => !row.items.some((item) => itemKey(item) === itemKey(product))) ? (
                          <button
                            type="button"
                            onClick={() => fillFromPickups(idx)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                          >
                            Add the pickup products
                          </button>
                        ) : null
                      }
                    />
                  </StopCard>
                ))}
              </div>

              <LoadBalance pickups={pickupList} deliveries={deliveryList} />
            </div>

            {/* What every product box on the form suggests. */}
            <datalist id="stop-product-suggestions">
              {productSuggestions.names.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {/* Booking details. The booking's date is Pickup 1's date - it had a
                second field here, the same value twice. */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                4. Booking Details
              </div>
              {/* The products are on each stop above; this used to be one line for the lot. */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 md:col-span-3">
                  <label className="block text-xs font-medium text-black mb-1">Priority Level *</label>
                  <select
                    name="priorityLevel"
                    value={formData.priorityLevel}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs ${errors.priorityLevel ? "border-red-500" : "border-slate-300"}`}
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    <option value="Standard">Standard</option>
                    <option value="Urgent">Urgent / Rush</option>
                    <option value="High Priority">High Priority</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Assign Crew / Subcon */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                <span className="font-semibold text-black text-sm tracking-wide">
                  5. Assign Delivery Crews & Vehicle {isSubconMode && "(Subcon)"}
                </span>
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                  {isSubconMode ? "Assign to Own Resources" : "Assign to Subcon Partner"}
                </button>
              </div>

              {isSubconMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-black mb-1" htmlFor="subcon-partner">
                      Select Subcon Partner *
                    </label>
                    <SelectMenu
                      id="subcon-partner"
                      value={formData.subconPartner}
                      onChange={(v) => {
                        setFormData((prev) => ({ ...prev, subconPartner: v }));
                        clearError("subconPartner");
                      }}
                      options={partnerOptions}
                      placeholder="Select partner"
                      emptyText="No active partners. Add one under Clients & Partners."
                      searchPlaceholder="Search company"
                    />
                    {errors.subconPartner && <p className="mt-1 text-xs text-red-600">{errors.subconPartner}</p>}
                  </div>
                  {(
                    [
                      ["truckPlate", "Truck / Plate No.", "text"],
                      ["driver", "Driver Name", "text"],
                      ["partnerContact", "Driver's Contact No.", "tel"],
                      ["helper1", "Helper #1", "text"],
                      ["helper2", "Helper #2", "text"],
                    ] as const
                  ).map(([name, title, type]) => (
                    <div key={name}>
                      <label className="block text-xs font-medium text-black mb-1">{title}</label>
                      <input
                        type={type}
                        name={name}
                        placeholder={name === "partnerContact" ? "09XXXXXXXXX (optional)" : "Optional"}
                        value={formData[name]}
                        onChange={handleChange}
                        className={inputClass(name)}
                      />
                      {errors[name] && name === "partnerContact" && (
                        <p className="mt-1 text-[11px] leading-tight text-red-600">{errors[name]}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <CrewPicker
                    value={{
                      truckPlate: formData.truckPlate,
                      driver: formData.driver,
                      helper1: formData.helper1,
                      helper2: formData.helper2,
                    }}
                    onChange={setCrew}
                    trucks={availableTrucks}
                    drivers={availableDrivers}
                    helpers={availableHelpers}
                    loading={loadingCrew}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {formData.deliverySchedule
                      ? "Suggested from who is free. Change any of them; leave the truck or driver unassigned to assign later."
                      : "Pick Pickup 1's date and a free truck and crew are suggested."}
                  </p>
                </>
              )}
            </div>

            {/* Notes */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
              <div className="border-b border-slate-200 pb-2 mb-4 font-semibold text-black text-sm tracking-wide">
                6. Notes / Instructions (Optional)
              </div>
              <textarea
                name="notes"
                placeholder="Any specific handling instructions..."
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                className="w-full resize-y border border-slate-300 rounded-md px-3 py-2 text-xs"
              />
            </div>

            {errorCount > 0 && (
              <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Check the fields marked in red.
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-slate-200 justify-end">
              <button type="button" onClick={onClose} className="px-6 py-2.5 bg-slate-200 text-slate-800 font-semibold rounded-xl text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Generate Booking
              </button>
            </div>
          </form>
        </div>
      </div>

      {confirmUnassigned && (
        <div className="fixed inset-0 overflow-y-auto z-70 flex items-center justify-center p-4 bg-slate-900/60" role="dialog" aria-modal="true" aria-labelledby="unassigned-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl my-auto">
            <h3 id="unassigned-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Create as an Unassigned Booking?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {!confirmUnassigned.truckPlate && !confirmUnassigned.driver
                ? "No truck or driver is assigned."
                : !confirmUnassigned.truckPlate
                  ? "No truck is assigned."
                  : "No driver is assigned."}{" "}
              The booking will be saved and wait under Unassigned Bookings until a truck and driver are assigned.
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmUnassigned(null)}
                className="min-h-tap px-5 py-2 rounded-xl bg-slate-200 text-sm font-semibold text-slate-800"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={() => {
                  const result = confirmUnassigned;
                  setConfirmUnassigned(null);
                  // Through the same save, so a tight schedule is still asked
                  // about and a refusal still keeps the form open.
                  void submit(result);
                }}
                className="min-h-tap px-5 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white"
              >
                Create unassigned booking
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTight && (
        <div className="fixed inset-0 overflow-y-auto z-70 flex items-center justify-center p-4 bg-slate-900/60" role="dialog" aria-modal="true" aria-labelledby="tight-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl my-auto">
            <h3 id="tight-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Check these times before booking
            </h3>
            <p className="mt-2 text-sm text-slate-600">{confirmTight.message}</p>
            <p className="mt-2 text-sm text-slate-600">Nothing has been saved yet.</p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmTight(null);
                  onClose();
                }}
                className="min-h-tap px-5 py-2 rounded-xl bg-slate-200 text-sm font-semibold text-slate-800"
              >
                Cancel booking
              </button>
              <button
                type="button"
                onClick={() => setConfirmTight(null)}
                className="min-h-tap px-5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
              >
                Go back and edit
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  const { result } = confirmTight;
                  setConfirmTight(null);
                  void submit({ ...result, acknowledgeTightSchedule: true });
                }}
                className="min-h-tap px-5 py-2 rounded-xl bg-amber-600 text-sm font-semibold text-white disabled:opacity-60"
              >
                Book anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// The products on one stop: a line each, name, how many, and in what. The
// name box suggests what this booking and this client have used before.
function StopProducts({
  label,
  prefix,
  items,
  errors,
  onChange,
  onAdd,
  onRemove,
  extraAction,
}: {
  label: string;
  prefix: string;
  items: ItemRow[];
  errors: Record<string, string>;
  onChange: (line: number, field: keyof ItemRow, value: string) => void;
  onAdd: () => void;
  onRemove: (line: number) => void;
  extraAction?: React.ReactNode;
}) {
  const listError = errors[`${prefix}_items`];
  const total = items.reduce((sum, item) => sum + (parseQuantity(item.quantity) ?? 0), 0);

  return (
    <div className="min-w-0 min-[440px]:col-span-2 sm:col-span-6 lg:col-span-12">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-black">{label}</span>
        {extraAction}
      </div>
      <div className={`space-y-2 rounded-md border p-2 ${listError ? "border-red-500 bg-red-50/20" : "border-slate-200 bg-slate-50/60"}`}>
        {items.map((item, line) => {
          const key = `${prefix}_item_${line}`;
          return (
            <div key={line} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_auto] sm:items-start">
              <div className="min-w-0 col-span-2 sm:col-span-1">
                <input
                  type="text"
                  list="stop-product-suggestions"
                  aria-label={`Product ${line + 1}`}
                  placeholder="Product, e.g. Buns"
                  maxLength={MAX_PRODUCT_NAME}
                  value={item.productName}
                  onChange={(e) => onChange(line, "productName", e.target.value)}
                  className={fieldClass(Boolean(errors[`${key}_productName`]))}
                />
                <CellError message={errors[`${key}_productName`]} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <div className="min-w-0">
                  <QuantityInput
                    value={item.quantity}
                    onChange={(v) => onChange(line, "quantity", v)}
                    hasError={Boolean(errors[`${key}_quantity`])}
                    label={`Quantity of product ${line + 1}`}
                  />
                  <CellError message={errors[`${key}_quantity`]} />
                </div>
                <select
                  aria-label={`Unit of product ${line + 1}`}
                  value={item.unit}
                  onChange={(e) => onChange(line, "unit", e.target.value)}
                  className={fieldClass(false)}
                >
                  {STOCK_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => onRemove(line)}
                aria-label={`Remove product ${line + 1}`}
                title="Remove this product"
                className="row-start-2 col-start-2 sm:row-start-auto sm:col-start-auto inline-flex min-h-tap min-w-tap md:pointer-fine:min-h-9 md:pointer-fine:min-w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onAdd}
            disabled={items.length >= MAX_ITEMS_PER_STOP}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:text-slate-400"
          >
            <Plus className="h-3.5 w-3.5" /> Add product
          </button>
          {total > 0 && <span className="text-[11px] text-slate-500">Total {total.toLocaleString("en-US")} units</span>}
        </div>
      </div>
      <CellError message={listError} />
    </div>
  );
}

// What the pickups load against what the drop-offs take, product by product.
// A difference is pointed out, not refused: a part load, or stock already on
// the truck, is real.
function LoadBalance({ pickups, deliveries }: { pickups: PickupRow[]; deliveries: DeliveryRow[] }) {
  const counted = (rows: { items: ItemRow[] }[]) =>
    rows.map((row) =>
      row.items
        .filter((item) => item.productName.trim() && parseQuantity(item.quantity) !== null)
        .map((item) => ({ productName: item.productName, quantity: parseQuantity(item.quantity) ?? 0, unit: item.unit })),
    );
  const rows = loadBalance(counted(pickups), counted(deliveries));
  if (rows.length === 0) return null;
  const off = rows.filter((row) => row.loaded !== row.dropped);

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold text-slate-900">Loaded vs dropped off</span>
        {off.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {off.length === 1 ? "1 product doesn't add up" : `${off.length} products don't add up`}. Check before saving.
          </span>
        ) : (
          <span className="text-[11px] font-medium text-emerald-700">Everything loaded is dropped off.</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-3 py-1.5 font-medium">Product</th>
              <th className="px-3 py-1.5 text-right font-medium">Loaded</th>
              <th className="px-3 py-1.5 text-right font-medium">Dropped off</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const mismatch = row.loaded !== row.dropped;
              return (
                <tr key={`${row.productName}|${row.unit}`} className={`border-t border-slate-100 ${mismatch ? "bg-amber-50 text-amber-900" : "text-slate-700"}`}>
                  <td className="px-3 py-1.5">{row.productName}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.loaded.toLocaleString("en-US")} {row.unit}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.dropped.toLocaleString("en-US")} {row.unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Whole numbers from 1 up. The browser's own arrows stop at 1, and a minus
// sign, decimal point or exponent cannot be typed.
function QuantityInput({
  value,
  onChange,
  hasError,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  hasError: boolean;
  label?: string;
}) {
  return (
    <input
      type="number"
      aria-label={label}
      inputMode="numeric"
      min={1}
      step={1}
      placeholder="0"
      value={value}
      onKeyDown={(e) => {
        if (["-", "+", "e", "E", ".", ","].includes(e.key)) e.preventDefault();
      }}
      onChange={(e) => onChange(e.target.value)}
      className={fieldClass(hasError)}
    />
  );
}
