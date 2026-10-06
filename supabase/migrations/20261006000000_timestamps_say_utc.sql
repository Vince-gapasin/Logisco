-- Timestamps that say they are UTC.
--
-- These columns were "timestamp without time zone". Every value in them is
-- UTC - filled by now() on a database running in UTC, or written by the app
-- as an ISO string ending in Z - but nothing on the value said so. A browser
-- in Manila read a bare 05:09 as 5:09 AM local: a trip started at 1:09 PM
-- told the client it had departed at 5:09 AM.
--
-- AT TIME ZONE 'UTC' keeps every stored moment where it is; only the type
-- changes, and values come back as "2026-10-06 05:09:19+00".
--
-- AuditTrail."timestamp" was converted by hand on 2026-10-06 ahead of this
-- file; the guard skips any column already converted, so the whole file is
-- safe to run as it stands.
--
-- Left alone on purpose:
--   Employee.dateEmployed, licenseExpirationDate, lastMedicalCheckup,
--   Maintenance.maintenanceDate, Truck.lastChecked - calendar days written as
--   "YYYY-MM-DD", for which a zone means nothing.
--   DeliveryTracking - nothing in the app reads or writes it.
--
-- Each column rewrites its table under a lock; run it outside busy hours.

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('AuditTrail',              'timestamp'),
      ('Order',                   'createdAt'),
      ('Reports',                 'generatedAt'),
      ('DispatchInterventionLog', 'timeStamp')
    ) AS t(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = target.table_name
        AND c.column_name = target.column_name
        AND c.data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
        target.table_name, target.column_name, target.column_name
      );
    END IF;
  END LOOP;
END $$;
