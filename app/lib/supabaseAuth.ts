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

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables: set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY. Both must be present at build time, not " +
      "only at runtime, because route handlers import this module.",
  );
}

export const supabaseAuth = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);