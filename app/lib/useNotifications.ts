"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";

// Two kinds of item arrive together. An event that happened carries its read
// state from the server, so reading it on a phone leaves it read on a laptop.
// A standing condition - a truck on maintenance, a booking with no crew - is
// not an event and has nothing to mark on the server, so dismissing one is
// remembered in this browser, as before.

const READ_STORAGE_KEY = "logisco_read_notifications";
const REFRESH_INTERVAL_MS = 60_000;

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
  /** Same flag under the name the mechanic screen uses. */
  isDone: boolean;
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

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      // Polled every 60s: always go to the network.
      const result = await apiFetch<{
        data: (Omit<AppNotification, "isRead" | "isDone"> & { isRead?: boolean })[];
      }>("/api/notifications", { cache: "no-store" });
      const dismissed = readDismissedIds();

      setNotifications(
        (result.data ?? []).map((item) => {
          // The server knows for an event; this browser knows for a condition.
          const isRead = item.isStored ? Boolean(item.isRead) : dismissed.has(item.id);
          return { ...item, isRead, isDone: isRead };
        }),
      );
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Polls only while the tab is visible.
  usePolling(load, REFRESH_INTERVAL_MS);

  const markRead = useCallback((id: string | number) => {
    const key = String(id);
    let stored = false;

    setNotifications((prev) => {
      stored = Boolean(prev.find((item) => item.id === key)?.isStored);
      if (!stored) {
        const dismissed = readDismissedIds();
        dismissed.add(key);
        storeDismissedIds(dismissed);
      }
      return prev.map((item) => (item.id === key ? { ...item, isRead: true, isDone: true } : item));
    });

    // Recorded for the person; a failure only means it stays unread.
    if (stored) {
      void apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ ids: [key] }) }).catch(
        (markError) => console.error("Could not mark the notification read:", markError),
      );
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const dismissed = readDismissedIds();
      prev.filter((item) => !item.isStored).forEach((item) => dismissed.add(item.id));
      storeDismissedIds(dismissed);

      return prev.map((item) => ({ ...item, isRead: true, isDone: true }));
    });

    void apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ all: true }) }).catch(
      (markError) => console.error("Could not mark notifications read:", markError),
    );
  }, []);

  return { notifications, isLoading, error, markRead, markAllRead, reload: load };
}
