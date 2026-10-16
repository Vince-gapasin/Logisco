// ==========================================
// LOGISCO - LOGOUT CONFIRMATION
// ==========================================
// "Are you sure?" before a session ends. Opened from the header's account menu.
"use client";

import { releasePushToken } from "@/components/PushNotifications";

import React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface LogoutDialogProps {
  /** Named in the warning: "...to access the crew portal." */
  portalName: string;
  onClose: () => void;
}

export default function LogoutDialog({ portalName, onClose }: LogoutDialogProps) {
  const router = useRouter();

  const handleConfirmLogout = async () => {
    // The phone stops receiving this person's notifications.
    await releasePushToken();

    // Clear auto-login and session storage keys.
    localStorage.removeItem("logisco_user_session");
    sessionStorage.removeItem("logisco_user_session");

    onClose();
    router.push("/");
  };

  // Onto the body: opened from the header, it would otherwise sit inside the
  // header's stacking layer and under anything layered above it.
  return createPortal(
    <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#000208] border border-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-[#f0f4ff] animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4 mx-auto border border-red-500/20 shadow-inner">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-center text-[#f0f4ff] mb-1">
          Confirm Logout
        </h3>
        <p className="text-sm text-[#8ba4d5] text-center mb-6">
          Are you sure you want to end your current session? You will need
          to log back in to access the {portalName} portal.
        </p>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
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
    </div>,
    document.body,
  );
}
