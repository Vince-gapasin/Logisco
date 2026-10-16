// ==========================================
// LOGISCO - PORTAL SIDEBAR
// ==========================================
// One sidebar for the admin, crew and mechanic portals. There used to be three
// copies of this file that differed only in their links.
//
// Logging out is in the header's account menu, not here.
//
// A drawer opened from the header at every width, phones and desktops alike:
// that is how the GUI was printed, so it stays closed until asked for.
"use client";

import React from "react";
import { describeRole, useSessionUser } from "@/app/lib/useSessionUser";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { PORTAL_NAV, isActive, type Portal } from "@/components/portalNav";

interface PortalSidebarProps {
  portal: Portal;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** The link for the page on screen was picked again: the layout resets the
      page, since a record opened on it does not change the URL. */
  onReselect: () => void;
}

export default function PortalSidebar({ portal, isOpen, setIsOpen, onReselect }: PortalSidebarProps) {
  const user = useSessionUser();
  const { items } = PORTAL_NAV[portal];

  const pathname = usePathname();

  // After a link is picked.
  const closeSidebar = () => {
    setIsOpen(false);
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
        className={`fixed inset-y-0 left-0 z-50 w-[min(16rem,85vw)] 2xl:w-72 bg-[#000208] border-r border-slate-950 text-[#f0f4ff] flex flex-col h-full pt-[var(--safe-top)] pb-[var(--safe-bottom)] shrink-0 transition-transform duration-300 ease-in-out overflow-hidden ${
          // The shadow only while open: shut, the drawer sits just past the
          // left edge and a 50px blur would still fall across the page.
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Subtle Ambient Glow Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-950/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-950/20 rounded-full blur-3xl"></div>
        </div>

        {/* Who is signed in, as one row with the close button. It was a large
            centred card, which pushed the admin links past the bottom of a
            laptop screen and made the drawer scroll. */}
        <div className="relative z-10 flex items-center gap-3 border-b border-slate-950 pl-5 pr-2 py-[clamp(0.5rem,2dvh,1.25rem)]">
          <div className="w-10 h-10 2xl:w-11 2xl:h-11 bg-black ring-2 ring-white/10 rounded-full overflow-hidden shrink-0">
            {/* Seeded from whoever is actually signed in. It used to be a name
                in the markup, so every portal drew the same initials. */}
            <img
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name ?? "?")}`}
              alt=""
              className="w-full h-full object-cover bg-slate-200"
            />
          </div>
          <div className="min-w-0 flex-1">
            {user ? (
              <>
                {/* As the name is written, like the header's menu. In capitals
                    it shouted, and a long name broke into two blocky lines. */}
                <h2 className="font-semibold text-sm leading-snug text-[#f0f4ff] line-clamp-2 wrap-break-word" title={user.name}>
                  {user.name}
                </h2>
                <p className="text-[#8ba4d5] text-xs mt-0.5 truncate">
                  {describeRole(user.role)}
                </p>
              </>
            ) : (
              // Until the browser has been read. A blank where the name goes is
              // better than a name belonging to nobody.
              <div aria-hidden="true" className="flex flex-col gap-2">
                <div className="h-3.5 w-28 rounded bg-slate-800" />
                <div className="h-2.5 w-16 rounded bg-slate-900" />
              </div>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="min-w-tap min-h-tap md:pointer-fine:min-w-0 md:pointer-fine:min-h-0 inline-flex items-center justify-center p-2 text-[#8ba4d5] hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu. The spacing follows the window's height, between
            limits: roomy on a tall screen, tight on a short laptop, so the
            links fill the drawer instead of leaving half of it empty, and
            still fit where there is little room. Only a phone on its side
            is too short for them all, and there the list scrolls. */}
        <nav className="relative z-10 flex-1 px-4 py-[clamp(0.5rem,2dvh,1.5rem)] space-y-[clamp(0.125rem,0.8dvh,0.5rem)] overflow-y-auto">
          {items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center px-4 py-[clamp(0.375rem,2.2dvh,1.125rem)] min-h-tap pointer-fine:min-h-0 rounded-xl text-sm 2xl:text-[15px] font-medium transition-all duration-150 ${
                  active
                    ? "bg-[#0D1A63] text-white shadow-lg shadow-[#0D1A63]/30 border border-blue-500/30 font-semibold"
                    : "text-[#8ba4d5] hover:bg-blue-600/20 hover:text-white"
                }`}
                onClick={() => {
                  closeSidebar();
                  if (pathname === item.href) onReselect();
                }}
              >
                <Icon className="w-5 h-5 mr-3 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
