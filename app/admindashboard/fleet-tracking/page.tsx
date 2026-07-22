import React from "react";

export default function FleetTrackingPage() {
  return (
    <div className="p-8 w-full">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        Fleet Live Tracking
      </h1>

      {/* Fleet Live Tracking Content Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        <p className="text-gray-500">
          Fleet mapping, active driver location, and real-time telemetry will be
          displayed here.
        </p>
      </div>
    </div>
  );
}
