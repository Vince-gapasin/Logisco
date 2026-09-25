// Who to send a booking's tracking link to, and sending it.
//
// A registered client has an address on file. A walk-in has whatever the
// booking form collected, kept in the notes with the rest of their details,
// which is also what a coordinator resends from later.

import { supabase } from "@/app/lib/supabase";
import { sendTrackingLink, trackingUrl } from "@/services/email/trackingEmail";

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function noteField(notes: string | null | undefined, label: string): string {
  const match = new RegExp(`${label}:\\s*([^\\n\\r]+)`, "i").exec(notes ?? "");
  return match?.[1]?.trim() ?? "";
}

export interface TrackingRecipient {
  email: string | null;
  clientName: string | null;
  orderCode: string;
  token: string | null;
  scheduledFor: string | null;
  stops: number;
  /** Why there is nobody to send to, when there is not. */
  reason?: string;
}

/** Everything the tracking email needs, or why it cannot be sent. */
export async function trackingRecipient(orderID: string): Promise<TrackingRecipient | null> {
  const { data, error } = await supabase
    .from("Order")
    .select("orderCode, notes, orderLinkToken, Client ( company, emailAdd ), BranchStops ( branchID )")
    .eq("orderID", orderID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const client = (Array.isArray(data.Client) ? data.Client[0] : data.Client) as
    | { company?: string; emailAdd?: string }
    | null;

  // A walk-in's address sits in the notes the booking form wrote.
  const fromNotes = noteField(data.notes, "Email");
  const candidate = (client?.emailAdd || fromNotes || "").trim();
  const email = EMAIL_PATTERN.test(candidate) ? candidate : null;

  return {
    email,
    clientName: client?.company ?? noteField(data.notes, "Name") ?? null,
    orderCode: (data.orderCode as string) ?? "",
    token: (data.orderLinkToken as string) ?? null,
    scheduledFor: noteField(data.notes, "Delivery Schedule") || null,
    stops: ((data.BranchStops as unknown[]) ?? []).length,
    reason: email ? undefined : candidate ? "That address does not look like an email." : "No email address on file.",
  };
}

export interface TrackingSendResult {
  sent: boolean;
  email: string | null;
  reason?: string;
}

/**
 * Sends a booking's tracking link to its client. Never throws: a booking that
 * was made is made, whether or not the mail left.
 */
export async function sendBookingTrackingLink(orderID: string): Promise<TrackingSendResult> {
  try {
    const recipient = await trackingRecipient(orderID);
    if (!recipient) return { sent: false, email: null, reason: "Booking not found." };
    if (!recipient.email) return { sent: false, email: null, reason: recipient.reason };
    if (!recipient.token) return { sent: false, email: recipient.email, reason: "This booking has no tracking link." };

    const sent = await sendTrackingLink({
      to: recipient.email,
      clientName: recipient.clientName,
      orderCode: recipient.orderCode,
      trackingUrl: trackingUrl(recipient.token),
      scheduledFor: recipient.scheduledFor,
      stops: recipient.stops,
    });

    return { sent, email: recipient.email, reason: sent ? undefined : "The mail server did not accept it." };
  } catch (error) {
    console.error("[Email] Tracking link not sent:", error instanceof Error ? error.message : error);
    return { sent: false, email: null, reason: "Something went wrong sending it." };
  }
}
