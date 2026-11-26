"use client";

import { useCallback, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";

// Two kinds of item arrive together. An event that happened carries its read
// state from the server, so reading it on a phone leaves it read on a laptop.
// A standing condition - a truck on maintenance, a booking with no crew - is
// not an event and has nothing to mark on the server, so dismissing one is
// remembered in this browser, as before.

const READ_STORAGE_KEY = "logisco_read_notifications";
const REFRESH_INTERVAL_MS = 60_000;

/** Fired once the server has recorded a read, so the bell can recount at once. */
export const NOTIFICATIONS_READ_EVENT = "logisco:notifications-read";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: string;
  /** Where clicking it should go. */
  link?: string | null;
  /** An event, rather than a condition that still holds. */
  isStored?: boolean;
  truckPlate?: string;
  vehicleType?: string;
  issue?: string;
  crewName?: string;
  reason?: string;
  isRead: boolean;
}

function readDismissedIds(): Set<string> {
  try {
    const stored = window.localStorage.getItem(READ_STORAGE_KEY);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set();
  }
}

function storeDismissedIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Private browsing or blocked storage: read state just will not persist.
  }
}

function announceRead(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Every unread event the person has, not only the newest ones the feed
  // holds - the bell's number. Null until the server has said.
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // What is on screen, read where a decision is made. Asking a state updater
  // instead does not work: React runs it later, so a flag set inside it is
  // still unset when the code after it looks - which is how marking one read
  // used to change the screen and never reach the server.
  const current = useRef<AppNotification[]>([]);

  const show = useCallback((items: AppNotification[]) => {
    current.current = items;
    setNotifications(items);
  }, []);

  const load = useCallback(async () => {
    try {
      // Polled every 60s: always go to the network.
      const result = await apiFetch<{
        data: (Omit<AppNotification, "isRead"> & { isRead?: boolean })[];
        unreadCount?: number | null;
      }>("/api/notifications", { cache: "no-store" });
      const dismissed = readDismissedIds();

      show(
        (result.data ?? []).map((item) => {
          // The server knows for an event; this browser knows for a condition.
          const isRead = item.isStored ? Boolean(item.isRead) : dismissed.has(item.id);
          return { ...item, isRead };
        }),
      );
      setUnreadCount(typeof result.unreadCount === "number" ? result.unreadCount : null);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, [show]);

  // Polls only while the tab is visible.
  usePolling(load, REFRESH_INTERVAL_MS);

  const markRead = useCallback(
    (id: string | number) => {
      const key = String(id);
      const item = current.current.find((entry) => entry.id === key);
      if (!item || item.isRead) return;

      show(current.current.map((entry) => (entry.id === key ? { ...entry, isRead: true } : entry)));

      if (!item.isStored) {
        const dismissed = readDismissedIds();
        dismissed.add(key);
        storeDismissedIds(dismissed);
        return;
      }

      setUnreadCount((count) => (count === null ? null : Math.max(0, count - 1)));
      // Recorded for the person; a failure only means it stays unread.
      void apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ ids: [key] }) })
        .then(announceRead)
        .catch((markError) => console.error("Could not mark the notification read:", markError));
    },
    [show],
  );

  const markAllRead = useCallback(() => {
    const dismissed = readDismissedIds();
    current.current.filter((item) => !item.isStored).forEach((item) => dismissed.add(item.id));
    storeDismissedIds(dismissed);

    show(current.current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount((count) => (count === null ? null : 0));

    void apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ all: true }) })
      .then(announceRead)
      .catch((markError) => console.error("Could not mark notifications read:", markError));
  }, [show]);

  return { notifications, unreadCount, isLoading, error, markRead, markAllRead, reload: load };
}
