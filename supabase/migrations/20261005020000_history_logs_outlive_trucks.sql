-- Let a truck's maintenance history outlive the truck.
--
-- WHY
--
-- Trucks are going to be deletable, not only disabled. A maintenance log knew
-- its truck only through HistoryLogsM."truckID", and read the plate and type
-- off the Truck row each time it was shown. Once the Truck row is gone the log
-- either goes with it (if the foreign key cascades), blocks the delete (if it
-- restricts), or survives with nothing to say whose repair it was.
--
-- WHAT
--
-- 1. Each log keeps the plate number and truck type it was written against,
--    filled in from the truck on insert and backfilled for the logs already
--    there. The screens prefer the live Truck row while it exists, so a
--    corrected plate still shows corrected; the copy is what is left after.
-- 2. The foreign key becomes ON DELETE SET NULL, whatever it was before:
--    deleting a truck clears "truckID" on its logs and leaves the logs, their
--    mechanics, notes and photos where they are.
--
-- Safe to run twice. Run it BEFORE deploying the code that reads the new
-- columns - the history list selects them and fails without them.

BEGIN;

ALTER TABLE "HistoryLogsM"
  ADD COLUMN IF NOT EXISTS "plateNumber" text,
  ADD COLUMN IF NOT EXISTS "truckType"   text;

UPDATE "HistoryLogsM" h
SET "plateNumber" = t."plateNumber",
    "truckType"   = t."truckType"
FROM "Truck" t
WHERE t."truckID" = h."truckID"
  AND (h."plateNumber" IS NULL OR h."truckType" IS NULL);

-- New logs copy their truck's plate and type as they are written.
CREATE OR REPLACE FUNCTION history_log_copy_truck() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."truckID" IS NOT NULL AND (NEW."plateNumber" IS NULL OR NEW."truckType" IS NULL) THEN
    SELECT COALESCE(NEW."plateNumber", t."plateNumber"),
           COALESCE(NEW."truckType", t."truckType")
    INTO NEW."plateNumber", NEW."truckType"
    FROM "Truck" t
    WHERE t."truckID" = NEW."truckID";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS history_log_copy_truck ON "HistoryLogsM";
CREATE TRIGGER history_log_copy_truck
  BEFORE INSERT ON "HistoryLogsM"
  FOR EACH ROW EXECUTE FUNCTION history_log_copy_truck();

-- Replace whatever foreign key "truckID" has with one that lets go.
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT conname FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = '"HistoryLogsM"'::regclass
      AND confrelid = '"Truck"'::regclass
  LOOP
    EXECUTE format('ALTER TABLE "HistoryLogsM" DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END;
$$;

ALTER TABLE "HistoryLogsM"
  ADD CONSTRAINT "HistoryLogsM_truckID_fkey"
  FOREIGN KEY ("truckID") REFERENCES "Truck" ("truckID") ON DELETE SET NULL;

COMMIT;

-- AFTERWARDS
--
-- Every log has a plate (expect 0):
--   SELECT count(*) FROM "HistoryLogsM" WHERE "plateNumber" IS NULL;
--
-- The foreign key lets go (expect confdeltype = 'n', i.e. SET NULL):
--   SELECT conname, confdeltype FROM pg_constraint
--   WHERE conrelid = '"HistoryLogsM"'::regclass AND contype = 'f';
