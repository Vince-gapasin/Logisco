-- Make the stall check actually run every ten minutes.
--
-- WHY IT WAS NOT RUNNING
--
-- The schedule lived in a GitHub Actions workflow asking for "*/10 * * * *".
-- GitHub does not honour that on a free public repository. Measured against the
-- live Actions API over three days, fourteen consecutive gaps:
--
--   requested   every 10 minutes
--   actual      median 277 minutes, range 132 to 500
--
-- Fifteen runs in total. Never once close to ten minutes.
--
-- What that does to the alert ladder: the board's GET is read-only and notifies
-- nobody, so the scheduled POST is the only thing that tells anyone. assessStall
-- reports the highest rung crossed and does not replay the ones it missed -
-- correctly, since announcing "silent for 15 minutes" five hours in would be a
-- lie. So a trip that went quiet got exactly one notification, hours late, at
-- whichever rung the clock had already reached. A test booking produced one
-- alert reading "Still nothing after 5 hours" and nothing at 15, 30 or 45.
--
-- WHY THE DATABASE AND NOT ANOTHER SERVICE
--
-- pg_cron runs inside the database this system already depends on. No new
-- account to keep alive, no third party holding the shared secret, and it fires
-- on the minute. Vercel's own cron is once a day on the Hobby plan, which is
-- what sent the schedule to GitHub in the first place.
--
-- BEFORE RUNNING THIS
--
-- The job authenticates with the same CRON_SECRET the deployment checks. It is
-- read from Supabase Vault rather than written into this file, so the value
-- stays yours and never enters the repository or the migration history.
--
-- Run this one statement first, on its own, with your real value:
--
--   SELECT vault.create_secret('PASTE_YOUR_CRON_SECRET_HERE', 'cron_secret');
--
-- It is the same string as CRON_SECRET in the Vercel project settings. If the
-- two ever drift apart the endpoint answers 401 and the job stops notifying
-- silently, so the check at the bottom of this file is worth running.

BEGIN;

-- ----------------------------------------------------------------------------
-- The extensions
-- ----------------------------------------------------------------------------
-- pg_cron schedules; pg_net makes the outbound request. Both ship with Supabase
-- and live in the "extensions" schema by convention there.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ----------------------------------------------------------------------------
-- The job
-- ----------------------------------------------------------------------------
-- Unscheduled first so this migration can be run again without piling up
-- duplicate jobs, each one notifying separately.

SELECT cron.unschedule('stall-check')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stall-check');

SELECT cron.schedule(
  'stall-check',
  '*/10 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://logisco-system.vercel.app/api/fleet/stall-check',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cron_secret'
      ),
      'Content-Type', 'application/json'
    ),
    -- The route reads nothing from the body; it is here because a POST wants
    -- one and an empty object is the least surprising thing to send.
    body := '{}'::jsonb,
    -- Longer than the check takes on a full fleet, shorter than the ten minutes
    -- before the next one starts.
    timeout_milliseconds := 30000
  );
  $job$
);

COMMIT;

-- AFTERWARDS
--
-- The job exists and is due:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'stall-check';
--   Expect one row, '*/10 * * * *', active true.
--
-- Give it fifteen minutes, then confirm it is firing and what the deployment
-- answered. 200 is right; 401 means the vault secret and CRON_SECRET disagree.
--   SELECT r.status_code, r.created, left(r.content, 200) AS body
--   FROM net._http_response r
--   ORDER BY r.created DESC
--   LIMIT 5;
--
-- And that cron itself is not erroring:
--   SELECT d.status, d.return_message, d.start_time
--   FROM cron.job_run_details d
--   JOIN cron.job j ON j.jobid = d.jobid
--   WHERE j.jobname = 'stall-check'
--   ORDER BY d.start_time DESC
--   LIMIT 5;
--   (job_run_details keys on jobid, not jobname - the name lives on cron.job.)
--
-- TO STOP IT
--   SELECT cron.unschedule('stall-check');
