"use client";

import Link from "next/link";
import RowOpenButton from "@/components/RowOpenButton";
import { FileText } from "lucide-react";
import { COLOR_STYLES, type DashboardBooking, TABS } from "./feeds";
import { bookingStatusLabel } from "@/app/lib/statusLabels";

export function FeedTable({
  tabConfig,
  bookings,
  onViewOrder,
  isLoading,
}: {
  tabConfig: (typeof TABS)[number];
  bookings: DashboardBooking[];
  onViewOrder: (booking: DashboardBooking) => void;
  isLoading: boolean;
}) {
  const styles = COLOR_STYLES[tabConfig.color as keyof typeof COLOR_STYLES];
  const data = bookings || [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center space-x-3">
          <div
            className={`w-9 h-9 rounded-xl ${styles.iconBg} flex items-center justify-center ${styles.iconText} shrink-0`}
          >
            <tabConfig.icon className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {tabConfig.name} Feed ({data.length})
          </h3>
        </div>
        <Link
          href={tabConfig.route}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          View All
        </Link>
      </div>
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto max-h-105 feed-scrollbar">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-sm font-semibold">Loading data records...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-2 opacity-20" />
            <p>No data found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {data.map((b) => {
              let displayStatus = tabConfig.statusLabel;
              if (b.isSubcon && b.dispatchStatus !== "Completed") {
                displayStatus = b.dispatchStatus === "Accepted" ? "Sub-con: awaiting pickup" : `Sub-con: ${b.dispatchStatus}`;
              } else if (tabConfig.name === "Pending Bookings") {
                const ds = b.dispatchStatus;
                const drv = b.driver;
                const hasDriver = drv && drv !== "Unassigned" && drv !== "N/A";

                if (ds === "Rejected") {
                  displayStatus = "Assign Now";
                } else if (!hasDriver) {
                  displayStatus = "Assign Crew";
                } else if (ds === "Accepted") {
                  displayStatus = "Waiting Crew Dispatch";
                } else {
                  displayStatus = "Pending Crew";
                }
              }
              // The bucket's own colour, except for a booking a crew turned
              // down: red says at a glance which of the pending ones is
              // waiting because something happened to it.
              const badge = b.dispatchStatus === "Rejected" ? COLOR_STYLES.red : styles;
              return (
                <div
                  key={b.orderId}
                  onClick={() => onViewOrder(b)}
                  className="cursor-pointer bg-gray-50/50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-200 group"
                >
                  {/* On a phone the status and date go under the booking, so the
                      order ID is not cut to "ORD-4..." beside them. */}
                  <div className="flex flex-wrap sm:flex-nowrap justify-between items-start gap-y-2 mb-3">
                    <div className="min-w-0 w-full sm:w-auto pr-2">
                      <h4 className="font-bold text-base truncate">
                        <RowOpenButton
                          label={`View booking ${b.orderId}`}
                          onOpen={() => onViewOrder(b)}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors max-w-full truncate"
                        >
                          {b.orderId}
                        </RowOpenButton>
                      </h4>
                      <p className="text-sm font-semibold text-slate-700 mt-0.5 truncate">
                        {b.client}
                      </p>
                    </div>
                    <div className="flex flex-row flex-wrap sm:flex-nowrap sm:flex-col items-center sm:items-end gap-x-2 gap-y-1 sm:gap-1.5 min-w-0 sm:shrink-0">
                      <span
                        className={`px-3 py-1 ${badge.badgeBg} ${badge.badgeText} rounded-full text-xs sm:text-[11px] font-bold whitespace-nowrap`}
                      >
                        {bookingStatusLabel(displayStatus)}
                      </span>
                      <span className="text-gray-500 text-xs sm:text-[11px] font-medium whitespace-nowrap">
                        {b.dateTime}
                      </span>
                    </div>
                  </div>
                  {/* Label and value side by side on a phone, so each value has the
                      width to be read; three columns from sm up. */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 text-sm mt-4 pt-4 border-t border-gray-200/80">
                    <div className="min-w-0 grid grid-cols-[32%_68%] items-baseline gap-2 sm:block">
                      <span className="text-gray-500 text-xs sm:text-[11px] uppercase tracking-wider font-semibold block sm:mb-1 truncate">
                        Product
                      </span>
                      <span
                        className="text-slate-700 font-medium block wrap-break-word sm:truncate"
                        title={b.product}
                      >
                        {b.product}
                      </span>
                    </div>
                    <div className="min-w-0 grid grid-cols-[32%_68%] items-baseline gap-2 sm:block">
                      <span className="text-gray-500 text-xs sm:text-[11px] uppercase tracking-wider font-semibold block sm:mb-1 truncate">
                        Driver
                      </span>
                      <span
                        className="text-slate-700 font-medium block wrap-break-word sm:truncate"
                        title={b.driver}
                      >
                        {b.driver}
                      </span>
                    </div>
                    <div className="min-w-0 grid grid-cols-[32%_68%] items-baseline gap-2 sm:block">
                      <span className="text-gray-500 text-xs sm:text-[11px] uppercase tracking-wider font-semibold block sm:mb-1 truncate">
                        Helper
                      </span>
                      <span
                        className="text-slate-700 font-medium block wrap-break-word sm:truncate"
                        title={b.helper}
                      >
                        {b.helper || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
