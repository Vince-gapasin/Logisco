// Password rules shared by the set-password page, the profile form and the
// update-password API so the client and server never disagree.

export const PASSWORD_MIN_LENGTH = 8;

const SPECIAL_CHARACTER = /[!@#$%^&*(),.?":{}|<>_\-\\[\]/`~';&+=]/;

export function getPasswordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  if (!SPECIAL_CHARACTER.test(password)) return "Password must contain a special character.";
  return null;
}
