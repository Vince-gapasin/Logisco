// File: components/Sidebaradmin.tsx
"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Truck,
  UserSquare2,
  MapPin,
  FileText,
  LogOut,
  Calendar,
  X,
  AlertTriangle,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // State to manage the Logout Modal popup visibility
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Helper to close sidebar after clicking a link on mobile screen widths
  const closeSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const getLinkClass = (path: string) => {
    const active = pathname === path;
    return `flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
      active
        ? "bg-blue-600 text-white shadow-md"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;
  };

  // Handler for confirming logout action
  const handleConfirmLogout = () => {
    // Add your signout logic here (e.g., supabase.auth.signOut())
    setIsLogoutModalOpen(false);
    router.push("/"); // Redirect user to home/login page after logout
  };

  return (
    <>
      {/* MOBILE DARK BACKDROP OVERLAY */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* THE SIDEBAR ASIDE */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 w-64 bg-[#000517] text-white flex flex-col h-full shadow-2xl shrink-0 transition-transform duration-300 ease-in-out ${
          isOpen
            ? "translate-x-0"
            : "-translate-x-full md:w-0 md:overflow-hidden"
        }`}
      >
        {/* X Close Button at the top-right corner inside the sidebar */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-300 hover:text-white transition-colors z-10"
          aria-label="Close Menu"
        >
          <X className="w-6 h-6" />
        </button>

        {/* User Profile Section */}
        <div className="flex flex-col items-center justify-center py-8 border-b border-slate-700/50 mt-8">
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
            href="/admindashboard/dashboard"
            className={getLinkClass("/admindashboard/dashboard")}
            onClick={closeSidebar}
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
            onClick={closeSidebar}
          >
            <div className="flex items-center">
              <Calendar className="w-5 h-5 mr-3" />
              <span>Calendar</span>
            </div>
          </Link>

          <Link
            href="/admindashboard/clients"
            className={getLinkClass("/admindashboard/clients")}
            onClick={closeSidebar}
          >
            <Users className="w-5 h-5 mr-3" />
            <span>Clients & Partners</span>
          </Link>

          <Link
            href="/admindashboard/employees"
            className={getLinkClass("/admindashboard/employees")}
            onClick={closeSidebar}
          >
            <UserSquare2 className="w-5 h-5 mr-3" />
            <span>Employee Directory</span>
          </Link>

          <Link
            href="/admindashboard/fleet-status"
            className={getLinkClass("/admindashboard/fleet-status")}
            onClick={closeSidebar}
          >
            <Truck className="w-5 h-5 mr-3" />
            <span>Fleet Status</span>
          </Link>

          <Link
            href="/admindashboard/fleet-tracking"
            className={getLinkClass("/admindashboard/fleet-tracking")}
            onClick={closeSidebar}
          >
            <MapPin className="w-5 h-5 mr-3" />
            <span>Fleet Live Tracking</span>
          </Link>

          <Link
            href="/admindashboard/reports"
            className={getLinkClass("/admindashboard/reports")}
            onClick={closeSidebar}
          >
            <FileText className="w-5 h-5 mr-3" />
            <span>Reports & Forecast</span>
          </Link>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center px-4 py-3 w-full text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* ================= LOGOUT CONFIRMATION MODAL ================= */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Icon */}
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4 mx-auto border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            {/* Modal Headings */}
            <h3 className="text-lg font-bold text-center text-slate-900 mb-1">
              Confirm Logout
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Are you sure you want to end your current session? You will need
              to log back in to access the admin portal.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 shadow-sm shadow-red-500/30 transition-colors"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
