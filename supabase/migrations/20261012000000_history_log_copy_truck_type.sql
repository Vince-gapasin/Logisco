-- Maintenance logs can be written again.
--
-- WHY
--
-- 20261005020000_history_logs_outlive_trucks added a trigger that copies a
-- truck's plate and type onto each new maintenance log. It did so with
-- COALESCE(NEW."truckType", t."truckType"): the log's column is text, the
-- truck's is the truck_type enum, and COALESCE will not mix the two. Every
-- insert into "HistoryLogsM" since has failed with
--
--   COALESCE types text and truck_type cannot be matched
--
-- - the mechanic's inspection, update and final logs, the log the office's
-- override opens, and the roadside verdict. The newest log in the table is
-- from 2026-10-05 04:27 UTC, the day it was applied.
--
-- WHAT
--
-- The truck's type is read as text. Nothing else changes.
--
-- Safe to run twice.

CREATE OR REPLACE FUNCTION history_log_copy_truck() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."truckID" IS NOT NULL AND (NEW."plateNumber" IS NULL OR NEW."truckType" IS NULL) THEN
    SELECT COALESCE(NEW."plateNumber", t."plateNumber"),
           COALESCE(NEW."truckType", t."truckType"::text)
    INTO NEW."plateNumber", NEW."truckType"
    FROM "Truck" t
    WHERE t."truckID" = NEW."truckID";
  END IF;
  RETURN NEW;
END;
$$;

-- AFTERWARDS
--
-- A log can be written (expect one row back, then nothing left behind):
--   BEGIN;
--   INSERT INTO "HistoryLogsM" ("truckID", "date", "statusBefore", "statusAfter")
--   SELECT "truckID", current_date, 'Available', 'Available' FROM "Truck" LIMIT 1
--   RETURNING id, "plateNumber", "truckType";
--   ROLLBACK;
