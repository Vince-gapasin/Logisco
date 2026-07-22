import React from "react";
import Sidebaradmin from "@/components/Sidebaradmin";
import Headeradmin from "@/components/Headeradmin";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden w-full">
      <Sidebaradmin />
      <div className="flex-1 flex flex-col overflow-hidden relative w-full">
        <Headeradmin />
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
