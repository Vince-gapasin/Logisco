// The two messages a login-email change sends: one asking for proof, one
// warning the address being left behind.
//
// Plain and narrow, like the tracking mail, for the same reason: mail clients
// are not browsers, and a table-free layout with inline styles survives Gmail,
// Outlook and a phone equally well.

import { sendEmail } from "@/services/email/emailService";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const shell = (inner: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a;line-height:1.55;max-width:560px">${inner}` +
  `<p style="margin:28px 0 0;font-size:13px;color:#64748b">Logisco</p></div>`;

/**
 * Sent to the address being moved to. Reading this is the proof.
 *
 * Never sent to the current address: the point is to find out whether the new
 * mailbox can be reached by the person asking.
 */
export async function sendEmailChangeConfirmation(input: {
  to: string;
  name: string;
  confirmUrl: string;
  validForMinutes: number;
}): Promise<boolean> {
  const text = [
    `Hello ${input.name},`,
    "",
    "You asked to use this address to sign in to Logisco.",
    "",
    "Confirm it here:",
    input.confirmUrl,
    "",
    `The link works for ${input.validForMinutes} minutes. Until you open it, nothing changes and your old address still signs you in.`,
    "",
    "If you did not ask for this, ignore this message - without the link, nothing happens.",
    "",
    "Logisco",
  ].join("\n");

  const html = shell(
    `<p style="margin:0 0 16px">Hello ${escape(input.name)},</p>` +
      `<p style="margin:0 0 16px">You asked to use this address to sign in to Logisco.</p>` +
      `<p style="margin:0 0 24px"><a href="${escape(input.confirmUrl)}" ` +
      `style="display:inline-block;background:#1b4fa8;color:#ffffff;text-decoration:none;` +
      `padding:11px 20px;border-radius:8px;font-weight:bold">Confirm this address</a></p>` +
      `<p style="margin:0 0 16px;font-size:14px;color:#475569">The link works for ` +
      `${input.validForMinutes} minutes. Until you open it, nothing changes and your old ` +
      `address still signs you in.</p>` +
      `<p style="margin:0;font-size:14px;color:#475569">If you did not ask for this, ignore this ` +
      `message &mdash; without the link, nothing happens.</p>`,
  );

  return sendEmail({ to: input.to, subject: "Confirm your new Logisco sign-in address", text, html });
}

/**
 * Sent to the address being left behind.
 *
 * The only way the real owner finds out, if it was not them who asked. It names
 * the new address so they can tell a typo of their own from somebody else's
 * mailbox, and it carries no link: there is nothing to click that would make
 * this safer, and a link in a warning is what a convincing forgery looks like.
 */
export async function sendEmailChangeNotice(input: {
  to: string;
  name: string;
  newEmail: string;
}): Promise<boolean> {
  const text = [
    `Hello ${input.name},`,
    "",
    `Somebody asked to move your Logisco sign-in from this address to ${input.newEmail}.`,
    "",
    "It has not happened yet. It takes effect only when that address is confirmed.",
    "",
    "If this was not you, tell your administrator now - whoever asked knew your password.",
    "",
    "Logisco",
  ].join("\n");

  const html = shell(
    `<p style="margin:0 0 16px">Hello ${escape(input.name)},</p>` +
      `<p style="margin:0 0 16px">Somebody asked to move your Logisco sign-in from this address to ` +
      `<strong>${escape(input.newEmail)}</strong>.</p>` +
      `<p style="margin:0 0 16px">It has not happened yet. It takes effect only when that address ` +
      `is confirmed.</p>` +
      `<p style="margin:0;color:#991b1b">If this was not you, tell your administrator now &mdash; ` +
      `whoever asked knew your password.</p>`,
  );

  return sendEmail({ to: input.to, subject: "Your Logisco sign-in address was asked to change", text, html });
}
