// ==========================================
// LOGISCO - PORTAL NAVIGATION
// ==========================================
// The pages each portal's sidebar links to, in one place. There used to be
// three sidebars, each with its own copy of its links.

import {
  Calendar,
  FileText,
  LayoutDashboard,
  MapPin,
  Truck,
  UserSquare2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type Portal = "admin" | "crew" | "mechanic";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other sections that belong under this link: the feeds are opened from
      the dashboard, so the dashboard stays lit while one is on screen. */
  also?: string[];
}

export const PORTAL_NAV: Record<Portal, { name: string; items: NavItem[] }> = {
  admin: {
    name: "admin",
    items: [
      { href: "/admindashboard/dashboard", label: "Dashboard", icon: LayoutDashboard, also: ["/admindashboard/feeds"] },
      { href: "/admindashboard/calendar", label: "Calendar", icon: Calendar },
      { href: "/admindashboard/clients", label: "Clients & Partners", icon: Users },
      { href: "/admindashboard/employees", label: "Employee Directory", icon: UserSquare2 },
      // History Logs opens from a button on Fleet Status, so it keeps this lit.
      { href: "/admindashboard/fleet-status", label: "Fleet Status", icon: Truck, also: ["/admindashboard/history-logs"] },
      { href: "/admindashboard/fleet-tracking", label: "Fleet Live Tracking", icon: MapPin },
      { href: "/admindashboard/reports", label: "Reports & Forecast", icon: FileText, also: ["/admindashboard/forecasting"] },
    ],
  },
  crew: {
    name: "crew",
    items: [
      { href: "/crew/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/crew/calendar", label: "Calendar", icon: Calendar },
      { href: "/crew/delivery-history", label: "Delivery History", icon: Truck },
    ],
  },
  mechanic: {
    name: "mechanic",
    items: [
      // First, because it is the one with someone waiting at the side of a road.
      { href: "/mechanic/roadside", label: "Roadside Jobs", icon: Wrench },
      { href: "/mechanic/fleet-status", label: "Fleet Status", icon: Truck },
      { href: "/mechanic/fleet-tracking", label: "Fleet Live Tracking", icon: MapPin },
      { href: "/mechanic/history-logs", label: "History Logs", icon: FileText },
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
