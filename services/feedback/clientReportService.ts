// A client reporting a problem, and the office dealing with it.
//
// The feedback questions wait until a delivery is finished, on purpose: asking
// how it went while the truck is on the road gets an answer about the wrong
// thing. A complaint does not wait. A truck three hours late, a crew rude at the
// gate, a box crushed at the first stop - the client wants to say so now, and
// until this they could only phone.
//
// So the tracking page has a "Report a problem" button at every stage. The
// token is the capability, as it is for feedback: holding the link is what
// proves the caller is this client. The office is told at once, resolves the
// report on the Client Reports screen with a reply, and the reply is shown on
// the same tracking page - so the client can see it was read.
//
// Unlike feedback, a report is never folded into anyone's performance score.
// It is a thing to act on, not a vote.

import { supabase } from "@/app/lib/supabase";
import { liveDispatchOf } from "@/app/lib/bookingView";
import {
  MAX_CONTACT_BACK,
  MAX_REPORT_MESSAGE,
  isReportCategory,
  reportCategoryLabel,
  type ClientReportSummary,
  type ReportCategory,
  type ReportStatus,
} from "@/app/lib/clientReports";
import { notify, OFFICE } from "@/services/notifications/notify";

export class ClientReportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ClientReportError";
  }
}

/**
 * How many a link may send in a day. Enough for a bad day with several things
 * going wrong; not enough for a forwarded link to bury the office.
 */
export const DAILY_REPORT_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const SUMMARY_COLUMNS = "reportID, category, message, createdAt, status, resolvedAt, resolutionNote";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toSummary(row: Record<string, unknown>): ClientReportSummary {
  return {
    reportID: row.reportID as string,
    category: row.category as ReportCategory,
    message: row.message as string,
    createdAt: row.createdAt as string,
    status: row.status as ReportStatus,
    resolvedAt: (row.resolvedAt as string | null) ?? null,
    resolutionNote: (row.resolutionNote as string | null) ?? null,
  };
}

// ------------------------------------------------------------ the client side

export interface ReportInput {
  category: unknown;
  message: unknown;
  contactBack?: unknown;
}

/** Checks what the client sent, and trims it to what is kept. */
export function cleanReport(input: ReportInput): { category: ReportCategory; message: string; contactBack: string | null } {
  if (!isReportCategory(input.category)) {
    throw new ClientReportError("Please choose what the problem is about.");
  }
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) {
    throw new ClientReportError("Please tell us what happened.");
  }
  if (message.length > MAX_REPORT_MESSAGE) {
    throw new ClientReportError(`Please keep it under ${MAX_REPORT_MESSAGE} characters.`);
  }
  const contactBack =
    typeof input.contactBack === "string" ? input.contactBack.trim().slice(0, MAX_CONTACT_BACK) || null : null;

  return { category: input.category, message, contactBack };
}

/**
 * Records a report from the tracking link and tells the office.
 *
 * Any stage of the delivery, but not on a booking that was cancelled - the
 * tracking page does not offer it there, and the coordinator who cancelled it
 * is the one to call.
 */
export async function submitClientReport(token: string, input: ReportInput): Promise<ClientReportSummary> {
  const report = cleanReport(input);

  const { data: order, error } = await supabase
    .from("Order")
    .select("orderID, orderCode, isActive, Client ( company ), DispatchOrder ( dispatchID, status )")
    .eq("orderLinkToken", token)
    .maybeSingle();

  if (error) throw new ClientReportError(`Could not read the delivery: ${error.message}`, 500);
  if (!order || order.isActive === false) throw new ClientReportError("Tracking link not found.", 404);

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error: countError } = await supabase
    .from("ClientReport")
    .select("reportID", { count: "exact", head: true })
    .eq("orderID", order.orderID)
    .gte("createdAt", since);
  if (countError) throw new ClientReportError(`Could not save your report: ${countError.message}`, 500);
  if ((count ?? 0) >= DAILY_REPORT_LIMIT) {
    throw new ClientReportError(
      "We have several reports from this link today already. Please contact your coordinator directly.",
      429,
    );
  }

  const trips = (Array.isArray(order.DispatchOrder) ? order.DispatchOrder : [order.DispatchOrder]).filter(Boolean) as {
    dispatchID: string;
    status: string;
  }[];
  const trip = liveDispatchOf(trips);

  const { data, error: insertError } = await supabase
    .from("ClientReport")
    .insert({
      orderID: order.orderID,
      dispatchID: trip?.dispatchID ?? null,
      category: report.category,
      message: report.message,
      contactBack: report.contactBack,
      source: "tracking_link",
    })
    .select(SUMMARY_COLUMNS)
    .single();

  if (insertError) throw new ClientReportError(`Could not save your report: ${insertError.message}`, 500);

  const saved = toSummary(data);
  const company = one(order.Client as { company: string | null } | { company: string | null }[] | null)?.company;
  const booking = [order.orderCode, company ? `(${company})` : null].filter(Boolean).join(" ");

  await notify({
    event: "CLIENT_REPORT",
    title: `Client report: ${reportCategoryLabel(saved.category)}`,
    body: `${booking || "A booking"}: ${saved.message.length > 140 ? `${saved.message.slice(0, 137)}...` : saved.message}`,
    severity: "action",
    roles: OFFICE,
    entity: { table: "ClientReport", id: saved.reportID },
    link: `/admindashboard/client-reports?report=${saved.reportID}`,
  });

  return saved;
}

/**
 * This booking's reports, newest first, for the tracking page.
 *
 * Never fails the page: a tracking page that cannot show the reports is still
 * a tracking page.
 */
export async function reportsForOrder(orderID: string): Promise<ClientReportSummary[]> {
  const { data, error } = await supabase
    .from("ClientReport")
    .select(SUMMARY_COLUMNS)
    .eq("orderID", orderID)
    .order("createdAt", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[Client reports] Could not read a booking's reports:", error.message);
    return [];
  }
  return (data ?? []).map(toSummary);
}

/** What changes when the office answers, for the tracking page's fingerprint. */
export async function reportsStamp(orderID: string): Promise<unknown> {
  const { data, error } = await supabase
    .from("ClientReport")
    .select("reportID, status, resolvedAt")
    .eq("orderID", orderID);
  if (error) return null;
  return data ?? [];
}

// ------------------------------------------------------------ the office side

export type ReportQueue = ReportStatus;

export interface ReportForOffice extends ClientReportSummary {
  orderID: string;
  orderCode: string | null;
  client: string | null;
  clientContact: string | null;
  clientEmail: string | null;
  contactBack: string | null;
  driverName: string | null;
  resolvedByName: string | null;
}

/** Enough to clear a backlog, and short enough to load on a phone. */
const PAGE = 100;

export async function countOpenReports(): Promise<number> {
  const { count, error } = await supabase
    .from("ClientReport")
    .select("reportID", { count: "exact", head: true })
    .eq("status", "open");
  if (error) throw new Error(`Client report count failed: ${error.message}`);
  return count ?? 0;
}

export async function listReportsForOffice(queue: ReportQueue): Promise<ReportForOffice[]> {
  let query = supabase
    .from("ClientReport")
    .select(
      `${SUMMARY_COLUMNS}, orderID, contactBack,
       Order ( orderCode, Client ( company, contact, emailAdd ) ),
       DispatchOrder ( Employee!DispatchOrder_driverID_fkey ( employeeName ), partnerDriver ),
       Resolver:Employee!resolvedBy ( employeeName )`,
    )
    .eq("status", queue);
  // Open: the one waiting longest first. Resolved: the latest first.
  query =
    queue === "open"
      ? query.order("createdAt", { ascending: true })
      : query.order("resolvedAt", { ascending: false });

  const { data, error } = await query.limit(PAGE);
  if (error) throw new Error(`Client report list failed: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const order = one(row.Order as { orderCode: string | null; Client: unknown } | null);
    const client = one(order?.Client as { company: string | null; contact: string | null; emailAdd: string | null } | null);
    const trip = one(row.DispatchOrder as { Employee: unknown; partnerDriver: string | null } | null);
    const driver = one(trip?.Employee as { employeeName: string | null } | null);
    const resolver = one(row.Resolver as { employeeName: string | null } | null);
    return {
      ...toSummary(row),
      orderID: row.orderID as string,
      orderCode: order?.orderCode ?? null,
      client: client?.company ?? null,
      clientContact: client?.contact ?? null,
      clientEmail: client?.emailAdd ?? null,
      contactBack: (row.contactBack as string | null) ?? null,
      driverName: driver?.employeeName ?? trip?.partnerDriver ?? null,
      resolvedByName: resolver?.employeeName ?? null,
    };
  });
}

/**
 * Marks a report resolved, with the reply the client will read.
 *
 * Once, unless `allowChange` - correcting a reply is done on purpose, from the
 * resolved list, not by a second click racing the first.
 */
export async function resolveClientReport(input: {
  reportID: string;
  note: string;
  resolverID: string;
  allowChange: boolean;
}): Promise<{ before: { status: ReportStatus; resolutionNote: string | null }; orderID: string }> {
  const note = input.note.trim();
  if (!note) throw new ClientReportError("Write a reply for the client saying what was done.");

  const { data: current, error: readError } = await supabase
    .from("ClientReport")
    .select("reportID, orderID, status, resolutionNote")
    .eq("reportID", input.reportID)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new ClientReportError("That report no longer exists.", 404);
  if (current.status === "resolved" && !input.allowChange) {
    throw new ClientReportError("This report was already resolved. Refresh the list.", 409);
  }

  let update = supabase
    .from("ClientReport")
    .update({
      status: "resolved",
      resolvedBy: input.resolverID,
      resolvedAt: new Date().toISOString(),
      resolutionNote: note,
    })
    .eq("reportID", input.reportID);
  // Two people on the same report: the second is told, not silently applied.
  update = update.eq("status", current.status);

  const { data: updated, error } = await update.select("reportID").maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new ClientReportError("Someone else dealt with this report just now. Refresh the list.", 409);

  return {
    before: { status: current.status as ReportStatus, resolutionNote: (current.resolutionNote as string | null) ?? null },
    orderID: current.orderID as string,
  };
}
