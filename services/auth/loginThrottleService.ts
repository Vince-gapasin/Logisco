import { supabase } from "@/app/lib/supabase";

// How many wrong passwords one account can take before it is made to wait.
//
// Every sign-in goes through /api/auth/login, so Supabase sees one address -
// the server's - for everybody. Its own limit cannot tell an attacker from the
// whole company: it either never trips, or it trips for everyone at once. So
// the count is kept here, per email, in the database rather than in memory,
// because each server instance would otherwise keep its own count.
//
// The cost is that someone who knows an address can keep its owner waiting.
// Fifteen minutes is short enough to ride out and long enough to make
// guessing a password hopeless.

export const MAX_FAILED_SIGN_INS = 10;
export const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;

const TABLE = "LoginAttempt";

function keyOf(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Whether this email has used up its tries. Never blocks a sign-in because
 * the count could not be read - a missing table or an outage must not lock
 * the whole company out - so it fails open, and says so in the log.
 */
export async function signInIsLocked(email: string, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - SIGN_IN_WINDOW_MS).toISOString();

  const { count, error } = await supabase
    .from(TABLE)
    .select("attemptedAt", { count: "exact", head: true })
    .eq("email", keyOf(email))
    .gte("attemptedAt", since);

  if (error) {
    console.error("[Login throttle] Could not read failed sign-ins:", error.message);
    return false;
  }

  return (count ?? 0) >= MAX_FAILED_SIGN_INS;
}

/** A wrong password. Older failures for the same email are cleared out on the way. */
export async function recordFailedSignIn(email: string, now = new Date()): Promise<void> {
  const key = keyOf(email);
  const since = new Date(now.getTime() - SIGN_IN_WINDOW_MS).toISOString();

  const { error } = await supabase.from(TABLE).insert({ email: key, attemptedAt: now.toISOString() });
  if (error) {
    console.error("[Login throttle] Could not record a failed sign-in:", error.message);
    return;
  }

  await supabase.from(TABLE).delete().eq("email", key).lt("attemptedAt", since);
}

/** A right password starts the count again. */
export async function clearFailedSignIns(email: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("email", keyOf(email));
  if (error) console.error("[Login throttle] Could not clear failed sign-ins:", error.message);
}
