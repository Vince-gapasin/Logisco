-- Deleting a truck must not delete its Maintenance rows.
--
-- WHY
--
-- Maintenance."truckID" was ON DELETE CASCADE: deleting a truck would delete
-- every Maintenance row written against it. The table is empty today - the
-- mechanic's work is recorded in HistoryLogsM - but a cascade on a history
-- table is a trap for whoever writes to it next. The other tables pointing at
-- Truck (HistoryLogsM, DispatchOrder, FoulTripIncident) already SET NULL.
--
-- WHAT
--
-- The foreign key becomes ON DELETE SET NULL, like the others. Safe to run
-- twice; no code depends on it.

BEGIN;

ALTER TABLE "Maintenance" DROP CONSTRAINT IF EXISTS "Maintenance_truckID_fkey";

ALTER TABLE "Maintenance"
  ADD CONSTRAINT "Maintenance_truckID_fkey"
  FOREIGN KEY ("truckID") REFERENCES "Truck" ("truckID") ON DELETE SET NULL;

COMMIT;

-- AFTERWARDS
--
-- No table deletes its rows with a truck any more (expect every confdeltype = 'n'):
--   SELECT conrelid::regclass AS "table", conname, confdeltype
--   FROM pg_constraint WHERE contype = 'f' AND confrelid = '"Truck"'::regclass;
