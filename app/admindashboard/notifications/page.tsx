import React from "react";

export default function NotificationsPage() {
  return (
    <div className="p-8 w-full">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Notifications</h1>

      {/* Notifications Content Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
        <p className="text-gray-500">
          System alerts, dispatch updates, and user notifications will be
          displayed here.
        </p>
      </div>
    </div>
  );
}
