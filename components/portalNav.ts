// ==========================================
// LOGISCO - PORTAL NAVIGATION
// ==========================================
// The pages each portal's sidebar links to, in one place, sorted into the
// groups the sidebar prints. There used to be three sidebars, each with its
// own copy of its links.

import {
  Calendar,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageSquareWarning,
  Truck,
  UserSquare2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type Portal = "admin" | "crew" | "mechanic";

/** A number on a link: things waiting there for this person. */
export type NavBadge = "proofReview" | "clientReports" | "roadside";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other sections that belong under this link: the feeds are opened from
      the dashboard, so the dashboard stays lit while one is on screen. */
  also?: string[];
  badge?: NavBadge;
}

export interface NavGroup {
  /** Printed above the group. None for a portal with too few links to sort. */
  label?: string;
  items: NavItem[];
}

export const PORTAL_NAV: Record<Portal, { name: string; groups: NavGroup[] }> = {
  admin: {
    name: "admin",
    groups: [
      {
        label: "Overview",
        items: [
          { href: "/admindashboard/dashboard", label: "Dashboard", icon: LayoutDashboard, also: ["/admindashboard/feeds"] },
          { href: "/admindashboard/calendar", label: "Calendar", icon: Calendar },
        ],
      },
      {
        label: "Operations",
        items: [
          // History Logs opens from a button on Fleet Status, so it keeps this lit.
          { href: "/admindashboard/fleet-status", label: "Fleet Status", icon: Truck, also: ["/admindashboard/history-logs"] },
          { href: "/admindashboard/fleet-tracking", label: "Fleet Live Tracking", icon: MapPin },
          { href: "/admindashboard/proof-review", label: "Proof Review", icon: ClipboardCheck, badge: "proofReview" },
        ],
      },
      {
        label: "People",
        items: [
          { href: "/admindashboard/clients", label: "Clients & Partners", icon: Users },
          { href: "/admindashboard/employees", label: "Employee Directory", icon: UserSquare2 },
        ],
      },
      {
        label: "Reports",
        items: [
          { href: "/admindashboard/client-reports", label: "Client Reports", icon: MessageSquareWarning, badge: "clientReports" },
          { href: "/admindashboard/reports", label: "Reports & Forecast", icon: FileText, also: ["/admindashboard/forecasting"] },
        ],
      },
    ],
  },
  crew: {
    name: "crew",
    groups: [
      {
        items: [
          { href: "/crew/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/crew/calendar", label: "Calendar", icon: Calendar },
          { href: "/crew/delivery-history", label: "Delivery History", icon: Truck },
        ],
      },
    ],
  },
  mechanic: {
    name: "mechanic",
    groups: [
      {
        label: "Jobs",
        items: [
          // First, because it is the one with someone waiting at the side of a road.
          { href: "/mechanic/roadside", label: "Roadside Jobs", icon: Wrench, badge: "roadside" },
        ],
      },
      {
        label: "Fleet",
        items: [
          { href: "/mechanic/fleet-status", label: "Fleet Status", icon: Truck },
          { href: "/mechanic/fleet-tracking", label: "Fleet Live Tracking", icon: MapPin },
          { href: "/mechanic/history-logs", label: "History Logs", icon: FileText },
        ],
      },
    ],
  },
};

function under(pathname: string, section: string): boolean {
  return pathname === section || pathname.startsWith(section + "/");
}

/** Whether a link is the one for the page on screen, including its sub-pages
    (the calendar's queues, a truck's history) and anything listed in `also`. */
export function isActive(pathname: string, item: NavItem): boolean {
  return [item.href, ...(item.also ?? [])].some((section) => under(pathname, section));
}
