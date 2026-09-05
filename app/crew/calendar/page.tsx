// File: app/crewdashboard/calendar/page.tsx
"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Clock,
  Calendar as CalendarIcon,
  Filter,
  Menu,
  X,
} from "lucide-react";

// ==========================================
// DUMMY DATA STRUCTURE
// ==========================================
export interface DeliveryEvent {
  id: string;
  date: string; // YYYY-MM-DD format
  clientName: string;
  timeWindow: string;
  status: "Completed" | "Pending";
}

const DUMMY_DELIVERIES: DeliveryEvent[] = [
  {
    id: "DEL-001",
    date: "2026-05-01",
    clientName: "Jollibee",
    timeWindow: "10:30 AM - 3:00 PM",
    status: "Completed",
  },
  {
    id: "DEL-002",
    date: "2026-05-01",
    clientName: "Bonchon",
    timeWindow: "5:00 PM - 9:00 PM",
    status: "Completed",
  },
  {
    id: "DEL-003",
    date: "2026-05-02",
    clientName: "Flash",
    timeWindow: "5:00 AM - 9:00 AM",
    status: "Pending",
  },
  {
    id: "DEL-004",
    date: "2026-05-02",
    clientName: "KFC",
    timeWindow: "2:00 PM - 6:00 PM",
    status: "Pending",
  },
];

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function CrewCalendarPage() {
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(4); // 4 = May
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [isMiniSidebarOpen, setIsMiniSidebarOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // For mobile single-day view

  const SIMULATED_TODAY = new Date(2026, 4, 1);

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

  const calendarCells = [];

  // Previous Month Disabled Dates
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
  }

  // Current Month Active Dates
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({ day: i, isCurrentMonth: true });
  }

  // Next Month Disabled Dates
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({ day: i, isCurrentMonth: false });
  }

  const weeklyColumns = [
    { name: "Mon", date: 27 },
    { name: "Tue", date: 28 },
    { name: "Wed", date: 29 },
    { name: "Thu", date: 30 },
    { name: "Fri", date: 1 },
    { name: "Sat", date: 2 },
    { name: "Sun", date: 3 },
  ];

  const hours = Array.from({ length: 24 }, (_, i) => {
    const ampm = i >= 12 ? "PM" : "AM";
    const displayHour = i % 12 === 0 ? 12 : i % 12;
    return `${displayHour} ${ampm}`;
  });

  const handlePrevDay = () => {
    setSelectedDayIndex((prev) => (prev > 0 ? prev - 1 : 6));
  };

  const handleNextDay = () => {
    setSelectedDayIndex((prev) => (prev < 6 ? prev + 1 : 0));
  };

  // ==========================================
  // DATE FORMATTING & FILTERING 
  // ==========================================
  const selectedDateObj = new Date(currentYear, currentMonth, selectedDay);
  const formattedMonthStr = String(currentMonth + 1).padStart(2, "0");
  const formattedDayStr = String(selectedDay).padStart(2, "0");
  const selectedDateString = `${currentYear}-${formattedMonthStr}-${formattedDayStr}`;
  
  const dailyDeliveries = DUMMY_DELIVERIES.filter((d) => d.date === selectedDateString);
  const totalDeliveries = dailyDeliveries.length;
  const completedDeliveries = dailyDeliveries.filter((d) => d.status === "Completed").length;
  
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const formattedDate = `${dayNames[selectedDateObj.getDay()]}, ${monthNames[currentMonth]} ${selectedDay}`;
  
  const diffTime = selectedDateObj.getTime() - SIMULATED_TODAY.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  let relativeLabel = "";
  if (diffDays === 0) relativeLabel = ", Today";
  else if (diffDays === 1) relativeLabel = ", Tomorrow";

  const handleDeliveryClick = (delivery: DeliveryEvent) => {
    console.log("Navigating to delivery details for:", delivery.clientName);
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
            className="p-1.5 rounded-lg text-slate-600 hover:bg-gray-100"
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
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} className="text-[11px] text-slate-500 font-semibold">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {calendarCells.map((cell, idx) => {
              const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
              return (
                <div key={idx} className="flex justify-center items-center h-8">
                  <button
                    onClick={() => cell.isCurrentMonth && setSelectedDay(cell.day)}
                    disabled={!cell.isCurrentMonth}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all font-semibold ${
                      !cell.isCurrentMonth
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                    } ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : ""
                    }`}
                  >
                    {cell.day}
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
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
              {completedDeliveries}/{totalDeliveries} Completed
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">{formattedDate}{relativeLabel}</p>
        </div>

        {/* Action Dispatch Buttons */}
        <div className="flex flex-col gap-3">
          <div className="px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Deliveries</div>
          {dailyDeliveries.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs font-medium border border-dashed border-gray-200 rounded-xl bg-white">
              No deliveries scheduled.
            </div>
          ) : (
            dailyDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                onClick={() => handleDeliveryClick(delivery)}
                className="flex items-start gap-3 p-3.5 bg-[#1e1b4b] rounded-xl text-white cursor-pointer hover:bg-opacity-95 transition-all shadow-sm group"
              >
                <div className="pt-1">
                  <div className={`w-3.5 h-3.5 rounded-full shadow-sm ${delivery.status === "Completed" ? "bg-[#90EE90]" : "bg-orange-400"}`}></div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-xs leading-tight tracking-wide">{delivery.clientName}</h4>
                  <p className="text-slate-300 text-[11px] mt-1 font-medium">{delivery.timeWindow}</p>
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
              className="p-2 -ml-2 rounded-lg text-slate-700 hover:bg-gray-100 lg:hidden"
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
              onClick={() => {
                setCurrentMonth(4);
                setCurrentYear(2026);
                setSelectedDay(1);
              }}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
            >
              Today
            </button>
            <button className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
              <Filter size={14} className="text-slate-500 shrink-0" /> Filter
            </button>
          </div>
        </div>

        {/* ================= MOBILE VIEW (Single Day View) ================= */}
        <div className="flex lg:hidden flex-col flex-1">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-slate-700 cursor-pointer"
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
              className="p-1.5 rounded-lg hover:bg-gray-200 text-slate-700 cursor-pointer"
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
                  className="h-16 border-b border-gray-100 w-full hover:bg-blue-50/25 transition-colors cursor-pointer relative"
                />
              ))}
            </div>
          </div>
        </div>

        {/* ================= DESKTOP VIEW (7-Column Weekly Grid) ================= */}
        <div className="hidden lg:flex flex-1 flex-col overflow-x-auto bg-white relative">
          <div className="min-w-187.5 flex flex-col flex-1">
            <div className="flex border-b border-gray-200 bg-white sticky top-0 z-20">
              <div className="w-20 shrink-0 border-r border-gray-100 bg-gray-50/50"></div>
              <div className="flex-1 grid grid-cols-7">
                {weeklyColumns.map((col, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col items-center justify-center py-3 border-r border-gray-100 last:border-r-0 ${
                      col.date === selectedDay ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      {col.name}
                    </span>
                    <span
                      onClick={() => setSelectedDay(col.date)}
                      className={`text-xl font-medium w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition-all ${
                        col.date === selectedDay
                          ? "bg-blue-600 text-white shadow-sm"
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
                {weeklyColumns.map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className="relative border-r border-gray-100 last:border-r-0 flex flex-col"
                  >
                    {hours.map((_, rowIdx) => (
                      <div
                        key={rowIdx}
                        className="h-16 border-b border-gray-100 w-full hover:bg-blue-50/20 transition-colors cursor-pointer"
                      />
                    ))}
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