"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationBell from "@/components/NotificationBell";

interface SharedHeaderProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  basePath: string; // e.g., "/admindashboard" or "/crewdashboard"
}

export default function SharedHeader({ isOpen, setIsOpen, basePath }: SharedHeaderProps) {
  const [avatarSeed, setAvatarSeed] = useState("User");

  useEffect(() => {
    const sessionData =
      localStorage.getItem("logisco_user_session") ||
      sessionStorage.getItem("logisco_user_session");

    if (sessionData) {
      try {
        const user = JSON.parse(sessionData);
        // Whose initials to draw, read out of the stored session.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAvatarSeed(user.employeeName || user.contactName || user.name || "User");
      } catch (error) {
        console.error("Failed to parse user session", error);
      }
    }
  }, []);

  return (
    <header className="h-16 bg-white shadow-sm flex justify-between items-center px-4 md:px-8 z-30 shrink-0 gap-4">
      <div className="flex items-center gap-3 w-full max-w-md min-w-0">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center bg-[#110031] text-white rounded-lg shadow-md hover:bg-[#1b0847] transition-colors shrink-0"
            aria-label="Open Menu"
          >
            <Menu className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}

        {/* Was an input with no handler: it did nothing when typed into. */}
        <GlobalSearch basePath={basePath} />
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4 md:space-x-6 shrink-0">
        <NotificationBell basePath={basePath} />

        <Link
          href={`${basePath}/profile`}
          className="w-11 h-11 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-blue-600 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer hover:opacity-90 transition block shrink-0"
          title="Profile Settings"
        >
          <img
            src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(avatarSeed)}`}
            alt="Avatar"
            className="w-full h-full object-cover bg-slate-200"
          />
        </Link>
      </div>
    </header>
  );
}