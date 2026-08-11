// File: app/admindashboard/layout.tsx
"use client";
import React, { useState } from "react";
import Sidebar from "@/components/Sidebaradmin";
import Header from "@/components/Headeradmin";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans relative">
      {/* Global Admin Sidebar (Overlay Drawer) */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Right Side Container (Header + Main Content Area) */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {/* Header */}
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

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
