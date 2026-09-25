// Enough of a contact detail to recognise, not enough to use.
//
// The tracking link is a capability: anyone holding it sees the page. The
// client's own email and number belong there - they are how they check the
// booking is theirs - but printed in full they would be handed to whoever the
// link reaches.

/** "logisco.system@gmail.com" becomes "lo•••••@gmail.com". */
export function maskEmail(value: string | null | undefined): string | null {
  const email = (value ?? "").trim();
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;

  const name = email.slice(0, at);
  const domain = email.slice(at);
  const shown = name.slice(0, Math.min(2, name.length));
  return `${shown}${"•".repeat(Math.max(3, name.length - shown.length))}${domain}`;
}

/** "09171234567" becomes "0917•••4567": the network and the last four. */
export function maskPhone(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;

  const head = digits.slice(0, 4);
  const tail = digits.slice(-4);
  return `${head}${"•".repeat(Math.max(3, digits.length - 8))}${tail}`;
}
