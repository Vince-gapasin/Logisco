-- What the photo check found on each maintenance photo.
--
-- WHY
--
-- A maintenance log took any picture at all - and the ones on file show it:
-- every photo attached so far is a screenshot or a test picture. A mechanic's
-- log now needs a photo for each phase it fills, and each is looked at on the
-- mechanic's device before it can be saved (app/lib/repairPhoto.ts): it has to
-- show a truck, a part of one, or the work on it. The server then refuses a
-- photo already used on another log, and a camera photo that is not recent
-- (services/history-logs/repairPhotoCheck.ts).
--
-- WHAT
--
-- Beside each photo in "LogPhotos":
--   - how and when it was taken ("camera" in the app, "file" from a computer);
--   - two fingerprints, to recognise it if it comes back: the exact file
--     (sha256) and the picture (a 64-bit difference hash);
--   - the check's result - "passed", or "unverified" when something could not
--     be checked (chosen from a file, or the device could not run the model) -
--     and what the model saw, for the office.
--
-- Photos already on file get none of this; their columns stay NULL and the
-- screens show them as from before the check.
--
-- APPLY THIS BEFORE DEPLOYING the code that writes these columns: the history
-- list selects them, and saving a log writes them, so both fail without it.
--
-- Safe to run twice.

BEGIN;

ALTER TABLE "LogPhotos"
  ADD COLUMN IF NOT EXISTS "captureMethod" text,
  ADD COLUMN IF NOT EXISTS "capturedAt"    timestamptz,
  ADD COLUMN IF NOT EXISTS "imageHash"     text,
  ADD COLUMN IF NOT EXISTS "imageDHash"    text,
  ADD COLUMN IF NOT EXISTS "checkStatus"   text,
  ADD COLUMN IF NOT EXISTS "checkLabels"   jsonb;

ALTER TABLE "LogPhotos" DROP CONSTRAINT IF EXISTS "LogPhotos_checkStatus_check";
ALTER TABLE "LogPhotos"
  ADD CONSTRAINT "LogPhotos_checkStatus_check"
  CHECK ("checkStatus" IS NULL OR "checkStatus" IN ('passed', 'unverified'));

-- Looked up on every photo saved.
CREATE INDEX IF NOT EXISTS log_photos_image_hash_idx ON "LogPhotos" ("imageHash");
CREATE INDEX IF NOT EXISTS log_photos_captured_at_idx ON "LogPhotos" ("capturedAt" DESC) WHERE "imageDHash" IS NOT NULL;

COMMENT ON COLUMN "LogPhotos"."checkStatus" IS
  'Result of the maintenance photo check: passed, or unverified (chosen from a file, or the device could not check it). NULL for photos from before the check.';

COMMIT;

-- AFTERWARDS
--
-- The columns are there (expect 6 rows):
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'LogPhotos'
--     AND column_name IN ('captureMethod', 'capturedAt', 'imageHash', 'imageDHash', 'checkStatus', 'checkLabels');
--
-- Photos saved since, and what the check found:
--   SELECT "logID", phase, "captureMethod", "capturedAt", "checkStatus", "checkLabels"
--   FROM "LogPhotos" WHERE "checkStatus" IS NOT NULL ORDER BY "capturedAt" DESC LIMIT 20;
