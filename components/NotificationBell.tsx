"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";

// How many notifications this person has not opened yet, on the bell.
//
// The number comes from the server, not from the feed the page happens to
// have loaded: read state belongs to the person, so what they read on their
// phone is already read when they sit down at a desk.

const REFRESH_MS = 30_000;

export default function NotificationBell({ basePath }: { basePath: string }) {
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      // Never from the cache: a badge that is a minute stale is a badge that
      // says nothing arrived when something did.
      const result = await apiFetch<{ data: { count: number } }>("/api/notifications/unread", {
        cache: "no-store",
      });
      setUnread(Number(result?.data?.count) || 0);
    } catch {
      // Nothing to say on the bell if the count cannot be read; the feed
      // itself will report the problem when it is opened.
    }
  }, []);

  usePolling(() => void refresh(), REFRESH_MS);

  // Leaving the notifications page, having just read everything, clears the
  // badge there and then instead of leaving a stale number up until the next
  // poll comes round.
  useEffect(() => {
    // The count lands in a network callback, not in the effect body, so this
    // is a subscription to a route change rather than a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [pathname, refresh]);

  return (
    <Link
      href={`${basePath}/notifications`}
      className="relative cursor-pointer hover:bg-gray-100 p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-full transition flex items-center justify-center"
      title={unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "Notifications"}
    >
      <Bell className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
      {unread > 0 && (
        <span
          aria-label={`${unread} unread`}
          className="absolute top-0.5 right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
