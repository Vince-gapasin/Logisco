// Telling people what happened.
//
// Called beside recordAudit() wherever something is written, and held to the
// same rule: a notification must never fail the action that caused it. Every
// error here is logged and swallowed - a booking that was created is created,
// whether or not anyone was told.

import { supabase } from "@/app/lib/supabase";
import { EMPLOYEE_ROLE } from "@/app/lib/enums";
import { sendPush } from "@/services/notifications/pushService";

export type Severity = "info" | "action" | "urgent";

/** Office staff see the same feed; what they may change differs, not what they know. */
export const OFFICE = [EMPLOYEE_ROLE.admin, EMPLOYEE_ROLE.coordinator];
export const ADMIN_ONLY = [EMPLOYEE_ROLE.admin];
export const MECHANICS = [EMPLOYEE_ROLE.mechanic];

export interface NotifyInput {
  event: string;
  title: string;
  body: string;
  severity?: Severity;
  /** Roles to tell, and named people to tell. Duplicates collapse. */
  roles?: string[];
  employeeIDs?: (string | null | undefined)[];
  /** Nobody is told twice about the same thing. */
  dedupeKey?: string;
  entity?: { table: string; id: string | number | null | undefined };
  /** Where the feed should take them. */
  link?: string;
  actor?: { employeeID?: string | null; name?: string | null } | null;
  /** Someone rarely needs telling what they just did themselves. */
  includeActor?: boolean;
}

async function employeesInRoles(roles: string[]): Promise<string[]> {
  if (roles.length === 0) return [];
  const { data, error } = await supabase
    .from("Employee")
    .select("employeeID, role")
    .eq("isActive", true)
    .in("role", roles);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.employeeID as string);
}

/**
 * Writes one notification and gives it to everyone who should see it. Returns
 * how many people were told, or 0 if nothing could be written.
 */
export async function notify(input: NotifyInput): Promise<number> {
  try {
    const byRole = await employeesInRoles(input.roles ?? []);
    const named = (input.employeeIDs ?? []).filter((id): id is string => Boolean(id));
    const recipients = new Set<string>([...byRole, ...named]);

    if (!input.includeActor && input.actor?.employeeID) {
      recipients.delete(input.actor.employeeID);
    }
    if (recipients.size === 0) return 0;

    const { data: notification, error } = await supabase
      .from("Notification")
      .insert({
        event: input.event,
        title: input.title,
        body: input.body,
        severity: input.severity ?? "info",
        entityTable: input.entity?.table ?? null,
        entityID: input.entity?.id != null ? String(input.entity.id) : null,
        link: input.link ?? null,
        actorID: input.actor?.employeeID ?? null,
        actorName: input.actor?.name ?? null,
        dedupeKey: input.dedupeKey ?? null,
      })
      .select("notificationID")
      .single();

    // Someone already wrote this exact thing: the dedupe key took the hit.
    if (error) {
      if (error.code === "23505") return 0;
      throw new Error(error.message);
    }

    const { error: recipientError } = await supabase.from("NotificationRecipient").insert(
      [...recipients].map((employeeID) => ({
        notificationID: notification.notificationID,
        employeeID,
      })),
    );
    if (recipientError) throw new Error(recipientError.message);

    // Phones, for whoever has the app installed. Awaited, not left running:
    // the server stops the moment it answers the request, so a push that was
    // merely started is killed in flight and never reaches anyone. It is
    // still best-effort - sendPush swallows its own failures.
    await sendPush([...recipients], {
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      notificationID: notification.notificationID as string,
    });

    return recipients.size;
  } catch (error) {
    console.error(`[Notify] ${input.event} not sent:`, error instanceof Error ? error.message : error);
    return 0;
  }
}

/** The crew on a trip: the driver and any helper who has not declined. */
export async function crewOf(dispatchID: string | null | undefined): Promise<string[]> {
  if (!dispatchID) return [];
  try {
    const { data, error } = await supabase
      .from("DispatchOrder")
      .select("driverID, DispatchHelper ( helperID, status )")
      .eq("dispatchID", dispatchID)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const helpers = ((data?.DispatchHelper as { helperID: string | null; status: string | null }[] | null) ?? [])
      .filter((helper) => helper.helperID && helper.status !== "Declined")
      .map((helper) => helper.helperID as string);

    return [data?.driverID, ...helpers].filter((id): id is string => Boolean(id));
  } catch (error) {
    console.error("[Notify] Could not read the crew:", error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * A booking's live trip, its code and the crew on it - read before something
 * removes them, so the people affected can still be told.
 */
export async function bookingCrew(orderID: string): Promise<{ orderCode: string | null; crew: string[] }> {
  try {
    const { data, error } = await supabase
      .from("Order")
      .select("orderCode, DispatchOrder ( dispatchID, status, driverID, DispatchHelper ( helperID, status ) )")
      .eq("orderID", orderID)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const trips = ((data?.DispatchOrder as
      | {
          dispatchID: string;
          status: string;
          driverID: string | null;
          DispatchHelper?: { helperID: string | null; status: string | null }[] | null;
        }[]
      | null) ?? []).filter(
      (trip) => trip && !["Completed", "Cancelled", "Rejected"].includes(trip.status),
    );
    const crew = new Set<string>();
    for (const trip of trips) {
      if (trip.driverID) crew.add(trip.driverID as string);
      for (const helper of (trip.DispatchHelper ?? []) as { helperID: string | null; status: string | null }[]) {
        if (helper.helperID && helper.status !== "Declined") crew.add(helper.helperID);
      }
    }
    return { orderCode: (data?.orderCode as string) ?? null, crew: [...crew] };
  } catch (error) {
    console.error("[Notify] Could not read the booking's crew:", error instanceof Error ? error.message : error);
    return { orderCode: null, crew: [] };
  }
}

/** Which delivery a message is about: "ORD-123456-AB1C (Acme Corp)". */
export async function tripLabel(dispatchID: string | null | undefined): Promise<string | null> {
  if (!dispatchID) return null;
  try {
    const { data, error } = await supabase
      .from("DispatchOrder")
      .select("Order ( orderCode, Client ( company ) )")
      .eq("dispatchID", dispatchID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    type OrderRow = { orderCode?: string; Client?: { company?: string } | { company?: string }[] | null };
    const raw = data?.Order as OrderRow | OrderRow[] | null;
    const order = Array.isArray(raw) ? raw[0] : raw;
    if (!order?.orderCode) return null;
    const client = Array.isArray(order.Client) ? order.Client[0] : order.Client;
    return client?.company ? `${order.orderCode} (${client.company})` : order.orderCode;
  } catch (error) {
    console.error("[Notify] Could not read the booking code:", error instanceof Error ? error.message : error);
    return null;
  }
}
