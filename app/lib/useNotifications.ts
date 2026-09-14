"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/apiClient";

// Notifications are derived server-side from live data, so there is nowhere to
// record "read" yet. Until a Notification table exists, the dismissed ids are
// kept per browser; they are a UI convenience, not shared state.

const READ_STORAGE_KEY = "logisco_read_notifications";
const REFRESH_INTERVAL_MS = 60_000;

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: string;
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
      const result = await apiFetch<{ data: Omit<AppNotification, "isRead" | "isDone">[] }>(
        "/api/notifications",
      );
      const dismissed = readDismissedIds();

      setNotifications(
        (result.data ?? []).map((item) => ({
          ...item,
          isRead: dismissed.has(item.id),
          isDone: dismissed.has(item.id),
        })),
      );
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const markRead = useCallback((id: string | number) => {
    const key = String(id);
    const dismissed = readDismissedIds();
    dismissed.add(key);
    storeDismissedIds(dismissed);

    setNotifications((prev) =>
      prev.map((item) => (item.id === key ? { ...item, isRead: true, isDone: true } : item)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const dismissed = readDismissedIds();
      prev.forEach((item) => dismissed.add(item.id));
      storeDismissedIds(dismissed);

      return prev.map((item) => ({ ...item, isRead: true, isDone: true }));
    });
  }, []);

  return { notifications, isLoading, error, markRead, markAllRead, reload: load };
}
