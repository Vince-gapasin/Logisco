// The email a client gets when their delivery is booked: what was booked,
// when, and the link that follows it.
//
// Plain and narrow on purpose. Mail clients are not browsers; a table-free
// layout with inline styles survives Gmail, Outlook and a phone equally well.

import { sendEmail } from "@/services/email/emailService";
import { formatDateTime } from "@/app/lib/datetime";

export interface TrackingEmail {
  to: string;
  clientName: string | null;
  orderCode: string;
  trackingUrl: string;
  scheduledFor: string | null;
  stops: number;
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function trackingLinkMessage(booking: TrackingEmail) {
  const greeting = booking.clientName ? `Hello ${booking.clientName},` : "Hello,";
  const when = booking.scheduledFor ? `Scheduled for ${booking.scheduledFor}` : "We will confirm the schedule shortly";
  const stops = `${booking.stops} delivery stop${booking.stops === 1 ? "" : "s"}`;

  const text = [
    greeting,
    "",
    `Your booking ${booking.orderCode} is confirmed: ${stops}. ${when}.`,
    "",
    "Follow your delivery here:",
    booking.trackingUrl,
    "",
    "The link shows where the truck is, each stop as it is delivered, and anything the crew reports along the way.",
    "",
    "Logisco",
  ].join("\n");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a;line-height:1.55;max-width:560px">
  <p>${escape(greeting)}</p>
  <p>Your booking <strong>${escape(booking.orderCode)}</strong> is confirmed: ${escape(stops)}. ${escape(when)}.</p>
  <p style="margin:24px 0">
    <a href="${escape(booking.trackingUrl)}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block;font-weight:bold">
      Track your delivery
    </a>
  </p>
  <p style="color:#475569;font-size:13px">
    The link shows where the truck is, each stop as it is delivered, and anything the crew reports along the way.
  </p>
  <p style="color:#94a3b8;font-size:12px;word-break:break-all">${escape(booking.trackingUrl)}</p>
  <p style="color:#475569;font-size:13px">Logisco</p>
</div>`;

  return { subject: `Your delivery ${booking.orderCode} - track it here`, text, html };
}

/** Sends the link. Returns false when mail is off or the address is unusable. */
export async function sendTrackingLink(booking: TrackingEmail): Promise<boolean> {
  const message = trackingLinkMessage(booking);
  return sendEmail({ to: booking.to, ...message });
}

/**
 * Where a tracking token can be opened. A local APP_URL is what a developer
 * wants in a browser and useless in someone's inbox, so a deployed instance
 * never uses one: mail sent from the server goes out with the real address.
 */
export function trackingUrl(token: string): string {
  const configured = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const isLocal = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.)/i.test(configured);
  const deployed = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

  const base =
    (!configured || isLocal) && deployed
      ? `https://${deployed}`
      : configured || "https://logisco-system.vercel.app";

  return `${base.replace(/\/$/, "")}/client-view?token=${token}`;
}

export { formatDateTime };
