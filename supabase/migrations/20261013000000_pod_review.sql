-- The office's decision on a proof of delivery the scan could not fully check.
--
-- WHAT WAS WRONG
--
-- A stop that closed with something the scan could not check - an app without
-- the scanner, mostly - was marked "Needs review" and the office was sent a
-- notification. The notification opened the live map. Nothing anywhere let the
-- office look at the proof and say whether it was good, so "Needs review" was a
-- label with no way to act on it, and it stayed on the proof for good.
--
-- The Proof Review screen (/admindashboard/proof-review) lists those proofs and
-- records the decision here: who looked, when, what they decided, and - for a
-- rejection - why.
--
--   reviewStatus  NULL       not reviewed (or never needed it)
--                 approved   the office looked and the proof stands
--                 rejected   the office looked and it does not; hidden from the
--                            client's tracking page until a good copy replaces it
--
-- validationStatus is left as the scan found it. The review is a second fact,
-- not a correction of the first.

BEGIN;

ALTER TABLE "POD"
  ADD COLUMN IF NOT EXISTS "reviewStatus" text,
  ADD COLUMN IF NOT EXISTS "reviewedBy" uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "reviewedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "reviewNote" text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pod_review_status_check') THEN
    ALTER TABLE "POD" ADD CONSTRAINT pod_review_status_check
      CHECK ("reviewStatus" IS NULL OR "reviewStatus" IN ('approved', 'rejected'));
  END IF;
  -- A rejection says why; the crew and the client's account manager will ask.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pod_review_reject_note_check') THEN
    ALTER TABLE "POD" ADD CONSTRAINT pod_review_reject_note_check
      CHECK ("reviewStatus" IS DISTINCT FROM 'rejected' OR coalesce(trim("reviewNote"), '') <> '');
  END IF;
END $$;

-- The review queue: proofs that need a look and have not had one.
CREATE INDEX IF NOT EXISTS pod_review_queue_idx
  ON "POD" ("deliveredAt" DESC)
  WHERE "validationStatus" = 'unverified' AND "reviewStatus" IS NULL;

COMMENT ON COLUMN "POD"."reviewStatus" IS
  'The office''s decision on a proof marked Needs review: approved or rejected. NULL when not reviewed.';
COMMENT ON COLUMN "POD"."reviewNote" IS
  'Why it was rejected (required), or anything the reviewer noted on approving.';

COMMIT;

-- AFTERWARDS
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'POD' AND column_name IN ('reviewStatus', 'reviewedBy', 'reviewedAt', 'reviewNote');
--
-- How many are waiting:
--   SELECT count(*) FROM "POD" WHERE "validationStatus" = 'unverified' AND "reviewStatus" IS NULL;
