// File: components/Sidebaradmin.tsx (or wherever your sidebar component is)
"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Truck,
  UserSquare2,
  MapPin,
  FileText,
  LogOut,
  Calendar,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const getLinkClass = (path: string) => {
    const active = pathname === path;
    return `flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
      active
        ? "bg-blue-600 text-white shadow-md"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;
  };

  return (
    <aside className="w-64 bg-[#110031] text-white flex flex-col h-full shadow-2xl z-20 shrink-0">
      {/* User Profile Section */}
      <div className="flex flex-col items-center justify-center py-8 border-b border-slate-700/50">
        <div className="w-20 h-20 bg-slate-400 rounded-full mb-3 border-2 border-slate-300 overflow-hidden">
          <img
            src="https://api.dicebear.com/7.x/initials/svg?seed=Joanne"
            alt="Profile"
            className="w-full h-full object-cover bg-slate-200"
          />
        </div>
        <h2 className="font-bold text-lg tracking-wide">JOANNE PATERNO</h2>
        <p className="text-slate-400 text-xs font-semibold tracking-widest">
          ADMIN
        </p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <Link
          href="/admindashboard"
          className={getLinkClass("/admindashboard")}
        >
          <LayoutDashboard className="w-5 h-5 mr-3" />
          <span>Dashboard</span>
        </Link>

        <Link
          href="/admindashboard/calendar"
          className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
            pathname === "/admindashboard/calendar"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <div className="flex items-center">
            <Calendar className="w-5 h-5 mr-3" />
            <span>Calendar</span>
          </div>
        </Link>

        <Link
          href="/admindashboard/clients"
          className={getLinkClass("/admindashboard/clients")}
        >
          <Users className="w-5 h-5 mr-3" />
          <span>Clients & Partners</span>
        </Link>

        <Link
          href="/admindashboard/employees"
          className={getLinkClass("/admindashboard/employees")}
        >
          <UserSquare2 className="w-5 h-5 mr-3" />
          <span>Employee Directory</span>
        </Link>

        <Link
          href="/admindashboard/fleet-status"
          className={getLinkClass("/admindashboard/fleet-status")}
        >
          <Truck className="w-5 h-5 mr-3" />
          <span>Fleet Status</span>
        </Link>

        <Link
          href="/admindashboard/fleet-tracking"
          className={getLinkClass("/admindashboard/fleet-tracking")}
        >
          <MapPin className="w-5 h-5 mr-3" />
          <span>Fleet Live Tracking</span>
        </Link>

        <Link
          href="/admindashboard/reports"
          className={getLinkClass("/admindashboard/reports")}
        >
          <FileText className="w-5 h-5 mr-3" />
          <span>Reports & Forecast</span>
        </Link>
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-slate-700/50">
        <button className="flex items-center px-4 py-3 w-full text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition">
          <LogOut className="w-5 h-5 mr-3" />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
}
