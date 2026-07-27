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

export default function CalendarPage() {
  const [currentMonth] = useState("August 2026");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // For mobile single-day view

  const miniWeekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const miniCalendarDays = Array.from({ length: 31 }, (_, i) => i + 1);

  const weeklyColumns = [
    { name: "Mon", date: 1 },
    { name: "Tue", date: 2 },
    { name: "Wed", date: 3 },
    { name: "Thu", date: 4 },
    { name: "Fri", date: 5 },
    { name: "Sat", date: 6 },
    { name: "Sun", date: 7 },
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

  return (
    <div className="flex h-screen lg:h-[calc(100vh-4rem)] w-full bg-white text-slate-800 overflow-hidden font-sans relative">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ========================================== */}
      {/* LEFT SIDEBAR (Responsive Drawer)           */}
      {/* ========================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 border-r border-gray-200 flex flex-col p-5 bg-white lg:bg-gray-50/40 h-full overflow-y-auto transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Mobile Close Button */}
        <div className="flex items-center justify-between lg:hidden mb-4">
          <span className="font-bold text-slate-800">Menu</span>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mini Calendar Header & Grid */}
        <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-slate-800">
              {currentMonth}
            </h2>
            <div className="flex gap-1 text-slate-600">
              <button
                aria-label="Previous Month"
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                aria-label="Next Month"
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {miniWeekDays.map((d) => (
              <div key={d} className="text-[11px] text-slate-400 font-semibold">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            <div className="p-1.5 text-slate-300">27</div>
            <div className="p-1.5 text-slate-300">28</div>
            <div className="p-1.5 text-slate-300">29</div>
            <div className="p-1.5 text-slate-300">30</div>
            <div className="p-1.5 text-slate-300">31</div>

            {miniCalendarDays.map((day) => (
              <div
                key={day}
                className={`p-1.5 cursor-pointer rounded-full transition-colors ${
                  day === 1
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "text-slate-700 hover:bg-gray-100"
                }`}
              >
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Action Dispatch & Confirmation Buttons */}
        <div className="flex flex-col gap-3">
          <button className="flex items-center gap-3 w-full px-4 py-3 bg-white text-slate-700 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium text-left group">
            <Inbox
              size={18}
              className="text-orange-500 group-hover:scale-110 transition-transform shrink-0"
            />
            <div className="flex flex-col">
              <span>Unassigned Bookings</span>
              <span className="text-[11px] text-slate-400 font-normal">
                0 pending assignment
              </span>
            </div>
          </button>

          <button className="flex items-center gap-3 w-full px-4 py-3 bg-white text-slate-700 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:bg-gray-50 transition-all text-sm font-medium text-left group">
            <Clock
              size={18}
              className="text-blue-500 group-hover:scale-110 transition-transform shrink-0"
            />
            <div className="flex flex-col">
              <span>Awaiting Crew Confirmation</span>
              <span className="text-[11px] text-slate-400 font-normal">
                0 awaiting response
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* ========================================== */}
      {/* MAIN CALENDAR VIEW (This is already Responsive)            */}
      {/* ========================================== */}
      <main className="flex flex-col flex-1 h-full w-full bg-white relative overflow-hidden">
        {/* Calendar Toolbar / Controls */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-gray-100 lg:hidden"
              aria-label="Open Sidebar"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarIcon className="text-blue-600 shrink-0" size={22} />
              <span className="truncate">{currentMonth}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
              Today
            </button>
            <button className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
              <Filter size={14} className="text-slate-500 shrink-0" /> Filter
            </button>
          </div>
        </div>

        {/* ================= MOBILE VIEW (Single Day View + Nav for the mini calendar and the 2 buttons) ================= */}
        <div className="flex lg:hidden flex-col flex-1 overflow-hidden">
          {/* Mobile Day Navigation Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-slate-600"
              aria-label="Previous Day"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 font-semibold text-sm text-slate-800">
              <span className="text-blue-600">
                {weeklyColumns[selectedDayIndex].name}
              </span>
              <span>{weeklyColumns[selectedDayIndex].date}</span>
            </div>
            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-slate-600"
              aria-label="Next Day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Mobile Hourly Timeline (1 Column) */}
          <div className="flex-1 overflow-y-auto bg-white flex">
            {/* Time Column */}
            <div className="w-20 shrink-0 flex flex-col border-r border-gray-100 bg-white">
              {hours.map((hour, idx) => (
                <div
                  key={idx}
                  className="h-16 border-b border-transparent relative"
                >
                  <span className="absolute -top-2.5 right-3 text-xs font-medium text-slate-400">
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
                  className="h-16 border-b border-gray-100 w-full hover:bg-blue-50/25 transition-colors cursor-pointer relative"
                >
                  {/* Slot content hook */}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= DESKTOP VIEW (7-Column Weekly Grid) ================= */}
        <div className="hidden lg:flex flex-1 flex-col overflow-hidden bg-white relative">
          {/* Sticky Days Header */}
          <div className="flex border-b border-gray-200 bg-white sticky top-0 z-20">
            <div className="w-20 shrink-0 border-r border-gray-100 bg-gray-50/50"></div>
            <div className="flex-1 grid grid-cols-7">
              {weeklyColumns.map((col, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col items-center justify-center py-3 border-r border-gray-100 last:border-r-0 ${
                    idx === 0 ? "bg-blue-50/40" : ""
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {col.name}
                  </span>
                  <span
                    className={`text-xl font-medium w-9 h-9 flex items-center justify-center rounded-full ${
                      idx === 0
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-700"
                    }`}
                  >
                    {col.date}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable Time Grid Body */}
          <div className="flex flex-1 overflow-y-auto bg-white relative">
            {/* Left Time Markers Column */}
            <div className="w-20 shrink-0 flex flex-col bg-white border-r border-gray-100 z-10 sticky left-0">
              {hours.map((hour, idx) => (
                <div
                  key={idx}
                  className="h-16 border-b border-transparent relative"
                >
                  <span className="absolute -top-2.5 right-3 text-xs font-medium text-slate-400">
                    {idx === 0 ? "" : hour}
                  </span>
                </div>
              ))}
            </div>

            {/* 7-Column Grid Canvas */}
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
                    >
                      {/* Empty cell slot ready to accept dynamic booking/delivery cards */}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
