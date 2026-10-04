// LOGISCO_PROTECTED_PORTAL_SECURITY_V1

"use client";

import React, { useState } from "react";

import ProtectedPortal from "@/components/ProtectedPortal";
import SharedHeader from "@/components/SharedHeader";
import { ToastProvider } from "@/components/Toast";
import PortalSidebar from "@/components/PortalSidebar";
import BottomTabBar from "@/components/BottomTabBar";

export default function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Bumped when the link for the page on screen is picked again. Remounting
  // <main> drops whatever the page had open (a record, a filter) and returns
  // it to its starting view, as tapping a lit tab does in any phone app.
  const [pageKey, setPageKey] = useState(0);
  const resetPage = () => setPageKey((key) => key + 1);

  return (
    <ProtectedPortal>
      <ToastProvider>
        <div className="relative flex h-[100dvh] w-full overflow-hidden bg-slate-50 font-sans md:pb-[var(--safe-bottom)]">
          <PortalSidebar portal="crew" isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onReselect={resetPage} />

          <div className="flex w-full flex-1 flex-col overflow-hidden">
            <SharedHeader
              isOpen={isSidebarOpen}
              setIsOpen={setIsSidebarOpen}
              basePath="/crew"
              hasTabBar
            />

            <main key={pageKey} className="flex-1 overflow-y-auto">
              {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                  return React.cloneElement(
                    child as React.ReactElement<Record<string, unknown>>,
                    {
                      isOpen: isSidebarOpen,
                      setIsOpen: setIsSidebarOpen,
                    },
                  );
                }

                return child;
              })}
            </main>

            {/* Phones only. It takes over the bottom safe-area padding the
                shell has from md up, so the bar runs to the screen edge. */}
            <BottomTabBar portal="crew" onMore={() => setIsSidebarOpen(true)} onReselect={resetPage} />
          </div>
        </div>
      </ToastProvider>
    </ProtectedPortal>
  );
}
