"use client";

import { Package } from "lucide-react";
import NotificationsFeed from "@/components/notifications/NotificationsFeed";

export default function CrewNotificationsPage() {
  // Live notifications for this driver/helper, derived from their dispatches.
  return (
    <NotificationsFeed
      portal="crew"
      title="Notifications"
      subtitle="Delivery assignments, route alerts, and status reminders."
      emptyMessage="No new assignments or alerts at this time."
      assignmentIcon={Package}
    />
  );
}
