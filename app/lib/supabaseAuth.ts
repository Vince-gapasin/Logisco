import { createClient } from "@supabase/supabase-js";

// Browser-facing client, used server-side to verify a password against
// Supabase Auth without the service-role key.
//
// These used to fall back to "" when unset, which createClient reports as
// "supabaseKey is required." - a message that names neither the variable nor
// the file, and surfaces during "Collecting page data" on a deploy rather
// than anywhere near the cause. Naming them costs nothing and saves an hour.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function required(value: string | undefined, name: string): string {
  if (value) return value;
  throw new Error(
    `Missing Supabase environment variable: ${name}. Set it in the deployment ` +
      "environment as well as .env - it is needed at build time, not only at " +
      "runtime, because route handlers import this module and Next evaluates " +
      "them while collecting page data.",
  );
}

export const supabaseAuth = createClient(
  required(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
  required(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);