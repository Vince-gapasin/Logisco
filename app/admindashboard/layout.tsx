// LOGISCO_PROTECTED_PORTAL_SECURITY_V1

"use client";

import React, { useState } from "react";

import ProtectedPortal from "@/components/ProtectedPortal";
import SharedHeader from "@/components/SharedHeader";
import Sidebar from "@/components/Sidebaradmin";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <ProtectedPortal>
      <div className="relative flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

        <div className="flex w-full flex-1 flex-col overflow-hidden">
          <SharedHeader
            isOpen={isSidebarOpen}
            setIsOpen={setIsSidebarOpen}
            basePath="/admindashboard"
          />

          <main className="flex-1 overflow-y-auto">
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
        </div>
      </div>
    </ProtectedPortal>
  );
}
