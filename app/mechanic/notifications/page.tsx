"use client";

import React, { useState } from "react";
import {
  Bell,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardList,
  X,
  MapPin,
  AlertCircle,
} from "lucide-react";

// Mock interface for Supabase integration
interface Notification {
  id: string | number;
  title: string;
  message: string;
  time: string;
  type: "assignment" | "warning" | "success" | "system" | "reminder";
  isDone: boolean;
  truckPlate?: string;
  vehicleType?: string;
  issue?: string;
  notes?: string;
  crewName?: string;
  location?: string;
  locationLink?: string;
  reason?: string;
  crewMessage?: string;
  driverName?: string;
  driverContact?: string;
  helperName?: string;
  helperContact?: string;
}

export default function MechanicNotificationsPage() {
  // Mock data tailored for the Mechanic role
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 2,
      title: "New Repair Assignment",
      message:
        "You have been assigned to diagnose issues observed on Truck ABC-1234 (Wing Van).",
      time: "10 mins ago",
      type: "assignment",
      isDone: false,
      truckPlate: "Truck ABC-1234",
      vehicleType: "Wing Van",
      issue: "Engine starting issues and unusual noise",
      notes:
        "Driver heard clicking noises when turning the key before dispatch.",
      crewName: "Rodel Cruz",
    },
    {
      id: 3,
      title: "Emergency: Breakdown Reported",
      message:
        "Truck XYZ-9876 reported transmission failure on NLEX. Stand by for recovery protocols.",
      time: "2 hours ago",
      type: "warning",
      isDone: false,
      truckPlate: "Truck XYZ-9876",
      vehicleType: "Dump Truck",
      location: "NLEX Southbound, Km 45",
      locationLink: "https://maps.google.com/?q=NLEX",
      reason: "Transmission failure",
      crewMessage:
        "Unable to shift past 2nd gear, fluid leaking visible under the chassis. Driver attempted to restart the engine but the issue persists. Vehicle is currently pulled over on the shoulder lane. Please prioritize this recovery as it is obstructing partial traffic flow.",
      crewName: "Michael Santos",
      driverName: "Michael Santos",
      driverContact: "0912 345 6789",
      helperName: "Juan Dela Cruz",
      helperContact: "0998 765 4321",
    },
  ]);

  const [selectedNotification, setSelectedNotification] =
    useState<Notification | null>(null);

  // State to manage the confirmation popup
  const [isConfirmingDone, setIsConfirmingDone] = useState(false);

  const pendingCount = notifications.filter((n) => !n.isDone).length;

  const handleMarkAsDone = (id: string | number) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isDone: true } : notif,
      ),
    );
    // Reset confirmation and close the main modal
    setIsConfirmingDone(false);
    setSelectedNotification(null);
  };

  const closeNotificationDetails = () => {
    setSelectedNotification(null);
    setIsConfirmingDone(false);
  };

  const handleNotificationClick = (notif: Notification) => {
    setSelectedNotification(notif);
  };

  // Helper function to render the correct icon and color based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "assignment":
        return <Wrench className="w-5 h-5 text-blue-600" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "reminder":
        return <ClipboardList className="w-5 h-5 text-purple-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case "assignment":
        return "bg-blue-100 border-blue-200";
      case "warning":
        return "bg-red-100 border-red-200";
      case "success":
        return "bg-emerald-100 border-emerald-200";
      case "reminder":
        return "bg-purple-100 border-purple-200";
      default:
        return "bg-slate-100 border-slate-200";
    }
  };

  // Helper function with darker solid colors and thick borders for maximum visibility
  const getPendingBg = (type: string, isDone: boolean) => {
    if (isDone)
      return "bg-white hover:bg-slate-50 border-l-4 border-transparent";
    switch (type) {
      case "assignment":
        return "bg-blue-100 hover:bg-blue-200 border-l-4 border-blue-600";
      case "warning":
        return "bg-red-100 hover:bg-red-200 border-l-4 border-red-600";
      case "success":
        return "bg-emerald-100 hover:bg-emerald-200 border-l-4 border-emerald-600";
      case "reminder":
        return "bg-purple-100 hover:bg-purple-200 border-l-4 border-purple-600";
      default:
        return "bg-slate-100 hover:bg-slate-200 border-l-4 border-slate-500";
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto space-y-6 relative">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Notifications
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                {pendingCount} Pending
              </span>
            )}
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            System alerts, dispatch updates, and repair assignments.
          </p>
        </div>
      </div>

      {/* Notifications Content Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
        {notifications.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-900 font-medium">You're all caught up!</p>
            <p className="text-slate-500 text-sm mt-1">
              No new notifications or alerts at this time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`px-4 sm:px-5 py-4 sm:py-5 flex flex-col sm:flex-row gap-4 transition-colors cursor-pointer ${getPendingBg(
                  notif.type,
                  notif.isDone,
                )}`}
              >
                {/* Icon Container */}
                <div
                  className={`w-12 h-12 rounded-full border flex shrink-0 items-center justify-center bg-white ${getIconBg(
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
                        !notif.isDone ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {notif.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" />
                      {notif.time}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed pr-0 sm:pr-4">
                    {notif.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notification Details Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          {/* Modal Container */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[85vh] sm:h-[600px] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div
              className={`flex items-center justify-between px-6 py-4 border-b shrink-0 transition-colors ${
                selectedNotification.type === "warning"
                  ? "bg-red-600 border-red-700 text-white"
                  : "bg-[#000c31] border-slate-800 text-white"
              }`}
            >
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                {selectedNotification.type === "warning" && (
                  <AlertTriangle className="w-5 h-5 text-white" />
                )}
                {selectedNotification.type === "assignment"
                  ? "New Repair Assignment"
                  : selectedNotification.type === "warning"
                    ? "Emergency Alert"
                    : "Notification Details"}
              </h2>
              <button
                onClick={closeNotificationDetails}
                className={`p-1.5 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer ${
                  selectedNotification.type === "warning"
                    ? "hover:bg-red-700"
                    : "hover:bg-slate-800"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-start gap-4 mb-6">
                <div
                  className={`w-12 h-12 rounded-full border flex shrink-0 items-center justify-center bg-white ${getIconBg(
                    selectedNotification.type,
                  )}`}
                >
                  {getNotificationIcon(selectedNotification.type)}
                </div>

                {/* Title & Mark as Done Area */}
                <div className="flex-1 flex justify-between items-start gap-2">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                      {(selectedNotification.type === "assignment" ||
                        selectedNotification.type === "warning") &&
                      selectedNotification.truckPlate
                        ? selectedNotification.truckPlate
                        : selectedNotification.title}
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                      <span
                        className={`inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md w-max ${
                          selectedNotification.type === "assignment"
                            ? "bg-blue-100 text-blue-700"
                            : selectedNotification.type === "warning"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {selectedNotification.type === "assignment"
                          ? "ASSIGNMENT"
                          : selectedNotification.type === "warning"
                            ? "EMERGENCY"
                            : selectedNotification.type}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {selectedNotification.time}
                      </span>
                    </div>
                  </div>

                  {/* Mark as Done Button */}
                  {!selectedNotification.isDone && (
                    <button
                      onClick={() => setIsConfirmingDone(true)}
                      className="shrink-0 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      Mark as Done
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed mb-6">
                <p>{selectedNotification.message}</p>
                {selectedNotification.crewName && (
                  <p className="mt-2 text-slate-500 font-medium">
                    Remarks by:{" "}
                    <span className="text-slate-700">
                      {selectedNotification.crewName}
                    </span>
                  </p>
                )}
              </div>

              {/* Dynamic Notification Context Details */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                <h4 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2 mb-3">
                  Context Information
                </h4>
                {selectedNotification.type === "assignment" && (
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                      <span className="font-medium text-slate-700">
                        Assigned Truck
                      </span>
                      <span className="font-semibold">
                        {selectedNotification.truckPlate}
                      </span>
                    </li>
                    <li className="flex justify-between border-b border-dashed border-slate-200 pb-2 pt-1">
                      <span className="font-medium text-slate-700">
                        Vehicle Type
                      </span>
                      <span>{selectedNotification.vehicleType}</span>
                    </li>
                    <li className="flex flex-col border-b border-dashed border-slate-200 pb-2 pt-1">
                      <span className="font-medium text-slate-700 mb-0.5">
                        Issues Observed
                      </span>
                      <span>{selectedNotification.issue}</span>
                    </li>
                    <li className="flex flex-col pt-1">
                      <span className="font-medium text-slate-700 mb-0.5">
                        Additional Notes
                      </span>
                      <span>{selectedNotification.notes}</span>
                    </li>
                  </ul>
                )}

                {selectedNotification.type === "warning" && (
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                      <span className="font-medium text-slate-700">
                        Reported Truck
                      </span>
                      <span className="font-semibold">
                        {selectedNotification.truckPlate}
                      </span>
                    </li>
                    <li className="flex justify-between border-b border-dashed border-slate-200 pb-2 pt-1">
                      <span className="font-medium text-slate-700">
                        Vehicle Type
                      </span>
                      <span>{selectedNotification.vehicleType}</span>
                    </li>
                    <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-dashed border-slate-200 pb-2 pt-1 gap-1">
                      <span className="font-medium text-slate-700">
                        Location
                      </span>
                      <a
                        href={selectedNotification.locationLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer flex items-center gap-1 font-medium"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        {selectedNotification.location}
                      </a>
                    </li>
                    <li className="flex flex-col border-b border-dashed border-slate-200 pb-2 pt-1">
                      <span className="font-medium text-slate-700 mb-0.5">
                        Reason
                      </span>
                      <span className="text-red-600 font-medium">
                        {selectedNotification.reason}
                      </span>
                    </li>
                    <li className="flex flex-col border-b border-dashed border-slate-200 pb-2 pt-1">
                      <span className="font-medium text-slate-700 mb-0.5">
                        Message of the Crew
                      </span>
                      <span>{selectedNotification.crewMessage}</span>
                    </li>
                    <li className="flex flex-col pt-1 gap-1.5">
                      <span className="font-medium text-slate-700 mb-0.5">
                        Crew Information
                      </span>
                      <div className="flex flex-col gap-1">
                        <span>
                          Driver: {selectedNotification.driverName} —{" "}
                          {selectedNotification.driverContact}
                        </span>
                        <span>
                          Helper: {selectedNotification.helperName} —{" "}
                          {selectedNotification.helperContact}
                        </span>
                      </div>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              {(selectedNotification.type === "assignment" ||
                selectedNotification.type === "warning") && (
                <button
                  className={`px-5 py-2.5 text-white rounded-xl text-sm font-semibold hover:bg-black hover:border-black transition-colors duration-200 shadow-md cursor-pointer border border-transparent ${
                    selectedNotification.type === "warning"
                      ? "bg-red-600"
                      : "bg-blue-700"
                  }`}
                >
                  {selectedNotification.type === "warning"
                    ? "Locate Truck"
                    : "Start Inspection"}
                </button>
              )}
              <button
                onClick={closeNotificationDetails}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-black hover:text-white hover:border-black transition-colors duration-200 shadow-sm cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmingDone && selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Mark as Done?
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Are you sure you want to mark this task as completed? This
                  action will remove it from your pending list.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={() => setIsConfirmingDone(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleMarkAsDone(selectedNotification.id)}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors shadow-md cursor-pointer"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
