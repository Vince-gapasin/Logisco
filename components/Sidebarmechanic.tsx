// ==========================================
// LOGISCO - MECHANIC SIDEBAR
// ==========================================
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Truck,
  MapPin,
  Wrench,
  FileText,
  LogOut,
  X,
  AlertTriangle,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function SidebarMechanic({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // State to manage the Logout Modal popup visibility
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Helper to close sidebar after clicking any navigation link
  const closeSidebar = () => {
    setIsOpen(false);
  };

  const getLinkClass = (path: string) => {
    const active = pathname === path;
    return `flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
      active
        ? "bg-[#0D1A63] text-white shadow-lg shadow-[#0D1A63]/30 border border-blue-500/30 font-semibold"
        : "text-[#8ba4d5] hover:bg-blue-600/20 hover:text-white"
    }`;
  };

  // Handler for confirming logout action
  const handleConfirmLogout = () => {
    // 🔑 CRITICAL FIX: Clear auto-login and session storage keys
    localStorage.removeItem("logisco_user_session");
    sessionStorage.removeItem("logisco_user_session");

    setIsLogoutModalOpen(false);
    setIsOpen(false);
    router.push("/"); // Redirect user to login page after logout
  };

  return (
    <>
      {/* DARK BACKDROP OVERLAY */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* THE SIDEBAR ASIDE */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#000208] border-r border-slate-950 text-[#f0f4ff] flex flex-col h-full shadow-2xl shrink-0 transition-transform duration-300 ease-in-out overflow-hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Subtle Ambient Glow Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-950/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-950/20 rounded-full blur-3xl"></div>
        </div>

        {/* X Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 text-[#8ba4d5] hover:text-white transition-colors z-20 cursor-pointer"
          aria-label="Close Menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Refined User Profile Section */}
        <div className="relative z-10 flex flex-col items-center justify-center py-8 border-b border-slate-950 mt-6 px-4 text-center">
          <div className="w-18 h-18 bg-black border border-slate-900 rounded-2xl mb-3 overflow-hidden shadow-inner flex items-center justify-center">
            <img
              src="https://api.dicebear.com/7.x/initials/svg?seed=JD"
              alt="Mechanic Profile"
              className="w-full h-full object-cover bg-slate-200"
            />
          </div>
          <h2 className="font-bold text-base tracking-wide text-[#f0f4ff]">
            JUAN DELA CRUZ
          </h2>
          <p className="text-[#8ba4d5] text-[11px] font-semibold tracking-[0.2em] mt-0.5">
            MECHANIC
          </p>
        </div>

        {/* Navigation Menu */}
        <nav className="relative z-10 flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          <Link
            href="/mechanic/fleet-status"
            className={getLinkClass("/mechanic/fleet-status")}
            onClick={closeSidebar}
          >
            <Truck className="w-5 h-5 mr-3 shrink-0" />
            <span>Fleet Status</span>
          </Link>

          <Link
            href="/mechanic/fleet-tracking"
            className={getLinkClass("/mechanic/fleet-tracking")}
            onClick={closeSidebar}
          >
            <MapPin className="w-5 h-5 mr-3 shrink-0" />
            <span>Fleet Live Tracking</span>
          </Link>

          <Link
            href="/mechanic/history-logs"
            className={getLinkClass("/mechanic/history-logs")}
            onClick={closeSidebar}
          >
            <FileText className="w-5 h-5 mr-3 shrink-0" />
            <span>History Logs</span>
          </Link>
        </nav>

        {/* Logout Button */}
        <div className="relative z-10 p-4 border-t border-slate-950">
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center px-4 py-3 w-full text-[#8ba4d5] hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent rounded-xl transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5 mr-3 shrink-0" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* ================= LOGOUT CONFIRMATION MODAL ================= */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#000208] border border-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-[#f0f4ff] animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Icon */}
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4 mx-auto border border-red-500/20 shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>

            {/* Modal Headings */}
            <h3 className="text-lg font-bold text-center text-[#f0f4ff] mb-1">
              Confirm Logout
            </h3>
            <p className="text-sm text-[#8ba4d5] text-center mb-6">
              Are you sure you want to end your current session? You will need
              to log back in to access the mechanic portal.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-900 bg-black text-sm font-semibold text-[#8ba4d5] hover:text-white hover:border-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-500 shadow-lg shadow-red-600/30 transition-colors cursor-pointer"
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
