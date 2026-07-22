// ==========================================
// MAIN DASHBOARD PAGE FOR ADMIN USERS
// ==========================================
"use client";
import React, { useRef } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Truck,
} from "lucide-react";

// ==========================================
// CONSTANTS & DATA
// ==========================================

const COLOR_STYLES = {
  orange: {
    iconBg: "bg-orange-50",
    iconText: "text-orange-500",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-700",
  },
  blue: {
    iconBg: "bg-blue-50",
    iconText: "text-blue-500",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
  },
  green: {
    iconBg: "bg-green-50",
    iconText: "text-green-500",
    badgeBg: "bg-green-100",
    badgeText: "text-green-700",
  },
  red: {
    iconBg: "bg-red-50",
    iconText: "text-red-500",
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
  },
};

const TABS = [
  {
    name: "Pending Bookings",
    icon: Clock,
    color: "orange",
    statusLabel: "Pending",
  },
  { name: "In-Transit", icon: Truck, color: "blue", statusLabel: "In-Transit" },
  {
    name: "Completed",
    icon: CheckCircle2,
    color: "green",
    statusLabel: "Delivered",
  },
  {
    name: "Foul Trip",
    icon: AlertTriangle,
    color: "red",
    statusLabel: "Foul Trip",
  },
];

const BOOKINGS = {
  "Pending Bookings": [],
  "In-Transit": [],
  Completed: [],
  "Foul Trip": [],
};

// ==========================================
// SUB-COMPONENTS
// ==========================================

function KPIGrid({ onNavigate }: { onNavigate: (name: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {TABS.map((tab) => {
        const styles = COLOR_STYLES[tab.color as keyof typeof COLOR_STYLES];
        const count = BOOKINGS[tab.name as keyof typeof BOOKINGS]?.length ?? 0;
        return (
          <button
            key={tab.name}
            onClick={() => onNavigate(tab.name)}
            className="p-5 rounded-2xl shadow-sm bg-white border border-gray-100 hover:border-blue-400 transition-all flex items-center space-x-4 text-left w-full"
          >
            <div
              className={`w-14 h-14 rounded-full ${styles.iconBg} flex items-center justify-center ${styles.iconText} shrink-0`}
            >
              <tab.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-slate-800">{count}</p>
              <p className="text-gray-500 text-[11px] font-bold tracking-wider mt-0.5">
                {tab.name.toUpperCase()}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FeedTable({ tabConfig, bookings }: any) {
  const styles = COLOR_STYLES[tabConfig.color as keyof typeof COLOR_STYLES];
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full">
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="text-lg font-bold text-slate-800">
          {tabConfig.name} Feed
        </h3>
      </div>
      <div className="overflow-x-auto min-h-75">
        {bookings.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-2 opacity-20" />
            <p>No data found.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <tbody className="divide-y divide-gray-50 text-sm">
              {bookings.map((b: any) => (
                <tr key={b.orderId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {b.orderId}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{b.client}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 ${styles.badgeBg} ${styles.badgeText} rounded-full text-xs font-bold`}
                    >
                      {tabConfig.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ==========================================
// MAIN DASHBOARD PAGE COMPONENT
// ==========================================

export default function AdminDashboardPage() {
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleNavigate = (tabName: string) => {
    sectionRefs.current[tabName]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="p-8 w-full">
      {/* Header with action buttons */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Overview</h1>
        <div className="flex space-x-3">
          <button className="px-5 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors duration-200 shadow-md shadow-green-200">
            + On-Call Booking
          </button>
          <button className="px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors duration-200 shadow-md shadow-blue-200">
            + New Booking
          </button>
        </div>
      </div>

      {/* KPI Cards act as Navigation Buttons */}
      <KPIGrid onNavigate={handleNavigate} />

      {/* 2x2 Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
        {TABS.map((tab) => (
          <div
            key={tab.name}
            ref={(el) => {
              sectionRefs.current[tab.name] = el;
            }}
            className="scroll-mt-6"
          >
            <FeedTable
              tabConfig={tab}
              bookings={BOOKINGS[tab.name as keyof typeof BOOKINGS]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
