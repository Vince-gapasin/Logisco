// File: app/crew/calendar/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Menu,
  X,
} from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";

// ==========================================
// DATA
// ==========================================
export interface DeliveryEvent {
  id: string;
  date: string; // YYYY-MM-DD
  clientName: string;
  bookingId: string;
  timeWindow: string;
  status: "Completed" | "Pending";
  startTime: string;
}

// One hour row is h-16 (64px); events are positioned against that.
const HOUR_HEIGHT_PX = 64;
const DEFAULT_EVENT_TIME = "08:00";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Monday of the week containing the given date.
function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// The crew API returns each dispatch with its schedule and stop times.
function toDeliveryEvent(record: any): DeliveryEvent | null {
  if (!record?.scheduledDate) return null;

  const parsed = new Date(record.scheduledDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const firstStopTime: string | undefined = record.multipleDeliveries?.[0]?.deliveryTime;
  const status = String(record.status ?? "").toLowerCase();

  return {
    id: String(record.id),
    date: toIsoDate(parsed),
    clientName: record.clientName || "Unknown Client",
    bookingId: record.bookingId || "",
    timeWindow: record.timeWindow || "Time to be confirmed",
    status: status === "completed" ? "Completed" : "Pending",
    startTime: firstStopTime ? String(firstStopTime).slice(0, 5) : DEFAULT_EVENT_TIME,
  };
}

export default function CrewCalendarPage() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [isMiniSidebarOpen, setIsMiniSidebarOpen] = useState(false);

  const [deliveries, setDeliveries] = useState<DeliveryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDeliveries = useCallback(async () => {
    try {
      const records = await apiFetch<any[]>("/api/crew/dispatches");
      setDeliveries((records ?? []).map(toDeliveryEvent).filter(Boolean) as DeliveryEvent[]);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load your schedule.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(1);
  };

  // ==========================================
  // CALENDAR GENERATION LOGIC
  // ==========================================
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const calendarCells: { day: number; isCurrentMonth: boolean }[] = [];

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({ day: i, isCurrentMonth: true });
  }
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({ day: i, isCurrentMonth: false });
  }

  // Deliveries grouped by day, so the calendar can mark days that have work.
  const deliveriesByDate = useMemo(() => {
    const grouped = new Map<string, DeliveryEvent[]>();
    for (const delivery of deliveries) {
      const list = grouped.get(delivery.date) ?? [];
      list.push(delivery);
      grouped.set(delivery.date, list);
    }
    for (const list of grouped.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return grouped;
  }, [deliveries]);

  const selectedDateObj = new Date(currentYear, currentMonth, selectedDay);
  const selectedDateString = toIsoDate(selectedDateObj);
  const todayIso = toIsoDate(today);

  const dailyDeliveries = deliveriesByDate.get(selectedDateString) ?? [];
  const totalDeliveries = dailyDeliveries.length;
  const completedDeliveries = dailyDeliveries.filter((d) => d.status === "Completed").length;

  // The week containing the selected day. Keyed on the date string because a
  // Date object is a new value on every render.
  const weeklyColumns = useMemo(() => {
    const weekStart = startOfWeek(new Date(currentYear, currentMonth, selectedDay));
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(weekStart, index);
      return {
        name: day.toLocaleDateString("en-PH", { weekday: "short" }),
        date: day.getDate(),
        iso: toIsoDate(day),
        full: day,
      };
    });
  }, [currentYear, currentMonth, selectedDay]);

  const selectedDayIndex = Math.max(
    0,
    weeklyColumns.findIndex((column) => column.iso === selectedDateString),
  );

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const formattedDate = `${dayNames[selectedDateObj.getDay()]}, ${monthNames[currentMonth]} ${selectedDay}`;

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round(
    (selectedDateObj.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
  let relativeLabel = "";
  if (diffDays === 0) relativeLabel = ", Today";
  else if (diffDays === 1) relativeLabel = ", Tomorrow";
  else if (diffDays === -1) relativeLabel = ", Yesterday";

  const hours = Array.from({ length: 24 }, (_, i) => {
    const ampm = i >= 12 ? "PM" : "AM";
    const displayHour = i % 12 === 0 ? 12 : i % 12;
    return `${displayHour} ${ampm}`;
  });

  const selectDate = (date: Date) => {
    setCurrentYear(date.getFullYear());
    setCurrentMonth(date.getMonth());
    setSelectedDay(date.getDate());
  };

  const handlePrevDay = () => selectDate(addDays(selectedDateObj, -1));
  const handleNextDay = () => selectDate(addDays(selectedDateObj, 1));

  // Deliveries are acted on from the crew dashboard.
  const handleDeliveryClick = () => router.push("/crew/dashboard");

  const renderEvent = (delivery: DeliveryEvent) => {
    const [hoursPart, minutesPart] = delivery.startTime.split(":").map(Number);
    const top = ((hoursPart || 0) + (minutesPart || 0) / 60) * HOUR_HEIGHT_PX;

    return (
      <button
        key={delivery.id}
        type="button"
        onClick={handleDeliveryClick}
        style={{ top: `${top}px` }}
        title={`${delivery.bookingId} - ${delivery.clientName}`}
        className={`absolute left-1 right-1 z-10 rounded-lg border px-2 py-1 text-left shadow-sm transition-colors cursor-pointer ${
          delivery.status === "Completed"
            ? "bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200"
            : "bg-orange-100 border-orange-300 text-orange-900 hover:bg-orange-200"
        }`}
      >
        <span className="block text-xs font-semibold truncate">
          {delivery.startTime} {delivery.clientName}
        </span>
      </button>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full bg-white text-slate-800 font-sans relative">
      {/* Mobile Backdrop for Mini-Calendar Drawer */}
      {isMiniSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden"
          onClick={() => setIsMiniSidebarOpen(false)}
        />
      )}

      {/* ========================================== */}
      {/* 1. MINI-CALENDAR & ACTIONS SIDEBAR */}
      {/* ========================================== */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-20 w-80 border-r border-gray-200 flex flex-col p-5 bg-white lg:bg-gray-50/40 h-full overflow-y-auto shrink-0 transition-transform duration-300 ease-in-out ${
          isMiniSidebarOpen
            ? "translate-x-0 shadow-2xl z-40"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Mobile Close Button */}
        <div className="flex items-center justify-between lg:hidden mb-4">
          <span className="font-bold text-slate-900">Calendar Menu</span>
          <button
            onClick={() => setIsMiniSidebarOpen(false)}
            className="p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-gray-100"
            aria-label="Close Calendar Menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mini Calendar Header & Grid */}
        <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-slate-900">
              {monthNames[currentMonth]} {currentYear}
            </h2>
            <div className="flex gap-1 text-slate-600">
              <button
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} className="text-xs text-slate-500 font-semibold py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {calendarCells.map((cell, idx) => {
              const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
              const cellIso = cell.isCurrentMonth
                ? toIsoDate(new Date(currentYear, currentMonth, cell.day))
                : "";
              const hasDeliveries = cellIso ? deliveriesByDate.has(cellIso) : false;

              return (
                <div key={idx} className="flex justify-center items-center h-11 sm:h-8">
                  <button
                    onClick={() => cell.isCurrentMonth && setSelectedDay(cell.day)}
                    disabled={!cell.isCurrentMonth}
                    className={`w-11 h-11 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all font-semibold relative ${
                      !cell.isCurrentMonth
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                    } ${isSelected ? "bg-blue-600 text-white shadow-sm" : ""} ${
                      !isSelected && cellIso === todayIso ? "ring-1 ring-blue-400" : ""
                    }`}
                  >
                    {cell.day}
                    {hasDeliveries && !isSelected && (
                      <span className="absolute bottom-1 sm:bottom-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 sm:h-1 sm:w-1 rounded-full bg-orange-500" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status / Completion Tracker Card */}
        <div className="mb-6 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 text-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-700">Selected Date Stats</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
              {completedDeliveries}/{totalDeliveries} Completed
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">{formattedDate}{relativeLabel}</p>
        </div>

        {/* Scheduled Deliveries */}
        <div className="flex flex-col gap-3">
          <div className="px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Deliveries</div>

          {loadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-xs">
              {loadError}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-6 text-slate-400 text-xs font-medium border border-dashed border-gray-200 rounded-xl bg-white">
              Loading your schedule...
            </div>
          ) : dailyDeliveries.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs font-medium border border-dashed border-gray-200 rounded-xl bg-white">
              No deliveries scheduled.
            </div>
          ) : (
            dailyDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                onClick={handleDeliveryClick}
                className="flex items-start gap-3 p-3.5 bg-[#1e1b4b] rounded-xl text-white cursor-pointer hover:bg-opacity-95 transition-all shadow-sm group"
              >
                <div className="pt-1">
                  <div className={`w-3.5 h-3.5 rounded-full shadow-sm ${delivery.status === "Completed" ? "bg-[#90EE90]" : "bg-orange-400"}`}></div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-xs leading-tight tracking-wide">{delivery.clientName}</h4>
                  <p className="text-slate-300 text-xs mt-1 font-medium">{delivery.timeWindow}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ========================================== */}
      {/* 2. MAIN CALENDAR VIEW CANVAS */}
      {/* ========================================== */}
      <main className="flex flex-col flex-1 min-w-0 bg-white relative">
        {/* Calendar Toolbar / Controls */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMiniSidebarOpen(true)}
              className="p-2 -ml-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-gray-100 lg:hidden"
              aria-label="Open Calendar Menu"
            >
              <Menu size={20} />
            </button>

            <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="text-blue-600 shrink-0" size={22} />
              <span className="truncate">{monthNames[currentMonth]} {currentYear}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => selectDate(new Date())}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>

        {/* ================= MOBILE VIEW (Single Day View) ================= */}
        <div className="flex lg:hidden flex-col flex-1">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
            <button
              onClick={handlePrevDay}
              className="p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center rounded-lg hover:bg-gray-200 text-slate-700 cursor-pointer"
              aria-label="Previous Day"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
              <span className="text-blue-600">
                {weeklyColumns[selectedDayIndex].name}
              </span>
              <span>{weeklyColumns[selectedDayIndex].date}</span>
            </div>
            <button
              onClick={handleNextDay}
              className="p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center rounded-lg hover:bg-gray-200 text-slate-700 cursor-pointer"
              aria-label="Next Day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex-1 bg-white flex">
            <div className="w-20 shrink-0 flex flex-col border-r border-gray-100 bg-white">
              {hours.map((hour, idx) => (
                <div
                  key={idx}
                  className="h-16 border-b border-transparent relative"
                >
                  <span className="absolute -top-2.5 right-3 text-xs font-medium text-slate-500">
                    {idx === 0 ? "" : hour}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col relative">
              {hours.map((_, rowIdx) => (
                <div
                  key={rowIdx}
                  className="h-16 border-b border-gray-100 w-full hover:bg-blue-50/25 transition-colors relative"
                />
              ))}

              {(deliveriesByDate.get(selectedDateString) ?? []).map(renderEvent)}
            </div>
          </div>
        </div>

        {/* ================= DESKTOP VIEW (7-Column Weekly Grid) ================= */}
        <div className="hidden lg:flex flex-1 flex-col overflow-x-auto bg-white relative">
          <div className="min-w-187.5 flex flex-col flex-1">
            <div className="flex border-b border-gray-200 bg-white sticky top-0 z-20">
              <div className="w-20 shrink-0 border-r border-gray-100 bg-gray-50/50"></div>
              <div className="flex-1 grid grid-cols-7">
                {weeklyColumns.map((col) => (
                  <div
                    key={col.iso}
                    className={`flex flex-col items-center justify-center py-3 border-r border-gray-100 last:border-r-0 ${
                      col.iso === selectedDateString ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      {col.name}
                    </span>
                    <span
                      onClick={() => selectDate(col.full)}
                      className={`text-xl font-medium w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition-all ${
                        col.iso === selectedDateString
                          ? "bg-blue-600 text-white shadow-sm"
                          : col.iso === todayIso
                            ? "text-blue-700 ring-1 ring-blue-300"
                            : "text-slate-900 hover:bg-gray-100"
                      }`}
                    >
                      {col.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-1 bg-white relative">
              <div className="w-20 shrink-0 flex flex-col bg-white border-r border-gray-100 z-10 sticky left-0">
                {hours.map((hour, idx) => (
                  <div
                    key={idx}
                    className="h-16 border-b border-transparent relative"
                  >
                    <span className="absolute -top-2.5 right-3 text-xs font-medium text-slate-500">
                      {idx === 0 ? "" : hour}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-7 relative">
                {weeklyColumns.map((col) => (
                  <div
                    key={col.iso}
                    className="relative border-r border-gray-100 last:border-r-0 flex flex-col"
                  >
                    {hours.map((_, rowIdx) => (
                      <div
                        key={rowIdx}
                        className="h-16 border-b border-gray-100 w-full hover:bg-blue-50/20 transition-colors"
                      />
                    ))}

                    {(deliveriesByDate.get(col.iso) ?? []).map(renderEvent)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
