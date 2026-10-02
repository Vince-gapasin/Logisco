-- Point the stall check at the address the site actually answers on.
--
-- WHY IT STOPPED NOTIFYING AGAIN
--
-- The job was scheduled against https://logisco-system.vercel.app, which was
-- the only address the deployment had. The site now has a domain of its own and
-- that alias no longer serves anything - it answers:
--
--   HTTP/1.1 307 Temporary Redirect
--   Location: https://logisco.company/api/fleet/stall-check
--
-- A browser follows that without anyone noticing, which is why the site looked
-- fine from a laptop. pg_net follows it too - and that is the part that cost
-- the time, because of what gets dropped on the way.
--
-- WHAT IT LOOKED LIKE INSTEAD
--
-- The header. Credentials are not carried across a redirect to a different
-- host; curl will not do it without --location-trusted and neither will this.
-- So the request did arrive at logisco.company, with the body and the method
-- intact and the Authorization header gone, and the route refused it. Four
-- consecutive runs, 07:00 to 07:30:
--
--   status_code   401
--
-- Which is the same 401 the endpoint answers when the Vault secret and
-- CRON_SECRET in Vercel have drifted apart. That is a false signal pointing
-- straight at the hardest thing in this setup to verify, when the secret was
-- never the problem and the address was. Repointing the url fixed it with the
-- secret untouched: the next run, 07:40, answered 200.
--
-- cron.job_run_details showed all four as successes throughout, because the job
-- did what it was asked - it sent a request and got an answer. Nothing in the
-- database knew the answer meant nobody had been notified.
--
-- READ A 401 HERE AS TWO POSSIBILITIES, NOT ONE
--
-- Either the secret has drifted, or the url has moved and the header did not
-- survive the hop. Check the url first. It is the cheaper of the two to rule
-- out, and it is the one that produces no other symptom anywhere.
--
-- So the url is the only thing that changes here. Schedule, secret, body and
-- timeout are as they were in 20260929000000_stall_check_schedule.sql.

BEGIN;

SELECT cron.unschedule('stall-check')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stall-check');

SELECT cron.schedule(
  'stall-check',
  '*/10 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://logisco.company/api/fleet/stall-check',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cron_secret'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

COMMIT;

-- AFTERWARDS
--
-- The job points at the right host:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'stall-check';
--   SELECT command FROM cron.job WHERE jobname = 'stall-check';
--   Expect logisco.company in the command, and no vercel.app.
--
-- Then wait for the next ten-minute mark and read what came back. This is the
-- check that matters, because the job reports success either way:
--
--   SELECT id, status_code, created
--   FROM net._http_response
--   ORDER BY created DESC
--   LIMIT 5;
--
--   200  the check ran and notified whoever needed notifying
--   401  either the secret has drifted, or the url has moved again and the
--        Authorization header was dropped following the redirect - confirm
--        which by reading the command above before touching the Vault
--   307  pointing at an address that redirects somewhere this did not follow
--
-- A row with no status_code at all is a request that never got an answer -
-- a timeout rather than a refusal.
