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
  // Open by default on desktop load
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar Component */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Right Side Container (Header + Main Content) */}
      <div className="flex flex-col flex-1 w-full overflow-hidden transition-all duration-300">
        {/* Header (Only renders the hamburger button when the sidebar is CLOSED) */}
        <Header isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

        {/* Dynamic Main Page Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
