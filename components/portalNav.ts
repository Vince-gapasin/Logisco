// ==========================================
// LOGISCO - PORTAL NAVIGATION
// ==========================================
// The pages each portal links to, in one place. The sidebar and the phone tab
// bar both draw from this, so a page added here appears in both and the two
// can never disagree about where a link goes.

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
  /** What the phone tab bar shows, where there is room for one word. */
  short: string;
  icon: LucideIcon;
  /** Other sections that belong under this link: the feeds are opened from
      the dashboard, so the dashboard stays lit while one is on screen. */
  also?: string[];
}

export const PORTAL_NAV: Record<Portal, { name: string; items: NavItem[] }> = {
  admin: {
    name: "admin",
    items: [
      { href: "/admindashboard/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard, also: ["/admindashboard/feeds"] },
      { href: "/admindashboard/calendar", label: "Calendar", short: "Calendar", icon: Calendar },
      { href: "/admindashboard/clients", label: "Clients & Partners", short: "Clients", icon: Users },
      { href: "/admindashboard/employees", label: "Employee Directory", short: "Employees", icon: UserSquare2 },
      { href: "/admindashboard/fleet-status", label: "Fleet Status", short: "Fleet", icon: Truck },
      { href: "/admindashboard/fleet-tracking", label: "Fleet Live Tracking", short: "Tracking", icon: MapPin },
      { href: "/admindashboard/reports", label: "Reports & Forecast", short: "Reports", icon: FileText, also: ["/admindashboard/forecasting"] },
    ],
  },
  crew: {
    name: "crew",
    items: [
      { href: "/crew/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
      { href: "/crew/calendar", label: "Calendar", short: "Calendar", icon: Calendar },
      { href: "/crew/delivery-history", label: "Delivery History", short: "History", icon: Truck },
    ],
  },
  mechanic: {
    name: "mechanic",
    items: [
      // First, because it is the one with someone waiting at the side of a road.
      { href: "/mechanic/roadside", label: "Roadside Jobs", short: "Roadside", icon: Wrench },
      { href: "/mechanic/fleet-status", label: "Fleet Status", short: "Fleet", icon: Truck },
      { href: "/mechanic/fleet-tracking", label: "Fleet Live Tracking", short: "Tracking", icon: MapPin },
      { href: "/mechanic/history-logs", label: "History Logs", short: "Logs", icon: FileText },
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
