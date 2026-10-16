"use client";

// The numbers on the sidebar's links: proofs waiting for review, client
// reports still open, roadside jobs this mechanic has not finished.
//
// Only the ones the portal's sidebar shows are asked for, and only while the
// tab is visible. A failed count leaves the last number up rather than
// clearing it: the page itself reports the problem when it is opened.

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/app/lib/apiClient";
import { usePolling } from "@/app/lib/usePolling";
import { PORTAL_NAV, type NavBadge, type Portal } from "@/components/portalNav";

const REFRESH_MS = 60_000;

const COUNTERS: Record<NavBadge, () => Promise<number>> = {
  proofReview: async () => {
    const result = await apiFetch<{ pending: number }>("/api/pod/review?count=1", { cache: "no-store" });
    return Number(result?.pending) || 0;
  },
  clientReports: async () => {
    const result = await apiFetch<{ open: number }>("/api/client-reports?count=1", { cache: "no-store" });
    return Number(result?.open) || 0;
  },
  // No count route: the list is this mechanic's jobs from the last two weeks,
  // fifty at most, so counting it here costs nothing worth a new route.
  roadside: async () => {
    const result = await apiFetch<{ data: { status: string }[] }>("/api/mechanic/roadside", { cache: "no-store" });
    return (result?.data ?? []).filter((job) => job.status === "mechanic_assigned").length;
  },
};

export function useNavBadges(portal: Portal): Partial<Record<NavBadge, number>> {
  const [counts, setCounts] = useState<Partial<Record<NavBadge, number>>>({});
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    const badges = PORTAL_NAV[portal].groups.flatMap((group) =>
      group.items.flatMap((item) => (item.badge ? [item.badge] : [])),
    );
    if (badges.length === 0) return;

    const results = await Promise.allSettled(badges.map((badge) => COUNTERS[badge]()));
    setCounts((previous) => {
      const next = { ...previous };
      results.forEach((result, i) => {
        if (result.status === "fulfilled") next[badges[i]] = result.value;
      });
      return next;
    });
  }, [portal]);

  // Not straight away: the effect below already counts on the first render.
  usePolling(() => void refresh(), REFRESH_MS, { immediate: false });

  // Leaving a queue, having just worked through it, brings the number down
  // there and then rather than at the next poll.
  useEffect(() => {
    // The counts land in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [pathname, refresh]);

  return counts;
}
