import React from "react";

export default function ClientsPage() {
  return (
    <div className="p-8 w-full">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        Clients & Partners
      </h1>

      {/* Clients & Partners Content Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        <p className="text-gray-500">
          Client directories, partner relationships, and account management
          details will be displayed here.
        </p>
      </div>
    </div>
  );
}
