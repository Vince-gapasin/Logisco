"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationBell from "@/components/NotificationBell";
import LogoutDialog from "@/components/LogoutDialog";
import { PORTAL_NAV, type Portal } from "@/components/portalNav";
import { describeRole, useSessionUser } from "@/app/lib/useSessionUser";

interface SharedHeaderProps {
  portal: Portal;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  basePath: string; // e.g., "/admindashboard" or "/crewdashboard"
}

export default function SharedHeader({ portal, isOpen, setIsOpen, basePath }: SharedHeaderProps) {
  // Whose initials to draw. This had its own copy of reading the session, which
  // is how three screens came to disagree about who was signed in.
  const user = useSessionUser();
  const avatarSeed = user?.name ?? "User";

  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Shut on a click anywhere else, or on Escape (focus back on the avatar).
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setIsMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  // A page change from anywhere (the sidebar, a notification) shuts it too.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const itemClass =
    "flex w-full items-center gap-3 px-4 py-2.5 min-h-tap md:pointer-fine:min-h-0 text-sm font-medium transition-colors cursor-pointer";

  return (
    <header className="min-h-16 pt-[var(--safe-top)] bg-white shadow-sm flex justify-between items-center px-4 md:px-8 z-30 shrink-0 gap-4">
      <div className="flex items-center gap-3 w-full max-w-md min-w-0">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 min-w-tap min-h-tap sm:pointer-fine:min-w-0 sm:pointer-fine:min-h-0 inline-flex items-center justify-center bg-[#110031] text-white rounded-lg shadow-md hover:bg-[#1b0847] transition-colors shrink-0"
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

        {/* The avatar opens a menu. It used to be a link to the profile page,
            and logging out meant opening the sidebar. */}
        <div ref={menuRef} className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label="Account menu"
            className="flex items-center gap-1 rounded-full cursor-pointer group"
          >
            <span className="w-11 h-11 sm:w-10 sm:h-10 bg-blue-600 rounded-full overflow-hidden border-2 border-white shadow-sm group-hover:opacity-90 transition block shrink-0">
              <img
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(avatarSeed)}`}
                alt=""
                className="w-full h-full object-cover bg-slate-200"
              />
            </span>
            <ChevronDown
              className={`hidden sm:block w-4 h-4 text-slate-500 transition-transform ${isMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-150 origin-top-right"
            >
              {/* Who is signed in: on a shared phone, the first thing to check. */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-900 truncate">{user?.name ?? ""}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email ?? ""}</p>
                {user && (
                  <p className="text-[11px] font-semibold tracking-[0.15em] text-blue-700 mt-1">
                    {describeRole(user.role).toUpperCase()}
                  </p>
                )}
              </div>

              <div className="py-1">
                <Link
                  href={`${basePath}/profile`}
                  role="menuitem"
                  onClick={() => setIsMenuOpen(false)}
                  className={`${itemClass} text-slate-700 hover:bg-slate-50 hover:text-slate-900`}
                >
                  <UserRound className="w-4 h-4 shrink-0" />
                  My Profile
                </Link>
              </div>

              <div className="py-1 border-t border-slate-100">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsLogoutModalOpen(true);
                  }}
                  className={`${itemClass} text-red-600 hover:bg-red-50`}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isLogoutModalOpen && (
        <LogoutDialog portalName={PORTAL_NAV[portal].name} onClose={() => setIsLogoutModalOpen(false)} />
      )}
    </header>
  );
}
