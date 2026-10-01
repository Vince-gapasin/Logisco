-- Let a proof of delivery belong to a warehouse pickup, not only to a branch.
--
-- WHAT WAS WRONG
--
-- The crew app asks for a photograph at every stop - reqPod is true for pickups
-- and for deliveries alike - and the server wrote all of them into "POD", which
-- has one link to a stop:
--
--   "branchID" integer REFERENCES "BranchStops"
--
-- A pickup step sends pickupID and no branchID, so every warehouse proof was
-- inserted with branchID null. Nothing else on the row identified the trip
-- either, because the crew insert never set dispatchID. The result is a row
-- attached to nothing: it cannot be found from the booking, it is not counted in
-- anybody's performance, and it does not appear on the report. The photograph
-- reached the bucket and the record of it was lost.
--
-- That is also the answer to "why can I only see one proof per delivery". A
-- one-pickup, one-drop booking produces two proofs and shows one, because the
-- warehouse half had nowhere to hang.
--
-- WHAT THIS DOES NOT DO
--
-- It does not recover the ones already orphaned. There is nothing on those rows
-- that says which pickup they belong to - no pickupID, no dispatchID, and a
-- remark whose stop name came from a title string the browser built. The files
-- are still in the bucket and the rows are still in the table; matching them up
-- is a job for somebody with the delivery dates in front of them, not for a
-- migration making guesses about which warehouse a photo was taken at.
--
--   SELECT count(*) FROM "POD" WHERE "branchID" IS NULL AND "dispatchID" IS NULL;
--
-- is how many there are.

BEGIN;

ALTER TABLE "POD"
  ADD COLUMN IF NOT EXISTS "pickupID" integer
    REFERENCES "PickupStops" ("pickupID") ON DELETE SET NULL;

COMMENT ON COLUMN "POD"."pickupID" IS
  'The warehouse pickup this proof was taken at. Exactly one of pickupID and branchID is set; a proof belongs to one stop.';

-- Read the same way as the branch side: every proof for one stop, newest first.
CREATE INDEX IF NOT EXISTS pod_pickup_idx ON "POD" ("pickupID");

-- A proof belongs to one stop or the other, never both. Not "one or the other
-- and never neither": a coordinator recording a partner's delivery has a trip
-- but no stop row of ours, and the subcon path already writes those with
-- dispatchID alone.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pod_one_stop_check') THEN
    ALTER TABLE "POD" ADD CONSTRAINT pod_one_stop_check
      CHECK ("pickupID" IS NULL OR "branchID" IS NULL);
  END IF;
END $$;

COMMIT;

-- AFTERWARDS
--
-- The column and its guard are there:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'POD' AND column_name = 'pickupID';
--
-- How many proofs are currently attached to nothing, which is the backlog this
-- stops growing rather than one it clears:
--   SELECT count(*) FROM "POD" WHERE "branchID" IS NULL AND "dispatchID" IS NULL;
--
-- And, once a delivery has run on the new code, that both halves landed:
--   SELECT p."podID", p."branchID", p."pickupID", p."deliveredAt", p."source"
--   FROM "POD" p
--   WHERE p."dispatchID" = '<a dispatchID>'
--   ORDER BY p."deliveredAt";
-- Expect one row per stop, each with exactly one of branchID and pickupID set,
-- and deliveredAt populated rather than null.
