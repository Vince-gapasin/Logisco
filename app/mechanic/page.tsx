"use client";

import React from "react";

export default function MechanicDashboardOverview(props: any) {
  return (
    <div className="p-6 sm:p-8 w-full max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Mechanic Dashboard
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Welcome back. Here is the current status of the fleet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Trucks in Garage
          </h2>
          <p className="text-3xl font-bold text-blue-600">0</p>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Pending Maintenance
          </h2>
          <p className="text-3xl font-bold text-yellow-600">2</p>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Recently Fixed
          </h2>
          <p className="text-3xl font-bold text-emerald-600">5</p>
        </div>
      </div>
    </div>
  );
}