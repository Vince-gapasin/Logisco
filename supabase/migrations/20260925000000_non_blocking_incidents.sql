-- Not every problem stops a delivery.
--
-- The crew's only way to report anything was the emergency button, which
-- marks the trip a foul trip, frees the truck and crew, and takes the booking
-- off the road. For "we collected the wrong product" that is far too heavy:
-- the crew can sort it out and carry on, and the office and the client should
-- simply be told.
--
-- An incident now says whether it stopped the trip. Everything recorded so
-- far did, since it was raised through the emergency button.

BEGIN;

ALTER TABLE "FoulTripIncident"
  ADD COLUMN IF NOT EXISTS "blocking" boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN "FoulTripIncident"."blocking" IS
  'True when the trip could not continue (a foul trip). False for an issue reported while the delivery carried on.';

-- One open foul trip per delivery, as before. An issue that did not stop the
-- trip is not one of those, so it no longer collides with a later breakdown
-- on the same trip.
DROP INDEX IF EXISTS foultrip_one_open_per_dispatch;
CREATE UNIQUE INDEX IF NOT EXISTS foultrip_one_open_per_dispatch
  ON "FoulTripIncident" ("dispatchID")
  WHERE "status" IN ('open', 'mechanic_assigned') AND "blocking";

COMMIT;

-- AFTERWARDS
--   SELECT "blocking", count(*) FROM "FoulTripIncident" GROUP BY 1;
-- Every existing row is true: all of them stopped their trip.
