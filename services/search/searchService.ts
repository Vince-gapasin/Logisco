// The search box in the portal header.
//
// It used to be an <input> with no handler behind it: it sat at the top of
// every screen in all three portals and did nothing when typed into. It now
// searches what the signed-in role is allowed to see and links each result to
// the screen that already lists it, with that screen's own filter set.
//
// Results are scoped by role on the server, never by the client:
//   office (Admin, Coordinator) - bookings, clients, employees, trucks
//   crew   (Driver, Helper)     - only the deliveries assigned to them
//   Mechanic                    - trucks

import { supabase } from "@/app/lib/supabase";
import {
  DELIVERY_STATUS,
  EMPLOYEE_ROLE,
  FINISHED_DELIVERY_STATUSES,
  HELPER_STATUS,
} from "@/app/lib/enums";

export type SearchResultType = "booking" | "delivery" | "client" | "employee" | "truck";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
}

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 60;

const PER_GROUP = 5;

// Letters in any script (so "Parañaque" survives), digits, spaces, and the
// punctuation that turns up in names, order codes and plate numbers.
// Everything else is dropped. That also removes the characters PostgREST
// treats as syntax inside or() - commas, parentheses, quotes - and the LIKE
// wildcards, so the value can be interpolated into a filter safely.
export function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s\-.'&@#/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
  return cleaned.length >= MIN_QUERY_LENGTH ? cleaned : null;
}

/** A destination screen with its own search box pre-filled. */
export function withQuery(path: string, value: string): string {
  return `${path}?q=${encodeURIComponent(value)}`;
}

// Which booking screen a booking appears on, decided by its live dispatch the
// same way the booking screens decide it: the first dispatch that was neither
// rejected nor aborted, otherwise the last one.
// Returns null for a booking no screen lists - its live dispatch cancelled -
// rather than linking to a page that will show an empty table.
export function bookingDestination(statuses: (string | null | undefined)[]): {
  path: string;
  label: string;
} | null {
  const all = statuses.filter((s): s is string => Boolean(s));
  const live =
    all.find((s) => s !== DELIVERY_STATUS.rejected && s !== DELIVERY_STATUS.foulTrip) ??
    all[all.length - 1];

  if (!live || live === DELIVERY_STATUS.rejected) {
    return { path: "/admindashboard/calendar/unassigned-bookings", label: "Needs assignment" };
  }
  if (live === DELIVERY_STATUS.pending || live === DELIVERY_STATUS.assigned) {
    return { path: "/admindashboard/calendar/awaiting-confirmation", label: "Awaiting crew" };
  }
  if (live === DELIVERY_STATUS.accepted) {
    return { path: "/admindashboard/feeds/pending", label: "Ready to depart" };
  }
  if (live === DELIVERY_STATUS.foulTrip) {
    return { path: "/admindashboard/feeds/foul-trip", label: "Foul trip" };
  }
  if ((FINISHED_DELIVERY_STATUSES as string[]).includes(live)) {
    return { path: "/admindashboard/feeds/completed", label: "Completed" };
  }
  if (live === DELIVERY_STATUS.cancelled) return null;
  return { path: "/admindashboard/feeds/in-transit", label: "In transit" };
}

// Case- and accent-insensitive "contains", for the crew list, which is
// filtered here rather than in the database because it is already scoped to
// one person's handful of trips.
export function looselyContains(haystack: string | null | undefined, needle: string): boolean {
  const fold = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return fold(haystack ?? "").includes(fold(needle));
}

// The columns each query selects. Embedded relations come back as an object
// or a one-element array depending on the relationship, so they are typed as
// either and unwrapped with first().
type Embed<T> = T | T[] | null;

interface OrderRow {
  orderID: string;
  orderCode: string;
  DispatchOrder: { status: string | null }[] | null;
  FoulTripIncident: { status: string; blocking?: boolean }[] | null;
  Client: Embed<{ company: string | null }>;
}

interface ClientRow {
  clientID: string;
  company: string;
  contactName: string | null;
}

interface EmployeeRow {
  employeeID: string;
  employeeName: string;
  role: string | null;
}

interface TruckRow {
  truckID: string;
  plateNumber: string;
  model: string | null;
  truckType: string | null;
  truckStatus: string | null;
}

interface TripRow {
  dispatchID: string;
  dispatchCode: string | null;
  status: string | null;
  Order: Embed<{ orderCode: string | null; Client: Embed<{ company: string | null }> }>;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ---------------------------------------------------------------- office

async function searchOffice(q: string): Promise<SearchResult[]> {
  const pattern = `%${q}%`;
  const quoted = `"${pattern}"`;

  const bookingColumns =
    "orderID, orderCode, createdAt, DispatchOrder ( status ), FoulTripIncident ( status, blocking )";

  // Cancelled bookings are left out: every booking screen lists active
  // orders only, so a cancelled one would lead to a screen that cannot show it.
  const [byCode, byClient, clients, employees, trucks] = await Promise.all([
    supabase
      .from("Order")
      .select(`${bookingColumns}, Client ( company )`)
      .eq("isActive", true)
      .ilike("orderCode", pattern)
      .order("createdAt", { ascending: false })
      .limit(PER_GROUP),
    supabase
      .from("Order")
      .select(`${bookingColumns}, Client!inner ( company )`)
      .eq("isActive", true)
      .ilike("Client.company", pattern)
      .order("createdAt", { ascending: false })
      .limit(PER_GROUP),
    supabase
      .from("Client")
      .select("clientID, company, contactName")
      .eq("isActive", true)
      .or(`company.ilike.${quoted},contactName.ilike.${quoted}`)
      .order("company")
      .limit(PER_GROUP),
    supabase
      .from("Employee")
      .select("employeeID, employeeName, role")
      .ilike("employeeName", pattern)
      .order("employeeName")
      .limit(PER_GROUP),
    supabase
      .from("Truck")
      .select("truckID, plateNumber, model, truckType, truckStatus")
      .eq("isActive", true)
      .or(`plateNumber.ilike.${quoted},model.ilike.${quoted},truckCode.ilike.${quoted}`)
      .order("plateNumber")
      .limit(PER_GROUP),
  ]);

  for (const { error } of [byCode, byClient, clients, employees, trucks]) {
    if (error) throw new Error(error.message);
  }

  // Grouped, then ordered: a name that matches a client, employee or truck
  // is the most direct answer, so those lead. Searching "KFC" used to list five
  // KFC bookings before KFC itself. An order code matches none of them, so
  // bookings still come first when that is what was typed.
  const bookings: SearchResult[] = [];
  const results: SearchResult[] = [];

  const seen = new Set<string>();
  const orders = ([...(byCode.data ?? []), ...(byClient.data ?? [])] as unknown as OrderRow[])
    .filter((order) => (seen.has(order.orderID) ? false : (seen.add(order.orderID), true)))
    .slice(0, PER_GROUP);

  for (const order of orders) {
    const dispatches = Array.isArray(order.DispatchOrder) ? order.DispatchOrder : [];
    const where = bookingDestination(dispatches.map((d) => d?.status));
    if (!where) continue;
    // The foul-trip screen lists open incidents only. A failed trip that was
    // closed without a recovery trip appears on no screen, so no link.
    if (
      where.path.endsWith("/foul-trip") &&
      !(order.FoulTripIncident ?? []).some(
        (i) => i.blocking !== false && (i.status === "open" || i.status === "mechanic_assigned"),
      )
    ) {
      continue;
    }
    const company = first(order.Client)?.company || "Walk-in customer";
    bookings.push({
      id: `booking-${order.orderID}`,
      type: "booking",
      title: order.orderCode,
      subtitle: `${company} · ${where.label}`,
      href: withQuery(where.path, order.orderCode),
    });
  }

  for (const client of (clients.data ?? []) as ClientRow[]) {
    results.push({
      id: `client-${client.clientID}`,
      type: "client",
      title: client.company,
      subtitle: client.contactName ? `Contact: ${client.contactName}` : "Client",
      href: withQuery("/admindashboard/clients", client.company),
    });
  }

  for (const employee of (employees.data ?? []) as EmployeeRow[]) {
    results.push({
      id: `employee-${employee.employeeID}`,
      type: "employee",
      title: employee.employeeName,
      subtitle: employee.role || "Employee",
      href: withQuery("/admindashboard/employees", employee.employeeName),
    });
  }

  for (const truck of (trucks.data ?? []) as TruckRow[]) {
    results.push({
      id: `truck-${truck.truckID}`,
      type: "truck",
      title: truck.plateNumber,
      subtitle: [truck.model || truck.truckType, truck.truckStatus].filter(Boolean).join(" · "),
      href: withQuery("/admindashboard/fleet-status", truck.plateNumber),
    });
  }

  return [...results, ...bookings];
}

// ------------------------------------------------------------------ crew

async function searchCrew(employeeID: string, q: string): Promise<SearchResult[]> {
  const tripColumns = "dispatchID, dispatchCode, status, Order ( orderCode, Client ( company ) )";

  const [asDriver, asHelper] = await Promise.all([
    supabase
      .from("DispatchOrder")
      .select(tripColumns)
      .eq("driverID", employeeID)
      .neq("status", DELIVERY_STATUS.rejected),
    supabase
      .from("DispatchHelper")
      .select(`status, DispatchOrder ( ${tripColumns} )`)
      .eq("helperID", employeeID)
      .neq("status", HELPER_STATUS.declined),
  ]);

  if (asDriver.error) throw new Error(asDriver.error.message);
  if (asHelper.error) throw new Error(asHelper.error.message);

  const trips = new Map<string, TripRow>();
  for (const trip of (asDriver.data ?? []) as unknown as TripRow[]) trips.set(trip.dispatchID, trip);
  for (const row of (asHelper.data ?? []) as unknown as { DispatchOrder: Embed<TripRow> }[]) {
    const trip = first(row.DispatchOrder);
    if (trip && trip.status !== DELIVERY_STATUS.rejected) trips.set(trip.dispatchID, trip);
  }

  const results: SearchResult[] = [];
  for (const trip of trips.values()) {
    const order = first(trip.Order);
    const bookingId: string = order?.orderCode || trip.dispatchCode || "";
    const company: string = first(order?.Client)?.company || "";
    if (!bookingId) continue;
    if (!looselyContains(bookingId, q) && !looselyContains(company, q)) continue;

    results.push({
      id: `delivery-${trip.dispatchID}`,
      type: "delivery",
      title: bookingId,
      subtitle: [company, trip.status].filter(Boolean).join(" · "),
      href: withQuery("/crew/dashboard", bookingId),
    });
    if (results.length >= PER_GROUP * 2) break;
  }

  return results;
}

// -------------------------------------------------------------- mechanic

async function searchFleet(q: string, basePath: string): Promise<SearchResult[]> {
  const quoted = `"%${q}%"`;
  const { data, error } = await supabase
    .from("Truck")
    .select("truckID, plateNumber, model, truckType, truckStatus")
    .eq("isActive", true)
    .or(`plateNumber.ilike.${quoted},model.ilike.${quoted},truckCode.ilike.${quoted}`)
    .order("plateNumber")
    .limit(PER_GROUP * 2);

  if (error) throw new Error(error.message);

  return ((data ?? []) as TruckRow[]).map((truck) => ({
    id: `truck-${truck.truckID}`,
    type: "truck" as const,
    title: truck.plateNumber,
    subtitle: [truck.model || truck.truckType, truck.truckStatus].filter(Boolean).join(" · "),
    href: withQuery(`${basePath}/fleet-status`, truck.plateNumber),
  }));
}

// ------------------------------------------------------------------ entry

export async function searchForRole(
  role: string,
  employeeID: string,
  q: string,
): Promise<SearchResult[]> {
  const normalized = (role ?? "").trim().toLowerCase();

  if (normalized === EMPLOYEE_ROLE.admin.toLowerCase() || normalized === EMPLOYEE_ROLE.coordinator.toLowerCase()) {
    return searchOffice(q);
  }
  if (normalized === EMPLOYEE_ROLE.driver.toLowerCase() || normalized === EMPLOYEE_ROLE.helper.toLowerCase()) {
    return searchCrew(employeeID, q);
  }
  if (normalized === EMPLOYEE_ROLE.mechanic.toLowerCase()) {
    return searchFleet(q, "/mechanic");
  }
  return [];
}
