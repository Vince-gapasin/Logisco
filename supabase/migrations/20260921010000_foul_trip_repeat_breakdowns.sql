-- A trip can break down more than once.
--
-- FoulTripIncident.dispatchID was UNIQUE - one incident per trip. But a
-- roadside repair resumes the SAME trip, so a truck that is fixed and then
-- breaks down again produces a second incident for that trip. The report
-- route upserted on dispatchID, which therefore updated the first, already
-- resolved incident instead of creating a new one: the status stayed
-- "resolved", so the booking disappeared from the foul-trip screen, and the
-- first breakdown's reason and details were overwritten with the second's.
--
-- The rule that actually holds is weaker: at most one OPEN incident per trip.
--
-- This also repairs any trip already hit: a trip that is in "Foul Trip"
-- again, whose latest incident was resolved as repaired on site, and which has
-- no open incident. The emergency route writes a Reports row for every
-- report, and that row still holds the reason, details and time the upsert
-- destroyed.

BEGIN;

-- 1. Drop the one-incident-per-trip rule, whatever the constraint is named.
DO $$
DECLARE
  con text;
BEGIN
  SELECT c.conname INTO con
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.conrelid = '"FoulTripIncident"'::regclass
    AND c.contype = 'u'
    AND a.attname = 'dispatchID'
    AND array_length(c.conkey, 1) = 1;
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "FoulTripIncident" DROP CONSTRAINT %I', con);
  END IF;
END $$;

-- 2. The rule that does hold: one open incident per trip at a time.
CREATE UNIQUE INDEX IF NOT EXISTS foultrip_one_open_per_dispatch
  ON "FoulTripIncident" ("dispatchID")
  WHERE "status" IN ('open', 'mechanic_assigned');

CREATE INDEX IF NOT EXISTS foultrip_dispatch_idx ON "FoulTripIncident" ("dispatchID");

-- 3. Repair trips already affected.
WITH affected AS (
  SELECT DISTINCT ON (i."dispatchID")
    i."incidentID", i."dispatchID", i."orderID", i."truckID", i."reportedBy",
    i."reportedAt", i."resolvedAt", i."latitude", i."longitude", i."photoPath",
    i."dispatchStatusBefore", d."pickupCompletedAt"
  FROM "FoulTripIncident" i
  JOIN "DispatchOrder" d ON d."dispatchID" = i."dispatchID"
  WHERE d."status" = 'Foul Trip'
    AND i."resolution" = 'repaired_on_site'
    AND NOT EXISTS (
      SELECT 1 FROM "FoulTripIncident" o
      WHERE o."dispatchID" = i."dispatchID" AND o."status" IN ('open', 'mechanic_assigned')
    )
  ORDER BY i."dispatchID", i."reportedAt" DESC
),
first_report AS (
  -- The report that opened the repaired incident: the one nearest its time.
  SELECT DISTINCT ON (a."incidentID")
    a."incidentID",
    substring(r."finalRemarks" FROM 'Type: ([^\n]*)') AS issue_type,
    NULLIF(substring(r."finalRemarks" FROM 'Details: ([^\n]*)'), 'None provided') AS details
  FROM affected a
  JOIN "Reports" r ON r."dispatchID" = a."dispatchID" AND r."status" = 'Foul Trip'
  ORDER BY a."incidentID", abs(extract(epoch FROM r."generatedAt" - a."reportedAt"))
),
restored AS (
  UPDATE "FoulTripIncident" i
  SET
    "issueType" = COALESCE(f.issue_type, i."issueType"),
    "details" = f.details,
    -- The photo and position on this row belong to the later report now;
    -- they move to the new incident below.
    "photoPath" = NULL,
    "resolutionNotes" = concat_ws(' ', i."resolutionNotes",
      'Position shown is from the next breakdown report; the original was overwritten before incidents could repeat.')
  FROM first_report f
  WHERE i."incidentID" = f."incidentID"
  RETURNING i."incidentID"
),
second_report AS (
  -- The report made after the repair.
  SELECT DISTINCT ON (a."incidentID")
    a.*,
    r."generatedAt",
    substring(r."finalRemarks" FROM 'Type: ([^\n]*)') AS issue_type,
    NULLIF(substring(r."finalRemarks" FROM 'Details: ([^\n]*)'), 'None provided') AS details,
    substring(r."finalRemarks" FROM 'Reported by: ([^\n]*)') AS reporter_name
  FROM affected a
  JOIN "Reports" r ON r."dispatchID" = a."dispatchID" AND r."status" = 'Foul Trip'
  WHERE r."generatedAt" > a."resolvedAt"
  ORDER BY a."incidentID", r."generatedAt" DESC
)
INSERT INTO "FoulTripIncident" (
  "dispatchID", "orderID", "truckID", "reportedBy", "reportedAt",
  "issueType", "details", "photoPath", "latitude", "longitude",
  "dispatchStatusBefore", "cargoLoaded", "status"
)
SELECT
  s."dispatchID", s."orderID", s."truckID",
  COALESCE((SELECT e."employeeID" FROM "Employee" e WHERE e."employeeName" = s.reporter_name LIMIT 1), s."reportedBy"),
  s."generatedAt",
  COALESCE(s.issue_type, 'Reason not recorded'),
  s.details,
  s."photoPath",
  s."latitude",
  s."longitude",
  s."dispatchStatusBefore",
  s."pickupCompletedAt" IS NOT NULL,
  'open'
FROM second_report s
WHERE EXISTS (SELECT 1 FROM restored);

COMMIT;

-- AFTERWARDS
--   SELECT "dispatchID", "status", "resolution", "issueType", "details", "reportedAt"
--   FROM "FoulTripIncident" WHERE "resolution" IS DISTINCT FROM 'historical'
--   ORDER BY "dispatchID", "reportedAt";
-- The repaired trip shows two rows: the first breakdown, resolved as repaired
-- on site, and the second, open.
