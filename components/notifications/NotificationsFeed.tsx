"use client";

// ==========================================
// LOGISCO - NOTIFICATIONS FEED
// ==========================================
// The notifications page for every portal. There were three: the office's and
// the crew's were copies of each other with different icons and words, and the
// mechanic's was a different design again - rows in solid colour that opened
// a details pop-up, a confirmation to mark one done, no way to clear them all,
// and a "Pending" count that disagreed with the number on the bell. The office's
// was the one to keep; this is it, with what the other two did better folded
// in (the truck details only the mechanic's pop-up showed, buttons that say
// where they go).

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  MapPin,
  Package,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useNotifications, type AppNotification } from "@/app/lib/useNotifications";
import ListLoadError from "@/components/ListLoadError";
import type { Portal } from "@/components/portalNav";

// One look per kind, whichever portal it lands in. "assignment" is the one
// word the portals use differently - a delivery for the crew, a repair for a
// mechanic - so each page can say which icon it means.
const KINDS: Record<string, { icon: LucideIcon; tone: string }> = {
  warning: { icon: AlertTriangle, tone: "bg-red-50 border-red-100 text-red-600" },
  approval: { icon: FileText, tone: "bg-blue-50 border-blue-100 text-blue-600" },
  assignment: { icon: Package, tone: "bg-blue-50 border-blue-100 text-blue-600" },
  success: { icon: CheckCircle2, tone: "bg-emerald-50 border-emerald-100 text-emerald-600" },
  status: { icon: MapPin, tone: "bg-emerald-50 border-emerald-100 text-emerald-600" },
  reminder: { icon: ClipboardList, tone: "bg-purple-50 border-purple-100 text-purple-600" },
  system: { icon: Truck, tone: "bg-slate-50 border-slate-100 text-slate-600" },
};
const FALLBACK_KIND = { icon: Bell, tone: "bg-slate-50 border-slate-100 text-slate-600" };

// Where a notification's link goes, as its button says it. Longest first, so a
// feed is not named after the dashboard it sits under.
const DESTINATIONS: [string, string][] = [
  ["/admindashboard/calendar/unassigned-bookings", "Unassigned Bookings"],
  ["/admindashboard/calendar/awaiting-confirmation", "Awaiting Confirmation"],
  ["/admindashboard/feeds/pending", "Pending Bookings"],
  ["/admindashboard/feeds/in-transit", "In-Transit Feed"],
  ["/admindashboard/feeds/completed", "Completed Feed"],
  ["/admindashboard/feeds/foul-trip", "Foul Trip Feed"],
  ["/admindashboard/fleet-tracking", "Live Tracking"],
  ["/admindashboard/fleet-status", "Fleet Status"],
  ["/admindashboard/history-logs", "History Logs"],
  ["/admindashboard/employees", "Employees"],
  ["/admindashboard/reports", "Reports"],
  ["/admindashboard/calendar", "Calendar"],
  ["/admindashboard/dashboard", "Dashboard"],
  ["/crew/dashboard", "My Deliveries"],
  ["/crew/delivery-history", "Delivery History"],
  ["/mechanic/roadside", "Roadside Jobs"],
  ["/mechanic/fleet-status", "Fleet Status"],
  ["/mechanic/history-logs", "History Logs"],
];

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

/** The page a link opens, by name; null when it is not one of the named ones. */
function destinationOf(link: string): string | null {
  const path = link.split(/[?#]/)[0];
  return DESTINATIONS.find(([prefix]) => under(path, prefix))?.[1] ?? null;
}

// A notification is written once and given to everyone it concerns, with one
// link - so the office, told the crew can carry on after a roadside repair, got
// the crew's dashboard, which only bounces them back. Read here: a link into
// another portal is turned into this portal's page for the same thing, or
// dropped when there is none. Longest prefix first; null means no such page.
const PORTAL_HOME: Record<Portal, string> = {
  admin: "/admindashboard",
  crew: "/crew",
  mechanic: "/mechanic",
};
const CROSS_PORTAL: Record<Portal, [string, string | null][]> = {
  admin: [
    ["/mechanic/fleet-status", "/admindashboard/fleet-status"],
    ["/mechanic/history-logs", "/admindashboard/history-logs"],
    ["/mechanic/roadside", "/admindashboard/feeds/foul-trip"],
    ["/mechanic", null],
    // A trip the crew carries on with, or a booking changed under them: the
    // office follows trips on the live map.
    ["/crew", "/admindashboard/fleet-tracking"],
  ],
  crew: [
    ["/admindashboard", "/crew/dashboard"],
    ["/mechanic", null],
  ],
  mechanic: [
    ["/admindashboard/fleet-status", "/mechanic/fleet-status"],
    ["/admindashboard/feeds/foul-trip", "/mechanic/roadside"],
    ["/admindashboard", null],
    ["/crew", null],
  ],
};

function linkFor(link: string | null | undefined, portal: Portal): string | null {
  if (!link) return null;
  const path = link.split(/[?#]/)[0];
  if (under(path, PORTAL_HOME[portal])) return link;
  const match = CROSS_PORTAL[portal].find(([prefix]) => under(path, prefix));
  // Not another portal's page ("/" and the like): leave it to the router.
  if (!match) return link;
  return match[1];
}

// Longer than this, a message starts folded to three lines. Most are one or
// two; a few - a trip that has gone quiet - run to ten on a phone.
const LONG_MESSAGE = 160;

type Filter = "all" | "unread";

interface NotificationsFeedProps {
  /** Whose feed: decides where each Open button may go. */
  portal: Portal;
  title: string;
  subtitle: string;
  /** What "all caught up" means here: "No new assignments or alerts". */
  emptyMessage: string;
  /** The icon for an assignment in this portal. */
  assignmentIcon?: LucideIcon;
}

export default function NotificationsFeed({
  portal,
  title,
  subtitle,
  emptyMessage,
  assignmentIcon,
}: NotificationsFeedProps) {
  const { notifications, isLoading, error, markRead, markAllRead, reload } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  // The bell's number: events that arrived and have not been opened. A
  // standing condition - a booking with no crew yet, a truck on maintenance -
  // is listed but is not "new", and counting it would leave a number nothing
  // could clear.
  const newCount = notifications.filter((n) => n.isStored && !n.isRead).length;
  const anyUnread = notifications.some((n) => !n.isRead);
  const shown = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  const kindOf = (type: string) => {
    if (type === "assignment" && assignmentIcon) return { ...KINDS.assignment, icon: assignmentIcon };
    return KINDS[type] ?? FALLBACK_KIND;
  };

  return (
    // The same width as every other page. The list used to stop at 896px,
    // which on a wide screen left it hugging the left with a third of the
    // page empty beside it; now only the message text keeps a reading width.
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
      <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600 shrink-0" aria-hidden="true" />
            {title}
            {newCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {newCount} new
              </span>
            )}
          </h1>
          <p className="text-slate-600 text-sm mt-1">{subtitle}</p>
        </div>

        {anyUnread && (
          <button
            type="button"
            onClick={markAllRead}
            className="min-h-tap md:pointer-fine:min-h-0 self-start sm:self-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            Mark all as read
          </button>
        )}
      </div>

      {/* All / Unread */}
      <div role="group" aria-label="Show" className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
        {(
          [
            ["all", "All"],
            ["unread", "Unread"],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-tap md:pointer-fine:min-h-0 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              filter === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
        {error && notifications.length > 0 && (
          <div className="px-4 sm:px-5 pt-4">
            <ListLoadError message={error} onRetry={() => void reload()} compact />
          </div>
        )}

        {isLoading && notifications.length === 0 ? (
          <ul aria-busy="true" aria-label="Loading notifications" className="divide-y divide-slate-100">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-3 sm:gap-4 px-4 sm:px-5 py-4 animate-pulse">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-2/5 rounded bg-slate-100" />
                  <div className="h-3 w-4/5 rounded bg-slate-100" />
                </div>
              </li>
            ))}
          </ul>
        ) : error && notifications.length === 0 ? (
          <div className="py-16">
            <ListLoadError message={error} onRetry={() => void reload()} />
          </div>
        ) : shown.length === 0 ? (
          <div className="px-6 py-16 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-slate-300" aria-hidden="true" />
            </div>
            <p className="text-slate-900 font-semibold">You&apos;re all caught up!</p>
            <p className="text-slate-500 text-sm mt-1">
              {filter === "unread" && notifications.length > 0 ? "Nothing unread." : emptyMessage}
            </p>
            {filter === "unread" && notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-4 min-h-tap md:pointer-fine:min-h-0 px-4 py-2 text-sm font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Show all notifications
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((notif) => (
              <NotificationItem
                key={notif.id}
                notif={notif}
                link={linkFor(notif.link, portal)}
                kind={kindOf(notif.type)}
                onRead={markRead}
              />
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

function NotificationItem({
  notif,
  link,
  kind,
  onRead,
}: {
  notif: AppNotification;
  /** Its link, as this portal can open it. */
  link: string | null;
  kind: { icon: LucideIcon; tone: string };
  onRead: (id: string) => void;
}) {
  const Icon = kind.icon;
  const unread = !notif.isRead;
  const destination = link ? destinationOf(link) : null;
  const isLong = notif.message.length > LONG_MESSAGE;
  const [expanded, setExpanded] = useState(false);

  // What a truck notification carries beyond its message. Shown only where
  // there is something to show.
  const facts = [
    notif.truckPlate && `Truck ${notif.truckPlate}`,
    notif.vehicleType,
    notif.crewName && `From ${notif.crewName}`,
  ].filter(Boolean) as string[];

  return (
    <li className={`relative flex gap-3 sm:gap-4 px-3 sm:px-5 py-4 transition-colors ${unread ? "bg-blue-50/60" : ""}`}>
      {/* Unread is marked by more than the tint: a bar a colour-blind eye
          still sees, and words for a screen reader. */}
      {unread && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-blue-600" />}

      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border flex shrink-0 items-center justify-center ${kind.tone}`}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className={`text-sm sm:text-base font-semibold wrap-break-word ${unread ? "text-slate-900" : "text-slate-700"}`}>
            {unread && <span className="sr-only">Unread: </span>}
            {notif.title}
          </h3>
          <span className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap shrink-0 pt-0.5">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {notif.time}
          </span>
        </div>

        <p className={`max-w-3xl text-sm text-slate-600 leading-relaxed mt-1 wrap-break-word ${isLong && !expanded ? "line-clamp-3" : ""}`}>
          {notif.message}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-0.5 -my-1.5 py-1.5 pr-3 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {facts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {facts.map((fact) => (
              <span key={fact} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {fact}
              </span>
            ))}
          </div>
        )}
        {notif.issue && <p className="mt-2 text-xs text-slate-600 wrap-break-word">{notif.issue}</p>}
        {notif.reason && (
          <p className="mt-1 text-xs font-medium text-red-600 wrap-break-word">Reason: {notif.reason}</p>
        )}

        {/* On a phone the two buttons share one row: they used to stack,
            making every notification twice as tall as it needed to be. */}
        {(link || unread) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {link && (
              <Link
                href={link}
                onClick={() => onRead(notif.id)}
                aria-label={destination ? `Open ${destination}` : "Open"}
                className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                {/* A phone drops the "Open": the arrow says it, and the name is
                    what keeps "Mark as read" on the same row. */}
                {destination ? (
                  <span>
                    <span className="hidden sm:inline">Open </span>
                    {destination}
                  </span>
                ) : (
                  "Open"
                )}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            )}
            {unread && (
              <button
                type="button"
                onClick={() => onRead(notif.id)}
                className="min-h-tap md:pointer-fine:min-h-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Check className="hidden sm:block w-3.5 h-3.5" aria-hidden="true" />
                Mark as read
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
