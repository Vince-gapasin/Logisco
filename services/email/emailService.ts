// Email the system sends on its own: the tracking link, and whatever follows.
//
// Any SMTP server will do - it is configured, not coded. Today that is the
// company Gmail account with an app password; a provider such as Brevo or
// Resend is the same four settings. Without them this does nothing at all, so
// the rest of the system works and mail can be switched on later.
//
// Best-effort, like push: a booking that was created is created, whether or
// not the mail left the building.

import nodemailer, { type Transporter } from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  /** The message as plain text, for clients that show no HTML. */
  text: string;
  html: string;
}

let transport: Transporter | null = null;
let configured: boolean | null = null;

function mailer(): Transporter | null {
  if (configured === false) return null;
  if (transport) return transport;

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  const port = Number(process.env.SMTP_PORT ?? 465);

  if (!host || !user || !password) {
    if (configured === null) {
      console.warn("[Email] SMTP_HOST, SMTP_USER or SMTP_PASSWORD is not set - no mail will be sent.");
    }
    configured = false;
    return null;
  }

  transport = nodemailer.createTransport({
    host,
    port,
    // 465 is TLS from the first byte; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user, pass: password },
  });
  configured = true;
  return transport;
}

/** True when mail is configured, so a screen can say whether it will be sent. */
export function emailIsConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim());
}

export async function sendEmail(mail: Mail): Promise<boolean> {
  const to = mail.to.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("[Email] Not a sendable address; nothing was sent.");
    return false;
  }

  const transporter = mailer();
  if (!transporter) return false;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER!.trim(),
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return true;
  } catch (error) {
    console.error("[Email] Not sent:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** Checks the credentials without sending anything. */
export async function verifyEmail(): Promise<{ ok: boolean; message: string }> {
  const transporter = mailer();
  if (!transporter) return { ok: false, message: "SMTP is not configured." };
  try {
    await transporter.verify();
    return { ok: true, message: "The mail server accepted the credentials." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The mail server refused the credentials." };
  }
}
