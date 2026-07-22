import React from "react";

export default function FleetStatusPage() {
  return (
    <div className="p-8 w-full">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Fleet Status</h1>

      {/* Fleet Status Content Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        <p className="text-gray-500">
          Vehicle availability, maintenance logs, and asset statuses will be
          displayed here.
        </p>
      </div>
    </div>
  );
}
