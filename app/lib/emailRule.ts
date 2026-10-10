import { z } from "zod";

// An email address, by the rule the server holds it to.
//
// The client and partner forms only asked whether the box had anything in it,
// and left the rest to the browser - which takes "name@company" as an email.
// The server does not: it wants a domain with a dot in it. So "qa@test" got
// past the form and came back as "Validation failed", with nothing to say it
// was the email. Both now check with the server's own rule, from here.

export const EMAIL_RULE = "Use a full email address, like name@company.com.";

const email = z.string().trim().email();

export function isValidEmail(value: string | null | undefined): boolean {
  return email.safeParse(value ?? "").success;
}
