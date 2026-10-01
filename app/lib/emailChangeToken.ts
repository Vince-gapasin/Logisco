// The link that proves somebody can read the address they are moving to.
//
// Changing a login email used to take effect on the spot, marked confirmed by
// the server without anybody proving control of the new address. Type it wrong
// and the account answers to a mailbox that may not exist, or belongs to a
// stranger - and there is no way back, because signing in to fix it needs the
// address you can no longer read.
//
// So the change is now a request, and the link that completes it is sent to the
// new address. Reading the link is the proof.
//
// WHY THERE IS NO PENDING-CHANGE TABLE
//
// The token carries what it needs and is signed, so nothing has to be stored
// between the request and the click. A row would add a table to prune, a second
// place for the two to disagree, and nothing this does not already have: the
// signature cannot be forged without the server key, and the expiry is inside
// the signed payload rather than beside it.
//
// The cost is that a link cannot be revoked before it expires. Asking twice
// leaves two working links for thirty minutes, and both do the same thing, so
// there is nothing to gain by replaying one.

import { createHmac, timingSafeEqual } from "crypto";

/**
 * How long the link is good for.
 *
 * Long enough to walk to another device and read the mail; short enough that a
 * link left in an inbox is not a standing key to the account.
 */
export const EMAIL_CHANGE_VALID_FOR_MS = 30 * 60 * 1000;

export interface EmailChangeClaim {
  employeeID: string;
  /** The address being moved to. */
  newEmail: string;
  /** The address it is moving from, so the link cannot be reused after a later change. */
  fromEmail: string;
  expiresAt: number;
}

/**
 * The signing key, derived from the service-role key rather than configured
 * separately.
 *
 * One fewer secret to set in two places and keep in step - which is exactly how
 * the scheduled check sat on a 401 for days. The label keeps this use of the
 * key separate from any other: the same secret signing two different things is
 * how one of them ends up accepting the other's tokens.
 */
function signingKey(): Buffer {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createHmac("sha256", secret).update("logisco:email-change:v1").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** A token the holder of the new address can hand back. */
export function createEmailChangeToken(
  claim: Omit<EmailChangeClaim, "expiresAt">,
  now = Date.now(),
): string {
  const body: EmailChangeClaim = { ...claim, expiresAt: now + EMAIL_CHANGE_VALID_FOR_MS };
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export type EmailChangeCheck =
  | { ok: true; claim: EmailChangeClaim }
  | { ok: false; reason: "malformed" | "forged" | "expired" };

/**
 * What a token says, if it says anything.
 *
 * The signature is compared in constant time. It is not much of an oracle -
 * guessing a signature is the whole attack - but comparing with === leaks how
 * much of a guess was right, and there is no reason to.
 */
export function readEmailChangeToken(token: string, now = Date.now()): EmailChangeCheck {
  const cut = token.lastIndexOf(".");
  if (cut <= 0) return { ok: false, reason: "malformed" };

  const payload = token.slice(0, cut);
  const given = token.slice(cut + 1);

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "forged" };

  let claim: EmailChangeClaim;
  try {
    claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as EmailChangeClaim;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    typeof claim?.employeeID !== "string" ||
    typeof claim?.newEmail !== "string" ||
    typeof claim?.fromEmail !== "string" ||
    typeof claim?.expiresAt !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  // Checked after the signature, so an expired token and a forged one are told
  // apart only for somebody who had a real one to begin with.
  if (now >= claim.expiresAt) return { ok: false, reason: "expired" };

  return { ok: true, claim };
}
