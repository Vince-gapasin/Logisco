-- Foul trip incidents: what went wrong, and what was done about it.
--
-- Until now a foul trip was only a status on DispatchOrder plus a line of text
-- in its note. There was no time it happened (0 of 124 had one), no photo, no
-- place, and - because the admin recovery screen made no server calls - no way
-- to resolve one. All 124 on record were still open, the oldest for 1,722
-- days.
--
-- One row per failed trip. The dispatch keeps its "Foul Trip" status as the
-- historical fact; this row carries the lifecycle:
--
--   open               reported, waiting for dispatch to act
--   mechanic_assigned  a mechanic is on the way to the truck
--   resolved           recovered: re-assigned, rescheduled, sub-contracted,
--                      repaired on site, or the booking cancelled
--   closed             handled outside the system, or historical
--
-- Apply BEFORE deploying the code that reads it: the foul-trip screen lists
-- open incidents from this table.

BEGIN;

CREATE TABLE IF NOT EXISTS "FoulTripIncident" (
  "incidentID"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dispatchID"            uuid NOT NULL UNIQUE REFERENCES "DispatchOrder" ("dispatchID") ON DELETE CASCADE,
  "orderID"               uuid NOT NULL REFERENCES "Order" ("orderID") ON DELETE CASCADE,
  "truckID"               uuid REFERENCES "Truck" ("truckID") ON DELETE SET NULL,
  "reportedBy"            uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  "reportedAt"            timestamptz NOT NULL DEFAULT now(),

  -- What happened
  "issueType"             text NOT NULL,
  "details"               text,
  "photoPath"             text,
  "latitude"              double precision,
  "longitude"             double precision,
  -- Where the trip stood, so an on-site repair can put it back exactly.
  "dispatchStatusBefore"  text,
  "cargoLoaded"           boolean NOT NULL DEFAULT false,

  "status"                text NOT NULL DEFAULT 'open'
    CHECK ("status" IN ('open', 'mechanic_assigned', 'resolved', 'closed')),

  -- Roadside repair
  "severity"              text CHECK ("severity" IN ('minor', 'major')),
  "mechanicID"            uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  "mechanicAssignedAt"    timestamptz,
  "mechanicOutcome"       text CHECK ("mechanicOutcome" IN ('fixed', 'not_fixable')),
  "mechanicNotes"         text,
  "mechanicRespondedAt"   timestamptz,

  -- Resolution
  "resolution"            text CHECK ("resolution" IN (
                            'reassigned', 'rescheduled', 'subcontracted',
                            'repaired_on_site', 'cancelled', 'closed', 'historical')),
  "resolutionNotes"       text,
  "resolvedAt"            timestamptz,
  "resolvedBy"            uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  "newDispatchID"         uuid REFERENCES "DispatchOrder" ("dispatchID") ON DELETE SET NULL,

  CONSTRAINT foultrip_resolved_has_resolution
    CHECK ("status" NOT IN ('resolved', 'closed') OR "resolution" IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS foultrip_status_idx   ON "FoulTripIncident" ("status");
CREATE INDEX IF NOT EXISTS foultrip_order_idx    ON "FoulTripIncident" ("orderID");
CREATE INDEX IF NOT EXISTS foultrip_mechanic_idx ON "FoulTripIncident" ("mechanicID") WHERE "status" = 'mechanic_assigned';

ALTER TABLE "FoulTripIncident" ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Backfill the 124 foul trips already on record
-- ----------------------------------------------------------------------------
-- Only a report made through the crew app carries an "EMERGENCY [type]" line;
-- the rest are older records whose reason reads "Foul trip recorded". The
-- reported time comes from the Reports row the crew app writes, the only
-- place it was ever stored.
--
-- An incident stays open only if it is real - reported through the app with
-- a reason - and recent, within 60 days. Everything else is closed as
-- historical, so the open list shows problems someone can still act on.

INSERT INTO "FoulTripIncident" (
  "dispatchID", "orderID", "truckID", "reportedBy", "reportedAt",
  "issueType", "details", "dispatchStatusBefore", "cargoLoaded",
  "status", "resolution", "resolutionNotes", "resolvedAt"
)
SELECT
  d."dispatchID",
  d."orderID",
  d."truckID",
  d."driverID",
  COALESCE(r.first_report, o."createdAt", now()),
  COALESCE(substring(d."dispatchNote" FROM 'EMERGENCY \[([^\]]+)\]'), 'Reason not recorded'),
  substring(d."dispatchNote" FROM 'EMERGENCY \[[^\]]+\][^:]*:[ ]*([^\n]*)'),
  'In Transit',
  d."pickupCompletedAt" IS NOT NULL,
  CASE WHEN real_and_recent THEN 'open' ELSE 'closed' END,
  CASE WHEN real_and_recent THEN NULL ELSE 'historical' END,
  CASE WHEN real_and_recent THEN NULL
       ELSE 'Closed when incident tracking was introduced: older than 60 days or no reason recorded.' END,
  CASE WHEN real_and_recent THEN NULL ELSE now() END
FROM "DispatchOrder" d
JOIN "Order" o ON o."orderID" = d."orderID"
LEFT JOIN LATERAL (
  SELECT min(rep."generatedAt") AS first_report
  FROM "Reports" rep
  WHERE rep."dispatchID" = d."dispatchID" AND rep."status" = 'Foul Trip'
) r ON true
CROSS JOIN LATERAL (
  SELECT (
    d."dispatchNote" ~ 'EMERGENCY \['
    AND COALESCE(r.first_report, o."createdAt") > now() - interval '60 days'
  ) AS real_and_recent
) flags
WHERE d."status" = 'Foul Trip'
ON CONFLICT ("dispatchID") DO NOTHING;

COMMIT;

-- AFTERWARDS
--   SELECT "status", "resolution", count(*) FROM "FoulTripIncident"
--   GROUP BY 1, 2 ORDER BY 1, 2;
-- Expect 124 rows: one open (the Broken Truck reported through the app) and
-- 123 closed as historical.
