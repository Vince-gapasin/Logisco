-- What the receipt scan found on each proof of delivery, and where and when it
-- was taken.
--
-- WHAT WAS WRONG
--
-- A stop closed on any photograph at all. The crew app asked for one, the
-- server did not, and nothing looked at what was in it - so a picture of a gate
-- and a signed delivery receipt were the same record. The office found out
-- which it was when a customer disputed the delivery.
--
-- The crew's receipt is now scanned and checked before the stop closes (app/
-- lib/podScan.ts on the phone, services/storage/podScanCheck.ts on the server):
-- a readable document, a signature where the form asks for one, taken at the
-- stop, after arrival, and not used before. A scan that fails is refused and
-- the crew rescan, so "failed" rows are not expected; the value is allowed so a
-- result can be recorded honestly if that ever changes.
--
--   passed      every check ran and found nothing wrong
--   unverified  the stop closed but something could not be checked; the office is told
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
  -- "scanner" (the live document scanner) or "camera" (an app without it).
  ADD COLUMN IF NOT EXISTS "scanMethod" text,
  -- The phone's own time and place at the moment of the scan.
  ADD COLUMN IF NOT EXISTS "capturedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "captureLat" double precision,
  ADD COLUMN IF NOT EXISTS "captureLng" double precision,
  -- The exact file, and a fingerprint of the picture that survives re-saving,
  -- so one receipt photo cannot be the proof for two stops.
  ADD COLUMN IF NOT EXISTS "imageHash" text,
  ADD COLUMN IF NOT EXISTS "imageDHash" text;

-- Looked up on every scanned stop.
CREATE INDEX IF NOT EXISTS pod_image_hash_idx ON "POD" ("imageHash");
CREATE INDEX IF NOT EXISTS pod_recorded_by_idx ON "POD" ("recordedBy", "deliveredAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pod_validation_status_check') THEN
    ALTER TABLE "POD" ADD CONSTRAINT pod_validation_status_check
      CHECK ("validationStatus" IS NULL OR "validationStatus" IN ('passed', 'failed', 'unverified'));
  END IF;
END $$;

COMMENT ON COLUMN "POD"."validationStatus" IS
  'Result of the receipt scan check: passed, unverified (something could not be checked) or failed. NULL for proofs recorded before the check or by the office.';
COMMENT ON COLUMN "POD"."validationNotes" IS
  'Why the check did not pass, as shown to the crew and the office.';

COMMIT;

-- AFTERWARDS
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'POD' AND column_name IN ('validationStatus', 'validationNotes', 'scanMethod', 'capturedAt', 'captureLat', 'captureLng', 'imageHash', 'imageDHash');
--
-- Once a delivery has run on the new code:
--   SELECT "podID", "receiverName", "scanMethod", "capturedAt", "captureLat", "captureLng", "validationStatus", "validationNotes"
--   FROM "POD" WHERE "dispatchID" = '<a dispatchID>' ORDER BY "deliveredAt";
