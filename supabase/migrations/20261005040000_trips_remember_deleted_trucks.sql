-- When a truck is deleted, its trips and breakdowns remember which truck it was.
--
-- WHY
--
-- DispatchOrder and FoulTripIncident point at Truck with ON DELETE SET NULL,
-- so deleting a truck keeps the trips and incidents but forgets the truck:
-- booking history, client tracking, the crew's delivery history and the foul
-- trip screens would show no plate for a delivery that had one.
--
-- WHAT
--
-- 1. DispatchOrder and FoulTripIncident get formerTruckPlate, formerTruckModel
--    and formerTruckType. They stay empty while the truck exists - screens
--    read the live Truck row - and are filled the moment it is deleted.
-- 2. A BEFORE DELETE trigger on Truck writes them, and refreshes the plate and
--    type HistoryLogsM already keeps, so a plate corrected after a log was
--    written is the one remembered.
--
-- The copy is taken at delete time, not when a trip is assigned: a trip whose
-- truck is changed or taken off would otherwise go on naming a truck it no
-- longer has.
--
-- Safe to run twice. Run it BEFORE deploying the code that reads the new
-- columns.

BEGIN;

ALTER TABLE "DispatchOrder"
  ADD COLUMN IF NOT EXISTS "formerTruckPlate" text,
  ADD COLUMN IF NOT EXISTS "formerTruckModel" text,
  ADD COLUMN IF NOT EXISTS "formerTruckType"  text;

ALTER TABLE "FoulTripIncident"
  ADD COLUMN IF NOT EXISTS "formerTruckPlate" text,
  ADD COLUMN IF NOT EXISTS "formerTruckModel" text,
  ADD COLUMN IF NOT EXISTS "formerTruckType"  text;

CREATE OR REPLACE FUNCTION truck_remember_on_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "DispatchOrder"
  SET "formerTruckPlate" = OLD."plateNumber",
      "formerTruckModel" = OLD."model",
      "formerTruckType"  = OLD."truckType"
  WHERE "truckID" = OLD."truckID";

  UPDATE "FoulTripIncident"
  SET "formerTruckPlate" = OLD."plateNumber",
      "formerTruckModel" = OLD."model",
      "formerTruckType"  = OLD."truckType"
  WHERE "truckID" = OLD."truckID";

  UPDATE "HistoryLogsM"
  SET "plateNumber" = OLD."plateNumber",
      "truckType"   = OLD."truckType"
  WHERE "truckID" = OLD."truckID";

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS truck_remember_on_delete ON "Truck";
CREATE TRIGGER truck_remember_on_delete
  BEFORE DELETE ON "Truck"
  FOR EACH ROW EXECUTE FUNCTION truck_remember_on_delete();

COMMIT;

-- AFTERWARDS
--
-- The columns are there and empty (expect 0 and 0 - no truck has been deleted yet):
--   SELECT
--     (SELECT count(*) FROM "DispatchOrder"    WHERE "formerTruckPlate" IS NOT NULL) AS trips,
--     (SELECT count(*) FROM "FoulTripIncident" WHERE "formerTruckPlate" IS NOT NULL) AS incidents;
--
-- The trigger is on Truck:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = '"Truck"'::regclass AND NOT tgisinternal;
