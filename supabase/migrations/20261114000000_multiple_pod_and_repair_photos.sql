-- More than one photo per proof of delivery, and per maintenance phase.
--
-- WHAT WAS WRONG
--
-- A stop's proof of delivery was one photo. "POD" holds the photo (proof) and
-- everything known about it - its fingerprints, the numbers read off it, where
-- and when it was taken, what the scan found - on the same row as the stop's
-- receiver and the office's review. A receipt that runs to two pages, or a
-- client who hands over a delivery receipt and a separate release slip, could
-- not be recorded.
--
-- A maintenance log took one photo per phase. "LogPhotos" is already a row per
-- photo; only the code kept it to one per phase.
--
-- WHAT THIS DOES
--
-- "PODPhotos": one row per photo of a stop's proof, in the order taken. Every
-- photo is a receipt page and goes through the same scan check as the first,
-- so each carries its own fingerprints, numbers, capture and result.
--
-- "POD" keeps its columns, and is still one row per stop. proof, fileType and
-- the scan columns hold the FIRST photo, so the screens and counts that read
-- them (performance, tracking, reports) keep working. validationStatus is the
-- worst of the stop's photos, and the review stays one decision per stop. A
-- proof recorded by the office or a partner writes no PODPhotos rows; readers
-- fall back to POD.proof when a proof has none.
--
-- "LogPhotos" gets a position within its phase, and at most one photo in each
-- position. Existing photos are photo 1 of their phase.
--
-- Existing proofs are copied into PODPhotos as their photo 1, so the "already
-- used" check, which now looks there, still sees every photo taken so far.
--
-- APPLY THIS BEFORE DEPLOYING the code that writes PODPhotos: the crew's stop
-- update and the screens read and write it, and fail without it.
--
-- Safe to run twice.

BEGIN;

-- PODPhotos.podID has to be the same type as POD.podID, which is not written
-- down in this repository; it is read off the table.
DO $$
DECLARE
  pod_id_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO pod_id_type
  FROM pg_attribute a
  WHERE a.attrelid = '"POD"'::regclass AND a.attname = 'podID' AND NOT a.attisdropped;

  IF to_regclass('"PODPhotos"') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE "PODPhotos" (
        "photoID"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "podID"            %s NOT NULL REFERENCES "POD" ("podID") ON DELETE CASCADE,
        "position"         smallint NOT NULL,
        -- The object in the delivery_proofs bucket, never a public URL.
        "path"             text NOT NULL,
        "fileType"         text,
        "scanMethod"       text,
        "capturedAt"       timestamptz,
        "captureLat"       double precision,
        "captureLng"       double precision,
        "imageHash"        text,
        "imageDHash"       text,
        "docNumbers"       text,
        "validationStatus" text,
        "validationNotes"  text,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pod_photos_position_check CHECK ("position" >= 1),
        CONSTRAINT pod_photos_validation_status_check
          CHECK ("validationStatus" IS NULL OR "validationStatus" IN ('passed', 'failed', 'unverified'))
      )
    $f$, pod_id_type);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS pod_photos_pod_position_idx ON "PODPhotos" ("podID", "position");
-- Looked up on every scanned stop, like POD's own.
CREATE INDEX IF NOT EXISTS pod_photos_image_hash_idx ON "PODPhotos" ("imageHash");

-- Reads and writes go through server routes with the service-role key. With
-- RLS on and no policies, the anon key shipped to browsers gets nothing.
ALTER TABLE "PODPhotos" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "PODPhotos" IS
  'Each photo of a stop''s proof of delivery, in order. POD.proof is photo 1. A proof with no rows here (office or partner uploads) has only POD.proof.';
COMMENT ON COLUMN "PODPhotos"."validationStatus" IS
  'What the receipt scan found on this photo: passed or unverified. POD.validationStatus is the worst of a proof''s photos.';

-- Every proof already on file becomes photo 1 of its stop.
INSERT INTO "PODPhotos" (
  "podID", "position", "path", "fileType", "scanMethod", "capturedAt", "captureLat", "captureLng",
  "imageHash", "imageDHash", "docNumbers", "validationStatus", "validationNotes", "created_at"
)
SELECT
  p."podID", 1, p."proof", p."fileType", p."scanMethod", p."capturedAt", p."captureLat", p."captureLng",
  p."imageHash", p."imageDHash", p."docNumbers", p."validationStatus", p."validationNotes",
  coalesce(p."deliveredAt", now())
FROM "POD" p
WHERE p."proof" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "PODPhotos" ph WHERE ph."podID" = p."podID");


-- Maintenance photos: an order within each phase.
ALTER TABLE "LogPhotos" ADD COLUMN IF NOT EXISTS "position" smallint NOT NULL DEFAULT 1;

-- A unique rule on (logID, phase) alone would refuse a second photo. None is
-- in this repository's migrations, but one may have been made by hand; any
-- such constraint or index is dropped here.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = '"LogPhotos"'::regclass
      AND c.contype = 'u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
           FROM pg_attribute a
           WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)) = ARRAY['logID', 'phase']
  LOOP
    EXECUTE format('ALTER TABLE "LogPhotos" DROP CONSTRAINT %I', rec.conname);
  END LOOP;

  FOR rec IN
    SELECT i.indexrelid::regclass::text AS index_name
    FROM pg_index i
    WHERE i.indrelid = '"LogPhotos"'::regclass
      AND i.indisunique
      AND NOT i.indisprimary
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
           FROM pg_attribute a
           WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)) = ARRAY['logID', 'phase']
  LOOP
    EXECUTE format('DROP INDEX %s', rec.index_name);
  END LOOP;
END $$;

-- Two photos already in one phase of one log (there should be none) would
-- stop the unique index below; they are numbered in the order they were saved.
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY "logID", phase ORDER BY created_at NULLS FIRST, id) AS n
  FROM "LogPhotos"
)
UPDATE "LogPhotos" lp
SET "position" = numbered.n
FROM numbered
WHERE lp.id = numbered.id AND lp."position" <> numbered.n;

CREATE UNIQUE INDEX IF NOT EXISTS log_photos_phase_position_idx ON "LogPhotos" ("logID", phase, "position");

COMMENT ON COLUMN "LogPhotos"."position" IS
  'Order of the photo within its phase of the log, from 1.';

COMMIT;

-- AFTERWARDS
--
-- The table is there and every proof with a photo has its photo 1 (expect the
-- two counts to match):
--   SELECT count(*) FROM "POD" WHERE "proof" IS NOT NULL;
--   SELECT count(*) FROM "PODPhotos" WHERE "position" = 1;
--
-- RLS is on:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'PODPhotos';
--
-- LogPhotos has the column and nothing left that allows only one per phase:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'LogPhotos' AND column_name = 'position';
--   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'LogPhotos';
--
-- Once a stop has been closed with several photos on the new code:
--   SELECT ph."podID", ph."position", ph."scanMethod", ph."validationStatus", ph."validationNotes"
--   FROM "PODPhotos" ph JOIN "POD" p USING ("podID")
--   WHERE p."dispatchID" = '<a dispatchID>'
--   ORDER BY p."deliveredAt", ph."position";
