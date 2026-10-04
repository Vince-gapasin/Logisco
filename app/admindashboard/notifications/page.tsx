"use client";

import NotificationsFeed from "@/components/notifications/NotificationsFeed";

export default function AdminNotificationsPage() {
  // Live notifications derived from bookings, dispatches and fleet status.
  return (
    <NotificationsFeed
      portal="admin"
      title="Notifications"
      subtitle="System alerts, administrative updates, and pending approvals."
      emptyMessage="No new notifications or alerts at this time."
    />
  );
}
