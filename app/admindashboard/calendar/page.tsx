import React from "react";

export default function CalendarPage() {
  return (
    <div className="p-8 w-full">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        Calendar Schedule
      </h1>

      {/* Your Calendar UI / content goes here */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        <p className="text-gray-500">
          Calendar view and upcoming deliveries will be displayed here.
        </p>
      </div>
    </div>
  );
}
