-- ============================================================================
-- Failed sign-ins, counted per email
-- ============================================================================
-- Read and written by services/auth/loginThrottleService.ts: ten wrong
-- passwords for one email within fifteen minutes and that email waits.
--
-- Until this is applied the login route cannot read the count, and signs
-- people in exactly as before - it logs the problem rather than locking anyone
-- out. Rows older than the window are deleted as new failures arrive, and all
-- of an email's rows on its next successful sign-in, so the table stays small.
--
-- Server-only, like every other table: RLS on with no policies.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "LoginAttempt" (
  "attemptID"   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"       text NOT NULL,
  "attemptedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loginattempt_email_time_idx
  ON "LoginAttempt" ("email", "attemptedAt" DESC);

ALTER TABLE "LoginAttempt" ENABLE ROW LEVEL SECURITY;
