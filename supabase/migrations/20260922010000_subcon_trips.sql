-- Sub-contractor trips, updated by the coordinator.
--
-- A partner has no access to the system: they tell the coordinator how the
-- trip is going and send the proof of delivery, and the coordinator records
-- it. Until now a partner trip was a DispatchOrder with no truck and the
-- partner's details written into its note; it could only be closed all at
-- once, with no proof.

BEGIN;

-- 1. Who is carrying the trip, as data rather than a line of the note.
ALTER TABLE "DispatchOrder"
  ADD COLUMN IF NOT EXISTS "subConID" uuid REFERENCES "SubContractor" ("subConID") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "partnerDriver" text,
  ADD COLUMN IF NOT EXISTS "partnerPlate" text,
  ADD COLUMN IF NOT EXISTS "partnerContact" text;

CREATE INDEX IF NOT EXISTS dispatchorder_subcon_idx ON "DispatchOrder" ("subConID") WHERE "subConID" IS NOT NULL;

-- 2. A proof of delivery can now come from the coordinator: a photo or PDF
-- the partner sent, or no file with the reason why.
ALTER TABLE "POD" ALTER COLUMN "proof" DROP NOT NULL;
ALTER TABLE "POD"
  ADD COLUMN IF NOT EXISTS "dispatchID" uuid REFERENCES "DispatchOrder" ("dispatchID") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "deliveredAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "recordedBy" uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'crew',
  ADD COLUMN IF NOT EXISTS "missingReason" text,
  ADD COLUMN IF NOT EXISTS "fileType" text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pod_source_check') THEN
    ALTER TABLE "POD" ADD CONSTRAINT pod_source_check CHECK ("source" IN ('crew', 'coordinator'));
  END IF;
  -- Every proof is a file, or says why there is none.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pod_file_or_reason') THEN
    ALTER TABLE "POD" ADD CONSTRAINT pod_file_or_reason
      CHECK ("proof" IS NOT NULL OR length(trim(coalesce("missingReason", ''))) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pod_dispatch_idx ON "POD" ("dispatchID");

-- 3. Link past partner trips to their partner where the note names one on file.
UPDATE "DispatchOrder" d
SET "subConID" = s."subConID"
FROM "SubContractor" s
WHERE d."subConID" IS NULL
  AND d."truckID" IS NULL
  AND lower(trim(substring(d."dispatchNote" FROM 'Subcontractor: ([^\n]*)'))) = lower(trim(s."companyName"));

UPDATE "DispatchOrder" d
SET
  "partnerDriver" = coalesce(d."partnerDriver", nullif(trim(substring(d."dispatchNote" FROM 'External Driver: ([^\n]*)')), '')),
  "partnerPlate" = coalesce(d."partnerPlate", nullif(trim(substring(d."dispatchNote" FROM 'Temporary Plate: ([^\n]*)')), '')),
  "partnerContact" = coalesce(d."partnerContact", nullif(trim(substring(d."dispatchNote" FROM 'Driver Contact: ([^\n]*)')), ''))
WHERE d."truckID" IS NULL
  AND d."dispatchNote" LIKE '%Subcontractor:%';

COMMIT;

-- AFTERWARDS
--   SELECT count(*) FILTER (WHERE "subConID" IS NOT NULL) AS linked,
--          count(*) FILTER (WHERE "subConID" IS NULL AND "dispatchNote" LIKE '%Subcontractor:%') AS not_matched
--   FROM "DispatchOrder" WHERE "truckID" IS NULL;
