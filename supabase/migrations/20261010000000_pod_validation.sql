-- What the receipt check found on each proof of delivery.
--
-- WHAT WAS WRONG
--
-- A stop closed on any photograph at all. The crew app asked for one, the
-- server did not, and nothing looked at what was in it - so a picture of a gate
-- and a signed delivery receipt were the same record. The office found out
-- which it was when a customer disputed the delivery.
--
-- The crew's photograph is now read before the stop is closed (services/
-- storage/podValidation.ts): is it a delivery receipt, is it signed, can the
-- receiver's name be read. A photograph that fails is refused and the crew
-- retake it, so "failed" rows are not expected; the value is allowed so a
-- reading can be recorded honestly if that ever changes.
--
--   passed      the receipt was read and has a signature and a name
--   unverified  the check could not run (no key, API down); the office is told
--   failed      the receipt fell short
--   NULL        recorded before this check existed, or by the office path
--
-- WHAT THIS DOES NOT DO
--
-- It does not re-check old proofs. They stay NULL and the screens call them
-- "Not checked", which is the truth.

BEGIN;

ALTER TABLE "POD"
  ADD COLUMN IF NOT EXISTS "validationStatus" text,
  ADD COLUMN IF NOT EXISTS "validationNotes" text,
  ADD COLUMN IF NOT EXISTS "nameOnReceipt" text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pod_validation_status_check') THEN
    ALTER TABLE "POD" ADD CONSTRAINT pod_validation_status_check
      CHECK ("validationStatus" IS NULL OR "validationStatus" IN ('passed', 'failed', 'unverified'));
  END IF;
END $$;

COMMENT ON COLUMN "POD"."validationStatus" IS
  'Result of the automatic receipt check: passed, unverified (check could not run) or failed. NULL for proofs recorded before the check or by the office.';
COMMENT ON COLUMN "POD"."validationNotes" IS
  'Why the check did not pass, as shown to the crew and the office.';
COMMENT ON COLUMN "POD"."nameOnReceipt" IS
  'The receiver name as read off the receipt photo, for comparing with the name the crew typed.';

COMMIT;

-- AFTERWARDS
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'POD' AND column_name IN ('validationStatus', 'validationNotes', 'nameOnReceipt');
--
-- Once a delivery has run on the new code:
--   SELECT "podID", "receiverName", "nameOnReceipt", "validationStatus", "validationNotes"
--   FROM "POD" WHERE "dispatchID" = '<a dispatchID>' ORDER BY "deliveredAt";
