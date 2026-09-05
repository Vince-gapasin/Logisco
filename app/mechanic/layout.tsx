// File: app/mechanic/layout.tsx
"use client";

import React, { useState } from "react";
import SidebarMechanic from "@/components/Sidebarmechanic";
import SharedHeader from "@/components/SharedHeader";

export default function MechanicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans relative">
      {/* Global Mechanic Sidebar (Overlay Drawer) */}
      <SidebarMechanic isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Right Side Container (Header + Main Content Area) */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {/* Header */}
        <SharedHeader 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          basePath="/mechanic" 
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