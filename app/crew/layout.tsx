// ==========================================
// LOGISCO - CREW LAYOUT SHELL
// ==========================================
"use client";

import React, { useState } from "react";
import Sidebarcrew from "@/components/Sidebarcrew";
import SharedHeader from "@/components/SharedHeader";

export default function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans relative">
      {/* Global Crew Sidebar (Overlay Drawer) */}
      <Sidebarcrew isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Right Side Container (Header + Main Content Area) */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {/* Header */}
        <SharedHeader 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          basePath="/crewdashboard" 
        />

        {/* Dynamic Main Page Content */}
        <main className="flex-1 overflow-y-auto">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, {
                isOpen: isSidebarOpen,
                setIsOpen: setIsSidebarOpen,
              });
            }
            return child;
          })}
        </main>
      </div>
    </div>
  );
}