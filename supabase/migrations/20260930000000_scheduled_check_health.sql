-- Record that the scheduled check ran, so its silence can be told from a quiet fleet.
--
-- WHY
--
-- The stall ladder - 15, 30, 45, 120, 360 minutes - is sent by one scheduled
-- POST and by nothing else. The fleet board's GET recomputes the same verdicts
-- on every poll and deliberately notifies nobody, so when the schedule stops,
-- the board goes on colouring quiet trips amber and not one alert is sent.
--
-- That has now happened twice:
--
--   GitHub Actions honoured "*/10 * * * *" at a median of 277 minutes on a free
--   public repository. Fourteen consecutive gaps over three days.
--
--   pg_cron replaced it and fired exactly on the ten, for days, into a 401 -
--   the Vault secret was a 19-character fragment where a 43-character secret
--   belonged. Every rung had been written, tested and deployed. Not one had
--   ever run in production.
--
-- Both times the only symptom was silence, which is also what a fleet with no
-- stalled trucks looks like. Nothing in the system could tell them apart.
--
-- WHAT THIS IS NOT
--
-- Not a log. One row per named check, overwritten on every run: the question is
-- "when did this last work", and keeping 144 rows a day to answer it would be a
-- table nobody prunes.
--
-- Not a second scheduler either. What reads this is the fleet board, which the
-- office already has open and which already polls every thirty seconds.

BEGIN;

CREATE TABLE IF NOT EXISTS "ScheduledCheck" (
  "name"         text PRIMARY KEY,
  "lastRunAt"    timestamptz NOT NULL DEFAULT now(),
  -- What the run found, so a suspiciously empty run is visible too: a checker
  -- that runs every ten minutes and never sees a single trip is its own kind of
  -- broken, and it would otherwise look perfectly healthy here.
  "tripsChecked" integer NOT NULL DEFAULT 0,
  "alertsRaised" integer NOT NULL DEFAULT 0
);

ALTER TABLE "ScheduledCheck" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- AFTERWARDS
--
-- Empty until the next scheduled run, then one row that moves every ten minutes:
--   SELECT * FROM "ScheduledCheck";
--
-- Give it fifteen minutes and check it is keeping up. Anything over about
-- twenty-five minutes means the schedule has stopped and the fleet board will
-- be saying so:
--   SELECT name, "lastRunAt", now() - "lastRunAt" AS ago FROM "ScheduledCheck";
--
-- The schedule itself, and what the deployment answered - 200 is right, 401
-- means the Vault secret and Vercel's CRON_SECRET disagree:
--   SELECT r.status_code, r.created FROM net._http_response r
--   ORDER BY r.created DESC LIMIT 5;
