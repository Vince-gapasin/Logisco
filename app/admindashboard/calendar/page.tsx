// File: app/admindashboard/calendar/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatTime } from "@/app/lib/datetime";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Clock,
  Calendar as CalendarIcon,
  Menu,
  X,
} from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import {
  isAwaitingAssignment,
  isAwaitingCrewConfirmation,
  mapOrderToBookingView,
  type BookingView,
  type OrderWithRelations,
} from "@/app/lib/bookingView";

// One hour row is h-16 (64px); events are positioned against that.
const HOUR_HEIGHT_PX = 64;
const DEFAULT_EVENT_TIME = "08:00";

// Where a booking at each stage is managed.
const STAGE_ROUTES: Record<string, string> = {
  Created: "/admindashboard/calendar/unassigned-bookings",
  Assigned: "/admindashboard/calendar/awaiting-confirmation",
  "In Transit": "/admindashboard/feeds/in-transit",
  Complete: "/admindashboard/feeds/completed",
  Returned: "/admindashboard/feeds/foul-trip",
};

const STAGE_STYLES: Record<string, string> = {
  Created: "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200",
  Assigned: "bg-blue-100 border-blue-300 text-blue-900 hover:bg-blue-200",
  "In Transit": "bg-indigo-100 border-indigo-300 text-indigo-900 hover:bg-indigo-200",
  Complete: "bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200",
  Returned: "bg-rose-100 border-rose-300 text-rose-900 hover:bg-rose-200",
};

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

interface CalendarEvent {
  id: string;
  orderId: string;
  clientName: string;
  stage: string;
  time: string;
  isoDate: string;
  topPx: number;
}

// The scheduled time comes from the first stop; fall back to a sane default.
function eventTime(booking: BookingView): string {
  const raw = booking.stops[0]?.expectedTime;
  return raw ? raw.slice(0, 5) : DEFAULT_EVENT_TIME;
}

function toCalendarEvent(booking: BookingView): CalendarEvent | null {
  if (!booking.scheduledDate) return null;

  const parsed = new Date(booking.scheduledDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const time = eventTime(booking);
  const [hours, minutes] = time.split(":").map(Number);

  return {
    id: booking.id,
    orderId: booking.orderId,
    clientName: booking.clientName,
    stage: booking.status,
    time,
    isoDate: toIsoDate(parsed),
    topPx: ((hours || 0) + (minutes || 0) / 60) * HOUR_HEIGHT_PX,
  };
}

export default function CalendarPage() {
  const router = useRouter();
  const [isMiniSidebarOpen, setIsMiniSidebarOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadBookings = useCallback(async () => {
    try {
      const orders = await apiFetch<OrderWithRelations[]>("/api/bookings");
      setBookings((orders ?? []).map(mapOrderToBookingView));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load bookings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // The rows land in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBookings();
  }, [loadBookings]);

  const todayIso = toIsoDate(new Date());

  const weeklyColumns = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = addDays(weekStart, index);
        return {
          name: day.toLocaleDateString("en-PH", { weekday: "short" }),
          date: day.getDate(),
          iso: toIsoDate(day),
        };
      }),
    [weekStart],
  );

  const monthLabel = useMemo(
    () => weekStart.toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
    [weekStart],
  );

  // Events for the visible week, grouped by day.
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    for (const booking of bookings) {
      const event = toCalendarEvent(booking);
      if (!event) continue;

      const list = grouped.get(event.isoDate) ?? [];
      list.push(event);
      grouped.set(event.isoDate, list);
    }

    for (const list of grouped.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return grouped;
  }, [bookings]);

  const unassignedCount = bookings.filter(isAwaitingAssignment).length;
  const awaitingCrewCount = bookings.filter(isAwaitingCrewConfirmation).length;
  const unscheduledCount = bookings.filter((booking) => !booking.scheduledDate).length;

  // Mini calendar for the month the visible week belongs to.
  const miniWeekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const miniMonth = useMemo(() => {
    const firstOfMonth = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const daysInMonth = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0).getDate();
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

    return {
      leadingBlanks,
      days: Array.from({ length: daysInMonth }, (_, index) => {
        const day = new Date(weekStart.getFullYear(), weekStart.getMonth(), index + 1);
        return { day: index + 1, iso: toIsoDate(day), date: day };
      }),
    };
  }, [weekStart]);

  const hours = Array.from({ length: 24 }, (_, i) => {
    const ampm = i >= 12 ? "PM" : "AM";
    const displayHour = i % 12 === 0 ? 12 : i % 12;
    return `${displayHour} ${ampm}`;
  });

  const handlePrevDay = () => {
    setSelectedDayIndex((prev) => {
      if (prev > 0) return prev - 1;
      setWeekStart((current) => addDays(current, -7));
      return 6;
    });
  };

  const handleNextDay = () => {
    setSelectedDayIndex((prev) => {
      if (prev < 6) return prev + 1;
      setWeekStart((current) => addDays(current, 7));
      return 0;
    });
  };

  const goToToday = () => {
    const now = new Date();
    setWeekStart(startOfWeek(now));
    setSelectedDayIndex((now.getDay() + 6) % 7);
  };

  const openEvent = (event: CalendarEvent) => {
    router.push(STAGE_ROUTES[event.stage] ?? "/admindashboard/feeds/pending");
  };

  const renderEvent = (event: CalendarEvent, compact = false) => (
    <button
      key={event.id}
      type="button"
      onClick={() => openEvent(event)}
      style={{ top: `${event.topPx}px` }}
      title={`${event.orderId} - ${event.clientName} (${event.stage})`}
      className={`absolute left-1 right-1 z-10 rounded-lg border px-2 py-1 text-left shadow-sm transition-colors cursor-pointer ${
        STAGE_STYLES[event.stage] ?? "bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200"
      }`}
    >
      <span className="block text-xs sm:text-[11px] font-semibold truncate">
        {formatTime(event.time)} {event.clientName}
      </span>
      {!compact && <span className="block text-xs sm:text-[10px] opacity-80 truncate">{event.orderId}</span>}
    </button>
  );

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
            className="p-1.5 rounded-lg text-slate-600 hover:bg-gray-100"
            aria-label="Close Calendar Menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mini Calendar Header & Grid */}
        <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-slate-900">{monthLabel}</h2>
            <div className="flex gap-1 text-slate-600">
              <button
                aria-label="Previous Month"
                onClick={() => setWeekStart((current) => addDays(current, -28))}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                aria-label="Next Month"
                onClick={() => setWeekStart((current) => addDays(current, 28))}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {miniWeekDays.map((d) => (
              <div key={d} className="text-xs sm:text-[11px] text-slate-500 font-semibold">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {Array.from({ length: miniMonth.leadingBlanks }, (_, index) => (
              <div key={`blank-${index}`} className="p-1.5" />
            ))}

            {miniMonth.days.map(({ day, iso, date }) => {
              const isInWeek = weeklyColumns.some((column) => column.iso === iso);
              const hasEvents = (eventsByDate.get(iso)?.length ?? 0) > 0;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setWeekStart(startOfWeek(date));
                    setSelectedDayIndex((date.getDay() + 6) % 7);
                    setIsMiniSidebarOpen(false);
                  }}
                  className={`p-1.5 cursor-pointer rounded-full transition-colors relative ${
                    iso === todayIso
                      ? "bg-blue-600 text-white font-semibold shadow-sm"
                      : isInWeek
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-slate-800 hover:bg-gray-100"
                  }`}
                >
                  {day}
                  {hasEvents && iso !== todayIso && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Dispatch & Confirmation Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() =>
              router.push("/admindashboard/calendar/unassigned-bookings")
            }
            className="flex items-center gap-3 w-full px-4 py-3 bg-white text-slate-800 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium text-left group cursor-pointer"
          >
            <Inbox
              size={18}
              className="text-orange-500 group-hover:scale-110 transition-transform shrink-0"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900">
                Unassigned Bookings
              </span>
              <span className="text-xs sm:text-[11px] text-slate-500 font-normal">
                {unassignedCount} pending assignment
              </span>
            </div>
          </button>

          <button
            onClick={() =>
              router.push("/admindashboard/calendar/awaiting-confirmation")
            }
            className="flex items-center gap-3 w-full px-4 py-3 bg-white text-slate-800 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium text-left group cursor-pointer"
          >
            <Clock
              size={18}
              className="text-blue-500 group-hover:scale-110 transition-transform shrink-0"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900">
                Awaiting Crew Confirmation
              </span>
              <span className="text-xs sm:text-[11px] text-slate-500 font-normal">
                {awaitingCrewCount} awaiting response
              </span>
            </div>
          </button>

          {unscheduledCount > 0 && (
            <p className="text-xs sm:text-[11px] text-slate-500 px-1">
              {unscheduledCount} booking{unscheduledCount === 1 ? "" : "s"} have no delivery
              schedule and do not appear on the calendar.
            </p>
          )}
        </div>
      </aside>

      {/* ========================================== */}
      {/* 2. MAIN CALENDAR VIEW CANVAS               */}
      {/* ========================================== */}
      <main className="flex flex-col flex-1 min-w-0 bg-white relative">
        {/* Calendar Toolbar / Controls */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile trigger button to open the mini-calendar drawer */}
            <button
              onClick={() => setIsMiniSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-700 hover:bg-gray-100 lg:hidden"
              aria-label="Open Calendar Menu"
            >
              <Menu size={20} />
            </button>

            <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="text-blue-600 shrink-0" size={22} />
              <span className="truncate">{monthLabel}</span>
            </h1>
            {isLoading && <span className="text-xs text-slate-500">Loading...</span>}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setWeekStart((current) => addDays(current, -7))}
              className="p-2 text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToToday}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart((current) => addDays(current, 7))}
              className="p-2 text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {loadError && (
          <div className="mx-4 sm:mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs">
            {loadError}
          </div>
        )}

        {/* MOBILE VIEW (Single Day View) */}
        <div className="flex lg:hidden flex-col flex-1">
          {/* Mobile Day Navigation Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-slate-700"
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
              className="p-1.5 rounded-lg hover:bg-gray-200 text-slate-700"
              aria-label="Next Day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Mobile Hourly Timeline (1 Column) */}
          <div className="flex-1 bg-white flex">
            {/* Time Column */}
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

            {/* Selected Single Day Slots */}
            <div className="flex-1 flex flex-col relative">
              {hours.map((_, rowIdx) => (
                <div
                  key={rowIdx}
                  className="h-16 border-b border-gray-100 w-full hover:bg-blue-50/25 transition-colors relative"
                />
              ))}

              {(eventsByDate.get(weeklyColumns[selectedDayIndex].iso) ?? []).map((event) =>
                renderEvent(event),
              )}
            </div>
          </div>
        </div>

        {/* ================= DESKTOP VIEW (7-Column Weekly Grid with min-width guard) ================= */}
        <div className="hidden lg:flex flex-1 flex-col overflow-x-auto bg-white relative">
          <div className="min-w-187.5 flex flex-col flex-1">
            {/* Sticky Days Header */}
            <div className="flex border-b border-gray-200 bg-white sticky top-0 z-20">
              <div className="w-20 shrink-0 border-r border-gray-100 bg-gray-50/50"></div>
              <div className="flex-1 grid grid-cols-7">
                {weeklyColumns.map((col) => {
                  const isToday = col.iso === todayIso;

                  return (
                    <div
                      key={col.iso}
                      className={`flex flex-col items-center justify-center py-3 border-r border-gray-100 last:border-r-0 ${
                        isToday ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <span className="text-xs sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {col.name}
                      </span>
                      <span
                        className={`text-xl font-medium w-9 h-9 flex items-center justify-center rounded-full ${
                          isToday ? "bg-blue-600 text-white shadow-sm" : "text-slate-900"
                        }`}
                      >
                        {col.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Time Grid Body */}
            <div className="flex flex-1 bg-white relative">
              {/* Left Time Markers Column */}
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

              {/* 7-Column Grid Canvas */}
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

                    {(eventsByDate.get(col.iso) ?? []).map((event) => renderEvent(event, true))}
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
