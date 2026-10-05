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
//
// How results are chosen. The database is asked for a generous handful of
// candidates per kind (CANDIDATES); each candidate is then scored here on how
// well it matches (scoreMatch), and the best few of each kind are kept and
// ordered by their best score (rankResults). A plain "contains" used to be
// the whole rule, which made two letters match nearly everything: "or" hit
// every booking through its "ORD-" prefix, and the list was cut to five rows
// alphabetically before anyone asked which matched best.

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
  /** The one clear best answer, shown above the groups. */
  top?: boolean;
}

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 60;

/** Rows asked of the database per kind, before scoring. */
const CANDIDATES = 20;
/** Results shown per kind, and in all. */
const PER_GROUP = 4;
const MAX_RESULTS = 12;

/** A score at or above this is an exact match, give or take spacing. */
const EXACT = 95;

const ORDER_CODE_PREFIX = "ORD-";

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

// ------------------------------------------------------------- matching

/** Lower case, accents dropped: "Parañaque" and "paranaque" compare equal. */
export function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Case- and accent-insensitive "contains".
export function looselyContains(haystack: string | null | undefined, needle: string): boolean {
  return fold(haystack ?? "").includes(fold(needle));
}

const SEPARATOR = /[\s\-./'&@#]/;
const SEPARATORS = /[\s\-./'&@#]+/g;

/** "ABC 1234" and "abc-1234" both become "abc1234". */
function compact(value: string): string {
  return value.replace(SEPARATORS, "");
}

/** True when `token` starts the value or starts one of its words. */
function startsAWord(value: string, token: string): boolean {
  for (let at = value.indexOf(token); at >= 0; at = value.indexOf(token, at + 1)) {
    if (at === 0 || SEPARATOR.test(value[at - 1])) return true;
  }
  return false;
}

/**
 * What of a typed token is left to compare with a code that carries a fixed
 * prefix. "ord-4829" and "ord4829" leave "4829"; anything that is only the
 * prefix ("o", "or", "ord", "ord-") leaves nothing, since every code has it.
 */
export function codeRemainder(token: string, prefix = ORDER_CODE_PREFIX): string | null {
  const p = fold(prefix);
  const bare = p.replace(/-$/, "");
  const t = fold(token);
  if (p.startsWith(t)) return null;
  if (t.startsWith(p)) return t.slice(p.length) || null;
  if (new RegExp(`^${bare}\\d`).test(t)) return t.slice(bare.length);
  return t;
}

export interface SearchField {
  value: string | null | undefined;
  /** A supporting field - a contact person, a truck model - counts for less. */
  secondary?: boolean;
  /** A prefix every value carries, ignored when matching ("ORD-"). */
  prefix?: string;
}

function tokenScore(token: string, field: SearchField): number {
  let value = fold(field.value ?? "");
  let t = token;
  if (field.prefix && value.startsWith(fold(field.prefix))) {
    value = value.slice(field.prefix.length);
    const rest = codeRemainder(t, field.prefix);
    if (!rest) return 0;
    t = rest;
  }
  if (!value || !t) return 0;

  // Two characters only count at the start of a word: "an" finds "Andaya",
  // not every name with an "an" in the middle.
  const long = t.length >= 3;
  let score = 0;
  if (value === t) score = 100;
  else if (long && compact(value) === compact(t)) score = EXACT;
  else if (value.startsWith(t)) score = 80;
  else if (startsAWord(value, t)) score = 60;
  else if (long && compact(t).length >= 3 && compact(value).startsWith(compact(t))) score = 55;
  else if (long && value.includes(t)) score = 20;
  else if (long && compact(t).length >= 3 && compact(value).includes(compact(t))) score = 15;

  if (score > 0 && field.secondary) score = Math.max(5, score - 15);
  return score;
}

/**
 * How well a result matches what was typed, from 0 to 100, or null when it
 * does not match. Each word typed must match one of the fields; the score is
 * the average of each word's best, or the whole phrase's if that is higher.
 */
export function scoreMatch(query: string, fields: SearchField[]): number | null {
  const phrase = fold(query).replace(/\s+/g, " ").trim();
  const tokens = phrase.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  for (const token of tokens) {
    const best = Math.max(0, ...fields.map((field) => tokenScore(token, field)));
    if (best === 0) return null;
    total += best;
  }
  let score = total / tokens.length;
  if (tokens.length > 1) {
    score = Math.max(score, ...fields.map((field) => tokenScore(phrase, field)));
  }
  return score;
}

/**
 * What was typed looks like: an order code or plate ("code"), a name
 * ("name"), or could be either. A code query puts bookings and trucks first.
 */
export function queryShape(query: string): "code" | "name" | "mixed" {
  const digits = (query.match(/\p{N}/gu) ?? []).length;
  const letters = (query.match(/\p{L}/gu) ?? []).length;
  if (/^ord-?\d/i.test(query) || (digits > 0 && digits >= letters)) return "code";
  if (digits === 0) return "name";
  return "mixed";
}

const SHAPE_BONUS: Record<ReturnType<typeof queryShape>, Partial<Record<SearchResultType, number>>> = {
  code: { booking: 10, truck: 10, delivery: 10 },
  name: { client: 5, employee: 5 },
  mixed: {},
};

export interface Candidate {
  result: SearchResult;
  score: number;
}

/**
 * The list the box shows: the best few of each kind, the kinds ordered by
 * their best result, and a single clear exact match lifted out on top.
 */
export function rankResults(
  candidates: Candidate[],
  { perGroup = PER_GROUP, total = MAX_RESULTS }: { perGroup?: number; total?: number } = {},
): SearchResult[] {
  // Stable, so equal scores keep the database's order (A-Z, or newest first).
  const sorted = candidates
    .map((candidate, index) => ({ ...candidate, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  let top: SearchResult | null = null;
  if (sorted.length > 0 && sorted[0].score >= EXACT && !(sorted[1]?.score >= EXACT)) {
    top = { ...sorted[0].result, top: true };
    sorted.shift();
  }

  const groups = new Map<SearchResultType, SearchResult[]>();
  for (const { result } of sorted) {
    const group = groups.get(result.type) ?? [];
    if (group.length < perGroup) group.push(result);
    groups.set(result.type, group);
  }

  // The map was filled best-first, so its order is already each kind's best.
  const ranked = [...groups.values()].flat();
  return (top ? [top, ...ranked] : ranked).slice(0, total);
}

// --------------------------------------------------------- database side
//
// The database narrows the field to candidates with ILIKE. It follows the
// same rules as tokenScore, loosely - scoring decides what is shown.

/**
 * The token as a LIKE pattern body. In longer words an n or e may stand for
 * ñ or é and the other way round, so "Paranaque" finds "Parañaque"; the
 * scorer, which folds accents, then drops anything that only looked alike.
 */
function likeBody(token: string): string {
  return token.length >= 4 ? [...token].map((c) => (/[nñeéèêë]/i.test(c) ? "_" : c)).join("") : token;
}

/** PostgREST or() clauses that find `token` in `column`. */
export function likeClauses(column: string, token: string): string[] {
  const t = likeBody(token);
  if (token.length < 3) {
    return [`${column}.ilike."${t}%"`, `${column}.ilike."% ${t}%"`, `${column}.ilike."%-${t}%"`];
  }
  const clauses = [`${column}.ilike."%${t}%"`];
  // "abc1234" or "abc-1234" for a plate stored as "ABC 1234".
  const spaced = token
    .replace(SEPARATORS, "%")
    .replace(/(\p{L})(?=\p{N})|(\p{N})(?=\p{L})/gu, "$1$2%");
  if (spaced !== token) clauses.push(`${column}.ilike."%${likeBody(spaced)}%"`);
  return clauses;
}

/** Clauses for an order code, skipping its "ORD-" prefix. */
export function orderCodeClauses(token: string): string[] {
  const rest = codeRemainder(token);
  if (!rest) return [];
  const t = likeBody(rest);
  const clauses =
    rest.length < 3
      ? [`orderCode.ilike."${ORDER_CODE_PREFIX}${t}%"`, `orderCode.ilike."${ORDER_CODE_PREFIX}%-${t}%"`]
      : [`orderCode.ilike."${ORDER_CODE_PREFIX}%${t}%"`];
  // Any code made before the prefix existed.
  clauses.push(`and(orderCode.not.ilike."${ORDER_CODE_PREFIX}%",orderCode.ilike."%${t}%")`);
  return clauses;
}

/** Every token must match one of the columns. */
function eachTokenIn(columns: string[], tokens: string[]): string[] {
  return tokens.map((token) => columns.flatMap((column) => likeClauses(column, token)).join(","));
}

/** Any token may match one of the columns; the scorer checks the rest. */
function anyTokenIn(clauses: (token: string) => string[], tokens: string[]): string {
  return tokens.flatMap(clauses).join(",");
}

function tokensOf(q: string): string[] {
  return q.toLowerCase().split(" ").filter(Boolean);
}

// The columns each query selects. Embedded relations come back as an object
// or a one-element array depending on the relationship, so they are typed as
// either and unwrapped with first().
type Embed<T> = T | T[] | null;

interface OrderRow {
  orderID: string;
  orderCode: string;
  createdAt: string | null;
  DispatchOrder: { status: string | null }[] | null;
  FoulTripIncident: { status: string; blocking?: boolean }[] | null;
  Client: Embed<{ clientID: string | null; company: string | null }>;
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

const NOTHING = Promise.resolve({ data: [] as unknown[], error: null });

const DAY_MS = 24 * 60 * 60 * 1000;

function truckFields(truck: TruckRow): SearchField[] {
  return [{ value: truck.plateNumber }, { value: truck.model, secondary: true }];
}

function truckResult(truck: TruckRow, href: string): SearchResult {
  return {
    id: `truck-${truck.truckID}`,
    type: "truck",
    title: truck.plateNumber,
    subtitle: [truck.model || truck.truckType, truck.truckStatus].filter(Boolean).join(" · "),
    href,
  };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------- office

async function searchOffice(q: string): Promise<SearchResult[]> {
  const tokens = tokensOf(q);
  const bonus = SHAPE_BONUS[queryShape(q)];

  const bookingColumns =
    "orderID, orderCode, createdAt, DispatchOrder ( status ), FoulTripIncident ( status, blocking )";
  const codeFilter = anyTokenIn(orderCodeClauses, tokens);

  let clientQuery = supabase.from("Client").select("clientID, company, contactName").eq("isActive", true);
  for (const clause of eachTokenIn(["company", "contactName"], tokens)) clientQuery = clientQuery.or(clause);

  let employeeQuery = supabase
    .from("Employee")
    .select("employeeID, employeeName, role")
    .eq("isActive", true);
  for (const clause of eachTokenIn(["employeeName"], tokens)) employeeQuery = employeeQuery.or(clause);

  let truckQuery = supabase
    .from("Truck")
    .select("truckID, plateNumber, model, truckType, truckStatus")
    .eq("isActive", true);
  for (const clause of eachTokenIn(["plateNumber", "model"], tokens)) truckQuery = truckQuery.or(clause);

  // Cancelled bookings are left out: every booking screen lists active
  // orders only, so a cancelled one would lead to a screen that cannot show it.
  const [byCode, byClient, clients, employees, trucks] = await Promise.all([
    codeFilter
      ? supabase
          .from("Order")
          .select(`${bookingColumns}, Client ( clientID, company )`)
          .eq("isActive", true)
          .or(codeFilter)
          .order("createdAt", { ascending: false })
          .limit(CANDIDATES)
      : NOTHING,
    supabase
      .from("Order")
      .select(`${bookingColumns}, Client!inner ( clientID, company )`)
      .eq("isActive", true)
      .or(anyTokenIn((token) => likeClauses("company", token), tokens), { referencedTable: "Client" })
      .order("createdAt", { ascending: false })
      .limit(CANDIDATES),
    clientQuery.order("company").limit(CANDIDATES),
    employeeQuery.order("employeeName").limit(CANDIDATES),
    truckQuery.order("plateNumber").limit(CANDIDATES),
  ]);

  for (const { error } of [byCode, byClient, clients, employees, trucks]) {
    if (error) throw new Error(error.message);
  }

  const candidates: Candidate[] = [];
  const add = (result: SearchResult, score: number | null) => {
    if (score !== null) candidates.push({ result, score: score + (bonus[result.type] ?? 0) });
  };

  // Clients first, since which of them are shown decides which bookings are.
  const clientMatches = ((clients.data ?? []) as ClientRow[])
    .map((client) => ({
      client,
      score: scoreMatch(q, [{ value: client.company }, { value: client.contactName, secondary: true }]),
    }))
    .filter((match): match is { client: ClientRow; score: number } => match.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_GROUP);

  // A client shown in the list stands for its bookings: they are counted on
  // its line rather than listed under it. Searching "KFC" used to show KFC
  // and then five KFC bookings.
  const shownClients = new Set(clientMatches.map(({ client }) => client.clientID));
  const bookingCounts = new Map<string, number>();
  if (shownClients.size > 0) {
    const { data, error } = await supabase
      .from("Order")
      .select("clientID")
      .eq("isActive", true)
      .in("clientID", [...shownClients]);
    if (error) throw new Error(error.message);
    for (const { clientID } of (data ?? []) as { clientID: string }[]) {
      bookingCounts.set(clientID, (bookingCounts.get(clientID) ?? 0) + 1);
    }
  }

  for (const { client, score } of clientMatches) {
    const count = bookingCounts.get(client.clientID) ?? 0;
    add(
      {
        id: `client-${client.clientID}`,
        type: "client",
        title: client.company,
        subtitle: [client.contactName ? `Contact: ${client.contactName}` : "Client", count ? plural(count, "booking") : ""]
          .filter(Boolean)
          .join(" · "),
        href: withQuery("/admindashboard/clients", client.company),
      },
      score,
    );
  }

  const seen = new Set<string>();
  const orders = ([...(byCode.data ?? []), ...(byClient.data ?? [])] as unknown as OrderRow[]).filter(
    (order) => (seen.has(order.orderID) ? false : (seen.add(order.orderID), true)),
  );

  const now = Date.now();
  for (const order of orders) {
    const client = first(order.Client);
    const companyField: SearchField = { value: client?.company, secondary: true };
    if (client?.clientID && shownClients.has(client.clientID) && scoreMatch(q, [companyField]) !== null) {
      continue;
    }

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

    let score = scoreMatch(q, [{ value: order.orderCode, prefix: ORDER_CODE_PREFIX }, companyField]);
    if (score === null) continue;
    // Among equal matches, a booking still under way, then a recent one.
    if (where.label !== "Completed") score += 5;
    if (order.createdAt && now - new Date(order.createdAt).getTime() < 30 * DAY_MS) score += 3;

    add(
      {
        id: `booking-${order.orderID}`,
        type: "booking",
        title: order.orderCode,
        subtitle: `${client?.company || "Walk-in customer"} · ${where.label}`,
        href: withQuery(where.path, order.orderCode),
      },
      score,
    );
  }

  for (const employee of (employees.data ?? []) as EmployeeRow[]) {
    add(
      {
        id: `employee-${employee.employeeID}`,
        type: "employee",
        title: employee.employeeName,
        subtitle: employee.role || "Employee",
        href: withQuery("/admindashboard/employees", employee.employeeName),
      },
      scoreMatch(q, [{ value: employee.employeeName }]),
    );
  }

  for (const truck of (trucks.data ?? []) as TruckRow[]) {
    add(truckResult(truck, withQuery("/admindashboard/fleet-status", truck.plateNumber)), scoreMatch(q, truckFields(truck)));
  }

  return rankResults(candidates);
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

  // Already scoped to one person's handful of trips, so every one of them
  // is scored here rather than narrowed in the database.
  const candidates: Candidate[] = [];
  for (const trip of trips.values()) {
    const order = first(trip.Order);
    const bookingId: string = order?.orderCode || trip.dispatchCode || "";
    const company: string = first(order?.Client)?.company || "";
    if (!bookingId) continue;

    let score = scoreMatch(q, [
      { value: bookingId, prefix: ORDER_CODE_PREFIX },
      { value: company, secondary: true },
    ]);
    if (score === null) continue;
    if (trip.status && !(FINISHED_DELIVERY_STATUSES as string[]).includes(trip.status)) score += 5;

    candidates.push({
      score,
      result: {
        id: `delivery-${trip.dispatchID}`,
        type: "delivery",
        title: bookingId,
        subtitle: [company, trip.status].filter(Boolean).join(" · "),
        href: withQuery("/crew/dashboard", bookingId),
      },
    });
  }

  return rankResults(candidates, { perGroup: MAX_RESULTS });
}

// -------------------------------------------------------------- mechanic

async function searchFleet(q: string, basePath: string): Promise<SearchResult[]> {
  let query = supabase
    .from("Truck")
    .select("truckID, plateNumber, model, truckType, truckStatus")
    .eq("isActive", true);
  for (const clause of eachTokenIn(["plateNumber", "model"], tokensOf(q))) query = query.or(clause);

  const { data, error } = await query.order("plateNumber").limit(CANDIDATES);
  if (error) throw new Error(error.message);

  const candidates: Candidate[] = [];
  for (const truck of (data ?? []) as TruckRow[]) {
    const score = scoreMatch(q, truckFields(truck));
    if (score !== null) {
      candidates.push({ score, result: truckResult(truck, withQuery(`${basePath}/fleet-status`, truck.plateNumber)) });
    }
  }
  return rankResults(candidates, { perGroup: MAX_RESULTS });
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
