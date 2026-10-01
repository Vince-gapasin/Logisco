-- Telling "the truck has stopped" apart from "the phone has stopped".
--
-- One additive column. Existing rows are backfilled so nothing reads as null.
--
-- THE PROBLEM THIS SOLVES
--
-- The crew app posts a position every fifteen metres of movement and at no other
-- time, so a stopped truck and a dead phone send exactly the same thing:
-- nothing. The stall alert has never been able to tell them apart, and the more
-- likely cause is the phone - Android kills background work, batteries die,
-- signal drops, drivers swipe the app away. Advising somebody to go and look for
-- a broken truck is the right answer to only one of those.
--
-- The fix is a heartbeat: the app reports every few minutes whether or not it has
-- moved. But a heartbeat alone would make things worse, not better - if every
-- ping refreshed the one timestamp we watch, every truck would look alive for
-- ever and the alert would never fire again.
--
-- So two moments are kept instead of one:
--
--   updated_at  the last time we heard from the app at all  (contact)
--   moved_at    the last time the position actually changed  (movement)
--
-- Which gives two different findings, with two different actions:
--
--   contact fresh, movement stale   the truck has genuinely stopped
--   contact stale                   we have lost the phone; the truck is unknown
--
-- Whether a ping counts as movement is decided on the server, from the distance
-- to the position already stored, rather than trusted from the request. An app
-- that could declare its own pings to be movement could silence the alert.
--
-- Until the new app build is installed there are no heartbeats, so the two
-- timestamps stay equal and every silence reads as "lost contact" - which is
-- exactly the truth in that case, and is what the wording already says.

BEGIN;

ALTER TABLE "FleetLocations"
  ADD COLUMN IF NOT EXISTS "moved_at" timestamptz;

COMMENT ON COLUMN "FleetLocations"."moved_at" IS
  'Last time the position actually changed. updated_at is the last time the app spoke at all; the gap between them is how a stopped truck is told from a dead phone.';

-- Every existing row predates heartbeats, so its last contact was also its last
-- movement.
UPDATE "FleetLocations"
SET "moved_at" = "updated_at"
WHERE "moved_at" IS NULL;

COMMIT;

-- AFTERWARDS
--   SELECT count(*) AS rows, count("moved_at") AS with_moved_at FROM "FleetLocations";
-- The two numbers should match.
