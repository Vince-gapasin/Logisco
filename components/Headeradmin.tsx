// File: components/Headeradmin.tsx
"use client";
import React from "react";
import Link from "next/link";
import { Search, Bell, Menu } from "lucide-react";

interface HeaderProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Header({ isOpen, setIsOpen }: HeaderProps) {
  return (
    <header className="h-16 bg-white shadow-sm flex justify-between items-center px-4 md:px-8 z-30 shrink-0 gap-4">
      {/* Search Input Bar & Conditional Hamburger Trigger */}
      <div className="flex items-center gap-3 w-full max-w-md">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 bg-[#110031] text-white rounded-lg shadow-md hover:bg-[#1b0847] transition-colors shrink-0"
            aria-label="Open Menu"
          >
            <Menu className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}

        <div className="relative w-full max-w-50 sm:max-w-xs md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-gray-100/80 text-xs md:text-sm text-gray-700 rounded-full pl-9 md:pl-10 pr-4 py-2 md:py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center space-x-2 sm:space-x-4 md:space-x-6 shrink-0">
        <Link
          href="/admindashboard/notifications"
          className="relative cursor-pointer hover:bg-gray-100 p-2 rounded-full transition flex items-center justify-center"
          title="Notifications"
        >
          <Bell className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
        </Link>

        <Link
          href="/admindashboard/profile"
          className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:opacity-90 transition block shrink-0"
          title="Profile Settings"
        >
          <img
            src="https://api.dicebear.com/7.x/initials/svg?seed=Joanne"
            alt="Avatar"
            className="w-full h-full object-cover bg-slate-200"
          />
        </Link>
      </div>
    </header>
  );
}
