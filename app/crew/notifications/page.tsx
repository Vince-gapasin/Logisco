"use client";

import React from "react";
import Link from "next/link";
import { useNotifications } from "@/app/lib/useNotifications";
import {
  Bell,
  Package,
  MapPin,
  AlertTriangle,
  Clock,
  Check,
  ClipboardList,
  Truck,
} from "lucide-react";

export default function CrewNotificationsPage() {
  // Live notifications for this driver/helper, derived from their dispatches.
  const { notifications, isLoading, error: notificationsError, markRead, markAllRead } =
    useNotifications();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = (id: string | number) => {
    markRead(id);
  };

  const handleMarkAllAsRead = () => {
    markAllRead();
  };

  // Render the correct icon based on notification type tailored for the crew
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "assignment":
        return <Package className="w-5 h-5 text-blue-600" />;
      case "status":
        return <MapPin className="w-5 h-5 text-emerald-600" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "reminder":
        return <ClipboardList className="w-5 h-5 text-purple-600" />;
      case "system":
        return <Truck className="w-5 h-5 text-slate-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case "assignment":
        return "bg-blue-50 border-blue-100";
      case "status":
        return "bg-emerald-50 border-emerald-100";
      case "warning":
        return "bg-red-50 border-red-100";
      case "reminder":
        return "bg-purple-50 border-purple-100";
      case "system":
        return "bg-slate-50 border-slate-100";
      default:
        return "bg-slate-50 border-slate-100";
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Crew Notifications
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                {unreadCount} New
              </span>
            )}
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Delivery assignments, route alerts, and status reminders.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications Content Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
        {notificationsError && (
          <div className="mx-4 sm:mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs">
            {notificationsError}
          </div>
        )}

        {isLoading && notifications.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-100 text-slate-600">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-3" />
            <p className="text-sm font-medium">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-75">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-900 font-medium">You're all caught up!</p>
            <p className="text-slate-500 text-sm mt-1">
              No new assignments or alerts at this time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`px-4 sm:px-5 py-4 sm:py-5 flex flex-col sm:flex-row gap-4 transition-colors hover:bg-slate-50/50 ${
                  !notif.isRead ? "bg-blue-50/20" : ""
                }`}
              >
                {/* Icon Container */}
                <div
                  className={`w-12 h-12 rounded-full border flex shrink-0 items-center justify-center ${getIconBg(
                    notif.type,
                  )}`}
                >
                  {getNotificationIcon(notif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4 mb-1">
                    <h3
                      className={`text-base font-semibold truncate ${
                        !notif.isRead ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {notif.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" />
                      {notif.time}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed pr-0 sm:pr-4">
                    {notif.message}
                  </p>
                  {notif.link && (
                    <Link
                      href={notif.link}
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="mt-1 inline-block text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Open
                    </Link>
                  )}
                </div>

                {/* Action Buttons */}
                {!notif.isRead && (
                  <div className="flex items-center sm:pl-4 sm:pr-2 sm:border-l border-slate-100 pt-3 sm:pt-0 border-t sm:border-t-0 mt-3 sm:mt-0 shrink-0">
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors w-full sm:w-auto"
                    >
                      Mark as read
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
