import React from "react";

export default function ReportsPage() {
  return (
    <div className="p-8 w-full">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        Reports & Forecast
      </h1>

      {/* Reports & Forecast Content Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        <p className="text-gray-500">
          Analytics, performance metrics, and delivery forecasts will be
          displayed here.
        </p>
      </div>
    </div>
  );
}
