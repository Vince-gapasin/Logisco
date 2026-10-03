import { DELIVERY_STATUS } from "@/app/lib/enums";
import { type OrderWithRelations } from "@/app/lib/bookingView";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
} from "lucide-react";

// A trip that has left the yard and has not finished yet.
export const ON_THE_ROAD_STATUSES: string[] = [
  DELIVERY_STATUS.startDelivery,
  DELIVERY_STATUS.inWarehouse,
  DELIVERY_STATUS.inTransit,
  DELIVERY_STATUS.arrived,
];

// ==========================================
// SESSION & API FETCH
// ==========================================

// ==========================================
// CONSTANTS & DATA
// ==========================================

export const COLOR_STYLES = {
  orange: {
    iconBg: "bg-orange-50",
    iconText: "text-orange-500",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-700",
  },
  blue: {
    iconBg: "bg-blue-50",
    iconText: "text-blue-500",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
  },
  green: {
    iconBg: "bg-green-50",
    iconText: "text-green-500",
    badgeBg: "bg-green-100",
    badgeText: "text-green-700",
  },
  red: {
    iconBg: "bg-red-50",
    iconText: "text-red-500",
    badgeBg: "bg-red-100",
    badgeText: "text-red-700",
  },
};

// Where a bucket's booking is opened: the list's own detail screen, so a card
// here and a row under View All show the same thing. Foul trips are missing on
// purpose - they already open the Foul Trip screen's own modal, recovery
// options and all, without leaving the dashboard.
export const FEED_ROUTE: Record<string, string> = {
  "Pending Bookings": "/admindashboard/feeds/pending",
  "In-Transit": "/admindashboard/feeds/in-transit",
  Completed: "/admindashboard/feeds/completed",
};

// A row on one of the four feed cards. Built from an order and the trip on
// it, and read by the card, the modal and whatever the row opens.
export interface DashboardBooking {
  orderId: string;
  client: string;
  product: string;
  driver: string;
  helper: string;
  dateTime: string;
  driverConfirmed: boolean;
  helperConfirmed: boolean;
  dispatchStatus: string;
  currentStep: number;
  isSubcon: boolean;
  partnerName: string;
  dispatchID: string | null;
  rawOrder: OrderWithRelations;
  statusCategory: string;
}

export const TABS = [
  {
    name: "Pending Bookings",
    icon: Clock,
    color: "orange",
    statusLabel: "Pending",
    route: "/admindashboard/feeds/pending",
  },
  {
    name: "In-Transit",
    icon: Truck,
    color: "blue",
    statusLabel: "In-Transit",
    route: "/admindashboard/feeds/in-transit",
  },
  {
    name: "Completed",
    icon: CheckCircle2,
    color: "green",
    statusLabel: "Delivered",
    route: "/admindashboard/feeds/completed",
  },
  {
    name: "Foul Trip",
    icon: AlertTriangle,
    color: "red",
    statusLabel: "Foul Trip",
    route: "/admindashboard/feeds/foul-trip",
  },
];
