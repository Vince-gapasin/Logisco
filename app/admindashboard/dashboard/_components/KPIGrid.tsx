"use client";

import { COLOR_STYLES, type DashboardBooking, TABS } from "./feeds";

// ==========================================
// SUB-COMPONENTS
// ==========================================

export function KPIGrid({
  onNavigate,
  bookingsData,
}: {
  onNavigate: (name: string) => void;
  bookingsData: Record<string, DashboardBooking[]>;
}) {
  return (
    // Four across on a phone rather than stacked: these are the counts somebody
    // checks at a glance, and one per screenful turns a glance into scrolling.
    <div className="grid grid-cols-4 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-6 mb-8">
      {TABS.map((tab) => {
        const styles = COLOR_STYLES[tab.color as keyof typeof COLOR_STYLES];
        const count = bookingsData[tab.name]?.length ?? 0;
        return (
          <button
            key={tab.name}
            onClick={() => onNavigate(tab.name)}
            className="min-h-tap md:min-h-0 p-2 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm bg-white border border-gray-200 hover:border-blue-600 transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start sm:space-x-4 text-center sm:text-left w-full"
            title={tab.name}
          >
            <div
              className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full ${styles.iconBg} flex items-center justify-center ${styles.iconText} shrink-0`}
            >
              <tab.icon className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>

            {/* Full name and a large count where there is room. */}
            <div className="hidden sm:block">
              <p className="text-3xl font-extrabold text-slate-800">{count}</p>
              <p className="text-gray-500 text-xs sm:text-[11px] font-bold tracking-wider mt-0.5">
                {tab.name.toUpperCase()}
              </p>
            </div>

            {/* On a phone the short status label, since "Pending Bookings" will
                not fit a quarter of the width without truncating to nothing. */}
            <div className="flex sm:hidden flex-col items-center mt-1.5 w-full">
              <p className="text-sm font-extrabold text-slate-800 leading-none">{count}</p>
              <p
                className={`text-[10px] font-bold mt-1 tracking-tight text-center truncate w-full ${styles.iconText}`}
              >
                {tab.statusLabel.toUpperCase()}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
