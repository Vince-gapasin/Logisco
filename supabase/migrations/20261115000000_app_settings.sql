-- Switches the office can flip without a redeploy: first, whether the photo
-- checks refuse a photo or only note what is wrong with it.
--
-- WHY
--
-- The receipt scan on the crew's phone and the photo check on the mechanic's
-- refuse a photo outright when it falls short: no signature, the name not on
-- the paper, a photo used before, too old. Real forms do not always pass, and
-- a crew held at a gate by a scan is worse than a proof the office looks at
-- afterwards. Each check now has a mode:
--
--   strict   as before: a photo that falls short is refused
--   relaxed  every photo is accepted; what would have refused it is written
--            on it as a note, and it is saved as "unverified", so a receipt
--            goes to Proof Review and a maintenance photo shows Needs review
--
--   podReceiptCheck   the crew's proof-of-delivery receipt scan
--   repairPhotoCheck  the mechanic's maintenance photo check
--
-- The app reads a missing table, a missing row or a failed read as strict, so
-- this can be applied before or after the code that reads it.
--
-- Safe to run twice.

BEGIN;

CREATE TABLE IF NOT EXISTS "AppSettings" (
  "key"       text PRIMARY KEY,
  "value"     jsonb NOT NULL,
  "updatedBy" uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_photo_check_mode_check') THEN
    ALTER TABLE "AppSettings" ADD CONSTRAINT app_settings_photo_check_mode_check
      CHECK ("key" NOT IN ('podReceiptCheck', 'repairPhotoCheck') OR "value" IN ('"strict"'::jsonb, '"relaxed"'::jsonb));
  END IF;
END $$;

-- Reads and writes go through server routes with the service-role key. With
-- RLS on and no policies, the anon key shipped to browsers gets nothing.
ALTER TABLE "AppSettings" ENABLE ROW LEVEL SECURITY;

INSERT INTO "AppSettings" ("key", "value") VALUES
  ('podReceiptCheck', '"strict"'::jsonb),
  ('repairPhotoCheck', '"strict"'::jsonb)
ON CONFLICT ("key") DO NOTHING;

COMMENT ON TABLE "AppSettings" IS
  'Switches the office changes from the app. podReceiptCheck / repairPhotoCheck: "strict" refuses a photo that fails its check, "relaxed" accepts it and notes why.';

COMMIT;

-- AFTERWARDS
--
-- The two switches, both strict:
--   SELECT "key", "value", "updatedBy", "updatedAt" FROM "AppSettings" ORDER BY "key";
--
-- RLS is on:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'AppSettings';
--
-- Who changed a switch, and when, is also in the audit trail:
--   SELECT "timestamp", "action", "newData" FROM "AuditTrail"
--   WHERE "tableName" = 'AppSettings' ORDER BY "timestamp" DESC LIMIT 10;
