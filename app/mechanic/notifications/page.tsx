"use client";

import { Wrench } from "lucide-react";
import NotificationsFeed from "@/components/notifications/NotificationsFeed";

export default function MechanicNotificationsPage() {
  // Live notifications derived from truck status and maintenance checks.
  return (
    <NotificationsFeed
      portal="mechanic"
      title="Notifications"
      subtitle="System alerts, dispatch updates, and repair assignments."
      emptyMessage="No new repair assignments or alerts at this time."
      assignmentIcon={Wrench}
    />
  );
}
